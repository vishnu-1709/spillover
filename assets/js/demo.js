// Self-playing two-phone demo. Two players hold their phones face to face,
// top edge to top edge, and steer by tilting them like a steering wheel.
// The ships move because of the tilt (same dead zone / full-speed angles as the game),
// so the phone you see turning is what drives the ship.
(function () {
  var canvas = document.getElementById("demo");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("demo-score");
  var playBtn = document.getElementById("demo-play");
  var SH = window.SpilloverShips ? SpilloverShips.SHIPS : null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 720, H = 860;
  // Phone geometry in each phone's own (untilted) frame.
  var B = { body: { x: 40, y: 28, w: 640, h: 372 }, scr: { x: 60, y: 48, w: 600, h: 332 } }; // top phone, held by player 2
  var A = { body: { x: 40, y: 460, w: 640, h: 372 }, scr: { x: 60, y: 480, w: 600, h: 332 } }; // bottom phone, player 1
  var EDGE_A = A.scr.y;            // player 1's top edge
  var EDGE_B = B.scr.y + B.scr.h;  // player 2's top edge (facing player 1)
  // Each phone tilts around the middle of the edge that faces the other phone,
  // so the two edges stay lined up while the far ends swing.
  var PIVOT_A = { x: W / 2, y: A.body.y };
  var PIVOT_B = { x: W / 2, y: B.body.y + B.body.h };

  var COL = {
    p1Bg: "#3A2C12", p1: "#F0C060", p1Wing: "#B88A30",
    p2Bg: "#2A1C2C", p2: "#B98ABE", p2Wing: "#845A88",
    paper: "#F4EFE6", ink: "#1F1D1A"
  };

  // Tilt model (from the game's tuning): 6° dead zone, full speed at 25°.
  var DEAD = 6, FULL = 25, MAX_TILT = 32;
  var SHIP_SPEED = 300;  // px/s at full tilt
  var SHOT_SPEED = 640;  // px/s
  var SHOW_TILT = 0.24;   // how much of the hand's tilt angle we draw (keeps it readable)
  var SHIP_R = 22;

  var paths = null;
  if (SH && window.Path2D) {
    paths = {};
    ["shooter"].forEach(function (k) {
      paths[k] = { shade: new Path2D(SH[k].shade), main: new Path2D(SH[k].main), cut: new Path2D(SH[k].cut) };
    });
  }

  var state, running = false, last = 0, visible = false, playing = !reduce;

  function player(scr, y, dir, kind) {
    return {
      x: W / 2 + (Math.random() * 160 - 80), y: y, dir: dir, kind: kind, scr: scr,
      tilt: 0, want: 0, goal: W / 2, think: 0, hp: 2, ammo: 3, refill: 0,
      cool: 0.8 + Math.random(), flash: 0, hidden: false, react: 0
    };
  }

  function reset(keepScore) {
    var score = keepScore && state ? state.score : { p1: 0, p2: 0 };
    state = {
      p1: player(A, A.scr.y + A.scr.h - 52, -1, "shooter"),
      p2: player(B, B.scr.y + 52, 1, "shooter"),
      shots: [], bits: [], edgeFlash: [], ko: 0, shake: 0, score: score
    };
  }
  reset(false);

  function clampX(x) { return Math.max(A.scr.x + 30, Math.min(A.scr.x + A.scr.w - 30, x)); }

  // Speed factor from tilt angle, exactly like the game: nothing inside the dead zone.
  function speedFrom(tilt) {
    var a = Math.abs(tilt);
    if (a <= DEAD) return 0;
    return Math.sign(tilt) * Math.min(1, (a - DEAD) / (FULL - DEAD));
  }

  function fire(p) {
    if (state.ko > 0 || p.ammo <= 0 || p.hidden) return;
    p.ammo--; p.refill = 0.8;
    state.shots.push({ x: p.x, y: p.y + p.dir * 26, vy: p.dir * SHOT_SPEED, owner: p === state.p1 ? "p1" : "p2", crossed: false });
  }

  function hit(target, owner) {
    target.hp--; target.flash = 0.12; state.shake = 0.12;
    if (target.hp <= 0) {
      state.score[owner]++;
      var col = owner === "p1" ? COL.p2 : COL.p1;
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
        state.bits.push({ x: target.x, y: target.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, life: 0.6, col: col });
      }
      target.hidden = true;
      state.ko = 1.4;
      updateScore();
    }
  }

  function updateScore() {
    if (scoreEl) scoreEl.textContent = "Gold " + state.score.p1 + " – Plum " + state.score.p2;
  }

  // One player's "hands": decide where to go, then tilt the phone toward it.
  function brain(me, foe, dt) {
    me.think -= dt;
    me.react -= dt;
    // threats: the other player's shots that have crossed onto my screen and are heading at me
    var threat = null;
    state.shots.forEach(function (s) {
      var mine = (s.owner === "p1") === (me === state.p1);
      if (mine || !s.crossed) return;
      var dist = (me.y - s.y) * me.dir * -1; // positive while the shot is still coming
      if (dist > 0 && dist < 260 && Math.abs(s.x - me.x) < 40) { if (!threat || dist < threat.d) threat = { s: s, d: dist }; }
    });
    if (threat && me.react <= 0 && Math.random() < 0.45) {
      // sidestep, away from the shot and away from the wall
      var away = threat.s.x < me.x ? 1 : -1;
      if (me.x + away * 110 > A.scr.x + A.scr.w - 40 || me.x + away * 110 < A.scr.x + 40) away = -away;
      me.goal = clampX(me.x + away * (100 + Math.random() * 40));
      me.react = 0.5 + Math.random() * 0.4;
      me.think = 0.5;
    } else if (me.think <= 0) {
      // line up with the other ship, with a bit of human error
      me.goal = clampX(foe.x + (Math.random() * 90 - 45));
      me.think = 1.1 + Math.random() * 1.2;
    }
    // tilt toward the goal like a person would: more tilt for a bigger gap, eased in and out
    var gap = (me.goal - me.x) * (me.dir < 0 ? 1 : -1); // player 2 sees the world flipped
    var want = Math.max(-MAX_TILT, Math.min(MAX_TILT, gap * 0.22));
    if (Math.abs(gap) < 12) want = 0;
    me.tilt += (want - me.tilt) * (1 - Math.exp(-dt * 5.5));
    var v = speedFrom(me.tilt) * SHIP_SPEED * (me.dir < 0 ? 1 : -1);
    me.x = clampX(me.x + v * dt);

    // shoot when roughly lined up
    me.cool -= dt;
    if (me.cool <= 0 && Math.abs(me.x - foe.x) < 90 && !foe.hidden) {
      fire(me);
      me.cool = 0.45 + Math.random() * 0.8;
    }
  }

  function step(dt) {
    var p1 = state.p1, p2 = state.p2;
    if (state.ko <= 0) { brain(p1, p2, dt); brain(p2, p1, dt); }
    else { p1.tilt *= 1 - Math.min(1, dt * 4); p2.tilt *= 1 - Math.min(1, dt * 4); }

    [p1, p2].forEach(function (p) {
      if (p.ammo < 3) { p.refill -= dt; if (p.refill <= 0) { p.ammo++; p.refill = 0.6; } }
      if (p.flash > 0) p.flash -= dt;
    });

    for (var i = state.shots.length - 1; i >= 0; i--) {
      var s = state.shots[i];
      s.y += s.vy * dt;
      var col = s.owner === "p1" ? COL.p1 : COL.p2;
      if (s.vy < 0 && !s.crossed && s.y < EDGE_A) {
        s.y = EDGE_B - (EDGE_A - s.y); s.crossed = true;
        state.edgeFlash.push({ phone: "A", x: s.x, t: 0.14, col: col }, { phone: "B", x: s.x, t: 0.14, col: col });
      }
      if (s.vy > 0 && !s.crossed && s.y > EDGE_B) {
        s.y = EDGE_A + (s.y - EDGE_B); s.crossed = true;
        state.edgeFlash.push({ phone: "A", x: s.x, t: 0.14, col: col }, { phone: "B", x: s.x, t: 0.14, col: col });
      }
      var target = s.owner === "p1" ? p2 : p1;
      if (s.crossed && !target.hidden && state.ko <= 0 && Math.abs(s.x - target.x) < SHIP_R + 6 && Math.abs(s.y - target.y) < SHIP_R + 6) {
        hit(target, s.owner); state.shots.splice(i, 1); continue;
      }
      if (s.y < B.scr.y - 10 || s.y > A.scr.y + A.scr.h + 10) state.shots.splice(i, 1);
    }
    for (var j = state.bits.length - 1; j >= 0; j--) {
      var b = state.bits[j]; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.94; b.vy *= 0.94; b.life -= dt;
      if (b.life <= 0) state.bits.splice(j, 1);
    }
    for (var k = state.edgeFlash.length - 1; k >= 0; k--) { state.edgeFlash[k].t -= dt; if (state.edgeFlash[k].t <= 0) state.edgeFlash.splice(k, 1); }
    if (state.shake > 0) state.shake -= dt;
    if (state.ko > 0) { state.ko -= dt; if (state.ko <= 0) reset(true); }
  }

  // ---------- drawing ----------
  var dotsCache = {};
  function dots(bg) {
    if (dotsCache[bg]) return dotsCache[bg];
    var c = document.createElement("canvas"); c.width = c.height = 10;
    var g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, 10, 10);
    g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(4, 4, 2, 2);
    return (dotsCache[bg] = ctx.createPattern(c, "repeat"));
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function label(text, x, y, col, flipped, size, align) {
    ctx.save();
    ctx.translate(x, y); if (flipped) ctx.rotate(Math.PI);
    ctx.fillStyle = col; ctx.font = "700 " + (size || 15) + "px 'Space Grotesk', system-ui, sans-serif";
    ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  function drawShip(p, body, wing, cut) {
    if (p.hidden) return;
    var flipped = p.dir > 0;
    var lean = speedFrom(p.tilt) * 0.21; // ships lean into the turn, max 12°
    ctx.save();
    ctx.translate(p.x, p.y);
    if (flipped) ctx.rotate(Math.PI);
    ctx.rotate(lean);
    ctx.scale(1.15, 1.15); ctx.translate(-24, -27);
    var f = p.flash > 0;
    if (paths) {
      var P = paths[p.kind];
      ctx.lineJoin = "round"; ctx.lineWidth = 2.4;
      ctx.fillStyle = ctx.strokeStyle = f ? COL.paper : wing; ctx.fill(P.shade); ctx.stroke(P.shade);
      ctx.fillStyle = ctx.strokeStyle = f ? COL.paper : body; ctx.fill(P.main); ctx.stroke(P.main);
      ctx.fillStyle = cut; ctx.fill(P.cut);
    } else {
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(24, 28, 12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function pips(n, x, y, col) {
    for (var i = 0; i < 3; i++) {
      var px = x + (i - 1) * 12 - 3;
      ctx.fillStyle = ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      if (i < n) ctx.fillRect(px, y, 6, 6); else ctx.strokeRect(px + 0.75, y + 0.75, 4.5, 4.5);
    }
  }

  // Draws one phone tilted by `deg`, with everything that's on its screen.
  function phone(P, pivot, deg, bg, contents) {
    ctx.save();
    ctx.translate(pivot.x, pivot.y); ctx.rotate(deg * Math.PI / 180); ctx.translate(-pivot.x, -pivot.y);
    ctx.fillStyle = COL.ink; rr(P.body.x, P.body.y, P.body.w, P.body.h, 34); ctx.fill();
    ctx.fillStyle = dots(bg); rr(P.scr.x, P.scr.y, P.scr.w, P.scr.h, 16); ctx.fill();
    ctx.save(); rr(P.scr.x, P.scr.y, P.scr.w, P.scr.h, 16); ctx.clip(); contents(); ctx.restore();
    ctx.restore();
  }

  function shotsOn(phoneName) {
    state.shots.forEach(function (s) {
      var onA = s.y >= EDGE_A;
      if ((phoneName === "A") !== onA) return;
      var mine = s.owner === "p1";
      var home = (mine && onA) || (!mine && !onA);
      var c = mine ? COL.p1 : COL.p2;
      if (!home) { ctx.fillStyle = COL.paper; ctx.fillRect(s.x - 5, s.y - 5, 10, 10); ctx.fillStyle = c; ctx.fillRect(s.x - 3.5, s.y - 3.5, 7, 7); }
      else { ctx.fillStyle = c; ctx.fillRect(s.x - 4, s.y - 4, 8, 8); }
    });
    state.bits.forEach(function (b) {
      if ((phoneName === "A") !== (b.y >= EDGE_A - 20)) return;
      ctx.globalAlpha = Math.max(0, b.life / 0.6); ctx.fillStyle = b.col; ctx.fillRect(b.x - 5, b.y - 5, 10, 10); ctx.globalAlpha = 1;
    });
    state.edgeFlash.forEach(function (e) {
      if (e.phone !== phoneName) return;
      ctx.globalAlpha = Math.max(0, e.t / 0.14); ctx.fillStyle = e.col;
      ctx.fillRect(e.x - 30, phoneName === "A" ? EDGE_A : EDGE_B - 5, 60, 5);
      ctx.globalAlpha = 1;
    });
  }

  function health(p, x, y, dirX) {
    for (var i = 0; i < 2; i++) {
      ctx.fillStyle = i < p.hp ? (p === state.p1 ? COL.p1 : COL.p2) : "rgba(244,239,230,0.18)";
      ctx.fillRect(x + dirX * i * 14, y, 10, 10);
    }
  }

  function draw() {
    var p1 = state.p1, p2 = state.p2;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (state.shake > 0 && !reduce) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);

    // A clockwise turn looks clockwise from either side, so both phones use the same sign.
    phone(B, PIVOT_B, p2.tilt * SHOW_TILT, COL.p2Bg, function () {
      label("PLAYER 2", B.scr.x + B.scr.w - 22, B.scr.y + B.scr.h - 22, "rgba(244,239,230,0.5)", true, 13);
      health(p2, B.scr.x + 20, B.scr.y + B.scr.h - 28, 1);
      pips(p2.ammo, p2.x, p2.y - 40, COL.p2);
      drawShip(p2, COL.p2, COL.p2Wing, COL.p2Bg);
      shotsOn("B");
      if (state.ko > 0) label(p2.hidden ? "KNOCKED OUT" : "WIN", W / 2, B.scr.y + B.scr.h / 2, COL.paper, true, 30, "center");
    });
    phone(A, PIVOT_A, p1.tilt * SHOW_TILT, COL.p1Bg, function () {
      label("PLAYER 1", A.scr.x + 22, A.scr.y + 22, "rgba(244,239,230,0.5)", false, 13);
      health(p1, A.scr.x + A.scr.w - 30, A.scr.y + 18, -1);
      pips(p1.ammo, p1.x, p1.y + 34, COL.p1);
      drawShip(p1, COL.p1, COL.p1Wing, COL.p1Bg);
      shotsOn("A");
      if (state.ko > 0) label(p1.hidden ? "KNOCKED OUT" : "WIN", W / 2, A.scr.y + A.scr.h / 2, COL.paper, false, 30, "center");
    });

    if (!playing) {
      ctx.fillStyle = "rgba(31,29,26,0.55)"; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---------- loop ----------
  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    if (playing) step(dt);
    draw();
    if (playing) requestAnimationFrame(frame); else running = false;
  }
  function setRunning(on) {
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!on) running = false;
  }

  function scale() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dotsCache = {};
    draw();
  }
  window.addEventListener("resize", scale);
  scale();
  updateScore();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

  // People who asked for less motion get a still frame and a button.
  if (playBtn) {
    playBtn.hidden = !reduce;
    playBtn.addEventListener("click", function () {
      playing = !playing;
      playBtn.textContent = playing ? "Pause demo" : "Play demo";
      setRunning(playing && visible);
    });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      setRunning(visible && playing && !document.hidden);
    }, { threshold: 0.1 }).observe(canvas);
  } else { visible = true; setRunning(playing); }
  document.addEventListener("visibilitychange", function () { setRunning(visible && playing && !document.hidden); });
})();
