#!/usr/bin/env python3
"""Strong Coast static site builder.

Stitches tools/pages/*.html bodies into the shared shell and writes plain HTML
to the repo root. Each body starts with:  <!--META {json} -->
META keys: title, desc, nav, og, css (list), js (list), bodyclass, gate ("skip"
to emit the file raw with no shell — used by the password gate page).

Usage: python3 tools/build.py
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / "tools" / "pages"
BASE = "https://mcallia.github.io/strongcoast/"
SITE_NAME = "Strong Coast"
NAV = [
    ("home", "home.html", "Home"),
    ("case", "the-case.html", "The Case"),
    ("plan", "why-mpas.html", "The Plan"),
    ("tankers", "no-tankers.html", "No Tankers"),
    ("watch", "coast-watch.html", "Coast Watch"),
    ("explainers", "explainers.html", "Explainers"),
    ("humans", "humans.html", "Humans"),
    ("news", "newsroom.html", "Newsroom"),
]

def nav_html(current):
    out = []
    for key, href, label in NAV:
        cur = ' aria-current="page"' if key == current else ""
        out.append(f'<a href="{href}"{cur}>{label}</a>')
    out.append('<a class="nav-cta" href="take-action.html">Take Action</a>')
    return "\n      ".join(out)

HEAD = """<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="js/gate.js"></script>
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="noindex,nofollow">
<meta property="og:site_name" content="{site}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{base}img/{og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#0c2733">
<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">
<link rel="apple-touch-icon" href="img/favicon-180.png">
<link rel="preload" href="fonts/BarlowCondensed-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/fonts.css">
<link rel="stylesheet" href="css/site.css">
{extra_css}
</head>
<body class="{bodyclass}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="header-bar">
  <a class="brand" href="home.html"><img src="img/logo-light.png" alt="Strong Coast" height="40"></a>
  <nav class="nav-desktop" aria-label="Primary">
      {nav}
  </nav>
  <button class="nav-toggle" aria-expanded="false" aria-controls="mnav" aria-label="Open menu"><span></span><span></span><span></span></button>
</div></header>
<nav class="nav-mobile" id="mnav" aria-label="Mobile">
      {nav}
</nav>
<main id="main">
"""

FOOTER = """</main>
<footer class="site-footer">
  <div class="container foot-grid">
    <div class="foot-brand">
      <img src="img/logo-light.png" alt="Strong Coast" height="44">
      <p class="foot-tag">DEFEND OUR COAST.</p>
      <p>Strong Coast supports the Great Bear Sea Marine Protected Area (MPA) Network through communication and education. Strong Coast is not affiliated with any political party, government, or industry group and is not part of the Great Bear Sea MPA Network governing structure.</p>
      <p class="foot-proto">Review prototype &mdash; not the live strongcoast.org</p>
    </div>
    <nav class="foot-col" aria-label="Explore">
      <h3>Explore</h3>
      <a href="the-case.html">The Case</a>
      <a href="why-mpas.html">The MPA Network Plan</a>
      <a href="no-tankers.html">The Tanker Ban</a>
      <a href="coast-watch.html">Coast Watch</a>
      <a href="explainers.html">Explainers &middot; Library</a>
      <a href="humans.html">Humans of the Coast</a>
      <a href="newsroom.html">Newsroom</a>
      <a href="resources.html">Resources &amp; Allies</a>
      <a href="about.html">About</a>
    </nav>
    <nav class="foot-col" aria-label="Act">
      <h3>Act</h3>
      <a href="take-action.html">Take Action</a>
      <a href="https://strongcoast.org/messagewriter" rel="noopener">Message Ottawa: MPA Network</a>
      <a href="https://strongcoast.org/nmcar-message-writer/" rel="noopener">Back the Central Coast MCA</a>
      <a href="https://strongcoast.org/new-call-your-mp-no-tankers/" rel="noopener">Call your MP: No Tankers</a>
      <a href="https://strongcoast.org/donations/coast-plan/" rel="noopener">Donate</a>
      <a href="https://strongcoast.org/shop/" rel="noopener">Shop</a>
    </nav>
    <div class="foot-col">
      <h3>Contact</h3>
      <a href="mailto:hello@strongcoast.org">hello@strongcoast.org</a>
      <p>Victoria, BC<br>+1 (250) 900-0773</p>
      <div class="foot-social">
        <a href="https://www.facebook.com/StrongCoastCA" rel="noopener">Facebook</a>
        <a href="https://instagram.com/StrongCoastCA" rel="noopener">Instagram</a>
        <a href="https://twitter.com/StrongCoastCA" rel="noopener">X</a>
        <a href="https://www.youtube.com/channel/UCAyo2pahS176Vm19IBLAbcA" rel="noopener">YouTube</a>
      </div>
    </div>
  </div>
  <div class="container foot-base">
    <span>&copy; <span data-year>2026</span> Strong Coast</span>
    <span><a href="about.html#credits">Photo &amp; data credits</a> &middot; <a href="https://strongcoast.org/privacy/" rel="noopener">Privacy</a> &middot; <a href="https://strongcoast.org/terms-of-service/" rel="noopener">Terms</a></span>
  </div>
</footer>
<script src="js/site.js"></script>
{extra_js}
</body>
</html>
"""

def build():
    for body_file in sorted(PAGES.glob("*.html")):
        raw = body_file.read_text()
        m = re.match(r"\s*<!--META\s*(\{.*?\})\s*-->", raw, re.S)
        meta = json.loads(m.group(1)) if m else {}
        body = raw[m.end():] if m else raw
        if meta.get("gate") == "skip":
            (ROOT / body_file.name).write_text(body.strip() + "\n")
            print("built (raw)", body_file.name)
            continue
        canonical = BASE + ("" if body_file.name == "index.html" else body_file.name)
        head = HEAD.format(
            title=meta.get("title", SITE_NAME),
            desc=meta.get("desc", "").replace('"', "&quot;"),
            site=SITE_NAME, base=BASE, canonical=canonical,
            og=meta.get("og", "og-share.jpg"),
            bodyclass=meta.get("bodyclass", ""),
            nav=nav_html(meta.get("nav", "")),
            extra_css="\n".join(f'<link rel="stylesheet" href="{c}">' for c in meta.get("css", [])),
        )
        footer = FOOTER.format(
            extra_js="\n".join(f'<script src="{j}"></script>' for j in meta.get("js", [])))
        (ROOT / body_file.name).write_text(head + body.strip() + "\n" + footer)
        print("built", body_file.name)

if __name__ == "__main__":
    build()
