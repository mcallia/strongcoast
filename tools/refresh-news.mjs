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
 * Rules 1–3 do not apply to Strong Coast's own posts (cat "campaign") or to
 * news-media results (cat "media", already scoped by the marine search query).
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
      if (blocked(item)) continue;
      seen.add(it.url); merged.push(item);
    }
    console.log("ok: google news");
  } catch (e) { console.warn("google news failed:", e.message); keepOld("media"); }

  merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  writeFileSync(NEWS_PATH, JSON.stringify({ updated: new Date().toISOString(), items: merged.slice(0, 44) }, null, 1) + "\n");
  console.log("wrote", Math.min(merged.length, 44), "items");
}
main().catch((e) => { console.error(e); process.exit(1); });
