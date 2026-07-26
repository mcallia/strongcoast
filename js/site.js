/* Strong Coast shared behaviours */
(function () {
  // sticky header shadow
  var header = document.querySelector(".site-header");
  var onScroll = function () {
    header && header.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // mobile nav
  var toggle = document.querySelector(".nav-toggle");
  var mnav = document.getElementById("mnav");
  if (toggle && mnav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      mnav.classList.toggle("open", !open);
      document.body.classList.toggle("nav-open", !open);
    });
  }

  // year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // reveal on scroll
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = document.querySelectorAll(".reveal");
  if (!reduced && "IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // CSS bar fills (.hbar-fill width from data-v when visible)
  var bars = document.querySelectorAll(".hbar");
  var fill = function (bar) {
    var f = bar.querySelector(".hbar-fill");
    if (f) f.style.width = (bar.getAttribute("data-v") || 0) + "%";
  };
  if (!reduced && "IntersectionObserver" in window && bars.length) {
    var bio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { fill(e.target); bio.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    bars.forEach(function (b) { bio.observe(b); });
  } else {
    bars.forEach(fill);
  }
})();
