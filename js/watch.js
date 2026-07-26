/* Coast Watch: MPA network Leaflet map from local GeoJSON (planning data, labeled as such). */
(function () {
  var el = document.getElementById("mpa-map");
  if (!el || typeof L === "undefined") return;

  var COLORS = {
    "Existing MPA/RCA - 'as-is, where-is'": "#0d5876",
    "Category 1": "#2f96c0",
    "Category 2": "#8ec9e2"
  };
  var LABELS = {
    "Existing MPA/RCA - 'as-is, where-is'": "Existing MPA / RCA",
    "Category 1": "New site — Category 1",
    "Category 2": "New site — Category 2"
  };

  var map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView([52.6, -129.6], 6);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 12
  }).addTo(map);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  fetch("data/mpa-network.geojson")
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (gj) {
      var counts = {}, areas = {};
      L.geoJSON(gj, {
        style: function (f) {
          var c = COLORS[f.properties.Category_Simple] || "#0d5876";
          return { color: "#0c2733", weight: 0.6, fillColor: c, fillOpacity: 0.62 };
        },
        onEachFeature: function (f, layer) {
          var p = f.properties;
          counts[p.Category_Simple] = (counts[p.Category_Simple] || 0) + 1;
          areas[p.Category_Simple] = (areas[p.Category_Simple] || 0) + (p.Area_km2 || 0);
          var name = p.EA_Common_site_name_Site_Profil || p.Exist_AIWI_Type || ("Site " + p.UID);
          layer.bindPopup(
            "<strong>" + esc(name) + "</strong><br>" +
            esc(LABELS[p.Category_Simple] || p.Category_Simple) + "<br>" +
            (p.Area_km2 ? p.Area_km2.toFixed(1) + " km²" : "") +
            (p.SUBREGION ? " · " + esc(p.SUBREGION) + " subregion" : "")
          );
        }
      }).addTo(map);

      var chips = document.getElementById("mpa-chips");
      if (chips) {
        chips.innerHTML = Object.keys(COLORS).map(function (k) {
          if (!counts[k]) return "";
          return '<span class="chip"><span class="swatch" style="background:' + COLORS[k] + '"></span>' +
            esc(LABELS[k]) + " — " + counts[k] + " sites · " +
            Math.round(areas[k]).toLocaleString("en-CA") + " km²</span>";
        }).join("");
      }
    })
    .catch(function () {
      el.innerHTML = '<p class="feed-note" style="padding:2rem">Map data unavailable right now — see the planning maps at <a href="https://mpanetwork.ca/" rel="noopener">mpanetwork.ca</a>.</p>';
    });
})();
