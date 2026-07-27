#!/usr/bin/env node
/**
 * Strong Coast news refresher — dependency-free, Node 18+.
 * Merges Strong Coast + allied RSS + Google News searches into data/news.json.
 * On any feed failure, previously fetched entries for that category are kept.
 * Run: node tools/refresh-news.mjs
 *
 * EDITORIAL RULES (set July 2026 — see README):
 * 1. Pacific Wild releases are never shown (BLOCKED_SOURCES). We collaborate at
 *    times, but their register targets urban environmentalists and repeated
 *    releases make Strong Coast look like a proxy. Mainstream-media coverage of
 *    the same topics may still appear via the news search — that's fine.
 * 2. Advocacy-org feeds (cat "coalition") are capped at ONE visible item per
 *    organization per refresh (COALITION_CAP) — never a wall of one org's releases.
 * 3. Coalition items must be recognizably coastal/marine (COASTAL_TERMS check
 *    on the title) — general-wildlife or inland releases are skipped.
 * 4. Opponent opinion is never surfaced (OPINION_GENRE + ADVERSARIAL). We report
 *    news; we don't hand the other side's op-eds a platform. This drops opinion/
 *    op-ed/editorial/commentary pieces from the news search AND anything whose
 *    headline argues against the campaign's positions (e.g. "scrap the tanker
 *    ban", "…defies logic"). Applies to media results only. If the team ever
 *    wants to feature a FAVOURABLE column, hand-add it to data/news.json as a
 *    {"cat":"campaign", ...} entry — the refresher preserves campaign entries.
 * Rules 1–3 do not apply to Strong Coast's own posts (cat "campaign"); rule 4
 * applies to media results only (campaign/coalition are trusted voices).
 */
import { readFileSync, writeFileSync } from "node:fs";

const NEWS_PATH = new URL("../data/news.json", import.meta.url);
const RSS_FEEDS = [
  ["campaign", "Strong Coast", "https://strongcoast.org/feed/"],
  ["coalition", "Coastal First Nations", "https://coastalfirstnations.ca/feed/"],
  ["coalition", "West Coast Now", "https://westcoastnow.ca/feed/"],
];
const GNEWS_QUERY = '("Great Bear Sea" OR "tanker ban" OR "bottom trawling" OR "marine protected area" OR "fish farm") "British Columbia"';
const UA = { headers: { "User-Agent": "strongcoast-site/1.0 (+https://github.com/mcallia/strongcoast)" } };

const BLOCKED_SOURCES = [/pacific\s*wild/i];
const BLOCKED_URLS = [/pacificwild\.org/i];
const COALITION_CAP = 1;
const COASTAL_TERMS = /coast|marine|ocean|sea\b|salmon|herring|fish|tanker|mpa|guardian|kelp|trawl|shellfish|whale|orca|estuar|tidal|haida|heiltsuk|nuxalk|kitasoo|gitga|wuikinuxv|gitxaa|bioregion|nmcar|ipca/i;

const blocked = (it) =>
  BLOCKED_SOURCES.some((r) => r.test(it.source || "")) ||
  BLOCKED_URLS.some((r) => r.test(it.url || ""));

// Rule 4 — opponent opinion. Genre tells (title starts with / is tagged Opinion,
// Op-Ed, Editorial, Commentary) plus explicit anti-campaign framings.
const OPINION_GENRE = /(^|[|:–-]\s*)(opinion|op[-\s]?ed|editorial|commentary)\b|\b(opinion|op[-\s]?ed)\s*:/i;
const ADVERSARIAL = [
  /defies?\s+logic/i,
  /\b(scrap|kill|lift|repeal|end|axe|ditch|overturn|drop|nix)\b[^.]{0,40}\btanker ban\b/i,
  /\btanker ban\b[^.]{0,40}\b(makes no sense|must go|has to go|is a mistake|overreach|unnecessary|pointless|should end|nonsense)\b/i,
  /\b(scrap|lift|repeal|kill)\b[^.]{0,30}\b(moratorium|bill c-?48)\b/i,
];
const opponentOpinion = (it) =>
  OPINION_GENRE.test(it.title || "") || ADVERSARIAL.some((r) => r.test(it.title || ""));

const decode = (s = "") => s
  .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, "'")
  .replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ").trim();

function parseRss(xml) {
  return (xml.match(/<item[\s\S]*?<\/item>/g) || []).map((b) => {
    const pick = (t) => { const m = b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? decode(m[1]) : ""; };
    const d = new Date(pick("pubDate"));
    return { title: pick("title"), url: pick("link"), date: isNaN(d) ? "" : d.toISOString().slice(0, 10) };
  }).filter((i) => i.title && i.url);
}

const fetchText = async (u) => { const r = await fetch(u, UA); if (!r.ok) throw new Error(r.status + " " + u); return r.text(); };

