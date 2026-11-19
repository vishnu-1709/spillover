// Page behaviour: config wiring, QR code, ship art, seams, mode diagrams.
(function () {
  var cfg = window.SPILLOVER || {};
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Ships section art
  if (window.SpilloverShips) {
    document.querySelectorAll("[data-ship]").forEach(function (el) {
      var kind = el.getAttribute("data-ship");
      el.outerHTML = SpilloverShips.shipSVG(kind, { body: "#F4EFE6", wing: "#D8C4DB", cut: "#6E4A72" }, 140, SpilloverShips.SHIPS[kind].name + " ship");
    });
  }

  // Download button + meta
  var dl = document.getElementById("dl-btn");
  if (dl && cfg.apkUrl) dl.href = cfg.apkUrl;
  var meta = document.getElementById("dl-meta");
  if (meta) {
    var bits = [];
    if (cfg.version) bits.push("Version " + cfg.version);
    if (cfg.apkSize) bits.push(cfg.apkSize);
    if (cfg.minAndroid) bits.push(cfg.minAndroid);
    meta.textContent = bits.join(", ");
    if (!bits.length) meta.hidden = true;
  }

  // Google Play live? Switch the wording.
  if (cfg.playStoreUrl) {
    document.querySelectorAll("[data-dl-label]").forEach(function (a) { a.textContent = "Get it on Google Play"; a.href = cfg.playStoreUrl; });
    var fine = document.querySelector("[data-hero-fine]");
    if (fine) fine.textContent = "Free on Android. 2 to 6 players on the same Wi-Fi.";
    var t = document.querySelector("[data-soon-title]");
    var x = document.querySelector("[data-soon-text]");
    if (t) t.textContent = "Now on Google Play";
    if (x) x.innerHTML = 'Get updates automatically from the <a href="' + cfg.playStoreUrl + '">Play Store</a>. Found a bug? Tell us.';
  }

  // QR code for people reading on a computer
  var qrWrap = document.getElementById("dl-qr");
  var qrBox = document.getElementById("qr-box");
  if (qrWrap && qrBox && window.qrcode) {
    try {
      var base = cfg.siteUrl || (location.protocol.indexOf("http") === 0 ? location.origin + location.pathname : "");
      if (base) {
        var q = qrcode(0, "M");
        q.addData(base.replace(/#.*$/, "") + "#download");
        q.make();
        qrBox.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        var svg = qrBox.querySelector("svg");
        if (svg) { svg.setAttribute("width", "132"); svg.setAttribute("height", "132"); svg.setAttribute("aria-hidden", "true"); }
        qrWrap.hidden = false;
      }
    } catch (e) { /* no QR, page still works */ }
  }

  // Clips
  var clips = Array.isArray(cfg.clips) ? cfg.clips : [];
  if (clips.length) {
    var sec = document.getElementById("clips");
    var list = document.getElementById("clips-list");
    clips.forEach(function (c) {
      var fig = document.createElement("figure");
      var v = document.createElement("video");
      v.src = c.src; if (c.poster) v.poster = c.poster;
      v.muted = true; v.loop = true; v.playsInline = true; v.controls = true; v.preload = "none";
      v.setAttribute("aria-label", c.caption || "Gameplay clip");
      fig.appendChild(v);
      if (c.caption) { var cap = document.createElement("figcaption"); cap.textContent = c.caption; fig.appendChild(cap); }
      list.appendChild(fig);
    });
    sec.hidden = false;
    var cs = document.querySelector("[data-clips-seam]");
    if (cs) cs.hidden = false;
    if ("IntersectionObserver" in window && !reduce) {
      var vio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { var v = e.target; if (e.isIntersecting) { v.play().catch(function () {}); } else { v.pause(); } });
      }, { threshold: 0.5 });
      list.querySelectorAll("video").forEach(function (v) { vio.observe(v); });
    }
  }

  // Seams: the shot crosses once when you scroll to it. Mode diagrams play only on screen.
  if ("IntersectionObserver" in window) {
    var seams = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !reduce) { e.target.classList.add("is-crossing"); seams.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -25% 0px" });
    document.querySelectorAll(".seam").forEach(function (s) { seams.observe(s); });

    var anims = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("is-playing", e.isIntersecting); });
    }, { threshold: 0.3 });
    document.querySelectorAll(".anim").forEach(function (a) { anims.observe(a); });
  } else {
    document.querySelectorAll(".anim").forEach(function (a) { a.classList.add("is-playing"); });
  }
})();
