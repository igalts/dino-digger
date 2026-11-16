'use strict';
(() => {
  // ---------- Board geometry ----------
  // The board is a 360x560 logical canvas split into 4px cells (90 x 140).
  // Cell values: 0 = dirt (unclaimed), 1 = claimed, 2 = trail being drawn.
  const LW = 360, LH = 560, CELL = 4, GW = LW / CELL, GH = LH / CELL;
  const INTERIOR = (GW - 2) * (GH - 2);
  const PAD = 18; // margin around the board so sprites on the edge aren't clipped
  const VW = LW + PAD * 2, VH = LH + PAD * 2;
  const INK = '#2B1B3D';
  const PLAYER_SPEED = 30;      // cells per second
  const PLAYER_SIZE = 50;
  const ITEM_SIZE = 32;

  // ---------- Content ----------
  const CHARS = {
    pip:   { name: 'פיפ',  img: 'pip',   perk: 'חוקר אמיץ' },
    stegi: { name: 'סטגי', img: 'stegi', perk: 'מתחיל כל שלב עם מגן', shieldStart: true },
    petra: { name: 'פטרה', img: 'petra', perk: 'הכי מהירה', speed: 1.3 },
    anki:  { name: 'אנקי', img: 'anki',  perk: '4 ביצים במקום 3', lives: 4 },
    rafi:  { name: 'רפי',  img: 'rafi',  perk: 'הפתעות נמשכות כפול', powerDur: 2 },
    rex:   { name: 'רקס',  img: 'magma-rex', perk: 'מגן וגם מהירות', shieldStart: true, speed: 1.15, faceLeft: true, w: 240, h: 220 },
  };
  const CHAR_ORDER = ['pip', 'stegi', 'petra', 'anki', 'rafi', 'rex'];
  const JOINS = { petra: ['מצטרפת', 'אותה'] }; // everyone else: מצטרף / אותו

  // goal %, boss speed, buzzers, buzzer speed, lava drops, lava speed (cells/s)
  const lv = (goal, boss, buzzers, buzz, lava = 0, lavaSpeed = 0) => ({ goal, boss, buzzers, buzz, lava, lavaSpeed });
  const WORLDS = [
    { name: 'עמק הר הגעש', unlock: 'stegi',
      levels: [lv(65, 44, 0, 0), lv(65, 50, 0, 0), lv(65, 55, 1, 72), lv(65, 60, 1, 78), lv(65, 64, 2, 82)] },
    { name: 'הג׳ונגל', unlock: 'petra',
      levels: [lv(70, 54, 2, 80), lv(70, 58, 2, 82), lv(70, 62, 3, 84), lv(70, 65, 3, 86), lv(70, 68, 3, 88)] },
    { name: 'החוף', unlock: 'anki',
      levels: [lv(75, 58, 1, 84, 1, 11), lv(75, 62, 1, 86, 1, 12), lv(75, 65, 2, 86, 1, 12), lv(75, 68, 2, 88, 2, 13), lv(75, 70, 2, 90, 2, 14)] },
    { name: 'ארץ הקרח', unlock: 'rafi', charge: true,
      levels: [lv(78, 60, 1, 86, 1, 12), lv(78, 64, 1, 88, 1, 13), lv(78, 67, 2, 88, 1, 13), lv(78, 70, 2, 90, 2, 14), lv(78, 72, 2, 92, 2, 15)] },
    { name: 'הלילה', unlock: 'rex', charge: true, itemsExpire: true,
      levels: [lv(80, 64, 2, 88, 1, 13), lv(80, 67, 2, 90, 2, 13), lv(80, 70, 2, 92, 2, 14), lv(80, 73, 3, 92, 2, 15), lv(80, 76, 3, 94, 2, 16)] },
  ];
  const sceneName = (w, l) => `s${w + 1}-${l + 1}`;
  const worldOpen = (w) => w === 0 || (store.data.stars[`${w}-5`] || 0) > 0;
  const levelOpen = (w, l) => (l === 0 ? worldOpen(w) : (store.data.stars[`${w + 1}-${l}`] || 0) > 0);

  const ENEMY = {
    boss:   { img: 'magma-rex', w: 104, h: 95, faceLeft: true, r: 22, hitR: 30 },
    buzzer: { img: 'buzzer',    w: 42,  h: 42, faceLeft: true, r: 12, hitR: 15 },
    lava:   { img: 'lava-blob', w: 36,  h: 36, faceLeft: false, r: 0, hitR: 16 },
  };
  const ITEMS = {
    bone:   { img: 'power-bone',   label: 'מהר!' },
    shield: { img: 'power-shield', label: 'מגן!' },
    ice:    { img: 'power-ice',    label: 'קפוא!' },
    amber:  { img: 'power-amber',  label: '+500' },
  };
  const ASSETS = ['pip', 'stegi', 'petra', 'anki', 'rafi', 'magma-rex', 'buzzer', 'lava-blob', 'power-bone', 'power-shield',
    'power-ice', 'power-amber', 'egg', 'dirt-1', 'dirt-2', 'dirt-3', 'dirt-4', 'dirt-5'];

  // Starting shapes (in cells, board is 90x140): pre-claimed bits so each level opens differently.
  // ['r', x, y, w, h] rectangle, ['c', cx, cy, r] circle.
  const LAYOUTS = {
    plain: [],
    peeks: [['c', 22, 35, 7], ['c', 68, 35, 7], ['c', 22, 105, 7], ['c', 68, 105, 7]],
    pillars: [['r', 28, 0, 5, 38], ['r', 57, 102, 5, 38]],
    notches: [['r', 0, 44, 16, 10], ['r', 74, 86, 16, 10]],
    islands: [['c', 18, 72, 6], ['c', 72, 72, 6], ['c', 45, 18, 5], ['c', 45, 116, 5]],
    steps: [['r', 0, 0, 20, 12], ['r', 70, 0, 20, 12], ['r', 0, 128, 14, 12], ['r', 76, 128, 14, 12]],
  };
  const WORLD_LAYOUTS = [
    ['plain', 'peeks', 'pillars', 'notches', 'islands'],
    ['steps', 'islands', 'plain', 'pillars', 'peeks'],
    ['peeks', 'notches', 'steps', 'islands', 'pillars'],
    ['pillars', 'plain', 'islands', 'steps', 'notches'],
    ['notches', 'steps', 'peeks', 'pillars', 'islands'],
  ];

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Saved progress ----------
  const store = {
    key: 'dinoDig.v1',
    data: { stars: {}, unlocked: ['pip'], selected: 'pip', streak: {}, muted: false },
    load() {
      try { const d = JSON.parse(localStorage.getItem(this.key)); if (d) Object.assign(this.data, d); } catch (e) { /* ignore */ }
    },
    save() {
      try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    },
  };

  // ---------- Sound (synthesized, no files) ----------
  const sfx = {
    ctx: null,
    init() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'triangle', vol = 0.08, when = 0, slide = 0) {
      if (!this.ctx || store.data.muted) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    claim() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.09, i * 0.06)); },
    hit()   { this.tone(240, 0.4, 'sawtooth', 0.09, 0, 70); },
    pop()   { this.tone(700, 0.12, 'square', 0.05, 0, 1600); },
    power() { [784, 988, 1319].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.08, i * 0.05)); },
    win()   { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.1, i * 0.13)); },
    lose()  { [392, 330, 262].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.09, i * 0.22)); },
    tap()   { this.tone(660, 0.06, 'triangle', 0.06); },
  };

  // ---------- Images & rasterized sprites ----------
  const images = {};
  let sprites = {};
  let RES = 1; // device pixels per logical pixel

  function loadImages() {
    return Promise.all(ASSETS.map((n) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { images[n] = im; res(); };
      im.onerror = () => res();
      im.src = `assets/${n}.svg`;
    })));
  }
  // Level pictures load on demand (and the next one is fetched in the background).
  function loadScene(name) {
    if (images[name]) return Promise.resolve();
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => { images[name] = im; res(); };
      im.onerror = () => res();
      im.src = `assets/${name}.svg`;
    });
  }
  function spr(name, w, h) {
    const key = `${name}@${w}x${h}`;
    if (!sprites[key]) {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w * RES));
      cv.height = Math.max(1, Math.ceil(h * RES));
      if (images[name]) cv.getContext('2d').drawImage(images[name], 0, 0, cv.width, cv.height);
      sprites[key] = cv;
    }
    return sprites[key];
  }

  // ---------- Canvas ----------
  const cv = $('#cv');
  const ctx = cv.getContext('2d');
  const dirtCv = document.createElement('canvas');
  const dirtCtx = dirtCv.getContext('2d');
  let sceneCv = null;
  let dirtPattern = null;

  function resize() {
    const wrap = $('#boardWrap');
    const W = wrap.clientWidth - 12, H = wrap.clientHeight;
    if (W <= 0 || H <= 0) return;
    const s = Math.min(W / VW, H / VH);
    cv.style.width = `${Math.floor(VW * s)}px`;
    cv.style.height = `${Math.floor(VH * s)}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    RES = s * dpr;
    cv.width = Math.round(VW * RES);
    cv.height = Math.round(VH * RES);
    dirtCv.width = Math.round(LW * RES);
    dirtCv.height = Math.round(LH * RES);
    sprites = {};
    if (G) { makeDirtPattern(); buildScene(); rebuildDirt(); }
  }
  function makeDirtPattern() {
    const tile = document.createElement('canvas');
    tile.width = tile.height = Math.max(8, Math.round(40 * RES));
    const img = images[`dirt-${G.w + 1}`];
    if (img) tile.getContext('2d').drawImage(img, 0, 0, tile.width, tile.height);
    dirtPattern = dirtCtx.createPattern(tile, 'repeat');
    if (dirtPattern.setTransform) dirtPattern.setTransform(new DOMMatrix().scale(40 / tile.width));
  }
  function buildScene() {
    sceneCv = document.createElement('canvas');
    sceneCv.width = dirtCv.width; sceneCv.height = dirtCv.height;
    const img = images[G.scene];
    if (img) sceneCv.getContext('2d').drawImage(img, 0, 0, sceneCv.width, sceneCv.height);
  }

  // Paint all non-claimed cells with the dirt texture, then outline the claimed/unclaimed boundary.
  function rebuildDirt() {
    const g = G.grid, c = dirtCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, dirtCv.width, dirtCv.height);
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.beginPath();
    for (let y = 0; y < GH; y++) {
      let x = 0;
      while (x < GW) {
        if (g[y * GW + x] !== 1) {
          const s = x;
          while (x < GW && g[y * GW + x] !== 1) x++;
          c.rect(s * CELL, y * CELL, (x - s) * CELL, CELL);
        } else x++;
      }
    }
    c.fillStyle = dirtPattern || '#A0673F';
    c.fill();

    c.beginPath();
    for (let y = 1; y < GH; y++) {
      let x = 0;
      while (x < GW) {
        const edge = (g[(y - 1) * GW + x] === 1) !== (g[y * GW + x] === 1);
        if (edge) {
          const s = x;
          while (x < GW && ((g[(y - 1) * GW + x] === 1) !== (g[y * GW + x] === 1))) x++;
          c.moveTo(s * CELL, y * CELL); c.lineTo(x * CELL, y * CELL);
        } else x++;
      }
    }
    for (let x = 1; x < GW; x++) {
      let y = 0;
      while (y < GH) {
        const edge = (g[y * GW + x - 1] === 1) !== (g[y * GW + x] === 1);
        if (edge) {
          const s = y;
          while (y < GH && ((g[y * GW + x - 1] === 1) !== (g[y * GW + x] === 1))) y++;
          c.moveTo(x * CELL, s * CELL); c.lineTo(x * CELL, y * CELL);
        } else y++;
      }
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.8; c.stroke();
  }

  // ---------- Game state ----------
  let G = null;
  let paused = false;
  let screen = 'title';

  async function startLevel(w, l) {
    const scene = sceneName(w, l);
    await loadScene(scene);
    const nw = l + 1 < WORLDS[w].levels.length ? w : w + 1;
    if (WORLDS[nw]) loadScene(sceneName(nw, nw === w ? l + 1 : 0));
    const cfg = WORLDS[w].levels[l];
    const ch = CHARS[store.data.selected] || CHARS.pip;
    const key = `${w + 1}-${l + 1}`;
    const ease = (store.data.streak[key] || 0) >= 3 ? 0.85 : 1; // quiet help after 3 losses in a row
    const lives = ch.lives || 3;
    G = {
      w, l, cfg, key, ch, ease, scene, world: WORLDS[w],
      grid: new Uint8Array(GW * GH),
      lives, maxLives: lives, score: 0, percent: 0,
      player: { x: Math.floor(GW / 2), y: GH - 1, face: 1, drawing: false, trail: [], startX: 0, startY: 0,
        acc: 0, invuln: 0, shield: !!ch.shieldStart, boost: 0 },
      enemies: [], items: [], particles: [],
      freeze: 0, state: 'ready', readyT: 1.8, t: 0, itemTimer: 12, shake: 0, winT: 0,
    };
    const g = G.grid;
    for (let x = 0; x < GW; x++) { g[x] = 1; g[(GH - 1) * GW + x] = 1; }
    for (let y = 0; y < GH; y++) { g[y * GW] = 1; g[y * GW + GW - 1] = 1; }
    for (const sh of LAYOUTS[WORLD_LAYOUTS[w][l]] || []) {
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const inside = sh[0] === 'r'
            ? x >= sh[1] && x < sh[1] + sh[3] && y >= sh[2] && y < sh[2] + sh[4]
            : (x - sh[1]) ** 2 + (y - sh[2]) ** 2 <= sh[3] ** 2;
          if (inside) g[y * GW + x] = 1;
        }
      }
    }
    computePercent();

    G.enemies.push(makeEnemy('boss', LW / 2, LH * 0.35, cfg.boss * ease));
    for (let i = 0; i < cfg.buzzers; i++) {
      let x = 0, y = 0;
      for (let k = 0; k < 50; k++) {
        x = rand(60, LW - 60); y = rand(60, LH * 0.5);
        if (!blockedAt(x, y, ENEMY.buzzer.r)) break;
      }
      G.enemies.push(makeEnemy('buzzer', x, y, cfg.buzz * ease));
    }
    const corners = [[0, 0, 1], [GW - 1, 0, -1]];
    for (let i = 0; i < cfg.lava; i++) {
      const [cx, cy, dx] = corners[i % 2];
      G.enemies.push({ kind: 'lava', ...ENEMY.lava, cx, cy, x: cx * CELL + 2, y: cy * CELL + 2, dir: { x: dx, y: 0 },
        acc: 0, speed: cfg.lavaSpeed * ease, vx: 0, vy: 0, anim: Math.random() * 6 });
    }
    spawnItem(); spawnItem();

    paused = false;
    hideOverlays();
    $('#game').dataset.world = String(w + 1);
    show('game');
    resize();
    buildLives();
    updateHud();
    const b = $('#banner');
    b.innerHTML = `<small class="wname">${WORLDS[w].name}</small>שלב ${l + 1}<small>תפסו ${cfg.goal}%</small>`;
    b.hidden = false;
    input.dir = null; input.target = null;
    applyControlMode();
    keepAwake();
  }

  function makeEnemy(kind, x, y, speed) {
    const d = ENEMY[kind];
    const e = { kind, x, y, speed, vx: 0, vy: 0, turnT: rand(1, 3), anim: Math.random() * 6, ...d };
    setHeading(e, rand(0, Math.PI * 2));
    return e;
  }
  function setHeading(e, a) {
    if (Math.abs(Math.cos(a)) < 0.3 || Math.abs(Math.sin(a)) < 0.3) a += 0.6;
    e.vx = Math.cos(a) * e.speed;
    e.vy = Math.sin(a) * e.speed;
  }

  function cellAt(px, py) {
    const x = Math.floor(px / CELL), y = Math.floor(py / CELL);
    if (x < 0 || y < 0 || x >= GW || y >= GH) return 1;
    return G.grid[y * GW + x];
  }
  function blockedAt(x, y, r) {
    if (r === 0) return cellAt(x, y) === 1;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (cellAt(x + Math.cos(a) * r, y + Math.sin(a) * r) === 1) return true;
    }
    return false;
  }

  function spawnItem() {
    const boss = G.enemies.find((e) => e.kind === 'boss');
    const types = Object.keys(ITEMS);
    for (let tries = 0; tries < 80; tries++) {
      const x = 7 + Math.floor(Math.random() * (GW - 14));
      const y = 7 + Math.floor(Math.random() * (GH - 14));
      let ok = true;
      for (let yy = y - 5; yy <= y + 5 && ok; yy++) {
        for (let xx = x - 5; xx <= x + 5; xx++) { if (G.grid[yy * GW + xx] !== 0) { ok = false; break; } }
      }
      if (!ok) continue;
      const px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
      if (boss && Math.hypot(boss.x - px, boss.y - py) < 70) continue;
      if (G.items.some((it) => Math.hypot(it.x - px, it.y - py) < 50)) continue;
      G.items.push({ type: types[Math.floor(Math.random() * types.length)], x: px, y: py, t: Math.random() * 6,
        life: G.world.itemsExpire ? 8 : Infinity });
      return;
    }
  }

  // ---------- Update ----------
  function update(dt) {
    G.t += dt;
    updateParticles(dt);
    if (G.shake > 0) G.shake -= dt;

    if (G.state === 'ready') {
      G.readyT -= dt;
      if (G.readyT <= 0) { G.state = 'play'; $('#banner').hidden = true; }
      return;
    }
    if (G.state === 'won') { updateWin(dt); return; }
    if (G.state !== 'play') return;

    const p = G.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.boost > 0) p.boost -= dt;
    if (G.freeze > 0) G.freeze -= dt;

    // Auto-finish: in the dirt with no finger down, Pip keeps walking until he reaches the edge.
    const auto = p.drawing && controlMode() !== 'touch' ? p.lastDir : null;
    if (input.dir || input.target || auto) {
      const speed = PLAYER_SPEED * (G.ch.speed || 1) * (p.boost > 0 ? 1.5 : 1);
      p.acc += dt * speed;
      while (p.acc >= 1) {
        p.acc -= 1;
        const d = input.dir || (input.target ? followDir() : null) || (p.drawing && controlMode() !== 'touch' ? p.lastDir : null);
        if (!d || !stepPlayer(d.x, d.y)) { p.acc = 0; break; }
      }
    } else p.acc = 0;
    if (G.state !== 'play') return;

    for (const e of G.enemies) { if (e.kind === 'lava') updateCrawler(e, dt); else updateEnemy(e, dt); }

    if (p.invuln <= 0 && G.freeze <= 0) {
      const px = p.x * CELL + CELL / 2, py = p.y * CELL + CELL / 2;
      for (const e of G.enemies) {
        // Lava drops walk the safe edges, so they can bump Pip even when he isn't digging.
        if (e.kind === 'lava') { if (Math.hypot(e.x - px, e.y - py) < e.hitR) { onHit(); break; } continue; }
        if (p.drawing && (Math.hypot(e.x - px, e.y - py) < e.hitR + 10 || trailHit(e))) { onHit(); break; }
      }
    }

    for (const it of G.items) it.life -= dt;
    G.items = G.items.filter((it) => it.life > 0);

    G.itemTimer -= dt;
    if (G.itemTimer <= 0) { G.itemTimer = 14; if (G.items.length < 2) spawnItem(); }
  }

  function stepPlayer(dx, dy) {
    const p = G.player, g = G.grid;
    const nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) return false;
    const i = ny * GW + nx, c = g[i];
    if (dx) p.face = dx;
    if (c !== 2) { p.axis = dx ? 'x' : 'y'; p.lastDir = { x: dx, y: dy }; }
    if (!p.drawing) {
      if (c === 1) { p.x = nx; p.y = ny; return true; }
      if (c === 0) {
        p.drawing = true; p.startX = p.x; p.startY = p.y;
        p.trail = [[p.x, p.y], [nx, ny]];
        g[i] = 2; p.x = nx; p.y = ny;
        return true;
      }
      return false;
    }
    if (c === 0) { g[i] = 2; p.trail.push([nx, ny]); p.x = nx; p.y = ny; return true; }
    if (c === 2) return false; // can't cross your own trail
    p.trail.push([nx, ny]); p.x = nx; p.y = ny;
    closeTrail();
    return false;
  }

  // ---------- Touch-to-go: work out Pip's next step toward the touched spot ----------
  const bfsPrev = new Int32Array(GW * GH);
  const bfsQueue = new Int32Array(GW * GH);

  // Shortest walk over claimed (safe) ground; returns the first step or null.
  function safeStep(sx, sy, tx, ty) {
    const g = G.grid, s = sy * GW + sx, t = ty * GW + tx;
    bfsPrev.fill(-1);
    bfsPrev[s] = s;
    let h = 0, tl = 0;
    bfsQueue[tl++] = s;
    while (h < tl) {
      const i = bfsQueue[h++];
      if (i === t) break;
      const x = i % GW;
      if (x > 0 && bfsPrev[i - 1] === -1 && g[i - 1] === 1) { bfsPrev[i - 1] = i; bfsQueue[tl++] = i - 1; }
      if (x < GW - 1 && bfsPrev[i + 1] === -1 && g[i + 1] === 1) { bfsPrev[i + 1] = i; bfsQueue[tl++] = i + 1; }
      if (i >= GW && bfsPrev[i - GW] === -1 && g[i - GW] === 1) { bfsPrev[i - GW] = i; bfsQueue[tl++] = i - GW; }
      if (i < GW * (GH - 1) && bfsPrev[i + GW] === -1 && g[i + GW] === 1) { bfsPrev[i + GW] = i; bfsQueue[tl++] = i + GW; }
    }
    if (bfsPrev[t] === -1) return null;
    let i = t;
    while (bfsPrev[i] !== s) i = bfsPrev[i];
    return { x: (i % GW) - sx, y: Math.floor(i / GW) - sy };
  }

  function followDir() {
    const p = G.player, t = input.target;
    if (!t || (p.x === t.x && p.y === t.y)) return null;
    if (!p.drawing && G.grid[t.y * GW + t.x] === 1) {
      const s = safeStep(p.x, p.y, t.x, t.y);
      if (s) return s;
    }
    // Otherwise an L-shaped path: keep going along the current axis until lined up, then turn.
    const dx = t.x - p.x, dy = t.y - p.y;
    let axis = p.axis || (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y');
    if (axis === 'x' && dx === 0) axis = 'y';
    if (axis === 'y' && dy === 0) axis = 'x';
    const options = axis === 'x' ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }] : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];
    for (const o of options) {
      if (!o.x && !o.y) continue;
      const nx = p.x + o.x, ny = p.y + o.y;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      if (G.grid[ny * GW + nx] === 2) continue; // own trail in the way
      return o;
    }
    return null;
  }

  // A touch close to the safe edge counts as the edge, so Pip doesn't stop just short in the dirt.
  function snapTarget(cx, cy) {
    if (G.grid[cy * GW + cx] === 1) return { x: cx, y: cy };
    const R = 5;
    let best = null, bd = Infinity;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= GW || y >= GH || G.grid[y * GW + x] !== 1) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    return best || { x: cx, y: cy };
  }

  function trailHit(e) {
    const t = G.player.trail, r2 = e.hitR * e.hitR;
    for (let k = 1; k < t.length; k++) {
      const dx = t[k][0] * CELL + CELL / 2 - e.x, dy = t[k][1] * CELL + CELL / 2 - e.y;
      if (dx * dx + dy * dy < r2) return true;
    }
    return false;
  }

  // ---------- Lava drops: crawl along the claimed/unclaimed border ----------
  function isEdge(i) {
    if (G.grid[i] !== 1) return false;
    const x = i % GW, y = Math.floor(i / GW);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        if (G.grid[ny * GW + nx] !== 1) return true;
      }
    }
    return false;
  }
  function relocateCrawler(e) {
    const s = e.cy * GW + e.cx;
    const seen = new Uint8Array(GW * GH);
    const q = [s]; seen[s] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (isEdge(i)) { e.cx = i % GW; e.cy = Math.floor(i / GW); return; }
      const x = i % GW;
      for (const j of [x > 0 ? i - 1 : -1, x < GW - 1 ? i + 1 : -1, i - GW, i + GW]) {
        if (j >= 0 && j < GW * GH && !seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
  }
  const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  function crawlStep(e) {
    const opts = [];
    for (const d of DIRS4) {
      if (d.x === -e.dir.x && d.y === -e.dir.y) continue;
      const nx = e.cx + d.x, ny = e.cy + d.y;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      if (isEdge(ny * GW + nx)) opts.push(d);
    }
    let d;
    if (!opts.length) d = { x: -e.dir.x, y: -e.dir.y };
    else {
      const straight = opts.find((o) => o.x === e.dir.x && o.y === e.dir.y);
      d = straight && Math.random() < 0.85 ? straight : opts[Math.floor(Math.random() * opts.length)];
    }
    const nx = e.cx + d.x, ny = e.cy + d.y;
    if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && G.grid[ny * GW + nx] === 1) { e.cx = nx; e.cy = ny; }
    e.dir = d;
  }
  function updateCrawler(e, dt) {
    e.anim += dt;
    if (G.freeze > 0) return;
    if (!isEdge(e.cy * GW + e.cx)) relocateCrawler(e);
    e.acc += dt * e.speed;
    while (e.acc >= 1) { e.acc -= 1; crawlStep(e); }
    e.x = e.cx * CELL + CELL / 2; e.y = e.cy * CELL + CELL / 2;
  }

  // Ice and night worlds: every few seconds Rex charges at Pip's trail.
  function bossCharge(e, dt) {
    const p = G.player;
    if (e.charging > 0) {
      e.charging -= dt;
      if (e.charging <= 0) setHeading(e, Math.atan2(e.vy, e.vx));
      return true;
    }
    e.chargeCD = (e.chargeCD === undefined ? rand(3, 5) : e.chargeCD) - dt;
    if (e.chargeCD > 0 || !p.drawing || p.trail.length < 4) return false;
    let best = null, bd = Infinity;
    for (const [x, y] of p.trail) {
      const d = Math.hypot(x * CELL + 2 - e.x, y * CELL + 2 - e.y);
      if (d < bd) { bd = d; best = [x * CELL + 2, y * CELL + 2]; }
    }
    const a = Math.atan2(best[1] - e.y, best[0] - e.x);
    e.vx = Math.cos(a) * e.speed * 1.9; e.vy = Math.sin(a) * e.speed * 1.9;
    e.charging = 1.1; e.chargeCD = rand(3.5, 5.5);
    floatText(e.x, e.y - 50, '!', '#FF6B2C');
    sfx.tone(180, 0.25, 'sawtooth', 0.07, 0, 320);
    return true;
  }

  function updateEnemy(e, dt) {
    e.anim += dt;
    if (G.freeze > 0) return;
    const charging = e.kind === 'boss' && G.world.charge && bossCharge(e, dt);
    e.turnT -= dt;
    if (e.turnT <= 0 && !charging) {
      e.turnT = e.kind === 'boss' ? rand(2, 5) : rand(0.5, 1.3);
      setHeading(e, rand(0, Math.PI * 2));
    }
    // If the area around the enemy got too tight, fall back to checking just its centre.
    const r = blockedAt(e.x, e.y, e.r) ? 0 : e.r;
    let nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
    if (blockedAt(nx, e.y, r)) { e.vx = -e.vx; nx = e.x; }
    if (blockedAt(nx, ny, r)) { e.vy = -e.vy; ny = e.y; }
    if (!blockedAt(nx, ny, r)) { e.x = nx; e.y = ny; }
  }

  function seedFor(e) {
    const cx = clamp(Math.floor(e.x / CELL), 0, GW - 1), cy = clamp(Math.floor(e.y / CELL), 0, GH - 1);
    const start = cy * GW + cx;
    if (G.grid[start] === 0) return start;
    const seen = new Uint8Array(GW * GH);
    const q = [start]; seen[start] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (G.grid[i] === 0) return i;
      const x = i % GW;
      const nb = [x > 0 ? i - 1 : -1, x < GW - 1 ? i + 1 : -1, i - GW, i + GW];
      for (const j of nb) { if (j >= 0 && j < GW * GH && !seen[j]) { seen[j] = 1; q.push(j); } }
    }
    return -1;
  }

  function closeTrail() {
    const p = G.player, g = G.grid;
    const trail = p.trail;
    for (const [x, y] of trail) g[y * GW + x] = 1;
    p.trail = []; p.drawing = false;

    // Everything not reachable from the boss becomes claimed.
    const boss = G.enemies.find((e) => e.kind === 'boss');
    const seed = boss ? seedFor(boss) : -1;
    const mark = new Uint8Array(GW * GH);
    if (seed >= 0) {
      const st = [seed]; mark[seed] = 1;
      while (st.length) {
        const i = st.pop(), x = i % GW;
        const nb = [x > 0 ? i - 1 : -1, x < GW - 1 ? i + 1 : -1, i - GW, i + GW];
        for (const j of nb) {
          if (j >= 0 && j < GW * GH && !mark[j] && g[j] === 0) { mark[j] = 1; st.push(j); }
        }
      }
      if (cellAt(boss.x, boss.y) === 1) { boss.x = (seed % GW) * CELL + CELL / 2; boss.y = Math.floor(seed / GW) * CELL + CELL / 2; }
    }
    let gained = trail.length;
    for (let i = 0; i < g.length; i++) if (g[i] === 0 && !mark[i]) { g[i] = 1; gained++; }
    G.score += gained;

    for (const e of G.enemies) {
      if (e.kind === 'buzzer' && cellAt(e.x, e.y) === 1) {
        e.dead = true; G.score += 300;
        burst(e.x, e.y, ['#8E5BD9', '#FFD23F', '#FFFFFF']);
        floatText(e.x, e.y - 10, '+300', '#FFD23F');
        sfx.pop();
      }
    }
    G.enemies = G.enemies.filter((e) => !e.dead);

    for (const it of G.items) {
      if (cellAt(it.x, it.y) === 1) { it.taken = true; collect(it); }
    }
    G.items = G.items.filter((it) => !it.taken);

    for (let k = 0; k < trail.length; k += 6) {
      const [x, y] = trail[k];
      burst(x * CELL + 2, y * CELL + 2, ['#FFD23F', '#FFFFFF'], 3);
    }

    computePercent();
    rebuildDirt();
    sfx.claim();
    updateHud();
    if (G.percent >= G.cfg.goal) win();
  }

  function computePercent() {
    let n = 0;
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) if (G.grid[y * GW + x] === 1) n++;
    G.percent = Math.floor(n * 100 / INTERIOR);
  }

  function collect(it) {
    const p = G.player, dur = G.ch.powerDur || 1;
    if (it.type === 'bone') p.boost = 8 * dur;
    if (it.type === 'shield') p.shield = true;
    if (it.type === 'ice') G.freeze = 5 * dur;
    if (it.type === 'amber') G.score += 500;
    floatText(it.x, it.y, ITEMS[it.type].label, '#FFFFFF');
    burst(it.x, it.y, ['#FFD23F', '#4FC3F7', '#FFFFFF'], 10);
    sfx.power();
  }

  function onHit() {
    const p = G.player, g = G.grid;
    const px = p.x * CELL + 2, py = p.y * CELL + 2;
    if (p.shield) {
      p.shield = false; p.invuln = 1.5;
      floatText(px, py - 20, 'המגן הציל!', '#BDEBFF');
      sfx.pop();
      return;
    }
    G.lives--;
    sfx.hit();
    G.shake = 0.4;
    try { if (navigator.vibrate) navigator.vibrate(180); } catch (e) { /* ignore */ }
    burst(px, py, ['#E8553D', '#FFD23F'], 12);
    if (p.drawing) {
      for (const [x, y] of p.trail) if (g[y * GW + x] === 2) g[y * GW + x] = 0;
      p.x = p.startX; p.y = p.startY;
    }
    p.trail = []; p.drawing = false;
    p.invuln = 2; p.acc = 0; p.axis = null; p.lastDir = null;
    input.dir = null; input.target = null; padRelease();
    buildLives();
    if (G.lives <= 0) lose();
  }

  // ---------- Finish animation ----------
  const REVEAL_TIME = 1.5;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const revealRadius = () => (G.winMaxR + 8) * easeInOut(Math.min(1, G.winT / REVEAL_TIME));
  const CONFETTI = ['#FFD23F', '#5CCB5F', '#FF8FA3', '#4FC3F7', '#8E5BD9', '#FF9F1C'];

  function updateWin(dt) {
    G.winT += dt;
    if (G.winT < REVEAL_TIME) {
      const R = revealRadius();
      for (let k = 0; k < 4; k++) {
        const a = rand(0, Math.PI * 2);
        const x = G.winX + Math.cos(a) * R, y = G.winY + Math.sin(a) * R;
        if (x < -10 || y < -10 || x > LW + 10 || y > LH + 10) continue;
        G.particles.push({ x, y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50 - 30, life: 0.6, max: 0.6,
          color: k % 2 ? '#FFFFFF' : '#FFD23F', size: rand(2, 4) });
      }
    }
    if (!G.confettiDone && G.winT > REVEAL_TIME - 0.1) {
      G.confettiDone = true;
      for (let k = 0; k < 90; k++) {
        G.particles.push({ conf: true, x: rand(0, LW), y: rand(-160, -10), vx: rand(-30, 30), vy: rand(60, 140),
          rot: rand(0, 6), vr: rand(-8, 8), w: rand(6, 10), h: rand(3, 6), color: CONFETTI[k % CONFETTI.length],
          life: 3.2, max: 3.2, sway: rand(0, 6) });
      }
      sfx.claim();
    }
  }

  function win() {
    G.state = 'won';
    G.winT = 0;
    G.winX = G.player.x * CELL + CELL / 2;
    G.winY = G.player.y * CELL + CELL / 2;
    G.winMaxR = Math.max(...[[0, 0], [LW, 0], [0, LH], [LW, LH]].map(([x, y]) => Math.hypot(x - G.winX, y - G.winY)));
    for (const e of G.enemies) {
      burst(e.x, e.y, ['#FFFFFF', '#FFD23F', '#D8D2E3'], e.kind === 'boss' ? 18 : 8);
    }
    for (const it of G.items) burst(it.x, it.y, ['#FFFFFF', '#FFD23F'], 6);
    G.enemies = []; G.items = []; G.player.trail = [];
    input.dir = null; input.target = null; padRelease();
    sfx.win();
    const stars = clamp(G.lives, 1, 3);
    const d = store.data;
    d.stars[G.key] = Math.max(d.stars[G.key] || 0, stars);
    d.streak[G.key] = 0;
    let unlocked = null;
    const world = WORLDS[G.w];
    if (G.l === world.levels.length - 1 && world.unlock && !d.unlocked.includes(world.unlock)) {
      d.unlocked.push(world.unlock);
      unlocked = world.unlock;
    }
    store.save();

    setTimeout(() => {
      if (!G || G.state !== 'won') return;
      $('#winStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : 'off'}">★</span>`).join('');
      $('#winScore').textContent = `ניקוד: ${G.score}`;
      const u = $('#unlock');
      if (unlocked) {
        const [joins, them] = JOINS[unlocked] || ['מצטרף', 'אותו'];
        $('#unlockImg').src = `assets/${CHARS[unlocked].img}.svg`;
        $('#unlockText').textContent = `${CHARS[unlocked].name} ${joins}! אפשר לבחור ${them} במסך הפתיחה.`;
        u.hidden = false;
      } else u.hidden = true;
      const lastLevel = G.l >= world.levels.length - 1;
      const lastWorld = G.w >= WORLDS.length - 1;
      $('#winTitle').textContent = lastLevel && lastWorld ? 'ניצחת את כל המשחק!' : lastLevel ? 'סיימת עולם!' : 'כל הכבוד!';
      $('#nextBtn').textContent = lastLevel ? 'לעולם הבא' : 'לשלב הבא';
      $('#nextBtn').hidden = lastLevel && lastWorld;
      $('#win').hidden = false;
      for (let i = 0; i < stars; i++) setTimeout(() => sfx.tone(880 + i * 220, 0.18, 'triangle', 0.1), 380 + i * 300);
    }, 2600);
  }

  function lose() {
    G.state = 'lost';
    store.data.streak[G.key] = (store.data.streak[G.key] || 0) + 1;
    store.save();
    sfx.lose();
    $('#loseImg').src = `assets/${G.ch.img}.svg`;
    setTimeout(() => { if (G && G.state === 'lost') $('#lose').hidden = false; }, 800);
  }

  // ---------- Particles ----------
  function burst(x, y, colors, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(40, 140);
      G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.4, 0.8), max: 0.8,
        color: colors[i % colors.length], size: rand(2.5, 5) });
    }
  }
  function floatText(x, y, text, color) {
    G.particles.push({ x, y, vx: 0, vy: -40, life: 1.2, max: 1.2, color, text });
  }
  function updateParticles(dt) {
    for (const q of G.particles) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.conf) { q.rot += q.vr * dt; q.sway += dt * 4; q.x += Math.sin(q.sway) * 30 * dt; }
      else if (!q.text) q.vy += 220 * dt;
    }
    G.particles = G.particles.filter((q) => q.life > 0);
  }

  // ---------- Render ----------
  function render() {
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const sx = G.shake > 0 ? rand(-4, 4) : 0, sy = G.shake > 0 ? rand(-4, 4) : 0;
    c.setTransform(RES, 0, 0, RES, (PAD + sx) * RES, (PAD + sy) * RES);

    c.fillStyle = INK;
    c.beginPath();
    if (c.roundRect) c.roundRect(-7, -7, LW + 14, LH + 14, 12); else c.rect(-7, -7, LW + 14, LH + 14);
    c.fill();
    const won = G.state === 'won';
    c.save();
    c.beginPath(); c.rect(0, 0, LW, LH); c.clip();
    if (sceneCv) {
      // A little "boing" on the picture once it is fully revealed.
      const t = won ? (G.winT - REVEAL_TIME) / 0.5 : -1;
      const k = t > 0 && t < 1 ? 1 + 0.05 * Math.sin(Math.PI * t) : 1;
      c.save();
      c.translate(LW / 2, LH / 2); c.scale(k, k); c.translate(-LW / 2, -LH / 2);
      c.drawImage(sceneCv, 0, 0, LW, LH);
      c.restore();
    }
    if (!won) c.drawImage(dirtCv, 0, 0, LW, LH);
    else {
      const R = revealRadius();
      if (R < G.winMaxR + 8) {
        c.save();
        c.beginPath();
        c.rect(0, 0, LW, LH);
        c.arc(G.winX, G.winY, R, 0, Math.PI * 2);
        c.clip('evenodd');
        c.drawImage(dirtCv, 0, 0, LW, LH);
        c.restore();
        c.beginPath(); c.arc(G.winX, G.winY, R, 0, Math.PI * 2);
        c.lineWidth = 7; c.strokeStyle = INK; c.stroke();
        c.lineWidth = 3; c.strokeStyle = '#FFD23F'; c.stroke();
      }
    }
    c.restore();

    const p = G.player;
    if (p.trail.length > 1) {
      c.beginPath();
      p.trail.forEach(([x, y], k) => {
        const px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.setLineDash([]);
      c.strokeStyle = INK; c.lineWidth = 6; c.stroke();
      c.setLineDash([6, 5]); c.lineDashOffset = -G.t * 24;
      c.strokeStyle = '#FFD23F'; c.lineWidth = 3; c.stroke();
      c.setLineDash([]);
    }

    if (G.state !== 'won') {
      for (const it of G.items) {
        if (it.life < 2 && Math.floor(G.t * 8) % 2 === 0) continue; // blink before disappearing
        const bob = Math.sin(G.t * 3 + it.t) * 3;
        c.drawImage(spr(ITEMS[it.type].img, ITEM_SIZE, ITEM_SIZE), it.x - ITEM_SIZE / 2, it.y - ITEM_SIZE / 2 + bob, ITEM_SIZE, ITEM_SIZE);
      }
      for (const e of G.enemies) {
        c.save();
        c.translate(e.x, e.y + Math.sin(e.anim * (e.kind === 'boss' ? 6 : 14)) * (e.kind === 'boss' ? 2 : 3));
        const goingRight = e.vx > 0;
        if (e.faceLeft ? goingRight : !goingRight) c.scale(-1, 1);
        c.drawImage(spr(e.img, e.w, e.h), -e.w / 2, -e.h / 2, e.w, e.h);
        c.restore();
        if (G.freeze > 0) {
          c.fillStyle = 'rgba(189,235,255,0.45)';
          c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
          c.beginPath(); c.arc(e.x, e.y, e.w * 0.45, 0, Math.PI * 2); c.fill(); c.stroke();
        }
      }
    }

    const px = p.x * CELL + CELL / 2;
    const hop = won && G.winT > 0.3 ? -Math.abs(Math.sin((G.winT - 0.3) * 7)) * 14 : 0;
    const py = p.y * CELL + CELL / 2 + hop;
    const blink = !won && p.invuln > 0 && Math.floor(G.t * 12) % 2 === 0;
    if (!blink) {
      const pw = PLAYER_SIZE * (G.ch.w ? 1.15 : 1), ph = pw * (G.ch.h || 200) / (G.ch.w || 200);
      c.save();
      c.translate(px, py);
      if (G.ch.faceLeft ? p.face > 0 : p.face < 0) c.scale(-1, 1);
      c.drawImage(spr(G.ch.img, pw, ph), -pw / 2, -ph / 2 - 6, pw, ph);
      c.restore();
    }
    if (p.shield && !won) {
      c.strokeStyle = 'rgba(189,235,255,0.9)'; c.lineWidth = 3;
      c.beginPath(); c.arc(px, py - 4, 30 + Math.sin(G.t * 5) * 2, 0, Math.PI * 2); c.stroke();
    }
    const t = input.target;
    if (t && G.state === 'play' && (t.x !== p.x || t.y !== p.y)) {
      const tx = t.x * CELL + CELL / 2, ty = t.y * CELL + CELL / 2, r = 9 + Math.sin(G.t * 8) * 2;
      c.lineWidth = 5; c.strokeStyle = INK;
      c.beginPath(); c.arc(tx, ty, r, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = '#FFD23F';
      c.beginPath(); c.arc(tx, ty, r, 0, Math.PI * 2); c.stroke();
    }
    if (p.boost > 0 && p.lastDir && (input.dir || input.target)) {
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2.5; c.lineCap = 'round';
      const d = p.lastDir;
      for (let k = -1; k <= 1; k++) {
        const ox = -d.x * 30 + d.y * k * 8, oy = -d.y * 30 + d.x * k * 8;
        c.beginPath(); c.moveTo(px + ox, py + oy); c.lineTo(px + ox - d.x * 12, py + oy - d.y * 12); c.stroke();
      }
    }

    for (const q of G.particles) {
      c.globalAlpha = clamp(q.life / q.max, 0, 1);
      if (q.conf) {
        c.save();
        c.translate(q.x, q.y); c.rotate(q.rot);
        c.fillStyle = q.color; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        c.restore();
      } else if (q.text) {
        c.font = '700 20px Fredoka, Rubik, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 5; c.strokeStyle = INK; c.lineJoin = 'round';
        c.strokeText(q.text, q.x, q.y);
        c.fillStyle = q.color; c.fillText(q.text, q.x, q.y);
      } else {
        c.fillStyle = q.color;
        c.beginPath(); c.arc(q.x, q.y, q.size, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  // ---------- HUD ----------
  function buildLives() {
    const el = $('#lives');
    el.innerHTML = '';
    for (let i = 0; i < G.maxLives; i++) {
      const im = document.createElement('img');
      im.src = 'assets/egg.svg'; im.alt = '';
      if (i >= G.lives) im.className = 'lost';
      el.appendChild(im);
    }
  }
  function updateHud() {
    $('#levelName').textContent = `שלב ${G.l + 1}`;
    $('#meterFill').style.width = `${Math.min(100, G.percent / G.cfg.goal * 100)}%`;
    $('#meterGoal').style.insetInlineStart = 'calc(100% - 3px)';
    $('#meterNum').innerHTML = `<bdi>${G.percent}%</bdi> מתוך <bdi>${G.cfg.goal}%</bdi>`;
  }

  // ---------- Input: drag anywhere = joystick, arrows on a keyboard ----------
  const input = { dir: null, target: null, id: null, ax: 0, ay: 0, padId: null };
  const stick = $('#stick'), knob = $('#knob');
  const gameEl = $('#game');
  const MODES = ['pad', 'touch', 'stick'];
  const MODE_LABEL = { pad: 'שליטה: חיצים', touch: 'שליטה: נגיעה', stick: 'שליטה: ג׳ויסטיק' };
  const MODE_HINT = { pad: '', touch: 'נוגעים איפה שרוצים שפיפ ילך', stick: 'גוררים את האצבע לכיוון שרוצים ללכת' };
  const controlMode = () => (MODES.includes(store.data.controlMode) ? store.data.controlMode : 'pad');
  const useStick = () => controlMode() === 'stick';

  function applyControlMode() {
    const m = controlMode();
    $('#pad').hidden = m !== 'pad';
    $('#hint').hidden = m === 'pad';
    $('#hint').textContent = MODE_HINT[m];
    $('#controlBtn').textContent = MODE_LABEL[m];
    if (screen === 'game') resize();
  }

  // Arrow pad: the direction comes from where the thumb is relative to the pad's centre,
  // so sliding between arrows works without lifting the thumb.
  const pad = $('#pad');
  const arrows = { up: pad.querySelector('.up'), down: pad.querySelector('.down'), left: pad.querySelector('.left'), right: pad.querySelector('.right') };
  function padRelease() {
    input.padId = null;
    for (const a of Object.values(arrows)) a.classList.remove('on');
  }
  function padUpdate(e) {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    let name = null;
    if (Math.hypot(dx, dy) > 14) name = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    for (const [k, a] of Object.entries(arrows)) a.classList.toggle('on', k === name);
    input.target = null;
    input.dir = name ? { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[name] : null;
  }
  pad.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!G || G.state !== 'play' || paused) return;
    sfx.init();
    input.padId = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    padUpdate(e);
  });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === input.padId) padUpdate(e); });
  const padEnd = (e) => { if (e.pointerId === input.padId) { padRelease(); input.dir = null; } };
  pad.addEventListener('pointerup', padEnd);
  pad.addEventListener('pointercancel', padEnd);

  function setTarget(e) {
    if (!G || G.state !== 'play') return;
    const r = cv.getBoundingClientRect();
    const lx = (e.clientX - r.left) / r.width * VW - PAD;
    const ly = (e.clientY - r.top) / r.height * VH - PAD;
    const cx = clamp(Math.floor(lx / CELL), 0, GW - 1), cy = clamp(Math.floor(ly / CELL), 0, GH - 1);
    input.dir = null;
    input.target = snapTarget(cx, cy);
  }

  gameEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, .overlay, .hud, .pad')) return;
    if (controlMode() === 'pad') return;
    sfx.init();
    input.id = e.pointerId; input.ax = e.clientX; input.ay = e.clientY;
    try { gameEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!useStick()) { setTarget(e); return; }
    stick.style.left = `${e.clientX - 48}px`; stick.style.top = `${e.clientY - 48}px`;
    knob.style.transform = 'translate(0,0)';
    stick.hidden = false;
  });
  gameEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== input.id) return;
    if (!useStick()) { setTarget(e); return; }
    let dx = e.clientX - input.ax, dy = e.clientY - input.ay;
    const len = Math.hypot(dx, dy), R = 36;
    if (len > R) {
      input.ax = e.clientX - dx / len * R; input.ay = e.clientY - dy / len * R;
      dx = dx / len * R; dy = dy / len * R;
      stick.style.left = `${input.ax - 48}px`; stick.style.top = `${input.ay - 48}px`;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (len < 10) { input.dir = null; return; }
    input.dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  });
  const endPointer = (e) => {
    if (e.pointerId !== input.id) return;
    input.id = null; stick.hidden = true;
    if (useStick()) input.dir = null; // in touch-to-go mode Pip keeps walking to the marker
  };
  gameEl.addEventListener('pointerup', endPointer);
  gameEl.addEventListener('pointercancel', endPointer);

  const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  window.addEventListener('keydown', (e) => {
    if (screen !== 'game') return;
    const k = KEYS[e.key];
    if (k) { e.preventDefault(); sfx.init(); input.target = null; input.dir = { x: k[0], y: k[1] }; }
    if (e.key === 'Escape' || e.key === 'p') togglePause(true);
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYS[e.key];
    if (k && input.dir && input.dir.x === k[0] && input.dir.y === k[1]) input.dir = null;
  });

  // ---------- Screens ----------
  function show(name) {
    screen = name;
    for (const id of ['title', 'map', 'game']) $(`#${id}`).hidden = id !== name;
    if (name === 'title') buildTitle();
    if (name === 'map') buildMap();
    if (name !== 'game') stick.hidden = true;
  }
  function hideOverlays() { for (const id of ['pause', 'win', 'lose']) $(`#${id}`).hidden = true; }

  function buildTitle() {
    const d = store.data;
    if (!d.unlocked.includes(d.selected)) d.selected = 'pip';
    const box = $('#chars');
    box.innerHTML = '';
    CHAR_ORDER.forEach((id, i) => {
      const ch = CHARS[id], open = d.unlocked.includes(id);
      const b = document.createElement('button');
      b.className = `char${open ? '' : ' locked'}${d.selected === id ? ' sel' : ''}`;
      b.setAttribute('aria-label', open ? ch.name : `נעול, נפתח אחרי עולם ${i}`);
      b.innerHTML = `<img src="assets/${ch.img}.svg" alt="">${open ? '' : '<span class="lock">🔒</span>'}`;
      b.addEventListener('click', () => {
        sfx.init(); sfx.tap();
        if (!open) { $('#charPerk').textContent = `נפתח אחרי עולם ${i}`; return; }
        d.selected = id; store.save(); buildTitle();
      });
      box.appendChild(b);
    });
    const sel = CHARS[d.selected];
    $('#charPerk').textContent = `${sel.name}: ${sel.perk}`;
    $('#titleHero').src = `assets/${sel.img}.svg`;
    $('#muteBtn').textContent = d.muted ? '🔇' : '🔊';
  }

  function currentMapWorld() {
    let w = store.data.mapWorld;
    if (!Number.isInteger(w) || w < 0 || w >= WORLDS.length) {
      w = 0; // default to the furthest world that is open
      for (let i = 0; i < WORLDS.length; i++) if (worldOpen(i)) w = i;
    }
    return w;
  }
  // Level spots on the 360x780 map pictures (bottom to top). Keep in sync with NODES in tools/make_maps.py.
  const MAP_NODES = [[95, 625], [262, 530], [100, 420], [262, 305], [150, 195]];

  function buildMap() {
    const w = currentMapWorld();
    const world = WORLDS[w];
    $('#map').dataset.world = String(w + 1);
    $('#mapBg').src = `assets/map-${w + 1}.svg`;
    const prize = CHARS[world.unlock];
    const prizeImg = $('#mapPrize');
    prizeImg.src = `assets/${prize.img}.svg`;
    prizeImg.classList.toggle('locked', !store.data.unlocked.includes(world.unlock));
    prizeImg.style.transform = `translate(-50%, -50%)${prize.faceLeft ? '' : ' scaleX(-1)'}`;
    $('#worldName').textContent = world.name;
    $('#worldNum').textContent = `עולם ${w + 1} מתוך ${WORLDS.length}`;
    $('#prevWorld').disabled = w === 0;
    $('#nextWorld').disabled = w === WORLDS.length - 1;
    $('#worldLocked').hidden = worldOpen(w);
    $('#worldLocked').textContent = `מסיימים את עולם ${w} כדי לפתוח`;
    const box = $('#levels');
    box.innerHTML = '';
    world.levels.forEach((lvl, i) => {
      const stars = store.data.stars[`${w + 1}-${i + 1}`] || 0;
      const open = levelOpen(w, i);
      const b = document.createElement('button');
      b.className = `level${open ? '' : ' locked'}`;
      b.style.left = `${MAP_NODES[i][0] / 360 * 100}%`;
      b.style.top = `${MAP_NODES[i][1] / 780 * 100}%`;
      b.setAttribute('aria-label', open ? `שלב ${i + 1}` : `שלב ${i + 1} נעול`);
      b.innerHTML = `${i + 1}<span class="st">${[0, 1, 2].map((k) => `<span class="${k < stars ? 'on' : 'off'}">★</span>`).join('')}</span>`;
      b.disabled = !open;
      b.addEventListener('click', () => { sfx.init(); sfx.tap(); startLevel(w, i); });
      box.appendChild(b);
    });
  }
  function pageWorld(delta) {
    const w = clamp(currentMapWorld() + delta, 0, WORLDS.length - 1);
    store.data.mapWorld = w; store.save(); sfx.tap(); buildMap();
  }

  function togglePause(on) {
    if (screen !== 'game' || !G || G.state === 'won' || G.state === 'lost') return;
    paused = on;
    $('#pause').hidden = !on;
    $('#pauseMuteBtn').textContent = store.data.muted ? 'צליל: כבוי' : 'צליל: פועל';
    $('#controlBtn').textContent = MODE_LABEL[controlMode()];
    input.dir = null; input.target = null; stick.hidden = true; padRelease();
  }

  function goFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => window.screen.orientation && window.screen.orientation.lock && window.screen.orientation.lock('portrait').catch(() => {}))
      .catch(() => {});
  }
  let wakeLock = null;
  function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        navigator.wakeLock.request('screen').then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  // Buttons
  $('#playBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); goFullscreen(); show('map'); });
  // Settings: reset progress (two steps, so a stray tap can't wipe everything).
  function settingsStep(confirming) {
    $('#resetAsk').hidden = confirming;
    $('#resetConfirm').hidden = !confirming;
  }
  $('#settingsBtn').addEventListener('click', () => {
    sfx.init(); sfx.tap();
    settingsStep(false);
    $('#resetDone').hidden = true;
    $('#settings').hidden = false;
  });
  $('#settingsClose').addEventListener('click', () => { sfx.tap(); $('#settings').hidden = true; });
  $('#resetBtn').addEventListener('click', () => { sfx.tap(); settingsStep(true); });
  $('#resetNo').addEventListener('click', () => { sfx.tap(); settingsStep(false); });
  $('#resetYes').addEventListener('click', () => {
    const { muted, controlMode } = store.data;
    store.data = { stars: {}, unlocked: ['pip'], selected: 'pip', streak: {}, muted, controlMode };
    store.save();
    G = null;
    sfx.tap();
    settingsStep(false);
    $('#resetDone').hidden = false;
    buildTitle();
  });

  $('#mapBack').addEventListener('click', () => { sfx.tap(); show('title'); });
  $('#muteBtn').addEventListener('click', () => { store.data.muted = !store.data.muted; store.save(); sfx.init(); sfx.tap(); buildTitle(); });
  $('#pauseBtn').addEventListener('click', () => { sfx.tap(); togglePause(true); });
  $('#resumeBtn').addEventListener('click', () => { sfx.tap(); togglePause(false); });
  $('#restartBtn').addEventListener('click', () => { sfx.tap(); startLevel(G.w, G.l); });
  $('#pauseMapBtn').addEventListener('click', () => { sfx.tap(); paused = false; hideOverlays(); show('map'); });
  $('#pauseMuteBtn').addEventListener('click', () => {
    store.data.muted = !store.data.muted; store.save(); sfx.tap();
    $('#pauseMuteBtn').textContent = store.data.muted ? 'צליל: כבוי' : 'צליל: פועל';
  });
  $('#controlBtn').addEventListener('click', () => {
    store.data.controlMode = MODES[(MODES.indexOf(controlMode()) + 1) % MODES.length];
    store.save(); sfx.tap();
    applyControlMode();
  });
  $('#nextBtn').addEventListener('click', () => {
    sfx.tap();
    if (G.l + 1 < WORLDS[G.w].levels.length) startLevel(G.w, G.l + 1);
    else { store.data.mapWorld = G.w + 1; store.save(); startLevel(G.w + 1, 0); }
  });
  $('#prevWorld').addEventListener('click', () => pageWorld(-1));
  $('#nextWorld').addEventListener('click', () => pageWorld(1));
  $('#winRetryBtn').addEventListener('click', () => { sfx.tap(); startLevel(G.w, G.l); });
  $('#winMapBtn').addEventListener('click', () => { sfx.tap(); store.data.mapWorld = G.w; hideOverlays(); show('map'); });
  $('#retryBtn').addEventListener('click', () => { sfx.tap(); startLevel(G.w, G.l); });
  $('#loseMapBtn').addEventListener('click', () => { sfx.tap(); hideOverlays(); show('map'); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) togglePause(true);
    else if (screen === 'game') keepAwake();
  });
  window.addEventListener('resize', () => { if (screen === 'game') resize(); });

  // ---------- Main loop ----------
  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (G && screen === 'game') {
      if (!paused) update(dt);
      render();
    }
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  store.load();
  loadImages().then(() => {
    show('title');
    requestAnimationFrame(frame);
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Debug hook for testing in a desktop browser.
  window.__dino = {
    get G() { return G; }, startLevel, store, input,
    tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt); render(); },
  };
})();
