'use strict';
// דינו בלוקים: a falling-stones game in the same five worlds, with the same dinos, bosses, eggs and gems.
// Clear full rows to reach the level's goal. Rex (and on the last level, the boss) throws rocks onto your stack;
// on boss levels every few rows you clear takes away one of the boss's hearts.
// game.js builds the shared pieces (save, sounds, wardrobe, map, win card) and hands them in as `core`.
window.DinoBlocks = (core) => {
  const { $, store, rec, sfx, CHARS, images, BOSSES, BOSS_HP, DIFFICULTY } = core;
  const INK = '#2B1B3D';
  const COLS = 10, ROWS = 18, CS = 32;      // board cells, cell size in logical px
  const BW = COLS * CS, BH = ROWS * CS;      // 320 x 576
  const PAD = 10, TOP = 104;                 // the strip above the board holds the dino, the next stone and Rex
  const VW = BW + PAD * 2, VH = TOP + BH + PAD;
  const BX = PAD, BY = TOP;                  // board's top-left on the canvas
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Stones ----------
  // n: size of the box they turn in. The small ones (d, i3, v) only show up in the easy levels.
  const SHAPES = {
    I:  { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: '#4FC3F7' },
    O:  { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#FFD23F' },
    T:  { n: 3, cells: [[0, 1], [1, 1], [2, 1], [1, 0]], color: '#B07CE8' },
    L:  { n: 3, cells: [[0, 1], [1, 1], [2, 1], [2, 0]], color: '#FF9F1C' },
    J:  { n: 3, cells: [[0, 1], [1, 1], [2, 1], [0, 0]], color: '#5B8DEF' },
    S:  { n: 3, cells: [[0, 1], [1, 1], [1, 0], [2, 0]], color: '#5CCB5F' },
    Z:  { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#FF6B7A' },
    d:  { n: 2, cells: [[0, 0], [1, 0]], color: '#FF8FC8' },
    i3: { n: 3, cells: [[0, 1], [1, 1], [2, 1]], color: '#4FD1C5' },
    v:  { n: 2, cells: [[0, 0], [0, 1], [1, 1]], color: '#C5E86C' },
  };
  const BAG = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
  const EASY_BAG = ['d', 'i3', 'v', 'O', 'I', 'T', 'L', 'i3', 'v'];
  const SMALL = ['d', 'i3', 'v'];
  const ROCK = { rock: '#9A90A8', sand: '#E9C46A', ice: '#BDEBFF', vine: '#3F9A3C' };

  // Power-ups ride on a stone; clear the row they sit in to get them.
  const POWERS = {
    bone:   { img: 'power-bone',   label: 'אבנים קטנות!' },
    shield: { img: 'power-shield', label: 'מגן!' },
    ice:    { img: 'power-ice',    label: 'קפוא!' },
    amber:  { img: 'power-amber',  label: '+500' },
  };

  // ---------- Worlds and levels ----------
  // goal: rows to clear. speed: rows per second the stone falls. throwEvery: seconds between Rex's rocks.
  // rise: seconds between new rows pushing up from the bottom. start: rows already on the board. easy: small stones too.
  const L = (goal, speed, o = {}) => ({ goal, speed, throwEvery: 0, rise: 0, start: 0, easy: false, ...o });
  const SPECIAL = [
    { rows: 'rock', strip: '#8FDCFF' },
    { rows: 'vine', strip: '#A6E58A' },
    { rows: 'sand', strip: '#8FE3FF' },
    { rows: 'ice',  strip: '#DDEFFF' },
    { rows: 'rock', strip: '#3A2E7A', dark: true },
  ];
  const LEVELS = [
    [L(4, 0.8, { easy: true }), L(5, 0.9, { easy: true }), L(6, 1.0, { easy: true }), L(7, 1.05, { easy: true, throwEvery: 12 }),
      L(8, 1.0, { easy: true })],
    [L(7, 1.1, { rise: 24 }), L(8, 1.15, { rise: 22 }), L(8, 1.2, { rise: 20, throwEvery: 14 }), L(9, 1.25, { rise: 18, throwEvery: 13 }),
      L(9, 1.15, { rise: 26 })],
    [L(8, 1.25, { start: 3 }), L(9, 1.3, { start: 4, throwEvery: 14 }), L(9, 1.35, { start: 4, rise: 24 }), L(10, 1.4, { start: 5, throwEvery: 12 }),
      L(10, 1.25, { start: 3 })],
    [L(9, 1.4, { start: 3, throwEvery: 13 }), L(10, 1.45, { start: 4, throwEvery: 12 }), L(10, 1.5, { start: 4, rise: 24, throwEvery: 14 }),
      L(11, 1.55, { start: 5, throwEvery: 11 }), L(10, 1.4, { start: 3 })],
    [L(10, 1.5, { throwEvery: 13 }), L(10, 1.55, { rise: 22, throwEvery: 14 }), L(11, 1.6, { start: 3, throwEvery: 12 }),
      L(12, 1.65, { start: 4, rise: 22, throwEvery: 12 }), L(11, 1.5, { start: 3 })],
  ];
  const WORLDS = core.WORLDS.map((wd, i) => {
    const levels = LEVELS[i];
    levels[levels.length - 1].bossFight = true;
    return { name: wd.name, unlock: wd.unlock, ...SPECIAL[i], levels };
  });

  // Challenges: each pays gems once, like in the dig game.
  const par = (cfg) => Math.round(cfg.goal * 11 + 20); // seconds
  const CHALS = [
    { bit: 1, icon: '✨', label: () => '2 שורות ביחד' },
    { bit: 2, icon: '⚡', label: (cfg) => `<bdi>${core.fmtTime(par(cfg))}</bdi>` },
    { bit: 4, icon: '🥚', label: () => 'כל הביצים' },
  ];

  // ---------- Canvas & pictures ----------
  const cv = $('#bcv');
  const ctx = cv.getContext('2d');
  let RES = 1, sprites = {}, sceneCv = null;
  function sprite(name, w, h) {
    const key = `${name}@${w}x${h}`;
    if (!sprites[key]) {
      const s = document.createElement('canvas');
      s.width = Math.max(1, Math.ceil(w * RES)); s.height = Math.max(1, Math.ceil(h * RES));
      if (images[name]) s.getContext('2d').drawImage(images[name], 0, 0, s.width, s.height);
      sprites[key] = s;
    }
    return sprites[key];
  }
  function resize() {
    const wrap = $('#boardWrap');
    const W = wrap.clientWidth - 12, H = wrap.clientHeight;
    if (W <= 0 || H <= 0) return;
    const s = Math.min(W / VW, H / VH);
    cv.style.width = `${Math.floor(VW * s)}px`;
    cv.style.height = `${Math.floor(VH * s)}px`;
    RES = s * Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(VW * RES); cv.height = Math.round(VH * RES);
    sprites = {};
    const G = core.G();
    if (G && G.mode === 'blocks') buildScene(G);
  }
  // The level's picture behind the board, dimmed so the stones stand out.
  function buildScene(G) {
    sceneCv = document.createElement('canvas');
    sceneCv.width = Math.round(BW * RES); sceneCv.height = Math.round(BH * RES);
    const c = sceneCv.getContext('2d'), img = images[G.scene];
    c.scale(RES, RES);
    if (img) {
      const k = Math.max(BW / 360, BH / 560), w = 360 * k, h = 560 * k;
      c.drawImage(img, (BW - w) / 2, (BH - h) / 2, w, h);
    }
    c.fillStyle = G.world.dark ? 'rgba(14,10,38,.72)' : 'rgba(30,20,48,.58)';
    c.fillRect(0, 0, BW, BH);
  }

  // ---------- Level start ----------
  let G = null;
  async function start(w, l) {
    const world = WORLDS[w], cfg = world.levels[l], r = rec('blocks');
    const scene = `s${w + 1}-${l + 1}`;
    await core.loadScene(scene);
    const ch = CHARS[r.selected] || CHARS.pip;
    const key = `${w + 1}-${l + 1}`;
    const help = (r.streak[key] || 0) >= 3 ? 0.85 : 1; // a little quiet help after 3 losses in a row
    const lives = ch.lives || 3;
    const boss = !!cfg.bossFight;
    G = {
      mode: 'blocks', w, l, cfg, key, ch, world, scene,
      bossFight: boss, bossInfo: BOSSES[w], bossHp: BOSS_HP,
      grid: new Array(COLS * ROWS).fill(null),
      lives, maxLives: lives, score: 0, lines: 0, multi: false,
      state: 'ready', readyT: boss ? 2.6 : 2.0, t: 0, playT: 0, shownSec: -1,
      particles: [], shots: [], piece: null, next: null, bag: [], pieces: 0,
      fall: 0, lockT: 0, lockMoves: 0, clearRows: null, clearT: 0,
      speed: cfg.speed * (ch.slow || 1) * help, soft: false,
      throwEvery: boss ? BOSSES[w].every * 2.3 / DIFFICULTY / help : cfg.throwEvery / help,
      throwT: boss ? 4 : cfg.throwEvery * 0.6, windup: 0,
      riseT: cfg.rise, freeze: 0, small: 0, shield: !!ch.shieldStart,
      cheer: 0, sad: 0, shake: 0, hurt: 0, winT: 0, outfit: { ...store.data.outfit },
    };
    G.readyMax = G.readyT;
    for (let k = 0; k < cfg.start; k++) addRow(ROWS - 1 - k, world.rows);
    G.next = takePiece();
    core.setG(G);
    core.setPaused(false);
    core.hideOverlays();
    const game = $('#game');
    game.dataset.world = String(w + 1);
    game.classList.add('blocks');
    core.show('game');
    resize();
    core.buildLives();
    hud();
    $('#timerNum').textContent = core.fmtTime(0);
    const b = $('#banner');
    const best = (r.best || {})[key];
    const bestLine = best ? `<small class="best-line">⏱ השיא <bdi>${core.fmtTime(best)}</bdi></small>` : '';
    const head = boss
      ? `<div class="ready-world">${world.name}</div><div class="ready-title boss">בוס: ${BOSSES[w].name}</div>`
      : `<div class="ready-world">${world.name}</div><div class="ready-title">שלב ${l + 1}</div>`;
    b.innerHTML = `<div class="ready-card">${head}<div class="ready-goal">${goalText(cfg)}</div>${bestLine}${
      core.chalRow(cfg, (r.chal || {})[key] || 0, 0, CHALS)}<div class="ready-bar"><i style="animation-duration:${G.readyT}s"></i></div></div>`;
    b.className = 'banner';
    if (boss) sfx.boss(); else sfx.ready();
    b.hidden = false;
    held.left = held.right = held.down = false;
    core.applyControlMode();
    core.keepAwake();
  }
  const goalText = (cfg) => `🧱 מנקים <bdi>${cfg.goal}</bdi> שורות`;

  // A full row with one or two holes (the starting rows, and the rows that push up from below).
  function addRow(y, kind) {
    const holes = new Set([Math.floor(Math.random() * COLS)]);
    if (Math.random() < 0.4) holes.add(Math.floor(Math.random() * COLS));
    for (let x = 0; x < COLS; x++) G.grid[y * COLS + x] = holes.has(x) ? null : { c: ROCK[kind], k: kind };
  }

  function takePiece() {
    if (G.small > 0) { G.small--; return makePiece(SMALL[Math.floor(Math.random() * SMALL.length)]); }
    if (!G.bag.length) {
      G.bag = [...(G.cfg.easy ? EASY_BAG : BAG)];
      for (let i = G.bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [G.bag[i], G.bag[j]] = [G.bag[j], G.bag[i]]; }
    }
    return makePiece(G.bag.pop());
  }
  function makePiece(t) {
    const s = SHAPES[t];
    G.pieces++;
    // Every 6th stone carries a power-up on one of its cells.
    const types = Object.keys(POWERS);
    const power = G.pieces % 6 === 0 ? types[Math.floor(Math.random() * types.length)] : null;
    return { t, n: s.n, color: s.color, cells: s.cells.map((c) => [...c]), x: 0, y: 0,
      power, powerAt: power ? Math.floor(Math.random() * s.cells.length) : -1 };
  }

  // ---------- Board rules ----------
  const cellAt = (x, y) => (x < 0 || x >= COLS || y >= ROWS ? 'wall' : y < 0 ? null : G.grid[y * COLS + x]);
  const fits = (p, x, y, cells = p.cells) => cells.every(([cx, cy]) => !cellAt(x + cx, y + cy));
  function spawn() {
    const p = G.next;
    G.next = takePiece();
    const minY = Math.min(...p.cells.map((c) => c[1]));
    p.x = Math.floor((COLS - p.n) / 2); p.y = -minY;
    G.fall = 0; G.lockT = 0; G.lockMoves = 0;
    if (!fits(p, p.x, p.y)) { G.piece = null; topOut(); return; }
    G.piece = p;
  }
  function move(dx) {
    const p = G.piece;
    if (!p || !fits(p, p.x + dx, p.y)) return false;
    p.x += dx;
    touched();
    sfx.tone(420, 0.04, 'triangle', 0.035);
    return true;
  }
  function rotate() {
    const p = G.piece;
    if (!p || p.t === 'O') return;
    const cells = p.cells.map(([x, y]) => [p.n - 1 - y, x]);
    for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]]) {
      if (fits(p, p.x + kx, p.y + ky, cells)) {
        p.cells = cells; p.x += kx; p.y += ky;
        touched();
        sfx.tone(620, 0.05, 'triangle', 0.045);
        return;
      }
    }
  }
  // Moving or turning a stone that is sitting on something gives a little more time before it locks.
  function touched() { if (G.lockMoves < 12) { G.lockT = 0; G.lockMoves++; } }
  const dropY = (p) => { let y = p.y; while (fits(p, p.x, y + 1)) y++; return y; };
  function hardDrop() {
    const p = G.piece;
    if (!p) return;
    const y = dropY(p);
    G.score += 2 * (y - p.y);
    p.y = y;
    for (const [cx, cy] of p.cells) dust(BX + (p.x + cx + 0.5) * CS, BY + (p.y + cy + 1) * CS);
    lock();
  }
  function lock() {
    const p = G.piece;
    G.piece = null;
    let over = false;
    p.cells.forEach(([cx, cy], i) => {
      const x = p.x + cx, y = p.y + cy;
      if (y < 0) { over = true; return; }
      G.grid[y * COLS + x] = { c: p.color, k: 'stone', power: i === p.powerAt ? p.power : null };
    });
    sfx.tone(170, 0.09, 'square', 0.05);
    if (over) { topOut(); return; }
    checkRows();
  }
  function fullRows() {
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      let full = true;
      for (let x = 0; x < COLS; x++) if (!G.grid[y * COLS + x]) { full = false; break; }
      if (full) rows.push(y);
    }
    return rows;
  }
  function checkRows() {
    const rows = fullRows();
    if (!rows.length) return false;
    G.clearRows = rows; G.clearT = 0.3;
    return true;
  }
  const SCORES = [0, 100, 300, 500, 800];
  function finishClear() {
    const rows = G.clearRows;
    G.clearRows = null;
    for (const y of rows) {
      for (let x = 0; x < COLS; x++) {
        const cell = G.grid[y * COLS + x];
        if (cell && cell.power) power(cell.power, BX + (x + 0.5) * CS, BY + (y + 0.5) * CS);
        burst(BX + (x + 0.5) * CS, BY + (y + 0.5) * CS, [cell ? cell.c : '#FFF', '#FFFFFF'], 3);
      }
    }
    // Drop everything above the cleared rows.
    const keep = [];
    for (let y = 0; y < ROWS; y++) if (!rows.includes(y)) keep.push(G.grid.slice(y * COLS, y * COLS + COLS));
    G.grid = [...new Array((ROWS - keep.length) * COLS).fill(null), ...keep.flat()];
    const n = rows.length;
    G.lines += n;
    G.score += SCORES[Math.min(4, n)];
    if (n >= 2) G.multi = true;
    G.cheer = 1;
    const midY = BY + (rows.reduce((a, b) => a + b, 0) / n + 0.5) * CS;
    floatText(BX + BW / 2, midY, n >= 2 ? `${n} שורות! ✨` : 'שורה!', n >= 2 ? '#FFD23F' : '#FFFFFF');
    sfx.claim();
    if (G.bossFight) {
      const hp = Math.ceil(BOSS_HP * Math.max(0, G.cfg.goal - G.lines) / G.cfg.goal);
      if (hp < G.bossHp) { G.bossHp = hp; G.hurt = 0.6; sfx.ouch(); floatText(throwerPos().x, throwerPos().y - 30, 'אאוץ׳!', '#FF8FA3'); }
    }
    hud();
    if (G.lines >= G.cfg.goal) win();
  }

  // The stack reached the top: the shield saves you, otherwise an egg breaks. Either way the bottom rows crumble away.
  function topOut() {
    if (G.shield) {
      G.shield = false;
      floatText(BX + BW / 2, BY + 80, 'המגן הציל!', '#BDEBFF');
      sfx.pop();
    } else {
      G.lives--;
      core.buildLives();
      sfx.hit();
      G.sad = 1.2; G.shake = 0.4;
      try { if (navigator.vibrate) navigator.vibrate(180); } catch (e) { /* ignore */ }
      if (G.lives <= 0) { core.lose(); return; }
      floatText(BX + BW / 2, BY + 80, 'אוי! ביצה נשברה', '#FF8FA3');
    }
    for (let y = ROWS - 7; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = G.grid[y * COLS + x];
        if (cell) burst(BX + (x + 0.5) * CS, BY + (y + 0.5) * CS, [cell.c, '#FFFFFF'], 2);
      }
    }
    G.grid = [...new Array(7 * COLS).fill(null), ...G.grid.slice(0, (ROWS - 7) * COLS)];
    G.piece = null;
  }

  function power(type, x, y) {
    const dur = G.ch.powerDur || 1;
    if (type === 'bone') G.small = 3 * dur;
    if (type === 'shield') G.shield = true;
    if (type === 'ice') G.freeze = 6 * dur;
    if (type === 'amber') G.score += 500;
    floatText(x, y - 18, POWERS[type].label, '#FFFFFF');
    burst(x, y, ['#FFD23F', '#4FC3F7', '#FFFFFF'], 10);
    setTimeout(() => sfx.power(), 120);
  }

  // A new row pushes the whole stack up from the bottom (vines in the jungle, the tide on the beach...).
  function rise() {
    const topRow = G.grid.slice(0, COLS).some(Boolean);
    G.grid = [...G.grid.slice(COLS), ...new Array(COLS).fill(null)];
    addRow(ROWS - 1, G.world.rows);
    const p = G.piece;
    if (p && !fits(p, p.x, p.y)) { if (fits(p, p.x, p.y - 1)) p.y--; else { G.piece = null; topOut(); return; } }
    if (topRow) { topOut(); return; }
    sfx.tone(140, 0.25, 'triangle', 0.07, 0, 220);
    checkRows();
  }

  // ---------- Rex / the boss throws rocks onto the stack ----------
  const throwerPos = () => ({ x: VW - PAD - 52, y: TOP / 2 + 4 });
  function throwRock() {
    const from = throwerPos();
    const col = Math.floor(Math.random() * COLS);
    G.shots.push({ col, sx: from.x - 20, sy: from.y - 10, t: 0, dur: 0.9, x: from.x, y: from.y, spin: 0 });
    sfx.throwIt();
  }
  function landRock(s) {
    let y = 0;
    while (y < ROWS && !G.grid[y * COLS + s.col]) y++;
    y--; // the empty cell on top of the column
    const p = G.piece;
    const onPiece = p && p.cells.some(([cx, cy]) => p.x + cx === s.col && p.y + cy >= y - 1);
    const px = BX + (s.col + 0.5) * CS;
    if (y < 0 || onPiece) { burst(px, BY + Math.max(0, y) * CS, core.SHOTS[G.bossInfo.shot].sparks, 8); sfx.pop(); return; }
    G.grid[y * COLS + s.col] = { c: ROCK.rock, k: 'rock' };
    burst(px, BY + (y + 0.5) * CS, core.SHOTS[G.bossInfo.shot].sparks, 8);
    G.shake = 0.15;
    sfx.tone(120, 0.15, 'square', 0.06);
    if (!G.piece && !G.clearRows) checkRows(); // otherwise the row is checked when the falling stone locks
  }
  const shotTarget = (s) => {
    let y = 0;
    while (y < ROWS && !G.grid[y * COLS + s.col]) y++;
    return { x: BX + (s.col + 0.5) * CS, y: BY + (Math.max(0, y) - 0.5) * CS };
  };

  // ---------- Update ----------
  const held = { left: false, right: false, down: false, rep: 0 };
  function update(dt) {
    G.t += dt;
    updateParticles(dt);
    if (G.shake > 0) G.shake -= dt;
    if (G.cheer > 0) G.cheer -= dt;
    if (G.sad > 0) G.sad -= dt;
    if (G.hurt > 0) G.hurt -= dt;
    if (G.state === 'ready') {
      G.readyT -= dt;
      if (G.readyT <= 0) core.startPlay();
      return;
    }
    if (G.state === 'won') { updateWin(dt); return; }
    if (G.state !== 'play') return;
    G.playT += dt;
    if (Math.floor(G.playT) !== G.shownSec) { G.shownSec = Math.floor(G.playT); $('#timerNum').textContent = core.fmtTime(G.playT); }
    if (G.freeze > 0) G.freeze -= dt;

    // Rocks in the air
    for (const s of G.shots) {
      s.t += dt / s.dur; s.spin += dt * 8;
      const to = shotTarget(s), k = Math.min(1, s.t);
      s.x = s.sx + (to.x - s.sx) * k;
      s.y = s.sy + (to.y - s.sy) * k - Math.sin(Math.PI * k) * 70;
      if (s.t >= 1) { s.dead = true; landRock(s); if (G.state !== 'play') return; }
    }
    G.shots = G.shots.filter((s) => !s.dead);

    if (G.clearRows) {
      G.clearT -= dt;
      if (G.clearT <= 0) finishClear();
      return;
    }
    if (!G.piece) { spawn(); if (G.state !== 'play' || !G.piece) return; }

    if (G.freeze <= 0) {
      if (G.throwEvery > 0) {
        if (G.windup > 0) { G.windup -= dt; if (G.windup <= 0) throwRock(); }
        else { G.throwT -= dt; if (G.throwT <= 0) { G.throwT = G.throwEvery * rand(0.85, 1.15); G.windup = 0.7; } }
      }
      if (G.cfg.rise) { G.riseT -= dt; if (G.riseT <= 0) { G.riseT = G.cfg.rise; rise(); if (!G.piece) return; } }
    }

    // Holding left/right keeps sliding after a short pause.
    if (held.left || held.right) {
      held.rep -= dt;
      if (held.rep <= 0) { move(held.left ? -1 : 1); held.rep = 0.06; }
    }

    const p = G.piece;
    const speed = held.down || G.soft ? Math.max(18, G.speed) : G.freeze > 0 ? 0 : G.speed;
    if (fits(p, p.x, p.y + 1)) {
      G.lockT = 0;
      G.fall += dt * speed;
      while (G.fall >= 1) {
        G.fall -= 1;
        if (!fits(p, p.x, p.y + 1)) break;
        p.y++;
        if (held.down || G.soft) G.score += 1;
      }
    } else {
      G.fall = 0;
      G.lockT += dt;
      if (G.lockT > (held.down || G.soft ? 0.12 : 0.45)) lock();
    }
  }

  // ---------- Win ----------
  const CONFETTI = ['#FFD23F', '#5CCB5F', '#FF8FA3', '#4FC3F7', '#8E5BD9', '#FF9F1C'];
  function win() {
    G.state = 'won';
    G.winT = 0; G.piece = null; G.shots = [];
    held.left = held.right = held.down = false;
    if (G.bossFight) {
      const at = throwerPos();
      floatText(at.x - 40, at.y + 20, 'ניצחת את הבוס!', '#FFD23F');
      sfx.defeat();
    }
    sfx.win();
    const done = (G.multi ? 1 : 0) | (G.playT <= par(G.cfg) ? 2 : 0) | (G.lives >= G.maxLives ? 4 : 0);
    core.finishWin(clamp(G.lives, 1, 3), done, 2400);
  }
  // The stack pops row by row from the top, then confetti.
  function updateWin(dt) {
    G.winT += dt;
    const gone = Math.floor(G.winT / 0.07);
    while ((G.popped || 0) < Math.min(ROWS, gone)) {
      const y = G.popped || 0;
      for (let x = 0; x < COLS; x++) {
        const cell = G.grid[y * COLS + x];
        if (cell) { burst(BX + (x + 0.5) * CS, BY + (y + 0.5) * CS, [cell.c, '#FFFFFF'], 2); G.grid[y * COLS + x] = null; }
      }
      if (y % 3 === 0) sfx.tone(500 + y * 30, 0.05, 'triangle', 0.04);
      G.popped = y + 1;
    }
    if (!G.confettiDone && G.winT > 1.2) {
      G.confettiDone = true;
      for (let k = 0; k < 90; k++) {
        G.particles.push({ conf: true, x: rand(0, VW), y: rand(-160, -10), vx: rand(-30, 30), vy: rand(60, 140),
          rot: rand(0, 6), vr: rand(-8, 8), w: rand(6, 10), h: rand(3, 6), color: CONFETTI[k % CONFETTI.length],
          life: 3.2, max: 3.2, sway: rand(0, 6) });
      }
      sfx.claim();
    }
  }

  // ---------- Particles ----------
  function burst(x, y, colors, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(40, 140);
      G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.4, 0.8), max: 0.8,
        color: colors[i % colors.length], size: rand(2.5, 5) });
    }
  }
  function dust(x, y) {
    for (let i = 0; i < 2; i++) G.particles.push({ x, y, vx: rand(-40, 40), vy: rand(-50, -10), life: 0.35, max: 0.35, color: 'rgba(255,255,255,.8)', size: rand(2, 3.5) });
  }
  function floatText(x, y, text, color) { G.particles.push({ x, y, vx: 0, vy: -40, life: 1.3, max: 1.3, color, text }); }
  function updateParticles(dt) {
    for (const q of G.particles) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.conf) { q.rot += q.vr * dt; q.sway += dt * 4; q.x += Math.sin(q.sway) * 30 * dt; }
      else if (!q.text) q.vy += 220 * dt;
    }
    G.particles = G.particles.filter((q) => q.life > 0);
  }

  // ---------- HUD ----------
  function hud() {
    $('.meter').classList.toggle('boss', G.bossFight);
    const goal = G.cfg.goal, n = Math.min(G.lines, goal);
    if (G.bossFight) {
      $('#levelName').textContent = 'בוס!';
      $('#meterFill').style.width = `${(1 - n / goal) * 100}%`;
      $('#meterNum').innerHTML = [...Array(BOSS_HP)].map((_, i) => `<span class="${i < G.bossHp ? 'on' : 'off'}">♥</span>`).join('')
        + `<div class="boss-pct">🧱 <bdi>${n}</bdi> מתוך <bdi>${goal}</bdi></div>`;
      return;
    }
    $('#levelName').textContent = `שלב ${G.l + 1}`;
    $('#meterFill').style.width = `${n / goal * 100}%`;
    $('#meterGoal').style.insetInlineStart = 'calc(100% - 3px)';
    $('#meterNum').innerHTML = `🧱 <bdi>${n}</bdi> מתוך <bdi>${goal}</bdi>`;
  }

  // ---------- Render ----------
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function block(c, px, py, color, kind, alpha = 1) {
    c.globalAlpha = alpha;
    rr(c, px + 1.5, py + 1.5, CS - 3, CS - 3, 7);
    c.fillStyle = color; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.fillStyle = 'rgba(43,27,61,.18)';
    rr(c, px + 5, py + CS - 10, CS - 10, 5, 2.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.42)';
    rr(c, px + 6, py + 5.5, CS - 16, 5.5, 2.75); c.fill();
    if (kind === 'rock' || kind === 'vine') {
      c.strokeStyle = 'rgba(43,27,61,.4)'; c.lineWidth = 1.6; c.beginPath();
      if (kind === 'rock') { c.moveTo(px + 9, py + 14); c.lineTo(px + 15, py + 19); c.lineTo(px + 13, py + 25); c.moveTo(px + 15, py + 19); c.lineTo(px + 23, py + 17); }
      else { c.moveTo(px + 6, py + 22); c.quadraticCurveTo(px + 16, py + 12, px + 26, py + 22); }
      c.stroke();
    } else if (kind === 'sand') {
      c.fillStyle = 'rgba(160,103,63,.45)';
      for (const [dx, dy] of [[9, 15], [20, 13], [15, 22], [24, 23]]) { c.beginPath(); c.arc(px + dx, py + dy, 1.4, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'ice') {
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath();
      c.moveTo(px + 9, py + 24); c.lineTo(px + 15, py + 15); c.moveTo(px + 15, py + 25); c.lineTo(px + 22, py + 16); c.stroke();
    }
    c.globalAlpha = 1;
  }
  function drawPower(c, type, px, py, t) {
    const s = 22 + Math.sin(t * 5) * 1.5;
    c.drawImage(sprite(POWERS[type].img, 24, 24), px + (CS - s) / 2, py + (CS - s) / 2, s, s);
  }
  function drawPieceAt(c, p, ox, oy, size) {
    const k = size / CS;
    c.save(); c.translate(ox, oy); c.scale(k, k);
    p.cells.forEach(([x, y], i) => {
      block(c, x * CS, y * CS, p.color, 'stone');
      if (i === p.powerAt) drawPower(c, p.power, x * CS, y * CS, G.t);
    });
    c.restore();
  }

  function render() {
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const sx = G.shake > 0 ? rand(-4, 4) : 0, sy = G.shake > 0 ? rand(-4, 4) : 0;
    c.setTransform(RES, 0, 0, RES, sx * RES, sy * RES);

    // Top strip: the dino, the next stone, Rex.
    rr(c, 2, 4, VW - 4, TOP - 12, 22);
    c.fillStyle = G.world.strip; c.fill();
    c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    drawDinoTop(c);
    drawNext(c);
    drawThrower(c);

    // Board frame + picture
    rr(c, BX - 6, BY - 6, BW + 12, BH + 12, 14);
    c.fillStyle = INK; c.fill();
    c.save();
    rr(c, BX, BY, BW, BH, 8); c.clip();
    if (sceneCv) c.drawImage(sceneCv, BX, BY, BW, BH);
    c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
    c.beginPath();
    for (let x = 1; x < COLS; x++) { c.moveTo(BX + x * CS, BY); c.lineTo(BX + x * CS, BY + BH); }
    for (let y = 1; y < ROWS; y++) { c.moveTo(BX, BY + y * CS); c.lineTo(BX + BW, BY + y * CS); }
    c.stroke();

    // Danger: the stack is close to the top.
    let top = ROWS;
    for (let i = 0; i < G.grid.length; i++) if (G.grid[i]) { top = Math.floor(i / COLS); break; }
    if (top < 5 && G.state === 'play') {
      c.fillStyle = `rgba(232,85,61,${0.18 + 0.12 * Math.sin(G.t * 8)})`;
      c.fillRect(BX, BY, BW, CS * 4);
    }

    // Stack
    const flash = G.clearRows && Math.floor(G.clearT * 20) % 2 === 0;
    for (let y = 0; y < ROWS; y++) {
      const clearing = G.clearRows && G.clearRows.includes(y);
      for (let x = 0; x < COLS; x++) {
        const cell = G.grid[y * COLS + x];
        if (!cell) continue;
        const px = BX + x * CS, py = BY + y * CS;
        if (clearing) {
          const k = Math.max(0, G.clearT / 0.3);
          block(c, px, py, flash ? '#FFFFFF' : cell.c, cell.k, 0.4 + k * 0.6);
        } else block(c, px, py, cell.c, cell.k);
        if (cell.power) drawPower(c, cell.power, px, py, G.t + x);
      }
    }

    const p = G.piece;
    if (p && G.state === 'play') {
      // Ghost: where the stone will land.
      const gy = dropY(p);
      if (gy > p.y) {
        c.setLineDash([5, 4]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.65)';
        for (const [cx, cy] of p.cells) { rr(c, BX + (p.x + cx) * CS + 4, BY + (gy + cy) * CS + 4, CS - 8, CS - 8, 6); c.stroke(); }
        c.setLineDash([]);
      }
      p.cells.forEach(([cx, cy], i) => {
        const x = p.x + cx, y = p.y + cy;
        if (y < 0) return;
        block(c, BX + x * CS, BY + y * CS, p.color, 'stone');
        if (i === p.powerAt) drawPower(c, p.power, BX + x * CS, BY + y * CS, G.t);
      });
    }

    // Night: only the area around the falling stone is lit.
    if (G.world.dark && G.state !== 'won') {
      const cx = p ? BX + (p.x + p.n / 2) * CS : BX + BW / 2, cy = p ? BY + (p.y + p.n / 2) * CS : BY + BH / 2;
      const gr = c.createRadialGradient(cx, cy, 70, cx, cy, 230);
      gr.addColorStop(0, 'rgba(8,5,26,0)'); gr.addColorStop(1, 'rgba(8,5,26,.82)');
      c.fillStyle = gr; c.fillRect(BX, BY, BW, BH);
    }
    if (G.freeze > 0) { c.fillStyle = 'rgba(189,235,255,.18)'; c.fillRect(BX, BY, BW, BH); }

    // Rising rows: a bar along the bottom fills up before the next row pushes in.
    if (G.cfg.rise && G.state === 'play') {
      const k = 1 - G.riseT / G.cfg.rise;
      c.fillStyle = k > 0.8 && Math.floor(G.t * 8) % 2 ? '#FFD23F' : ROCK[G.world.rows];
      c.fillRect(BX, BY + BH - 5, BW * k, 5);
    }
    c.restore();

    for (const s of G.shots) core.drawShot(c, s.x, s.y, 9, s.spin);
    drawParticles(c);
  }

  function drawDinoTop(c) {
    const ch = G.ch, W = ch.w || 200, H = ch.h || 200;
    const pw = 74 * (ch.w ? 1.2 : 1), ph = pw * H / W;
    const won = G.state === 'won';
    const hop = won && G.winT > 0.3 ? -Math.abs(Math.sin((G.winT - 0.3) * 7)) * 12 : G.cheer > 0 ? -Math.sin(G.cheer * Math.PI) * 10 : 0;
    const wob = G.sad > 0 ? Math.sin(G.sad * 25) * 3 : 0;
    c.save();
    c.translate(PAD + 46 + wob, TOP - 12 + hop);
    if (ch.faceLeft) c.scale(-1, 1);
    c.translate(-pw / 2, -ph);
    core.drawDino(c, ch, G.outfit, pw, ph, G.t, sprite(ch.img, pw, ph));
    c.restore();
    if (G.shield) {
      c.strokeStyle = 'rgba(189,235,255,0.95)'; c.lineWidth = 3;
      c.beginPath(); c.arc(PAD + 46, TOP - 12 - ph * 0.45, 40 + Math.sin(G.t * 5) * 2, 0, Math.PI * 2); c.stroke();
    }
  }
  function drawNext(c) {
    const cx = VW / 2 - 6, cy = TOP / 2 - 2, w = 92, h = 70;
    rr(c, cx - w / 2, cy - h / 2, w, h, 16);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.font = '700 13px Rubik, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = INK; c.fillText('הבא', cx, cy - h / 2 + 11);
    const p = G.next;
    if (!p) return;
    const size = 16;
    const xs = p.cells.map((q) => q[0]), ys = p.cells.map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pw = (maxX - minX + 1) * size, ph = (maxY - minY + 1) * size;
    drawPieceAt(c, p, cx - pw / 2 - minX * size, cy + 8 - ph / 2 - minY * size, size);
  }
  function drawThrower(c) {
    const at = throwerPos();
    const boss = G.bossFight;
    const img = boss ? `boss-${G.w + 1}` : `rex-${G.w + 1}`;
    const w = boss ? 94 : 82, h = boss ? 98 : 75;
    if (G.state === 'won' && boss) {
      const t = Math.min(1, G.winT / 1.2);
      if (t >= 1) return;
      c.save(); c.globalAlpha = 1 - t * t;
      c.translate(at.x, at.y - t * 90); c.rotate(t * 9); c.scale(1 - t * 0.7, 1 - t * 0.7);
      c.drawImage(sprite(img, w, h), -w / 2, -h / 2, w, h);
      c.restore(); c.globalAlpha = 1;
      return;
    }
    const sleepy = !G.throwEvery;
    let k = 1, ox = 0;
    if (G.windup > 0) k = 1 + 0.08 * Math.sin((0.7 - G.windup) * 30);
    if (G.hurt > 0) ox = Math.sin(G.hurt * 60) * 5;
    c.save();
    c.translate(at.x + ox, at.y + (boss ? -2 : 6) + Math.sin(G.t * (sleepy ? 2 : 5)) * 2);
    c.scale(k, k);
    if (G.hurt > 0 && Math.floor(G.hurt * 14) % 2 === 0) c.globalAlpha = 0.45;
    c.drawImage(sprite(img, w, h), -w / 2, -h / 2, w, h);
    c.restore(); c.globalAlpha = 1;
    if (G.windup > 0) core.drawShot(c, at.x - 22, at.y - 10, 9 * (1 - G.windup / 0.7) + 2, G.t * 7);
    if (sleepy && G.state === 'play') {
      c.font = '700 16px Fredoka, sans-serif'; c.fillStyle = INK; c.textAlign = 'center';
      c.fillText('z', at.x - 30, at.y - 26 - (G.t * 8 % 8)); c.fillText('z', at.x - 40, at.y - 38 - (G.t * 8 % 8));
    }
    if (G.freeze > 0) {
      c.fillStyle = 'rgba(189,235,255,0.45)'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
      c.beginPath(); c.arc(at.x, at.y, w * 0.48, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  }
  function drawParticles(c) {
    for (const q of G.particles) {
      c.globalAlpha = clamp(q.life / q.max, 0, 1);
      if (q.conf) {
        c.save(); c.translate(q.x, q.y); c.rotate(q.rot);
        c.fillStyle = q.color; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        c.restore();
      } else if (q.text) {
        c.font = '700 22px Fredoka, Rubik, sans-serif';
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

  // ---------- Controls ----------
  const playing = () => G && G.mode === 'blocks' && G.state === 'play' && !core.isPaused();
  function press(k) {
    core.skipIntro();
    if (!playing()) return;
    sfx.init();
    if (k === 'left' || k === 'right') { held[k] = true; held[k === 'left' ? 'right' : 'left'] = false; move(k === 'left' ? -1 : 1); held.rep = 0.17; }
    if (k === 'down') held.down = true;
    if (k === 'rot') rotate();
    if (k === 'drop') hardDrop();
  }
  function release(k) { if (k in held) held[k] = false; }
  // Button pad
  for (const b of document.querySelectorAll('#bpad [data-k]')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      b.classList.add('on');
      press(k);
    });
    const up = () => { b.classList.remove('on'); release(k); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }
  // Swipe mode: drag sideways to slide the stone, tap to turn it, flick down to drop it, drag down slowly to speed it up.
  const sw = { id: null };
  const wrap = $('#boardWrap');
  wrap.addEventListener('pointerdown', (e) => {
    if (!G || G.mode !== 'blocks' || core.controlMode() !== 'swipe') return;
    if (e.target.closest('button, .overlay')) return;
    Object.assign(sw, { id: e.pointerId, x: e.clientX, y: e.clientY, ax: e.clientX, ay: e.clientY, t: e.timeStamp, moved: false, ly: e.clientY, lt: e.timeStamp, vy: 0 });
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sw.id || !playing()) return;
    const cell = cv.getBoundingClientRect().width / VW * CS * 0.9;
    const dt = e.timeStamp - sw.lt;
    if (dt > 0) sw.vy = (e.clientY - sw.ly) / dt;
    sw.ly = e.clientY; sw.lt = e.timeStamp;
    while (e.clientX - sw.ax > cell) { move(1); sw.ax += cell; sw.moved = true; }
    while (sw.ax - e.clientX > cell) { move(-1); sw.ax -= cell; sw.moved = true; }
    const dy = e.clientY - sw.ay;
    if (dy > cell * 1.2 && Math.abs(e.clientX - sw.x) < dy) { G.soft = true; sw.moved = true; }
    else if (dy < cell * 0.5) G.soft = false;
  });
  const swEnd = (e) => {
    if (e.pointerId !== sw.id) return;
    sw.id = null;
    const wasSoft = G && G.soft;
    if (G) G.soft = false;
    if (!playing() || e.type === 'pointercancel') return;
    const dy = e.clientY - sw.y, dx = e.clientX - sw.x;
    if (sw.vy > 0.9 && dy > 40) { hardDrop(); return; }
    if (!sw.moved && !wasSoft && Math.hypot(dx, dy) < 14 && e.timeStamp - sw.t < 350) rotate();
  };
  wrap.addEventListener('pointerup', swEnd);
  wrap.addEventListener('pointercancel', swEnd);

  // Keyboard: arrows move, up or X turns, down drops faster, space drops.
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rot', x: 'rot', X: 'rot', ' ': 'drop' };
  function key(e, down) {
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (!down) { release(k); return; }
    if (e.repeat && (k === 'left' || k === 'right' || k === 'down')) return; // we repeat ourselves
    if (e.repeat) return;
    press(k);
  }

  return {
    game: { logo: ['דינו', 'בלוקים!'], worlds: WORLDS, chals: CHALS, perk: 'bperk', goal: goalText, start },
    update: (dt) => { G = core.G(); update(dt); },
    render: () => { G = core.G(); render(); },
    resize, key,
  };
};
