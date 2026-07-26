/* Searchable, filterable archive for Explainers & Humans (reads data/library.json).
   Markup: a wrapper with [data-archive="<theme|all>"] containing
   .archive-pills (optional), .archive-search input (optional), .archive-count
   (optional), and .archive-grid (required). */
(function () {
  var root = document.querySelector("[data-archive]");
  if (!root) return;
  var grid = root.querySelector(".archive-grid");
  var input = root.querySelector(".archive-search input");
  var pillWrap = root.querySelector(".archive-pills");
  var countEl = root.querySelector(".archive-count");
  var baseFilter = root.getAttribute("data-archive") || "all";
  var THEME_ORDER = ["Marine Protected Areas", "The Great Bear Sea", "Bottom Trawling",
    "Fish Farms", "Tankers & Spills", "Marine Life", "Indigenous Stewardship",
    "Enforcement & Poaching", "People & Community", "Coast News"];
  var data = [], theme = "all", q = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmt(d) {
    var dt = new Date(d + "T12:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  }
  function card(it) {
    var media = it.img
      ? '<img class="card-img" loading="lazy" src="' + esc(it.img) + '" alt="">'
      : '<div class="card-img card-img-fallback"><span>' + esc(it.theme) + "</span></div>";
    return '<article class="card"><a class="card-link" href="' + esc(it.url) + '" rel="noopener">' +
      media + '<div class="card-body"><span class="card-tag">' + esc(it.theme) + "</span>" +
      "<h3>" + esc(it.title) + "</h3>" +
      (it.excerpt ? "<p>" + esc(it.excerpt) + "</p>" : "") +
      '<span class="card-meta">' + fmt(it.date) + "</span></div></a></article>";
  }
  function render() {
    var items = data.filter(function (it) {
      if (baseFilter !== "all" && it.theme !== baseFilter) return false;
      if (theme !== "all" && it.theme !== theme) return false;
      if (q) { return (it.title + " " + it.excerpt).toLowerCase().indexOf(q) >= 0; }
      return true;
    });
    grid.innerHTML = items.map(card).join("") ||
      '<p class="feed-note">No stories match &ldquo;' + esc(q) + '&rdquo; — try another word.</p>';
    if (countEl) countEl.textContent = items.length + (items.length === 1 ? " story" : " stories");
  }
  function buildPills() {
    if (!pillWrap) return;
    var present = THEME_ORDER.filter(function (t) { return data.some(function (d) { return d.theme === t; }); });
    pillWrap.innerHTML = '<button data-t="all" aria-pressed="true">All</button>' +
      present.map(function (t) { return '<button data-t="' + esc(t) + '" aria-pressed="false">' + esc(t) + "</button>"; }).join("");
    pillWrap.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        pillWrap.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        theme = b.getAttribute("data-t");
        render();
      });
    });
  }
  Promise.all([
    fetch("data/library.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
    // curated cross-site stories (West Coast NOW / The Skeena etc.) preserved across library re-pulls
    fetch("data/humans-extra.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
  ])
    .then(function (res) {
      var seen = {};
      data = res[1].concat(res[0]).filter(function (it) {
        if (!it || !it.url || seen[it.url]) return false;
        seen[it.url] = 1; return true;
      });
      data.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      buildPills(); render();
    })
    .catch(function () { grid.innerHTML = '<p class="feed-note">Library unavailable right now — see <a href="https://strongcoast.org/explainers/" rel="noopener">strongcoast.org</a>.</p>'; });
  if (input) input.addEventListener("input", function () { q = input.value.trim().toLowerCase(); render(); });
})();
