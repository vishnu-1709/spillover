// Playable two-phone demo. Your phone at the bottom, a bot's phone at the top,
// top edges touching. Shots leave one screen and come out on the other.
(function () {
  var canvas = document.getElementById("demo");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("demo-score");
  var tiltBtn = document.getElementById("demo-tilt");
  var SH = window.SpilloverShips ? SpilloverShips.SHIPS : null;

  var W = 720, H = 860;
  // Phone bodies and screens (logical px)
  var B = { body: { x: 40, y: 28, w: 640, h: 372 }, scr: { x: 60, y: 48, w: 600, h: 332 } }; // bot, top
  var A = { body: { x: 40, y: 460, w: 640, h: 372 }, scr: { x: 60, y: 480, w: 600, h: 332 } }; // you, bottom
  var EDGE_A = A.scr.y;            // your screen's top edge
  var EDGE_B = B.scr.y + B.scr.h;  // bot screen's top edge (facing you)

  var COL = {
    youBg: "#3A2C12", you: "#F0C060", youWing: "#B88A30",
    botBg: "#2A1C2C", bot: "#B98ABE", botWing: "#845A88",
    paper: "#F4EFE6", ink: "#1F1D1A"
  };

  var SHIP_R = 22;   // hitbox radius
  var SPEED = 540;   // shot speed px/s
  var paths = null;
  if (SH && window.Path2D) {
    paths = {};
    ["shooter", "venom"].forEach(function (k) {
      paths[k] = { shade: new Path2D(SH[k].shade), main: new Path2D(SH[k].main), cut: new Path2D(SH[k].cut) };
    });
  }

  var state, started = false, running = false, last = 0, visible = false;
  var input = { target: null, left: false, right: false, tilt: 0, tiltOn: false };

  function reset(full) {
    var keepScore = state && !full ? state.score : { you: 0, bot: 0 };
    state = {
      you: { x: W / 2, y: A.scr.y + A.scr.h - 52, hp: 3, ammo: 3, refill: 0, flash: 0, lean: 0 },
      bot: { x: W / 2, y: B.scr.y + 52, hp: 3, ammo: 3, refill: 0, flash: 0, cool: 1.2, goal: W / 2, think: 0, lean: 0 },
      shots: [], bits: [], edgeFlash: [], ko: 0, shake: 0, score: keepScore
    };
  }
  reset(true);

  // ---------- input ----------
  function toLogical(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
  }
  canvas.addEventListener("pointermove", function (ev) {
    if (input.tiltOn) return;
    input.target = toLogical(ev).x;
  });
  canvas.addEventListener("pointerdown", function (ev) {
    if (!input.tiltOn) input.target = toLogical(ev).x;
    begin();
    fire(state.you, -1);
  });
  canvas.addEventListener("pointerleave", function () { if (!input.tiltOn) input.target = null; });
  canvas.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowLeft" || ev.key === "a") { input.left = true; input.target = null; ev.preventDefault(); begin(); }
    else if (ev.key === "ArrowRight" || ev.key === "d") { input.right = true; input.target = null; ev.preventDefault(); begin(); }
    else if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); begin(); fire(state.you, -1); }
  });
  canvas.addEventListener("keyup", function (ev) {
    if (ev.key === "ArrowLeft" || ev.key === "a") input.left = false;
    if (ev.key === "ArrowRight" || ev.key === "d") input.right = false;
  });

  // Tilt steering on phones
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  if (tiltBtn && coarse && "DeviceOrientationEvent" in window) {
    tiltBtn.hidden = false;
    tiltBtn.addEventListener("click", function () {
      if (input.tiltOn) { input.tiltOn = false; input.tilt = 0; tiltBtn.textContent = "Steer by tilting"; return; }
      var ask = window.DeviceOrientationEvent.requestPermission;
      (ask ? ask.call(window.DeviceOrientationEvent) : Promise.resolve("granted")).then(function (res) {
        if (res !== "granted") { tiltBtn.textContent = "Tilt not allowed"; return; }
        input.tiltOn = true; input.target = null;
        tiltBtn.textContent = "Steer by touch";
        begin();
      }).catch(function () { tiltBtn.textContent = "Tilt not available"; });
    });
    window.addEventListener("deviceorientation", function (e) {
      if (!input.tiltOn) return;
      var landscape = (screen.orientation && screen.orientation.type.indexOf("landscape") === 0) || window.innerWidth > window.innerHeight;
      var a = landscape ? (e.beta || 0) * (window.orientation === -90 ? -1 : 1) : (e.gamma || 0);
      var dead = 4, full = 25;
      var s = Math.abs(a) < dead ? 0 : Math.max(-1, Math.min(1, (Math.abs(a) - dead) / (full - dead))) * Math.sign(a);
      input.tilt = s;
    });
  }

  function begin() {
    if (!started) { started = true; state.bot.cool = 1.0; }
  }

  // ---------- game ----------
  function fire(ship, dir) {
    if (!started || state.ko > 0 || ship.ammo <= 0) return;
    ship.ammo--; ship.refill = 0.7;
    state.shots.push({ x: ship.x, y: ship.y + dir * 26, vy: dir * SPEED, owner: dir < 0 ? "you" : "bot", crossed: false });
  }

  function hit(target, owner) {
    target.hp--; target.flash = 0.12; state.shake = 0.14;
    if (target.hp <= 0) {
      state.score[owner]++;
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
        state.bits.push({ x: target.x, y: target.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.6, col: owner === "you" ? COL.bot : COL.you });
      }
      target.hidden = true;
      state.ko = 1.1;
      updateScore();
    }
  }

  function updateScore() {
    if (scoreEl) scoreEl.textContent = "You " + state.score.you + "   Bot " + state.score.bot;
  }

  function clampX(x) { return Math.max(A.scr.x + 30, Math.min(A.scr.x + A.scr.w - 30, x)); }

  function step(dt) {
    var you = state.you, bot = state.bot;

    // your movement: smoothed toward the pointer, or velocity from keys/tilt
    var prevX = you.x;
    var maxV = 620;
    if (input.tiltOn) you.x += input.tilt * maxV * dt;
    else if (input.left || input.right) you.x += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 480 * dt;
    else if (input.target != null) {
      var d = input.target - you.x;
      var v = Math.max(-maxV, Math.min(maxV, d * 9));
      you.x += v * dt;
    }
    you.x = clampX(you.x);
    you.lean += (Math.max(-1, Math.min(1, (you.x - prevX) / (dt * 500 || 1))) * 0.21 - you.lean) * Math.min(1, dt * 10);

    // bot: dodge the nearest incoming shot, otherwise drift toward you
    if (started && state.ko <= 0) {
      bot.think -= dt;
      var threat = null;
      state.shots.forEach(function (s) {
        if (s.owner === "you" && s.crossed && s.y > bot.y && Math.abs(s.x - bot.x) < 46) {
          if (!threat || s.y < threat.y) threat = s;
        }
      });
      if (threat && Math.random() < 0.9) bot.goal = clampX(bot.x + (threat.x < bot.x ? 90 : -90));
      else if (bot.think <= 0) { bot.goal = clampX(you.x + (Math.random() * 220 - 110)); bot.think = 0.6 + Math.random() * 0.8; }
      var bprev = bot.x;
      var bd = bot.goal - bot.x;
      bot.x += Math.max(-300, Math.min(300, bd * 5)) * dt;
      bot.x = clampX(bot.x);
      bot.lean += (Math.max(-1, Math.min(1, (bot.x - bprev) / (dt * 300 || 1))) * 0.21 - bot.lean) * Math.min(1, dt * 10);
      bot.cool -= dt;
      if (bot.cool <= 0 && Math.abs(bot.x - you.x) < 140) { fire(bot, 1); bot.cool = 0.9 + Math.random() * 0.9; }
    }

    // ammo refill (one at a time, after a short delay)
    [you, bot].forEach(function (s) {
      if (s.ammo < 3) { s.refill -= dt; if (s.refill <= 0) { s.ammo++; s.refill = 0.55; } }
      if (s.flash > 0) s.flash -= dt;
    });

    // shots
    for (var i = state.shots.length - 1; i >= 0; i--) {
      var s = state.shots[i];
      var py = s.y;
      s.y += s.vy * dt;
      // crossing the touching edges: the gap is just bezel, so the shot appears on the other screen at once
      if (s.vy < 0 && !s.crossed && s.y < EDGE_A) { s.y = EDGE_B - (EDGE_A - s.y); s.crossed = true; state.edgeFlash.push({ y: EDGE_B, x: s.x, t: 0.12, col: COL.you }); state.edgeFlash.push({ y: EDGE_A, x: s.x, t: 0.12, col: COL.you }); }
      if (s.vy > 0 && !s.crossed && s.y > EDGE_B) { s.y = EDGE_A + (s.y - EDGE_B); s.crossed = true; state.edgeFlash.push({ y: EDGE_A, x: s.x, t: 0.12, col: COL.bot }); state.edgeFlash.push({ y: EDGE_B, x: s.x, t: 0.12, col: COL.bot }); }
      var target = s.owner === "you" ? bot : you;
      if (s.crossed && !target.hidden && state.ko <= 0 && Math.abs(s.x - target.x) < SHIP_R + 4 && Math.abs(s.y - target.y) < SHIP_R + 4) {
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
    if (state.ko > 0) {
      state.ko -= dt;
      if (state.ko <= 0) { var sc = state.score; reset(false); state.score = sc; }
    }
  }

  // ---------- drawing ----------
  var dotsCache = {};
  function dots(bg, dark) {
    if (dotsCache[bg]) return dotsCache[bg];
    var c = document.createElement("canvas"); c.width = c.height = 10;
    var g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, 10, 10);
    g.fillStyle = dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.06)";
    g.fillRect(4, 4, 2, 2);
    return (dotsCache[bg] = ctx.createPattern(c, "repeat"));
  }

  function rr(x, y, w, h, r, keep) {
    if (!keep) ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function phone(p, bg) {
    ctx.fillStyle = COL.ink; rr(p.body.x, p.body.y, p.body.w, p.body.h, 34); ctx.fill();
    ctx.fillStyle = dots(bg); rr(p.scr.x, p.scr.y, p.scr.w, p.scr.h, 16); ctx.fill();
  }

  function drawShip(s, kind, body, wing, cutCol, flipped) {
    if (s.hidden) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (flipped) ctx.rotate(Math.PI);
    ctx.rotate(s.lean || 0);
    var k = 1.15;
    ctx.scale(k, k); ctx.translate(-24, -27);
    var f = s.flash > 0;
    if (paths) {
      ctx.lineJoin = "round"; ctx.lineWidth = 2.4;
      ctx.fillStyle = ctx.strokeStyle = f ? COL.paper : wing; ctx.fill(paths[kind].shade); ctx.stroke(paths[kind].shade);
      ctx.fillStyle = ctx.strokeStyle = f ? COL.paper : body; ctx.fill(paths[kind].main); ctx.stroke(paths[kind].main);
      ctx.fillStyle = cutCol; ctx.fill(paths[kind].cut);
    } else {
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(24, 28, 12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function pips(n, x, y, col, flipped) {
    for (var i = 0; i < 3; i++) {
      var px = x + (i - 1) * 12 - 3;
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      if (i < n) ctx.fillRect(px, y, 6, 6); else ctx.strokeRect(px + 0.75, y + 0.75, 4.5, 4.5);
    }
  }

  function label(text, x, y, col, flipped, size, align) {
    ctx.save();
    ctx.translate(x, y); if (flipped) ctx.rotate(Math.PI);
    ctx.fillStyle = col; ctx.font = "700 " + (size || 15) + "px 'Space Grotesk', system-ui, sans-serif";
    ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = "3px";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (state.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

    phone(B, COL.botBg);
    phone(A, COL.youBg);

    // the facing edges glow where a shot crosses
    state.edgeFlash.forEach(function (e) {
      ctx.fillStyle = e.col; ctx.globalAlpha = Math.max(0, e.t / 0.12);
      ctx.fillRect(e.x - 28, e.y === EDGE_A ? EDGE_A : EDGE_B - 4, 56, 4);
      ctx.globalAlpha = 1;
    });

    // screens clip everything that lives on them
    function onScreens(fn) {
      ctx.save();
      ctx.beginPath(); rr(A.scr.x, A.scr.y, A.scr.w, A.scr.h, 16, true); rr(B.scr.x, B.scr.y, B.scr.w, B.scr.h, 16, true); ctx.clip();
      fn(); ctx.restore();
    }
    onScreens(function () {
      label("YOU", A.scr.x + 22, A.scr.y + A.scr.h - 22, "rgba(244,239,230,0.55)", false, 14);
      label("BOT", B.scr.x + B.scr.w - 22, B.scr.y + 22, "rgba(244,239,230,0.55)", true, 14);
      pips(state.you.ammo, state.you.x, state.you.y + 34, COL.you);
      pips(state.bot.ammo, state.bot.x, state.bot.y - 40, COL.bot);
      // health: small bars at the outer corner
      for (var i = 0; i < 3; i++) {
        ctx.fillStyle = i < state.you.hp ? COL.you : "rgba(244,239,230,0.18)";
        ctx.fillRect(A.scr.x + A.scr.w - 30 - i * 14, A.scr.y + A.scr.h - 28, 10, 10);
        ctx.fillStyle = i < state.bot.hp ? COL.bot : "rgba(244,239,230,0.18)";
        ctx.fillRect(B.scr.x + 20 + i * 14, B.scr.y + 18, 10, 10);
      }
      drawShip(state.bot, "venom", COL.bot, COL.botWing, COL.botBg, true);
      drawShip(state.you, "shooter", COL.you, COL.youWing, COL.youBg, false);
      state.shots.forEach(function (s) {
        var onYours = s.y >= EDGE_A;
        var mine = s.owner === "you";
        var home = (mine && onYours) || (!mine && !onYours);
        ctx.fillStyle = mine ? COL.you : COL.bot;
        if (!home) { ctx.fillStyle = COL.paper; ctx.fillRect(s.x - 5, s.y - 5, 10, 10); ctx.fillStyle = mine ? COL.you : COL.bot; ctx.fillRect(s.x - 3.5, s.y - 3.5, 7, 7); }
        else ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
      });
      state.bits.forEach(function (b) { ctx.globalAlpha = Math.max(0, b.life / 0.6); ctx.fillStyle = b.col; ctx.fillRect(b.x - 5, b.y - 5, 10, 10); ctx.globalAlpha = 1; });

      if (!started) {
        ctx.fillStyle = "rgba(31,29,26,0.55)"; ctx.fillRect(A.scr.x, A.scr.y, A.scr.w, A.scr.h);
        label(coarse ? "TAP TO PLAY" : "CLICK TO PLAY", W / 2, A.scr.y + A.scr.h / 2, COL.paper, false, 28, "center");
        label("move to steer, tap to shoot", W / 2, A.scr.y + A.scr.h / 2 + 34, "rgba(244,239,230,0.8)", false, 15, "center");
      }
      if (state.ko > 0) {
        var youLost = state.you.hidden;
        label(youLost ? "KNOCKED OUT" : "KO", W / 2, A.scr.y + A.scr.h / 2 - 20, COL.paper, false, 30, "center");
        label(youLost ? "KO" : "KNOCKED OUT", W / 2, B.scr.y + B.scr.h / 2 + 20, COL.paper, true, 30, "center");
      }
    });
    ctx.restore();
  }

  // ---------- loop ----------
  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    if (started) step(dt);
    draw();
    requestAnimationFrame(frame);
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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      setRunning(visible && !document.hidden);
    }, { threshold: 0.15 }).observe(canvas);
  } else { visible = true; setRunning(true); }
  document.addEventListener("visibilitychange", function () { setRunning(visible && !document.hidden); });
})();
