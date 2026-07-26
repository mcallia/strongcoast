# Strong Coast — site redesign prototype

Password-gated review prototype of a redesigned **strongcoast.org**, built as static,
dependency-light HTML for GitHub Pages.

**Live preview:** https://mcallia.github.io/strongcoast/ (password required — ask the team)

## How it's put together

- Every page is plain HTML in the repo root — any host can serve it, anyone can hand-edit it.
- Page *bodies* live in `tools/pages/*.html` with a small JSON `<!--META-->` header
  (title, description, nav key, extra css/js). `tools/build.py` stitches each body into the
  shared shell (head, header/nav, footer) and writes the root HTML files.
- **Edit workflow:** change a file in `tools/pages/`, run `python3 tools/build.py`, commit, push.
  (Editing the root HTML directly also works — just know a later build overwrites it.)
- `main` is the working branch; GitHub Pages serves the `gh-pages` branch. The news workflow
  mirrors `main → gh-pages` on every run (every 6 h), or push manually:
  `git push origin main:gh-pages --force`.

## What's where

| Path | What |
|---|---|
| `index.html` | Password gate (client-side SHA-256; sessionStorage). Not real security — review privacy only. |
| `home.html` … `404.html` | The site (gated by `js/gate.js` in the shared shell) |
| `css/site.css` | Design system — brand tokens extracted from the Strong Coast logo |
| `css/fonts.css` + `fonts/` | Self-hosted Barlow Condensed / Barlow / IBM Plex Mono |
| `js/live-tiles.js` | Live tiles: Open-Meteo marine + Water Survey of Canada (keyless, CORS-open, fail-soft) |
| `js/watch.js` | Coast Watch MPA map (Leaflet, vendored) from `data/mpa-network.geojson` |
| `data/mpa-network.geojson` | NSB MPA Network planning boundaries (SeaSketch, simplified; retrieved Jul 2026) |
| `data/news.json` | Newsroom feed — refreshed by `.github/workflows/news.yml` every 6 h |
| `tools/refresh-news.mjs` | The refresher: Strong Coast + allied RSS + Google News search |
| `img/` | Photography from the campaign's own site library (credits: About page) |

## Changing the password

The gate compares a SHA-256 hash in `tools/pages/index.html`. To change it:
`python3 -c "import hashlib;print(hashlib.sha256('newpassword'.encode()).hexdigest())"`,
paste the hash into the `HASH` constant, rebuild, push. (Password is lower-cased before hashing.)

## Register discipline

Every statistic on the site carries a named public source (see The Case → Sources, and
About → credits). No internal strategy language or unreleased numbers. Keep it that way.

## Going live for real (later)

This prototype ships with `noindex` metatags, `robots.txt` disallow, and the password gate.
A real launch would remove those three things, point a custom domain, and swap absolute
URLs in `tools/build.py` (`BASE`).
