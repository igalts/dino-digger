'use strict';
// דינו בלוקים: a falling-blocks game with its own five worlds, using the same dinos, eggs, gems and wardrobe.
// Clear full rows to reach the level's goal. Each cleared row sends a star flying: to the goal counter,
// or, in a boss level, straight into the boss (one hit per row). The boss throws rocks onto your stack;
// a red marker shows where each one will land. Magic stones do something the moment they land.
// game.js builds the shared pieces (save, sounds, wardrobe, map, win card) and hands them in as `core`.
window.DinoBlocks = (core) => {
  const { $, store, rec, sfx, CHARS, images, SHOTS } = core;
  const INK = '#2B1B3D';
  const COLS = 10, ROWS = 18, CS = 32;      // board cells, cell size in logical px
  const BW = COLS * CS, BH = ROWS * CS;      // 320 x 576
  const PAD = 10, TOP = 100;                 // strip above the board: the dino, the next stone, the goal or the boss
  const VW = BW + PAD * 2, VH = TOP + BH + PAD;
  const BX = PAD, BY = TOP;                  // board's top-left on the canvas
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- The seven classic stones ----------
  const SHAPES = {
    I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: '#4FC3F7' },
    O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#FFD23F' },
    T: { n: 3, cells: [[0, 1], [1, 1], [2, 1], [1, 0]], color: '#B07CE8' },
    L: { n: 3, cells: [[0, 1], [1, 1], [2, 1], [2, 0]], color: '#FF9F1C' },
    J: { n: 3, cells: [[0, 1], [1, 1], [2, 1], [0, 0]], color: '#5B8DEF' },
    S: { n: 3, cells: [[0, 1], [1, 1], [1, 0], [2, 0]], color: '#5CCB5F' },
    Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#FF6B7A' },
  };
  const BAG = Object.keys(SHAPES);
  // Rows that are already on the board (or push up from below) look like the world they're in.
  const ROWKIND = {
    crystal: { c: '#9C8ADB', mark: '#E3D6FF' },
    candy:   { c: '#FFB0D2', mark: '#FFFFFF' },
    coral:   { c: '#5FC9C0', mark: '#C9F2EE' },
    sand:    { c: '#E9C46A', mark: '#C98A52' },
    moon:    { c: '#B8AEDB', mark: '#8E84B8' },
    rock:    { c: '#9A90A8', mark: '#6E6480' },
  };

  // Magic stones: one cell of the stone glows. The magic happens the moment the stone lands.
  const MAGIC = {
    bomb:   { label: 'בום!' },   // blows up the stones around it
    bolt:   { label: 'ברק!' },   // clears its whole row
    freeze: { label: 'קפוא!' },  // everything slows down for a while
    stomp:  { label: 'רקיעה!' }, // the dino stomps: the two bottom rows are cleared (and count toward the goal)
  };
  const MAGIC_EVERY = 7; // every 7th stone is a magic stone

  // ---------- Worlds and levels ----------
  // goal: rows to clear. speed: rows per second the stone falls. start: rows on the board at the start.
  // rise: seconds between new rows pushing up from below. meteors: seconds between meteors (space).
  const L = (goal, speed, o = {}) => ({ goal, speed, start: 0, rise: 0, meteors: 0, ...o });
  const WORLDS = [
    { name: 'מערת הקריסטלים', unlock: 'stegi', rows: 'crystal', strip: '#C9BCF5', bg: 'bbg-1', game: '#2A1F5C',
      levels: [L(4, 0.75), L(5, 0.85), L(6, 0.9, { start: 2 }), L(7, 0.95, { start: 3 }), L(8, 0.9)] },
    { name: 'ארץ הממתקים', unlock: 'petra', rows: 'candy', strip: '#FFD6EC', bg: 'bbg-2', game: '#7A2E58',
      levels: [L(6, 1.0, { start: 3 }), L(7, 1.05, { start: 4 }), L(7, 1.1, { start: 4 }), L(8, 1.15, { start: 5 }), L(9, 1.0, { start: 3 })] },
    { name: 'מתחת לים', unlock: 'anki', rows: 'coral', strip: '#A6E4FF', bg: 'bbg-3', game: '#103A72',
      levels: [L(7, 1.1, { rise: 24 }), L(8, 1.15, { rise: 21 }), L(8, 1.2, { start: 2, rise: 20 }), L(9, 1.25, { start: 3, rise: 18 }),
        L(10, 1.1, { rise: 26 })] },
    { name: 'מדבר הפירמידות', unlock: 'rafi', rows: 'sand', strip: '#FFE3A8', bg: 'bbg-4', game: '#7A4A18',
      levels: [L(8, 1.3, { start: 3 }), L(8, 1.4, { start: 4 }), L(9, 1.45, { start: 4, rise: 24 }), L(10, 1.5, { start: 5, rise: 22 }),
        L(10, 1.3, { start: 3 })] },
    { name: 'החלל', unlock: 'rex', rows: 'moon', strip: '#B8AEDB', bg: 'bbg-5', game: '#0E0A2E',
      levels: [L(8, 1.4, { meteors: 14 }), L(9, 1.45, { meteors: 12, start: 2 }), L(9, 1.5, { meteors: 12, rise: 24 }),
        L(10, 1.55, { meteors: 10, start: 3 }), L(11, 1.35, { start: 2 })] },
  ];
  WORLDS.forEach((wd) => { wd.levels[wd.levels.length - 1].bossFight = true; });
  // One boss per world. It throws something every `every` seconds; every row you clear hits it once.
  const BOSSES = [
    { name: 'מלך הקריסטלים', shot: 'crystal', every: 9.5 },
    { name: 'רקס הסוכריות',  shot: 'candy',   every: 9 },
    { name: 'מלך הים',       shot: 'bubble',  every: 8.5 },
    { name: 'פרעה רקס',      shot: 'sandball', every: 8 },
    { name: 'רקס החלל',      shot: 'star',    every: 7.5 },
  ];
  Object.assign(SHOTS, {
    crystal:  { fill: '#7EE0FF', core: '#E6FBFF', sparks: ['#7EE0FF', '#E08CFF'] },
    candy:    { fill: '#FF6FA8', core: '#FFFFFF', sparks: ['#FF6FA8', '#FFFFFF'] },
    sandball: { fill: '#F2C36E', core: '#FFF0C8', sparks: ['#F2C36E', '#C98A52'] },
    meteor:   { fill: '#9A90A8', core: '#FF9F1C', sparks: ['#FF9F1C', '#FFD23F'] },
  });
  // Map: level spots and prize spot on each bmap-N picture (keep in sync with tools/make_blocks_art.py).
  const MAP = {
    img: (w) => `assets/bmap-${w + 1}.svg`,
    boss: (w) => `assets/bboss-${w + 1}.svg`,
    layouts: [
      { nodes: [[180, 650], [85, 540], [255, 450], [105, 335], [235, 225]], prize: [100, 118] },
      { nodes: [[80, 640], [270, 585], [150, 470], [280, 335], [95, 255]], prize: [255, 118] },
      { nodes: [[265, 660], [95, 585], [205, 455], [80, 335], [255, 240]], prize: [110, 118] },
      { nodes: [[100, 652], [255, 560], [105, 440], [262, 330], [150, 215]], prize: [275, 112] },
      { nodes: [[180, 662], [292, 520], [160, 420], [62, 300], [222, 210]], prize: [292, 112] },
    ],
  };

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
    const W = wrap.clientWidth - 8, H = wrap.clientHeight;
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
  // The world's picture behind the board: softened (a bit blurred, less colourful) and darkened,
  // so it sets the mood without being mistaken for stones.
  function buildScene(G) {
    sceneCv = document.createElement('canvas');
    sceneCv.width = Math.round(BW * RES); sceneCv.height = Math.round(BH * RES);
    const c = sceneCv.getContext('2d'), img = images[G.world.bg];
    c.scale(RES, RES);
    if (img) {
      const k = Math.max(BW / 360, BH / 640), w = 360 * k, h = 640 * k;
      c.filter = `blur(${(1.6 * RES).toFixed(1)}px) saturate(0.55)`;
      c.drawImage(img, (BW - w) / 2 - 4, (BH - h) / 2 - 4, w + 8, h + 8); // a little bigger so the blur has no soft edge
      c.filter = 'none';
    }
    c.fillStyle = 'rgba(24,16,40,.62)';
    c.fillRect(0, 0, BW, BH);
  }
  const loadPics = (w) => Promise.all([`bbg-${w + 1}`, `bboss-${w + 1}`].map((n) => core.loadScene(n)));

  // ---------- Level start ----------
  let G = null;
  async function start(w, l) {
    const world = WORLDS[w], cfg = world.levels[l], r = rec('blocks');
    await loadPics(w);
    if (WORLDS[w + 1]) loadPics(w + 1);
    const ch = CHARS[r.selected] || CHARS.pip;
    const key = `${w + 1}-${l + 1}`;
    const help = (r.streak[key] || 0) >= 3 ? 0.85 : 1; // a little quiet help after 3 losses in a row
    const lives = 3;
    const boss = !!cfg.bossFight;
    G = {
      mode: 'blocks', w, l, cfg, key, ch, world, perk: ch.id, bombRows: 0, hold: null, holdUsed: false, after: null,
      bossFight: boss, bossInfo: boss ? BOSSES[w] : { shot: 'meteor' }, bossHp: cfg.goal, bossShown: cfg.goal,
      grid: new Array(COLS * ROWS).fill(null),
      lives, maxLives: lives, score: 0, lines: 0, flown: 0, multi: false,
      state: 'ready', readyT: boss ? 3.2 : 2.2, t: 0, playT: 0, shownSec: -1,
      particles: [], shots: [], orbs: [], trails: [], piece: null, next: null, bag: [], pieces: 0,
      fall: 0, lockT: 0, lockMoves: 0, clearRows: null, clearT: 0,
      speed: cfg.speed * help, soft: false,
      throwEvery: boss ? BOSSES[w].every / help : cfg.meteors / help,
      throwT: boss ? 5 : cfg.meteors * 0.7, windup: 0, target: null,
      riseT: cfg.rise, freeze: 0, extraRows: null, qAnim: 0, bounces: [],
      cheer: 0, sad: 0, shake: 0, hurt: 0, bump: 0, winT: 0, outfit: { ...store.data.outfit },
    };
    G.readyMax = G.readyT;
    for (let k = 0; k < cfg.start; k++) addRow(ROWS - 1 - k, world.rows);
    G.next = takePiece();
    if (G.perk === 'stegi') G.after = takePiece(); // Stegi sees two stones ahead
    core.setG(G);
    core.setPaused(false);
    core.hideOverlays();
    const game = $('#game');
    game.dataset.world = `b${w + 1}`;
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
    // What's special about this level, in one or two short lines.
    const how = [];
    if (boss) how.push('🪨 הבוס זורק סלעים על המגדל', '💥 כל שורה שתנקו פוגעת בו');
    else if (cfg.meteors) how.push('☄️ מטאורים נופלים! הסימן האדום מראה איפה');
    if (cfg.rise) how.push('⬆️ שורות חדשות עולות מלמטה');
    b.innerHTML = `<div class="ready-card">${head}<div class="ready-goal">${goalText(cfg)}</div>${
      how.map((s) => `<div class="ready-how">${s}</div>`).join('')}${bestLine}${
      core.chalRow(cfg, (r.chal || {})[key] || 0, 0, CHALS)}<div class="ready-bar"><i style="animation-duration:${G.readyT}s"></i></div></div>`;
    b.className = 'banner';
    if (boss) sfx.boss(); else sfx.ready();
    b.hidden = false;
    held.left = held.right = held.down = false;
    core.applyControlMode();
    core.keepAwake();
  }
  const goalText = (cfg) => (cfg.bossFight ? `💥 <bdi>${cfg.goal}</bdi> שורות מנצחות את הבוס` : `🧱 מנקים <bdi>${cfg.goal}</bdi> שורות`);

  // A full row with one or two holes (the starting rows, and the rows that push up from below).
  function addRow(y, kind) {
    const holes = new Set([Math.floor(Math.random() * COLS)]);
    if (Math.random() < 0.4) holes.add(Math.floor(Math.random() * COLS));
    for (let x = 0; x < COLS; x++) G.grid[y * COLS + x] = holes.has(x) ? null : { c: ROWKIND[kind].c, k: kind };
  }

  function takePiece() {
    if (!G.bag.length) {
      G.bag = [...BAG];
      for (let i = G.bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [G.bag[i], G.bag[j]] = [G.bag[j], G.bag[i]]; }
    }
    const t = G.bag.pop(), s = SHAPES[t];
    G.pieces++;
    const kinds = Object.keys(MAGIC);
    const every = G.perk === 'rafi' ? 4 : MAGIC_EVERY; // Rafi gets magic stones about twice as often
    const magic = G.pieces > 2 && G.pieces % every === 0 ? kinds[Math.floor(Math.random() * kinds.length)] : null;
    return { t, n: s.n, color: s.color, cells: s.cells.map((c) => [...c]), x: 0, y: 0, rx: 0, ry: 0,
      magic, magicAt: magic ? Math.floor(Math.random() * s.cells.length) : -1 };
  }

  // ---------- Board rules ----------
  const cellAt = (x, y) => (x < 0 || x >= COLS || y >= ROWS ? 'wall' : y < 0 ? null : G.grid[y * COLS + x]);
  const fits = (p, x, y, cells = p.cells) => cells.every(([cx, cy]) => !cellAt(x + cx, y + cy));
  function spawn() {
    const p = G.next;
    if (G.after) { G.next = G.after; G.after = takePiece(); } else G.next = takePiece();
    G.prevNext = p; G.qAnim = Q_ANIM; // the preview animates the stones moving along
    G.holdUsed = false;
    place(p);
  }
  // Put a stone at the top middle of the board.
  function place(p) {
    const minY = Math.min(...p.cells.map((c) => c[1]));
    p.x = Math.floor((COLS - p.n) / 2); p.y = -minY;
    p.rx = p.x; p.ry = p.y - 0.6;
    G.fall = 0; G.lockT = 0; G.lockMoves = 0;
    if (!fits(p, p.x, p.y)) { G.piece = null; topOut(); return; }
    G.piece = p;
  }
  // Petra flies off with the falling stone and keeps it for later (once per stone).
  function hold() {
    const p = G.piece;
    if (G.perk !== 'petra' || !p || G.slam || G.holdUsed) return;
    p.cells = SHAPES[p.t].cells.map((c) => [...c]); // back to how it started
    const back = G.hold;
    G.hold = p;
    if (back) place(back); else spawn();
    G.holdUsed = true;
    sfx.tone(780, 0.08, 'triangle', 0.06, 0, 1100);
  }
  function move(dx) {
    const p = G.piece;
    if (!p || G.slam || !fits(p, p.x + dx, p.y)) return false;
    p.x += dx;
    touched();
    sfx.tone(440, 0.03, 'triangle', 0.03);
    return true;
  }
  function moveDown() {
    const p = G.piece;
    if (!p || G.slam || !fits(p, p.x, p.y + 1)) return false;
    p.y++; G.score += 1;
    return true;
  }
  function rotate() {
    const p = G.piece;
    if (!p || G.slam || p.t === 'O') return;
    const cells = p.cells.map(([x, y]) => [p.n - 1 - y, x]);
    for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, 1]]) {
      if (fits(p, p.x + kx, p.y + ky, cells)) {
        p.cells = cells; p.x += kx; p.y += ky;
        p.spin = 1;
        touched();
        sfx.tone(660, 0.05, 'triangle', 0.045);
        return;
      }
    }
  }
  // Moving or turning a stone that is sitting on something gives a little more time before it locks.
  function touched() { if (G.lockMoves < 15) { G.lockT = 0; G.lockMoves++; } }
  const dropY = (p) => { let y = p.y; while (fits(p, p.x, y + 1)) y++; return y; };
  // Slam: the stone shoots down (speeding up as it goes, so you can see it fall), then hits with a bump.
  function slam() {
    const p = G.piece;
    if (!p || G.slam) return;
    const y = dropY(p);
    const dist = y - p.y;
    G.score += 2 * dist;
    p.rx = p.x;
    G.slam = { from: p.ry, to: y, t: 0, dur: dist > 0 ? Math.min(0.2, 0.09 + dist * 0.008) : 0 };
    p.y = y;
    if (dist > 0) sfx.tone(520, 0.14, 'triangle', 0.035, 0, 160);
    else slamImpact();
  }
  function slamImpact() {
    const p = G.piece, s = G.slam;
    G.slam = null;
    p.ry = p.y;
    const minY = Math.min(...p.cells.map(([, cy]) => cy));
    if (p.y - s.from > 0.5) {
      G.trails.push({ cols: [...new Set(p.cells.map(([cx]) => p.x + cx))], from: s.from + minY, to: p.y + minY, t: 0.3 });
    }
    for (const [cx, cy] of p.cells) dust(BX + (p.x + cx + 0.5) * CS, BY + (p.y + cy + 1) * CS);
    G.shake = Math.max(G.shake, 0.12); G.bump = 0.15;
    sfx.tone(110, 0.12, 'square', 0.07, 0, 55);
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* ignore */ }
    lock();
  }
  function lock() {
    const p = G.piece;
    G.piece = null;
    let over = false, magicAt = null;
    p.cells.forEach(([cx, cy], i) => {
      const x = p.x + cx, y = p.y + cy;
      if (y < 0) { over = true; return; }
      G.grid[y * COLS + x] = { c: p.color, k: 'stone' };
      if (i === p.magicAt) magicAt = [x, y];
    });
    sfx.tone(170, 0.08, 'square', 0.045);
    if (over) { topOut(); return; }
    if (magicAt) doMagic(p.magic, magicAt[0], magicAt[1]);
    checkRows(G.extraRows || []);
    G.extraRows = null;
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
  function checkRows(extra = []) {
    const rows = [...new Set([...fullRows(), ...extra])].sort((a, b) => a - b);
    if (!rows.length) return false;
    G.clearRows = rows; G.clearT = 0.28;
    return true;
  }
  const SCORES = [0, 100, 300, 500, 800];
  function finishClear() {
    const rows = G.clearRows;
    G.clearRows = null;
    for (const y of rows) {
      for (let x = 0; x < COLS; x++) {
        const cell = G.grid[y * COLS + x];
        if (cell) burst(BX + (x + 0.5) * CS, BY + (y + 0.5) * CS, [cell.c, '#FFFFFF'], 3);
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
    // One star per row flies up to the goal counter (or into the boss). Rex's rows count twice: two stars each.
    const to = goalPos(), per = G.perk === 'rex' ? 2 : 1, stars = rows.flatMap((y) => Array(per).fill(y));
    stars.forEach((y, i) => {
      const x = BX + BW / 2 + (i - (stars.length - 1) / 2) * 26;
      G.orbs.push({ x, y: BY + (y + 0.5) * CS, sx: x, sy: BY + (y + 0.5) * CS, tx: to.x, ty: to.y, t: -i * 0.08, dur: 0.55 });
    });
    if (per > 1) floatText(BX + BW / 2, midY + 28, 'רקס: כפול!', '#FF9F1C');
    // Anki's hammer tail: every 4 rows, the next stone comes with a bomb.
    if (G.perk === 'anki') {
      G.bombRows += n;
      if (G.bombRows >= 4) {
        G.bombRows -= 4;
        G.next.magic = 'bomb'; G.next.magicAt = Math.floor(Math.random() * G.next.cells.length);
        floatText(BX + 60, BY + 30, 'אנקי: פצצה!', '#FFD23F');
      }
    }
  }
  // A star reached the counter / the boss.
  function orbHit() {
    G.flown++;
    if (G.bossFight) {
      G.bossHp = Math.max(0, G.cfg.goal - G.flown);
      G.hurt = 0.5;
      sfx.ouch();
      burst(goalPos().x, goalPos().y, ['#FFD23F', '#FFFFFF', '#FF8FA3'], 10);
    } else {
      G.bumpGoal = 0.35;
      sfx.tone(988, 0.08, 'triangle', 0.07);
    }
    hud();
    if (G.flown >= G.cfg.goal && G.state === 'play') win();
  }

  // The stack reached the top: an egg breaks and the bottom rows crumble away.
  function topOut() {
    G.lives--;
    core.buildLives();
    sfx.hit();
    G.sad = 1.2; G.shake = 0.4;
    try { if (navigator.vibrate) navigator.vibrate(180); } catch (e) { /* ignore */ }
    if (G.lives <= 0) { core.lose(); return; }
    floatText(BX + BW / 2, BY + 80, 'אוי! ביצה נשברה', '#FF8FA3');
    for (let y = ROWS - 7; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = G.grid[y * COLS + x];
        if (cell) burst(BX + (x + 0.5) * CS, BY + (y + 0.5) * CS, [cell.c, '#FFFFFF'], 2);
      }
    }
    G.grid = [...new Array(7 * COLS).fill(null), ...G.grid.slice(0, (ROWS - 7) * COLS)];
    G.piece = null;
  }

  function doMagic(type, x, y) {
    const dur = 1;
    const px = BX + (x + 0.5) * CS, py = BY + (y + 0.5) * CS;
    if (type === 'bomb') {
      for (let yy = y - 1; yy <= y + 1; yy++) {
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || xx >= COLS || yy < 0 || yy >= ROWS) continue;
          const cell = G.grid[yy * COLS + xx];
          if (cell) burst(BX + (xx + 0.5) * CS, BY + (yy + 0.5) * CS, [cell.c, '#FFD23F', '#FF9F1C'], 4);
          G.grid[yy * COLS + xx] = null;
        }
      }
      G.shake = 0.3;
      sfx.tone(80, 0.35, 'sawtooth', 0.09, 0, 40);
      G.flashes = [{ x: px, y: py, r: 0, t: 0.35, c: '#FFD23F' }];
    }
    if (type === 'bolt') {
      // Fill the row so it clears like any other row (and counts toward the goal).
      for (let xx = 0; xx < COLS; xx++) if (!G.grid[y * COLS + xx]) G.grid[y * COLS + xx] = { c: '#FFF27A', k: 'bolt' };
      G.boltRow = { y, t: 0.3 };
      sfx.tone(1400, 0.2, 'sawtooth', 0.05, 0, 300);
    }
    if (type === 'freeze') { G.freeze = 8 * dur; sfx.tone(1200, 0.4, 'sine', 0.06, 0, 600); }
    if (type === 'stomp') {
      // The dino stomps: the two bottom rows (if they have stones) clear like full rows and count toward the goal.
      G.extraRows = [ROWS - 1, ROWS - 2].filter((yy) => G.grid.slice(yy * COLS, yy * COLS + COLS).some(Boolean));
      G.shake = 0.45; G.cheer = 1;
      sfx.tone(70, 0.3, 'square', 0.1, 0, 45); sfx.tone(90, 0.3, 'sawtooth', 0.06, 0.12, 50);
      try { if (navigator.vibrate) navigator.vibrate([40, 60, 40]); } catch (e) { /* ignore */ }
    }
    floatText(px, py - 22, MAGIC[type].label, '#FFFFFF');
    burst(px, py, ['#FFD23F', '#4FC3F7', '#FFFFFF'], 10);  }

  // A new row pushes the whole stack up from the bottom.
  function rise() {
    const topRow = G.grid.slice(0, COLS).some(Boolean);
    G.grid = [...G.grid.slice(COLS), ...new Array(COLS).fill(null)];
    addRow(ROWS - 1, G.world.rows);
    const p = G.piece;
    if (p && !fits(p, p.x, p.y)) { if (fits(p, p.x, p.y - 1)) { p.y--; p.ry--; } else { G.piece = null; topOut(); return; } }
    if (topRow) { topOut(); return; }
    sfx.tone(140, 0.25, 'triangle', 0.07, 0, 220);
  }

  // ---------- The boss (or meteors) throws rocks onto the stack ----------
  const throwerPos = () => ({ x: VW - PAD - 52, y: TOP / 2 + 2 });
  const goalPos = () => (G.bossFight ? { x: throwerPos().x, y: throwerPos().y } : { x: VW - PAD - 50, y: TOP / 2 });
  const columnTop = (col) => { let y = 0; while (y < ROWS && !G.grid[y * COLS + col]) y++; return y; }; // first filled row
  function pickTarget() {
    // Aim at a column the falling stone isn't over, so you can see it coming.
    const p = G.piece, busy = new Set(p ? p.cells.map(([cx]) => p.x + cx) : []);
    const free = [...Array(COLS).keys()].filter((c) => !busy.has(c));
    return free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * COLS);
  }
  function throwRock() {
    const col = G.target;
    const tx = BX + (col + 0.5) * CS;
    const from = G.bossFight ? { x: throwerPos().x - 22, y: throwerPos().y - 8 } : { x: tx + rand(-60, 60), y: -20 };
    G.shots.push({ col, sx: from.x, sy: from.y, t: 0, dur: G.bossFight ? 1.0 : 1.2, x: from.x, y: from.y, spin: 0, arc: G.bossFight ? 70 : 0 });
    if (G.bossFight) sfx.throwIt(); else sfx.tone(300, 0.5, 'sawtooth', 0.04, 0, 80);
  }
  // Where the falling stone covers a column: the top of the stone there (in rows, as drawn), or null.
  function pieceTopIn(col) {
    const p = G.piece;
    if (!p || G.state !== 'play') return null;
    const ys = p.cells.filter(([cx]) => p.x + cx === col).map(([, cy]) => p.ry + cy);
    return ys.length ? Math.min(...ys) : null;
  }
  function landRock(s) {
    const y = columnTop(s.col) - 1;
    const px = BX + (s.col + 0.5) * CS;
    const sparks = SHOTS[G.bossInfo.shot].sparks;
    // The falling stone works like an umbrella: the rock hits the top of it and bounces away. The stone is fine.
    const onTop = pieceTopIn(s.col);
    if (onTop !== null || y < 0) {
      const hy = BY + (onTop !== null ? onTop : 0) * CS;
      burst(px, hy, ['#FFFFFF', ...sparks], 8);
      G.bounces.push({ x: px, y: hy - 8, vx: (s.col < COLS / 2 ? -1 : 1) * rand(150, 210), vy: -260, spin: s.spin, t: 1 });
      if (onTop !== null) floatText(px, hy - 24, 'חסמת!', '#FFFFFF');
      sfx.tone(900, 0.08, 'triangle', 0.06, 0, 500);
      return;
    }
    G.grid[y * COLS + s.col] = { c: ROWKIND.rock.c, k: 'rock' };
    burst(px, BY + (y + 0.5) * CS, sparks, 10);
    G.shake = Math.max(G.shake, 0.15);
    sfx.tone(120, 0.15, 'square', 0.06);
    if (!G.piece && !G.clearRows) checkRows(); // otherwise the row is checked when the falling stone locks
  }
  // Rocks aim at the top of the stack, or at the falling stone if it's in the way.
  const shotTarget = (s) => {
    const top = pieceTopIn(s.col);
    return { x: BX + (s.col + 0.5) * CS, y: BY + (top !== null ? top - 0.3 : columnTop(s.col) - 0.5) * CS };
  };

  // ---------- Update ----------
  const held = { left: false, right: false, down: false, rep: 0, downRep: 0 };
  function update(dt) {
    G.t += dt;
    updateParticles(dt);
    for (const k of ['shake', 'cheer', 'sad', 'hurt', 'bump', 'bumpGoal', 'qAnim']) if (G[k] > 0) G[k] -= dt;
    for (const tr of G.trails) tr.t -= dt;
    for (const b of G.bounces) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.spin += dt * 12; b.t -= dt; }
    G.bounces = G.bounces.filter((b) => b.t > 0 && b.y < VH + 40);
    G.trails = G.trails.filter((tr) => tr.t > 0);
    if (G.flashes) { for (const f of G.flashes) { f.t -= dt; f.r += dt * 260; } G.flashes = G.flashes.filter((f) => f.t > 0); }
    if (G.boltRow) { G.boltRow.t -= dt; if (G.boltRow.t <= 0) G.boltRow = null; }
    updateOrbs(dt);
    smooth(dt);
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
      s.y = s.sy + (to.y - s.sy) * k * k - Math.sin(Math.PI * k) * s.arc;
      if (s.t >= 1) { s.dead = true; landRock(s); if (G.state !== 'play') return; }
    }
    G.shots = G.shots.filter((s) => !s.dead);

    if (G.throwEvery > 0) {
      const slowK = G.freeze > 0 ? 0.35 : 1;
      if (G.windup > 0) { G.windup -= dt * slowK; if (G.windup <= 0) throwRock(); }
      else {
        G.throwT -= dt * slowK;
        if (G.throwT <= 0) {
          G.throwT = G.throwEvery * rand(0.85, 1.15); G.windup = 1.0; G.target = pickTarget();
        }
      }
    }
    if (G.cfg.rise) { G.riseT -= dt * (G.freeze > 0 ? 0.35 : 1); if (G.riseT <= 0) { G.riseT = G.cfg.rise; rise(); } }

    if (G.clearRows) {
      G.clearT -= dt;
      if (G.clearT <= 0) finishClear();
      return;
    }
    if (!G.piece) { spawn(); if (G.state !== 'play' || !G.piece) return; }
    if (G.slam) {
      const s = G.slam;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      G.piece.ry = s.from + (s.to - s.from) * k * k;
      if (k >= 1) slamImpact();
      return;
    }

    // Holding left/right keeps sliding after a short pause; holding down keeps speeding it down.
    if (held.left || held.right) {
      held.rep -= dt;
      if (held.rep <= 0) { move(held.left ? -1 : 1); held.rep = 0.05; }
    }

    const p = G.piece;
    const fast = held.down || G.soft;
    const speed = fast ? Math.max(22, G.speed) : G.speed * (G.freeze > 0 ? 0.45 : 1);
    if (fits(p, p.x, p.y + 1)) {
      G.lockT = 0;
      G.fall += dt * speed;
      while (G.fall >= 1) {
        G.fall -= 1;
        if (!fits(p, p.x, p.y + 1)) { G.fall = 0; break; }
        p.y++;
        if (fast) G.score += 1;
      }
    } else {
      G.fall = 0;
      G.lockT += dt;
      if (G.lockT > (fast ? 0.15 : 0.5)) lock();
    }
  }
  // The stone glides between cells instead of jumping, so moving and falling look smooth.
  function smooth(dt) {
    const p = G.piece;
    if (!p || G.slam) return;
    const k = Math.min(1, dt * 28);
    p.rx += (p.x - p.rx) * k;
    const ty = p.y + (fits(p, p.x, p.y + 1) ? Math.min(G.fall, 0.95) : 0);
    p.ry = ty < p.ry ? ty : p.ry + (ty - p.ry) * Math.min(1, dt * 30);
    if (Math.abs(p.rx - p.x) < 0.01) p.rx = p.x;
    if (p.spin > 0) p.spin = Math.max(0, p.spin - dt * 9);
  }
  function updateOrbs(dt) {
    for (const o of G.orbs) {
      o.t += dt / o.dur;
      if (o.t < 0) continue;
      const k = Math.min(1, o.t), e = k * k * (3 - 2 * k);
      o.x = o.sx + (o.tx - o.sx) * e + Math.sin(Math.PI * k) * 40;
      o.y = o.sy + (o.ty - o.sy) * e;
      if (Math.random() < 0.6) G.particles.push({ x: o.x, y: o.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, max: 0.3, color: '#FFE98A', size: rand(2, 3.5) });
      if (o.t >= 1) { o.dead = true; orbHit(); }
    }
    G.orbs = G.orbs.filter((o) => !o.dead);
  }

  // ---------- Win ----------
  const CONFETTI = ['#FFD23F', '#5CCB5F', '#FF8FA3', '#4FC3F7', '#8E5BD9', '#FF9F1C'];
  function win() {
    G.state = 'won';
    G.winT = 0; G.piece = null; G.shots = []; G.windup = 0;
    held.left = held.right = held.down = false;
    if (G.bossFight) {
      const at = throwerPos();
      floatText(at.x - 50, at.y + 30, 'ניצחת את הבוס!', '#FFD23F');
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
    for (let i = 0; i < 3; i++) G.particles.push({ x, y, vx: rand(-60, 60), vy: rand(-60, -10), life: 0.35, max: 0.35, color: 'rgba(255,255,255,.85)', size: rand(2, 3.5) });
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
    const goal = G.cfg.goal, n = Math.min(G.flown, goal);
    if (G.bossFight) {
      $('#levelName').textContent = 'בוס!';
      const hearts = Math.ceil(5 * G.bossHp / goal);
      $('#meterFill').style.width = `${G.bossHp / goal * 100}%`;
      $('#meterNum').innerHTML = [...Array(5)].map((_, i) => `<span class="${i < hearts ? 'on' : 'off'}">♥</span>`).join('')
        + `<div class="boss-pct">💥 <bdi>${n}</bdi> מתוך <bdi>${goal}</bdi></div>`;
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
    const rk = ROWKIND[kind];
    if (rk) {
      c.strokeStyle = rk.mark; c.fillStyle = rk.mark; c.lineWidth = 2; c.beginPath();
      if (kind === 'rock') { c.moveTo(px + 9, py + 14); c.lineTo(px + 15, py + 19); c.lineTo(px + 13, py + 25); c.moveTo(px + 15, py + 19); c.lineTo(px + 23, py + 17); c.stroke(); }
      else if (kind === 'crystal') { c.moveTo(px + 10, py + 24); c.lineTo(px + 16, py + 13); c.lineTo(px + 22, py + 24); c.stroke(); }
      else if (kind === 'candy') { c.moveTo(px + 6, py + 22); c.lineTo(px + 14, py + 14); c.moveTo(px + 14, py + 24); c.lineTo(px + 24, py + 14); c.stroke(); }
      else if (kind === 'coral') { for (const [dx, dy] of [[11, 18], [21, 16], [16, 24]]) { c.moveTo(px + dx + 2.5, py + dy); c.arc(px + dx, py + dy, 2.5, 0, Math.PI * 2); } c.stroke(); }
      else if (kind === 'sand') { for (const [dx, dy] of [[9, 16], [20, 14], [15, 22], [24, 23]]) { c.moveTo(px + dx + 1.5, py + dy); c.arc(px + dx, py + dy, 1.5, 0, Math.PI * 2); } c.fill(); }
      else if (kind === 'moon') { c.ellipse(px + 13, py + 18, 4, 2.5, 0, 0, Math.PI * 2); c.moveTo(px + 26, py + 22); c.ellipse(px + 23, py + 22, 3, 2, 0, 0, Math.PI * 2); c.stroke(); }
    }
    c.globalAlpha = 1;
  }
  // The glowing mark on a magic stone's cell.
  function drawMagic(c, type, px, py, t) {
    const cx = px + CS / 2, cy = py + CS / 2, pulse = 1 + Math.sin(t * 7) * 0.08;
    c.save();
    c.shadowColor = '#FFF27A'; c.shadowBlur = 12;
    rr(c, px + 1.5, py + 1.5, CS - 3, CS - 3, 7);
    c.fillStyle = '#FFFFFF'; c.fill();
    c.restore();
    c.lineWidth = 3; c.strokeStyle = INK; rr(c, px + 1.5, py + 1.5, CS - 3, CS - 3, 7); c.stroke();
    c.save(); c.translate(cx, cy); c.scale(pulse, pulse);
    c.lineWidth = 2.2; c.strokeStyle = INK; c.lineJoin = 'round';
    if (type === 'bomb') {
      c.fillStyle = INK; c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(4, -4); c.quadraticCurveTo(8, -10, 10, -9); c.stroke();
      c.fillStyle = Math.floor(t * 10) % 2 ? '#FFD23F' : '#FF6B2C'; c.beginPath(); c.arc(10, -10, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-3, -1, 2.2, 0, Math.PI * 2); c.fill();
    } else if (type === 'bolt') {
      c.fillStyle = '#FFD23F'; c.beginPath();
      c.moveTo(2, -11); c.lineTo(-7, 2); c.lineTo(0, 2); c.lineTo(-3, 11); c.lineTo(7, -3); c.lineTo(0, -3); c.closePath(); c.fill(); c.stroke();
    } else if (type === 'freeze') {
      c.strokeStyle = '#4FC3F7'; c.lineWidth = 2.6; c.beginPath();
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(Math.cos(a) * -10, Math.sin(a) * -10); c.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); }
      c.stroke();
    } else if (type === 'stomp') {
      // a dino footprint: three toes and a heel
      c.fillStyle = '#FF9F1C';
      for (const [tx, ty, a] of [[-7, -6, -0.5], [0, -9, 0], [7, -6, 0.5]]) {
        c.beginPath(); c.ellipse(tx, ty, 2.8, 5, a, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.beginPath(); c.ellipse(0, 5, 7, 6.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.restore();
  }
  function drawPieceCells(c, p, ox, oy, size, ghost = false) {
    const k = size / CS;
    c.save(); c.translate(ox, oy); c.scale(k, k);
    p.cells.forEach(([x, y], i) => {
      if (i === p.magicAt) drawMagic(c, p.magic, x * CS, y * CS, G.t);
      else block(c, x * CS, y * CS, p.color, 'stone', ghost ? 0.3 : 1);
    });
    c.restore();
  }

  function render() {
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const sh = G.shake > 0 ? G.shake * 18 : 0;
    const sx = sh ? rand(-sh, sh) : 0, sy = (sh ? rand(-sh, sh) : 0) + (G.bump > 0 ? Math.sin(G.bump / 0.15 * Math.PI) * 3 : 0);
    c.setTransform(RES, 0, 0, RES, sx * RES, sy * RES);

    // Top strip: the dino, the next stone, and the goal counter or the boss.
    rr(c, 2, 4, VW - 4, TOP - 12, 22);
    c.fillStyle = G.world.strip; c.fill();
    c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    drawDinoTop(c);
    drawNext(c);
    if (G.bossFight) drawBoss(c); else drawGoal(c);

    // Board frame + picture
    rr(c, BX - 6, BY - 6, BW + 12, BH + 12, 14);
    c.fillStyle = INK; c.fill();
    c.save();
    rr(c, BX, BY, BW, BH, 8); c.clip();
    if (sceneCv) c.drawImage(sceneCv, BX, BY, BW, BH);
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
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

    // Where the next rock lands: a red marker on that column.
    if (G.state === 'play' && G.target !== null && (G.windup > 0 || G.shots.length)) {
      const cols = new Set([...(G.windup > 0 ? [G.target] : []), ...G.shots.map((s) => s.col)]);
      for (const col of cols) {
        const ty = columnTop(col);
        const a = 0.35 + 0.25 * Math.sin(G.t * 14);
        c.fillStyle = `rgba(232,85,61,${a * 0.5})`;
        c.fillRect(BX + col * CS + 2, BY, CS - 4, ty * CS);
        c.strokeStyle = '#FF4F4F'; c.lineWidth = 3.5; c.lineCap = 'round';
        const mx = BX + (col + 0.5) * CS, my = BY + (ty - 0.5) * CS;
        c.beginPath(); c.moveTo(mx - 8, my - 8); c.lineTo(mx + 8, my + 8); c.moveTo(mx + 8, my - 8); c.lineTo(mx - 8, my + 8); c.stroke();
        c.lineCap = 'butt';
      }
    }

    // Stack
    const flash = G.clearRows && Math.floor(G.clearT * 20) % 2 === 0;
    for (let y = 0; y < ROWS; y++) {
      const clearing = G.clearRows && G.clearRows.includes(y);
      for (let x = 0; x < COLS; x++) {
        const cell = G.grid[y * COLS + x];
        if (!cell) continue;
        const px = BX + x * CS, py = BY + y * CS;
        if (clearing) block(c, px, py, flash ? '#FFFFFF' : cell.c, cell.k, 0.4 + Math.max(0, G.clearT / 0.28) * 0.6);
        else block(c, px, py, cell.c, cell.k);
      }
    }
    if (G.boltRow) {
      c.fillStyle = `rgba(255,242,122,${G.boltRow.t / 0.3 * 0.8})`;
      c.fillRect(BX, BY + G.boltRow.y * CS - 4, BW, CS + 8);
    }
    for (const f of G.flashes || []) {
      c.strokeStyle = `rgba(255,210,63,${f.t / 0.35})`; c.lineWidth = 8;
      c.beginPath(); c.arc(f.x, f.y, f.r, 0, Math.PI * 2); c.stroke();
    }

    // Slam streaks
    const sp = G.piece, spTop = sp ? Math.min(...sp.cells.map(([, cy]) => cy)) : 0;
    const live = G.slam && sp ? [{ cols: [...new Set(sp.cells.map(([cx]) => sp.x + cx))], from: G.slam.from + spTop, to: sp.ry + spTop, t: 0.3 }] : [];
    for (const tr of [...G.trails, ...live]) {
      const a = tr.t / 0.3;
      for (const col of tr.cols) {
        const g = c.createLinearGradient(0, BY + tr.from * CS, 0, BY + (tr.to + 1) * CS);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${0.55 * a})`);
        c.fillStyle = g;
        c.fillRect(BX + col * CS + 5, BY + tr.from * CS, CS - 10, (tr.to - tr.from + 1) * CS);
      }
    }

    const p = G.piece;
    if (p && G.state === 'play') {
      // Ghost: where the stone will land if you slam it.
      const gy = dropY(p);
      if (gy > p.y) {
        c.setLineDash([5, 4]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.7)';
        for (const [cx, cy] of p.cells) {
          rr(c, BX + (p.x + cx) * CS + 3, BY + (gy + cy) * CS + 3, CS - 6, CS - 6, 6);
          c.fillStyle = 'rgba(255,255,255,.1)'; c.fill(); c.stroke();
        }
        c.setLineDash([]);
      }
      const ox = BX + p.rx * CS, oy = BY + p.ry * CS;
      c.save();
      if (p.spin > 0) {
        // a quick little twist when it turns
        const pc = (p.n / 2) * CS;
        c.translate(ox + pc, oy + pc); c.rotate(-p.spin * 0.35); c.translate(-(ox + pc), -(oy + pc));
      }
      p.cells.forEach(([cx, cy], i) => {
        if (p.ry + cy < -0.9) return;
        const px = ox + cx * CS, py = oy + cy * CS;
        if (i === p.magicAt) drawMagic(c, p.magic, px, py, G.t);
        else block(c, px, py, p.color, 'stone');
      });
      c.restore();
    }

    if (G.freeze > 0) {
      c.fillStyle = 'rgba(189,235,255,.16)'; c.fillRect(BX, BY, BW, BH);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 6; rr(c, BX + 3, BY + 3, BW - 6, BH - 6, 8); c.stroke();
    }

    // Rising rows: a bar along the bottom fills up before the next row pushes in.
    if (G.cfg.rise && G.state === 'play') {
      const k = 1 - G.riseT / G.cfg.rise;
      c.fillStyle = k > 0.8 && Math.floor(G.t * 8) % 2 ? '#FFD23F' : ROWKIND[G.world.rows].c;
      c.fillRect(BX, BY + BH - 6, BW * k, 6);
    }
    c.restore();

    for (const s of G.shots) core.drawShot(c, s.x, s.y, G.bossFight ? 10 : 12, s.spin);
    for (const b of G.bounces) { c.globalAlpha = Math.min(1, b.t * 2); core.drawShot(c, b.x, b.y, G.bossFight ? 9 : 11, b.spin); c.globalAlpha = 1; }
    for (const o of G.orbs) {
      if (o.t < 0) continue;
      c.save(); c.translate(o.x, o.y); c.rotate(G.t * 6);
      c.fillStyle = '#FFD23F'; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 5 : 11; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    drawParticles(c);
  }

  function drawDinoTop(c) {
    const ch = G.ch, W = ch.w || 200, H = ch.h || 200;
    const pw = 72 * (ch.w ? 1.2 : 1), ph = pw * H / W;
    const won = G.state === 'won';
    const hop = won && G.winT > 0.3 ? -Math.abs(Math.sin((G.winT - 0.3) * 7)) * 12 : G.cheer > 0 ? -Math.sin(G.cheer * Math.PI) * 10 : 0;
    const wob = G.sad > 0 ? Math.sin(G.sad * 25) * 3 : 0;
    c.save();
    c.translate(PAD + 46 + wob, TOP - 12 + hop);
    if (ch.faceLeft) c.scale(-1, 1);
    c.translate(-pw / 2, -ph);
    core.drawDino(c, ch, G.outfit, pw, ph, G.t, sprite(ch.img, pw, ph));
    c.restore();
  }
  // A small stone centred on (cx, cy).
  function drawMini(c, p, cx, cy, size, alpha = 1) {
    const xs = p.cells.map((q) => q[0]), ys = p.cells.map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pw = (maxX - minX + 1) * size, ph = (maxY - minY + 1) * size;
    c.globalAlpha = alpha;
    drawPieceCells(c, p, cx - pw / 2 - minX * size, cy - ph / 2 - minY * size, size);
    c.globalAlpha = 1;
  }
  function box(c, cx, cy, w, h, label, glow) {
    rr(c, cx - w / 2, cy - h / 2, w, h, 16);
    c.fillStyle = glow ? '#FFF6C9' : 'rgba(255,255,255,.92)'; c.fill();
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.font = '700 13px Rubik, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = INK; c.fillText(label, cx, cy - h / 2 + 11);
  }
  const HOLD_BOX = { cx: 114, cy: TOP / 2 - 2, w: 50, h: 72 };
  const Q_ANIM = 0.4; // seconds for the "next" stones to move along
  const queueK = () => clamp(1 - G.qAnim / Q_ANIM, 0, 1);
  function drawNext(c) {
    const cy = TOP / 2 - 2;
    if (G.perk === 'stegi') {
      // Stegi sees two stones ahead: the next one big, the one after it smaller.
      // Numbered 1 (comes first, on the right where Hebrew starts) and 2 (after it, smaller and paler).
      const cx = 168, w = 124;
      box(c, cx, cy, w, 72, '');
      const x1 = cx + 26, x2 = cx - 32;
      c.strokeStyle = 'rgba(43,27,61,.25)'; c.lineWidth = 2; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(cx - 6, cy - 28); c.lineTo(cx - 6, cy + 30); c.stroke(); c.setLineDash([]);
      // When a stone drops in: stone 1 slides down out of the box, stone 2 glides over and grows into
      // place 1, and a new stone fades in at place 2.
      const k = queueK(), e = k * k * (3 - 2 * k), f = clamp((k - 0.35) / 0.65, 0, 1);
      c.save();
      rr(c, cx - w / 2 + 2, cy - 34, w - 4, 68, 14); c.clip();
      if (k < 1 && G.prevNext) drawMini(c, G.prevNext, x1, cy + 10 + 46 * e, 15, 1 - e);
      if (G.next) drawMini(c, G.next, x2 + (x1 - x2) * e, cy + 12 - 2 * e, 10 + 5 * e, 0.6 + 0.4 * e);
      if (G.after) drawMini(c, G.after, x2, cy + 12, Math.max(1, 10 * f), 0.6 * f);
      c.restore();
      for (const [x, n, big] of [[x1, '1', true], [x2, '2', false]]) {
        const bx = x, by = cy - 21, rad = big ? 10 : 8;
        c.beginPath(); c.arc(bx, by, rad, 0, Math.PI * 2);
        c.fillStyle = big ? '#FFD23F' : '#E3DDEE'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
        c.fillStyle = INK; c.font = `700 ${big ? 13 : 11}px Fredoka, Rubik, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(n, bx, by + 1);
      }
      return;
    }
    const cx = G.perk === 'petra' ? 190 : VW / 2 - 4;
    box(c, cx, cy, 96, 72, 'הבא');
    const k = queueK(), e = 1 - (1 - k) ** 3;
    if (G.next) drawMini(c, G.next, cx, cy + 8, Math.max(1, 16 * e), e);
    if (G.perk === 'petra') {
      // Petra's pocket: tap it (or Petra) to put the falling stone aside and take it back later.
      const H = HOLD_BOX, ready = !G.holdUsed && G.state === 'play';
      box(c, H.cx, H.cy, H.w, H.h, 'שמור', ready && Math.sin(G.t * 4) > 0.6);
      if (G.hold) drawMini(c, G.hold, H.cx, H.cy + 8, 9);
      else { c.font = '700 22px Fredoka, sans-serif'; c.fillStyle = 'rgba(43,27,61,.35)'; c.fillText('+', H.cx, H.cy + 9); }
    }
  }
  // Normal levels: how many rows are left. The stars from cleared rows fly in here.
  function drawGoal(c) {
    const at = goalPos(), left = Math.max(0, G.cfg.goal - G.flown);
    const k = 1 + (G.bumpGoal > 0 ? Math.sin(G.bumpGoal / 0.35 * Math.PI) * 0.18 : 0);
    c.save(); c.translate(at.x, at.y); c.scale(k, k);
    c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2);
    c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK;
    c.font = '700 30px Fredoka, Rubik, sans-serif';
    c.fillText(String(left), 0, -3);
    c.font = '700 11px Rubik, sans-serif';
    c.fillText(left === 1 ? 'שורה' : 'שורות', 0, 20);
    c.restore();
  }
  // Boss levels: the boss with its health bar; each cleared row hits it.
  function drawBoss(c) {
    const at = throwerPos();
    const img = `bboss-${G.w + 1}`, w = 92, h = 96;
    if (G.state === 'won') {
      const t = Math.min(1, G.winT / 1.2);
      if (t >= 1) return;
      c.save(); c.globalAlpha = 1 - t * t;
      c.translate(at.x, at.y - t * 90); c.rotate(t * 9); c.scale(1 - t * 0.7, 1 - t * 0.7);
      c.drawImage(sprite(img, w, h), -w / 2, -h / 2, w, h);
      c.restore(); c.globalAlpha = 1;
      return;
    }
    let k = 1, ox = 0;
    if (G.windup > 0) k = 1 + 0.1 * Math.sin((1 - G.windup) * 30);
    if (G.hurt > 0) ox = Math.sin(G.hurt * 60) * 6;
    if (G.state === 'ready') k *= Math.min(1, (G.readyMax - G.readyT) / 0.5);
    c.save();
    c.translate(at.x + ox, at.y + 4 + Math.sin(G.t * 4) * 2);
    c.scale(k, k);
    if (G.hurt > 0 && Math.floor(G.hurt * 14) % 2 === 0) c.globalAlpha = 0.45;
    c.drawImage(sprite(img, w, h), -w / 2, -h / 2, w, h);
    c.restore(); c.globalAlpha = 1;
    if (G.windup > 0) core.drawShot(c, at.x - 24, at.y - 8, 10 * (1 - G.windup) + 2, G.t * 7);
    if (G.freeze > 0) {
      c.fillStyle = 'rgba(189,235,255,0.45)'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
      c.beginPath(); c.arc(at.x, at.y, w * 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    // health bar under the boss
    const bw = 84, bx = at.x - bw / 2, by = TOP - 22;
    rr(c, bx, by, bw, 12, 6); c.fillStyle = '#FFFFFF'; c.fill();
    const f = G.bossHp / G.cfg.goal;
    if (f > 0) { rr(c, bx, by, bw * f, 12, 6); c.fillStyle = '#E8553D'; c.fill(); }
    rr(c, bx, by, bw, 12, 6); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.strokeStyle = 'rgba(43,27,61,.35)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 1; i < G.cfg.goal; i++) { const x = bx + bw * i / G.cfg.goal; c.moveTo(x, by + 2); c.lineTo(x, by + 10); }
    c.stroke();
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
    if (k === 'left' || k === 'right') { held[k] = true; held[k === 'left' ? 'right' : 'left'] = false; move(k === 'left' ? -1 : 1); held.rep = 0.15; }
    if (k === 'down') held.down = true;
    if (k === 'rot') rotate();
    if (k === 'drop') slam();
    if (k === 'hold') hold();
  }
  function release(k) { if (k in held) held[k] = false; }
  // Button pad: buttons react the moment a finger touches them.
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
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // Touching the board: the stone follows your finger sideways, a quick flick down slams it,
  // dragging down slowly speeds it up, a flick up or a tap turns it. (With buttons on, a tap on the board turns it too.)
  const sw = { id: null };
  const wrap = $('#boardWrap');
  const cellPx = () => cv.getBoundingClientRect().width / VW * CS;
  wrap.addEventListener('pointerdown', (e) => {
    if (!G || G.mode !== 'blocks' || e.target.closest('button, .overlay')) return;
    Object.assign(sw, { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false, done: false, axis: null,
      col: G.piece ? G.piece.x : 0, row: G.piece ? G.piece.y : 0, samples: [[e.timeStamp, e.clientX, e.clientY]] });
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sw.id || sw.done || !playing() || !G.piece) return;
    const swipe = core.controlMode() === 'swipe';
    sw.samples.push([e.timeStamp, e.clientX, e.clientY]);
    while (sw.samples.length > 2 && e.timeStamp - sw.samples[0][0] > 70) sw.samples.shift();
    const [t0, , y0] = sw.samples[0];
    const vy = (e.clientY - y0) / Math.max(1, e.timeStamp - t0);
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y, cp = cellPx();
    if (Math.hypot(dx, dy) > 14) sw.moved = true;
    if (!swipe) return;
    // Each touch is either sideways or down, decided once the finger has really moved,
    // so sliding sideways never slams by accident (and a slam never nudges the stone sideways).
    if (!sw.axis) {
      if (Math.abs(dx) > cp * 0.6 && Math.abs(dx) > Math.abs(dy)) sw.axis = 'x';
      else if (dy > cp * 0.6 && dy > Math.abs(dx) * 1.2) sw.axis = 'y';
      else return;
      sw.col = G.piece.x; sw.row = G.piece.y; // (the stone may be a new one since the finger went down)
    }
    const p = G.piece, step = cp * 1.3; // a bit more finger travel than one cell per move
    if (sw.axis === 'x') {
      // Sideways: the stone follows the finger column by column.
      const want = sw.col + Math.round(dx / step);
      while (p.x < want && move(1));
      while (p.x > want && move(-1));
      return;
    }
    // Fast flick down: slam right away, no need to lift the finger.
    if (vy > 1.1 && dy > cp * 1.2) { slam(); sw.done = true; return; }
    // Slow drag down: the stone comes down with the finger.
    const wantRow = sw.row + Math.floor(Math.max(0, dy - cp * 0.6) / step);
    if (wantRow > p.y) { while (p.y < wantRow && moveDown()); G.lockT = Math.min(G.lockT, 0.25); }
  });
  const swEnd = (e) => {
    if (e.pointerId !== sw.id) return;
    sw.id = null;
    if (sw.done || !playing() || e.type === 'pointercancel') return;
    const dy = e.clientY - sw.y, dx = e.clientX - sw.x, quick = e.timeStamp - sw.t < 300;
    const swipe = core.controlMode() === 'swipe';
    if (!sw.moved && quick) {
      // Petra: a tap on her or on her pocket puts the stone aside.
      const r = cv.getBoundingClientRect(), lx = (e.clientX - r.left) / r.width * VW, ly = (e.clientY - r.top) / r.height * VH;
      if (G.perk === 'petra' && ly < TOP && lx < HOLD_BOX.cx + HOLD_BOX.w / 2 + 4) { hold(); return; }
      rotate(); return;
    }
    if (swipe && quick && dy < -cellPx() * 1.5 && Math.abs(dy) > Math.abs(dx) * 1.5) rotate(); // flick up turns
  };
  wrap.addEventListener('pointerup', swEnd);
  wrap.addEventListener('pointercancel', swEnd);

  // Keyboard: arrows move, up or X turns, down drops faster, space slams.
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rot', x: 'rot', X: 'rot', ' ': 'drop', c: 'hold', C: 'hold' };
  function key(e, down) {
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (!down) { release(k); return; }
    if (e.repeat) return; // we repeat held keys ourselves
    press(k);
  }

  return {
    game: { logo: ['דינו', 'בלוקים!'], worlds: WORLDS, chals: CHALS, perk: 'bperk', goal: goalText, start, bosses: BOSSES, map: MAP },
    update: (dt) => { G = core.G(); update(dt); },
    render: () => { G = core.G(); render(); },
    resize, key,
  };
};
