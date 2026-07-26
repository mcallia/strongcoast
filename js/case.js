/* The Case scrolly: generates sounder fish marks, flips chapter states. */
(function () {
  var svg = document.getElementById("sounder-svg");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";

  // deterministic pseudo-random
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // fish mark: small sonar arc
  function fish(x, y, big) {
    var p = document.createElementNS(NS, "path");
    var w = big ? 16 : 10;
    p.setAttribute("d", "M" + x + " " + y + " q" + w / 2 + " " + -w * 0.42 + " " + w + " 0");
    p.setAttribute("class", "fish" + (big ? " big" : ""));
    return p;
  }
  // populate density groups: [group id, count, xmin, xmax, ymin, ymax, bigshare]
  var groups = [
    ["g1", 9,  30, 385, 120, 400, 0.35],
    ["g2", 12, 30, 385, 110, 410, 0.25],
    ["g3", 13, 30, 385, 100, 415, 0.2],
    ["g4", 16, 40, 240, 100, 415, 0.4],   // recovery inside the line
    ["g5", 7, 265, 390, 130, 400, 0.3]    // spillover outside the line
  ];
  groups.forEach(function (g) {
    var el = document.getElementById(g[0]);
    for (var i = 0; i < g[1]; i++) {
      el.appendChild(fish(g[2] + rnd() * (g[3] - g[2]), g[4] + rnd() * (g[5] - g[4]), rnd() < g[6]));
    }
  });

  var status = document.getElementById("sh-status");
  var states = {
    1: { on: ["g1", "g2", "g3"], thin: [], trawl: false, boundary: false, spill: false, txt: "CONTACTS: FULL SCREEN" },
    2: { on: ["g1"], thin: ["g2"], trawl: true, boundary: false, spill: false, txt: "CONTACTS FADING" },
    3: { on: [], thin: ["g1"], trawl: true, boundary: false, spill: false, txt: "SCREEN NEAR EMPTY" },
    4: { on: [], thin: ["g1"], trawl: false, boundary: true, spill: false, txt: "A LINE ON THE CHART" },
    5: { on: ["g1", "g2", "g4"], thin: [], trawl: false, boundary: true, spill: true, txt: "REBUILDING · SPILLOVER" },
    6: { on: ["g1", "g2", "g3", "g4", "g5"], thin: [], trawl: false, boundary: true, spill: true, txt: "YOUR MOVE" }
  };
  function apply(n) {
    var s = states[n]; if (!s) return;
    ["g1", "g2", "g3", "g4", "g5"].forEach(function (id) {
      var el = document.getElementById(id);
      el.classList.remove("off", "thin");
      if (s.on.indexOf(id) < 0 && s.thin.indexOf(id) < 0) el.classList.add("off");
      if (s.thin.indexOf(id) >= 0) el.classList.add("thin");
    });
    document.getElementById("trawl").classList.toggle("on", s.trawl);
    document.getElementById("boundary").classList.toggle("on", s.boundary);
    document.getElementById("spill").classList.toggle("on", s.spill);
    if (status) status.textContent = s.txt;
  }
  apply(1);

  var steps = document.querySelectorAll(".step[data-ch]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) apply(+e.target.getAttribute("data-ch"));
      });
    }, { rootMargin: "-42% 0px -42% 0px" });
    steps.forEach(function (s) { io.observe(s); });
  } else {
    apply(6);
  }
})();
