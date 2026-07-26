/* Renders data/news.json into #news-teaser (N cards) and/or #news-list (full). */
(function () {
  var teaser = document.getElementById("news-teaser");
  var list = document.getElementById("news-list");
  var updatedEl = document.getElementById("news-updated");
  if (!teaser && !list) return;

  var CAT = {
    campaign: { label: "Strong Coast", cls: "tag-campaign" },
    coalition: { label: "Allies", cls: "tag-coalition" },
    media: { label: "In the news", cls: "tag-media" }
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return "";
    var dt = new Date(d + "T12:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  }
  function itemCard(it) {
    var cat = CAT[it.cat] || CAT.media;
    return '<article class="card reveal in"><div class="card-body">' +
      '<span class="card-tag ' + cat.cls + '">' + esc(it.source || cat.label) + "</span>" +
      '<a class="card-link" href="' + esc(it.url) + '" rel="noopener"><h3>' + esc(it.title) + "</h3></a>" +
      '<span class="card-meta">' + fmtDate(it.date) + "</span>" +
      "</div></article>";
  }
  function itemRow(it) {
    var cat = CAT[it.cat] || CAT.media;
    return '<li class="news-row" data-cat="' + esc(it.cat || "media") + '">' +
      '<span class="news-date mono">' + fmtDate(it.date) + "</span>" +
      '<span class="news-src ' + cat.cls + '">' + esc(it.source || cat.label) + "</span>" +
      '<a href="' + esc(it.url) + '" rel="noopener">' + esc(it.title) + "</a></li>";
  }

  fetch("data/news.json?v=" + Math.floor(Date.now() / 36e5))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var items = (data.items || []).slice().sort(function (a, b) {
        return (b.date || "").localeCompare(a.date || "");
      });
      if (teaser) {
        teaser.innerHTML = items.slice(0, +(teaser.getAttribute("data-count") || 3)).map(itemCard).join("");
      }
      if (list) {
        list.innerHTML = items.map(itemRow).join("");
        var pills = document.querySelectorAll("[data-filter]");
        pills.forEach(function (p) {
          p.addEventListener("click", function () {
            pills.forEach(function (q) { q.setAttribute("aria-pressed", "false"); });
            p.setAttribute("aria-pressed", "true");
            var f = p.getAttribute("data-filter");
            list.querySelectorAll(".news-row").forEach(function (row) {
              row.style.display = (f === "all" || row.getAttribute("data-cat") === f) ? "" : "none";
            });
          });
        });
      }
      if (updatedEl && data.updated) {
        updatedEl.textContent = "Feed refreshed " + new Date(data.updated).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
      }
    })
    .catch(function () {
      var msg = '<p class="feed-note">News feed unavailable right now — see <a href="https://strongcoast.org/news/" rel="noopener">strongcoast.org/news</a>.</p>';
      if (teaser) teaser.innerHTML = msg;
      if (list) list.innerHTML = "<li>" + msg + "</li>";
    });
})();
