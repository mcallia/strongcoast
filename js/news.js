/* Renders data/news.json as photo cards (thumbnails from the library where the
   story is a Strong Coast post; branded fallback tiles otherwise).
   Drives #news-teaser (home, N cards) and #news-list (newsroom grid + pills). */
(function () {
  var teaser = document.getElementById("news-teaser");
  var list = document.getElementById("news-list");
  var updatedEl = document.getElementById("news-updated");
  if (!teaser && !list) return;

  var CAT = {
    campaign: { label: "Strong Coast", cls: "tag-campaign", tint: "" },
    coalition: { label: "Allies", cls: "tag-coalition", tint: "tint-coalition" },
    media: { label: "In the news", cls: "tag-media", tint: "tint-media" }
  };
  var libMap = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return "";
    var dt = new Date(d + "T12:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  }
  function media(it) {
    var img = it.img || libMap[it.url];
    if (img) return '<img class="card-img" loading="lazy" src="' + esc(img) + '" alt="">';
    var cat = CAT[it.cat] || CAT.media;
    return '<div class="card-img card-img-fallback ' + cat.tint + '"><span>' + esc(it.source || cat.label) + "</span></div>";
  }
  function card(it) {
    var cat = CAT[it.cat] || CAT.media;
    return '<article class="card" data-cat="' + esc(it.cat || "media") + '">' +
      '<a class="card-link" href="' + esc(it.url) + '" rel="noopener">' + media(it) +
      '<div class="card-body"><span class="card-tag ' + cat.cls + '">' + esc(it.source || cat.label) + "</span>" +
      "<h3>" + esc(it.title) + "</h3>" +
      '<span class="card-meta">' + fmtDate(it.date) + "</span></div></a></article>";
  }

  Promise.all([
    fetch("data/news.json?v=" + Math.floor(Date.now() / 36e5)).then(function (r) { return r.json(); }),
    fetch("data/library.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
  ]).then(function (res) {
    var data = res[0], lib = res[1] || [];
    lib.forEach(function (x) { if (x.img) libMap[x.url] = x.img; });
    var items = (data.items || []).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });

    if (teaser) {
      teaser.innerHTML = items.slice(0, +(teaser.getAttribute("data-count") || 3)).map(card).join("");
    }
    if (list) {
      list.innerHTML = items.map(card).join("");
      var pills = document.querySelectorAll("[data-filter]");
      pills.forEach(function (p) {
        p.addEventListener("click", function () {
          pills.forEach(function (q) { q.setAttribute("aria-pressed", "false"); });
          p.setAttribute("aria-pressed", "true");
          var f = p.getAttribute("data-filter");
          list.querySelectorAll(".card[data-cat]").forEach(function (c) {
            c.style.display = (f === "all" || c.getAttribute("data-cat") === f) ? "" : "none";
          });
        });
      });
    }
    if (updatedEl && data.updated) {
      updatedEl.textContent = "Feed refreshed " + new Date(data.updated).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
    }
  }).catch(function () {
    var msg = '<p class="feed-note">News feed unavailable right now — see <a href="https://strongcoast.org/news/" rel="noopener">strongcoast.org/news</a>.</p>';
    if (teaser) teaser.innerHTML = msg;
    if (list) list.innerHTML = msg;
  });
})();