// ---- image enrichment (best-effort; every step wrapped so it can never break the feed) ----
const withTimeout = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
const BROWSER_UA = { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36" } };

async function ogImage(url) {
  try {
    const h = await withTimeout(9000, fetch(url, BROWSER_UA).then((r) => r.text()));
    const m = h.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
              h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
              h.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (!m) return null;
    let img = m[1].replace(/&amp;/g, "&");
    if (img.startsWith("//")) img = "https:" + img;
    return /^https?:\/\//.test(img) ? img : null;
  } catch { return null; }
}

// Resolve a Google News RSS link to its real publisher URL (Google batchexecute).
async function resolveGoogleNews(url) {
  try {
    const id = (url.match(/\/articles\/([^?/]+)/) || [])[1];
    if (!id) return null;
    const page = await withTimeout(9000, fetch("https://news.google.com/rss/articles/" + id, BROWSER_UA).then((r) => r.text()));
    const sig = (page.match(/data-n-a-sg="([^"]+)"/) || [])[1];
    const ts = (page.match(/data-n-a-ts="([^"]+)"/) || [])[1];
    if (!sig || !ts) return null;
    const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sig}"]`;
    const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner]]]));
    const t = await withTimeout(9000, fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute",
      { method: "POST", headers: { ...BROWSER_UA.headers, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body })
      .then((r) => r.text()));
    const m = t.match(/https?:\/\/(?!news\.google)[^\\"]+/);
    return m ? m[0] : null;
  } catch { return null; }
}

async function imageFor(item) {
  try {
    if (/news\.google\.com/.test(item.url)) {
      // the batchexecute decode is occasionally flaky — one retry lifts the hit rate
      let real = await resolveGoogleNews(item.url);
      if (!real) real = await resolveGoogleNews(item.url);
      return real ? await ogImage(real) : null;
    }
    // coalition/direct items: pull the article's own og:image
    return await ogImage(item.url);
  } catch { return null; }
}

// enrich an array in small concurrent batches (campaign items skip — the site maps them to self-hosted thumbnails)
async function enrichImages(items) {
  const targets = items.filter((i) => i.cat !== "campaign" && !i.img);
  const CONC = 5;
  for (let i = 0; i < targets.length; i += CONC) {
    const batch = targets.slice(i, i + CONC);
    const imgs = await Promise.all(batch.map((it) => imageFor(it)));
    batch.forEach((it, j) => { if (imgs[j]) it.img = imgs[j]; });
  }
}

async function main() {
  let current = { items: [] };
  try { current = JSON.parse(readFileSync(NEWS_PATH, "utf8")); } catch {}
  const merged = [];
  const seen = new Set();
  const keepOld = (cat, source) => {
    for (const i of (current.items || []).filter((x) => x.cat === cat && (!source || x.source === source))) {
      if (blocked(i) || seen.has(i.url)) continue;
      seen.add(i.url); merged.push(i);
    }
  };

  for (const [cat, source, feed] of RSS_FEEDS) {
    try {
      let kept = 0;
      const cap = cat === "coalition" ? COALITION_CAP : 12;
      for (const it of parseRss(await fetchText(feed))) {
        if (kept >= cap) break;
        if (seen.has(it.url) || blocked({ ...it, source })) continue;
        if (cat === "coalition" && !COASTAL_TERMS.test(it.title)) continue;
        seen.add(it.url); merged.push({ cat, source, ...it }); kept++;
      }
      console.log(`ok: ${source} (${kept} kept)`);
    } catch (e) { console.warn(source, "feed failed:", e.message); keepOld(cat, source); }
  }
  try {
    const xml = await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(GNEWS_QUERY)}&hl=en-CA&gl=CA&ceid=CA:en`);
    for (const it of parseRss(xml).slice(0, 14)) {
      if (seen.has(it.url)) continue;
      const cut = it.title.lastIndexOf(" - ");
      const item = { cat: "media", source: cut > 0 ? it.title.slice(cut + 3).trim() : "News",
                     ...it, title: cut > 0 ? it.title.slice(0, cut) : it.title };
      if (blocked(item) || opponentOpinion(item)) continue;
      seen.add(it.url); merged.push(item);
    }
    console.log("ok: google news");
  } catch (e) { console.warn("google news failed:", e.message); keepOld("media"); }

  // Final scrub — drops any stale cached opponent op-ed re-added via keepOld.
  const cleaned = merged.filter((i) => !blocked(i) && !(i.cat === "media" && opponentOpinion(i)));
  cleaned.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const top = cleaned.slice(0, 44);

  // Best-effort thumbnails (og:image). Preserves any img already present; never throws.
  try { await enrichImages(top); } catch (e) { console.warn("image enrichment skipped:", e.message); }
  console.log("images:", top.filter((i) => i.img).length + "/" + top.length);

  writeFileSync(NEWS_PATH, JSON.stringify({ updated: new Date().toISOString(), items: top }, null, 1) + "\n");
  console.log("wrote", top.length, "items");
}
main().catch((e) => { console.error(e); process.exit(1); });
