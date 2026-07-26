/* Homepage live tiles: Hecate seas, Dixon SST, Fraser discharge.
   All feeds keyless + CORS-open; every tile fails soft. */
(function () {
  function tile(key) { return document.querySelector('[data-live="' + key + '"]'); }
  function set(key, num, unit, ts) {
    var t = tile(key); if (!t) return;
    t.classList.remove("loading");
    t.querySelector(".live-num").innerHTML = num + '<span class="unit"> ' + unit + "</span>";
    t.querySelector(".live-ts").textContent = ts;
  }
  function fail(key, srcLabel, srcUrl) {
    var t = tile(key); if (!t) return;
    t.classList.remove("loading");
    t.classList.add("is-error");
    t.querySelector(".live-num").textContent = "—";
    t.querySelector(".live-ts").innerHTML = 'Feed unavailable — <a href="' + srcUrl + '" rel="noopener">' + srcLabel + "</a>";
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  }

  // Marine conditions (Open-Meteo marine model, keyless CORS-open)
  function marine(key, lat, lon, field, unit, label) {
    fetch("https://marine-api.open-meteo.com/v1/marine?latitude=" + lat + "&longitude=" + lon +
          "&current=wave_height,sea_surface_temperature&timezone=America%2FVancouver")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var v = d.current[field];
        if (v == null) throw 0;
        set(key, (Math.round(v * 10) / 10).toFixed(1), unit, label + " " + fmtTime(d.current.time) + " · Open-Meteo model");
      })
      .catch(function () { fail(key, "Environment Canada marine", "https://weather.gc.ca/marine/region_e.html?mapID=11"); });
  }
  if (tile("hecate")) marine("hecate", 53.6, -131.1, "wave_height", "m", "est.");
  if (tile("dixon")) marine("dixon", 54.4, -132.4, "sea_surface_temperature", "°C", "est.");

  // Fraser River at Hope discharge (ECCC hydrometric realtime, CORS-open)
  if (tile("fraser")) {
    fetch("https://api.weather.gc.ca/collections/hydrometric-realtime/items?STATION_NUMBER=08MF005&limit=12&sortby=-DATETIME&f=json")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var f = (d.features || []).find(function (x) { return x.properties.DISCHARGE != null; });
        if (!f) throw 0;
        set("fraser", Math.round(f.properties.DISCHARGE).toLocaleString("en-CA"), "m³/s",
            "measured " + fmtTime(f.properties.DATETIME) + " · Water Survey of Canada");
      })
      .catch(function () { fail("fraser", "Water Survey of Canada", "https://wateroffice.ec.gc.ca/report/real_time_e.html?stn=08MF005"); });
  }
})();
