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
  // perk / bperk: what the dino is good at in the dig game / in the blocks game. slow: blocks fall slower.
  const CHARS = {
    pip:   { name: 'פיפ',  img: 'pip',   perk: 'חוקר אמיץ', bperk: 'בונה אמיץ' },
    stegi: { name: 'סטגי', img: 'stegi', perk: 'מתחיל כל שלב עם מגן', bperk: 'מתחיל כל שלב עם מגן', shieldStart: true },
    petra: { name: 'פטרה', img: 'petra', perk: 'הכי מהירה', bperk: 'האבנים נופלות לאט יותר', speed: 1.3, slow: 0.8 },
    anki:  { name: 'אנקי', img: 'anki',  perk: '4 ביצים במקום 3', bperk: '4 ביצים במקום 3', lives: 4 },
    rafi:  { name: 'רפטי', img: 'rafi',  perk: 'הפתעות נמשכות כפול', bperk: 'הפתעות נמשכות כפול', powerDur: 2 },
    rex:   { name: 'רקס',  img: 'magma-rex', perk: 'מגן וגם מהירות', bperk: 'מגן וגם אבנים איטיות', shieldStart: true, speed: 1.15, slow: 0.9, faceLeft: true, w: 240, h: 220 },
  };
  const CHAR_ORDER = ['pip', 'stegi', 'petra', 'anki', 'rafi', 'rex'];
  CHAR_ORDER.forEach((id) => { CHARS[id].id = id; });
  const OUT = window.DinoOutfits;

  // Level challenges: each pays gems once (bit flags in store.data.chal[key]).
  //   claim: finish with goal + 10% (max 90%)   bite: grab 25% in one cut   eggs: don't lose an egg
  const GEMS_PER_CHAL = 3, GEMS_PER_WIN = 1, BITE_PCT = 25;
  const claimTarget = (cfg) => Math.min(90, cfg.goal + 10);
  const CHALS = [
    { bit: 1, icon: '🗺️', label: (cfg) => `${claimTarget(cfg)}%` },
    { bit: 2, icon: '🍰', label: () => `ביס ${BITE_PCT}%` },
    { bit: 4, icon: '🥚', label: () => 'כל הביצים' },
  ];
  const chalRow = (cfg, done, fresh = 0, chals = curGame().chals) => `<span class="chal-row">${chals.map((ch) =>
    `<span class="chal${done & ch.bit ? ' done' : ''}${fresh & ch.bit ? ' fresh' : ''}">${ch.icon} <bdi>${ch.label(cfg)}</bdi>${
      fresh & ch.bit ? `<b class="plus">+${GEMS_PER_CHAL}💎</b>` : ''}</span>`).join('')}</span>`;
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
  // The last level of every world is a boss fight: a big crowned rex that throws things and has 5 hearts.
  // Each fence you close takes hearts away (hearts follow your progress toward the goal).
  const BOSS_HP = 5;
  const DIFFICULTY = 0.85; // global: 15% slower enemies, lava and boss shots, boss throws 15% less often
  const BOSSES = [
    { name: 'רקס הלוהט',   shot: 'fire',    every: 4.2, buzzers: 0 },
    { name: 'מלך הג׳ונגל', shot: 'coconut', every: 3.9, buzzers: 1 },
    { name: 'רקס הגלים',   shot: 'bubble',  every: 3.6, buzzers: 1 },
    { name: 'רקס הקפוא',   shot: 'snow',    every: 3.4, buzzers: 1 },
    { name: 'מלך הלילה',   shot: 'star',    every: 3.1, buzzers: 1 },
  ];
  const SHOTS = {
    fire:    { fill: '#FF9F1C', core: '#FFD23F', sparks: ['#E8553D', '#FFD23F'] },
    coconut: { fill: '#7B4A12', core: '#B98A4E', sparks: ['#7B4A12', '#C5E86C'] },
    bubble:  { fill: '#4FC3F7', core: '#E6F7FF', sparks: ['#4FC3F7', '#FFFFFF'] },
    snow:    { fill: '#FFFFFF', core: '#BDEBFF', sparks: ['#FFFFFF', '#BDEBFF'] },
    star:    { fill: '#FFD23F', core: '#FFF6B8', sparks: ['#FFD23F', '#C9A8FF'] },
  };
  const SHOT_R = 8;
  WORLDS.forEach((wd) => { wd.levels[wd.levels.length - 1].bossFight = true; });
  const sceneName = (w, l) => `s${w + 1}-${l + 1}`;
  const worldOpen = (w) => w === 0 || (rec().stars[`${w}-5`] || 0) > 0;
  const levelOpen = (w, l) => (l === 0 ? worldOpen(w) : (rec().stars[`${w + 1}-${l}`] || 0) > 0);

  const ENEMY = {
    boss:   { img: 'magma-rex', w: 104, h: 95, faceLeft: true, r: 22, hitR: 30 },
    buzzer: { img: 'buzzer',    w: 42,  h: 42, faceLeft: true, r: 12, hitR: 15 },
    lava:   { img: 'lava-blob', w: 36,  h: 36, faceLeft: false, r: 0, hitR: 16 },
  };
  const BIG_BOSS = { w: 140, h: 146, r: 30, hitR: 38 }; // boss-N.svg is 240x250
  const ITEMS = {
    bone:   { img: 'power-bone',   label: 'מהר!' },
    shield: { img: 'power-shield', label: 'מגן!' },
    ice:    { img: 'power-ice',    label: 'קפוא!' },
    amber:  { img: 'power-amber',  label: '+500' },
  };
  const ASSETS = ['pip', 'stegi', 'petra', 'anki', 'rafi', 'magma-rex', 'buzzer', 'lava-blob', 'power-bone', 'power-shield',
    'power-ice', 'power-amber', 'egg', 'dirt-1', 'dirt-2', 'dirt-3', 'dirt-4', 'dirt-5',
    'boss-1', 'boss-2', 'boss-3', 'boss-4', 'boss-5', 'rex-1', 'rex-2', 'rex-3', 'rex-4', 'rex-5'];

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
  // Seconds -> "1:05". Times always read left to right, so wrap them in <bdi> when mixed with Hebrew.
  const fmtTime = (s) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  // ---------- Saved progress ----------
  const store = {
    key: 'dinoDig.v1',
    data: { stars: {}, best: {}, unlocked: ['pip'], selected: 'pip', streak: {}, muted: false,
      gems: 0, owned: [], outfit: {}, chal: {}, times: {} },
    load() {
      try { const d = JSON.parse(localStorage.getItem(this.key)); if (d) Object.assign(this.data, d); } catch (e) { /* ignore */ }
      this.loaded = true;
    },
    save() {
      // Never write before the saved game has been read, or the defaults would replace real progress.
      if (!this.loaded) return;
      try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    },
  };

  // ---------- Two games, one wardrobe ----------
  // Each game keeps its own stars, times, challenges and unlocked dinos; gems and outfits are shared.
  // The dig game's records stay at the top of the save (where they always were), the blocks game's live in data.blocks.
  let GAME = 'dig';
  const freshRecords = () => ({ stars: {}, best: {}, chal: {}, times: {}, streak: {}, unlocked: ['pip'], selected: 'pip' });
  function rec(game = GAME) {
    if (game === 'dig') return store.data;
    const d = store.data;
    if (!d.blocks) d.blocks = freshRecords();
    for (const [k, v] of Object.entries(freshRecords())) if (d.blocks[k] == null) d.blocks[k] = v;
    return d.blocks;
  }
  // Every dino unlocked in either game can be dressed up in the wardrobe.
  const anyUnlocked = (id) => store.data.unlocked.includes(id) || rec('blocks').unlocked.includes(id);
  const GAMES = {
    dig: { logo: ['דינו', 'סוגר שטחים!'], worlds: WORLDS, chals: CHALS, perk: 'perk',
      goal: (cfg) => `🗺️ תפסו <bdi>${cfg.goal}%</bdi>`, start: (w, l) => startLevel(w, l) },
  };
  const curGame = () => GAMES[GAME];
  const worldsNow = () => curGame().worlds;

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
    ready() { [392, 523].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.06, i * 0.12)); },
    go()    { [659, 988].forEach((f, i) => this.tone(f, 0.16, 'square', 0.06, i * 0.09)); },
    boss()  { [110, 110, 147, 110].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.08, i * 0.2)); },
    ouch()  { this.tone(520, 0.3, 'square', 0.07, 0, 140); },
    throwIt() { this.tone(300, 0.18, 'triangle', 0.07, 0, 700); },
    defeat() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.06, i * 0.12)); },
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
    // DIFFICULTY scales every enemy/lava/boss-shot speed and boss throw rate; extra quiet help after 3 losses in a row.
    const ease = DIFFICULTY * ((store.data.streak[key] || 0) >= 3 ? 0.85 : 1);
    const lives = ch.lives || 3;
    G = {
      mode: 'dig', w, l, cfg, key, ch, ease, scene, world: WORLDS[w],
      grid: new Uint8Array(GW * GH),
      lives, maxLives: lives, score: 0, percent: 0,
      player: { x: Math.floor(GW / 2), y: GH - 1, face: 1, drawing: false, trail: [], startX: 0, startY: 0,
        acc: 0, invuln: 0, shield: !!ch.shieldStart, boost: 0 },
      enemies: [], items: [], particles: [],
      freeze: 0, state: 'ready', readyT: 2.0, t: 0, playT: 0, itemTimer: 12, shake: 0, winT: 0,
      bossFight: !!cfg.bossFight, bossInfo: cfg.bossFight ? BOSSES[w] : null, bossHp: BOSS_HP, shots: [],
      bite: 0, outfit: { ...store.data.outfit },
    };
    if (G.bossFight) G.readyT = 2.6;
    G.readyMax = G.readyT;
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
    G.startPct = G.percent;

    const boss = makeEnemy('boss', LW / 2, LH * 0.35, cfg.boss * ease * (G.bossFight ? 0.85 : 1));
    if (G.bossFight) {
      Object.assign(boss, BIG_BOSS, { img: `boss-${w + 1}`, throwT: 2.5, windup: 0, hurt: 0, angry: false });
      setHeading(boss, rand(0, Math.PI * 2));
    } else boss.img = `rex-${w + 1}`; // same colours as this world's boss, minus the crown
    G.enemies.push(boss);
    const buzzers = G.bossFight ? G.bossInfo.buzzers : cfg.buzzers;
    for (let i = 0; i < buzzers; i++) {
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
    $('#game').classList.remove('blocks');
    show('game');
    resize();
    buildLives();
    updateHud();
    $('#timerNum').textContent = fmtTime(0);
    const b = $('#banner');
    const best = (store.data.best || {})[key];
    const bestLine = best ? `<small class="best-line">⏱ השיא <bdi>${fmtTime(best)}</bdi></small>` : '';
    const chals = chalRow(cfg, (store.data.chal || {})[key] || 0);
    // Intro card on a dimmed board, then a big "קדימה!" the moment the game starts.
    const goal = `<div class="ready-goal">🗺️ תפסו <bdi>${cfg.goal}%</bdi></div>`;
    const head = G.bossFight
      ? `<div class="ready-world">${WORLDS[w].name}</div><div class="ready-title boss">בוס: ${G.bossInfo.name}</div>`
      : `<div class="ready-world">${WORLDS[w].name}</div><div class="ready-title">שלב ${l + 1}</div>`;
    b.innerHTML = `<div class="ready-card">${head}${goal}${bestLine}${chals}<div class="ready-bar"><i style="animation-duration:${G.readyT}s"></i></div></div>`;
    b.className = G.bossFight ? 'banner boss' : 'banner'; // boss: card sits low so his entrance shows above it
    if (G.bossFight) sfx.boss(); else sfx.ready();
    b.hidden = false;
    input.dir = null; input.hold = false;
    applyControlMode();
    keepAwake();
  }

  // A dino with its outfit, top-left at (0,0), pw x ph. src: the dino picture (image or cached sprite).
  function drawDino(c, ch, outfit, pw, ph, t, src) {
    const u = pw / (ch.w || 200);
    c.save(); c.scale(u, u); OUT.drawOn(c, ch.id, outfit, 'back', t); c.restore();
    if (src) c.drawImage(src, 0, 0, pw, ph);
    c.save(); c.scale(u, u); OUT.drawOn(c, ch.id, outfit, 'front', t); c.restore();
  }
  // Draw a dressed dino centred in a canvas, leaving room above for hats and balloons.
  function paintDino(cv, chId, outfit, t) {
    const ch = CHARS[chId] || CHARS.pip;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = cv.clientWidth || 200, chh = cv.clientHeight || 200;
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr); }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    // the dino takes 70% of the width and sits at the bottom
    const W = ch.w || 200, H = ch.h || 200;
    const pw = Math.min(cw * 0.7, chh * 0.66 * W / H), ph = pw * H / W;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate((cw - pw) / 2, chh - ph - chh * 0.02);
    if (ch.faceLeft) { c.translate(pw, 0); c.scale(-1, 1); }
    drawDino(c, ch, outfit, pw, ph, t, images[ch.img]);
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

  function startPlay() {
    G.state = 'play';
    const b = $('#banner'), g = G;
    b.className = 'banner go';
    b.innerHTML = '<div class="go-word">קדימה!</div>';
    sfx.go();
    setTimeout(() => { if (G === g && b.classList.contains('go')) b.hidden = true; }, 750);
  }

  // ---------- Update ----------
  function update(dt) {
    G.t += dt;
    updateParticles(dt);
    if (G.shake > 0) G.shake -= dt;

    if (G.state === 'ready') {
      G.readyT -= dt;
      if (G.readyT <= 0) startPlay();
      return;
    }
    if (G.state === 'won') { updateWin(dt); return; }
    if (G.state !== 'play') return;
    G.playT += dt; // only counts real play: not the intro banner, not while paused
    if (Math.floor(G.playT) !== G.shownSec) { G.shownSec = Math.floor(G.playT); $('#timerNum').textContent = fmtTime(G.playT); }

    const p = G.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.boost > 0) p.boost -= dt;
    if (G.freeze > 0) G.freeze -= dt;

    // Auto-finish: in the dirt with no finger down, Pip keeps walking until he reaches the edge.
    // (In swipe mode a touch holds him still, even in the dirt.)
    const held = controlMode() === 'swipe' && input.hold;
    const auto = p.drawing && !held ? p.lastDir : null;
    if (input.dir || auto) {
      const speed = PLAYER_SPEED * (G.ch.speed || 1) * (p.boost > 0 ? 1.5 : 1);
      p.acc += dt * speed;
      while (p.acc >= 1) {
        p.acc -= 1;
        const d = input.dir || auto;
        if (!d || !stepPlayer(d.x, d.y)) {
          p.acc = 0;
          // Swipe: one swipe = one straight line. Stop when it's blocked or the cut closes.
          if (controlMode() === 'swipe') input.dir = null;          break;
        }
      }
    } else p.acc = 0;
    if (G.state !== 'play') return;

    for (const e of G.enemies) { if (e.kind === 'lava') updateCrawler(e, dt); else updateEnemy(e, dt); }
    if (G.bossFight) updateBossFight(dt);

    if (p.invuln <= 0 && G.freeze <= 0) {
      const px = p.x * CELL + CELL / 2, py = p.y * CELL + CELL / 2;
      let hit = null;
      for (const e of G.enemies) {
        // Lava drops walk the safe edges, so they can bump Pip even when he isn't digging.
        if (e.kind === 'lava') { if (Math.hypot(e.x - px, e.y - py) < e.hitR) { hit = e; break; } continue; }
        if (p.drawing && (Math.hypot(e.x - px, e.y - py) < e.hitR + 10 || trailNear(e.x, e.y, e.hitR))) { hit = e; break; }
      }
      // Boss shots only hurt while digging, like everything else in the dirt.
      if (!hit && p.drawing) {
        hit = G.shots.find((s) => Math.hypot(s.x - px, s.y - py) < SHOT_R + 12 || trailNear(s.x, s.y, SHOT_R + 2));
        if (hit) { hit.dead = true; burst(hit.x, hit.y, SHOTS[G.bossInfo.shot].sparks, 8); }
      }
      if (hit) onHit();
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

  function trailNear(x, y, r) {
    const t = G.player.trail, r2 = r * r;
    for (let k = 1; k < t.length; k++) {
      const dx = t[k][0] * CELL + CELL / 2 - x, dy = t[k][1] * CELL + CELL / 2 - y;
      if (dx * dx + dy * dy < r2) return true;
    }
    return false;
  }

  // ---------- Boss fight ----------
  const bossOf = () => G.enemies.find((e) => e.kind === 'boss');
  // Where the boss's mouth is (the art faces left; it flips when walking right).
  const bossMouth = (b) => ({ x: b.x + (b.vx > 0 ? 1 : -1) * b.w * 0.3, y: b.y - b.h * 0.12 });

  function updateBossFight(dt) {
    const b = bossOf();
    if (!b) return;
    if (b.hurt > 0) b.hurt -= dt;
    if (G.freeze > 0) return;
    if (b.windup > 0) {
      b.windup -= dt;
      if (b.windup <= 0) throwShots(b);
    } else {
      b.throwT -= dt;
      if (b.throwT <= 0) {
        b.windup = 0.7;
        b.throwT = G.bossInfo.every * (b.angry ? 0.75 : 1) / G.ease;
      }
    }
    for (const s of G.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.spin += dt * 7;
      // Shots pop when they reach safe ground, so standing on the edge is always safe.
      if (cellAt(s.x, s.y) === 1) { s.dead = true; burst(s.x, s.y, SHOTS[G.bossInfo.shot].sparks, 5); }
    }
    G.shots = G.shots.filter((s) => !s.dead);
  }

  function throwShots(b) {
    const p = G.player, m = bossMouth(b);
    const base = Math.atan2(p.y * CELL + 2 - m.y, p.x * CELL + 2 - m.x);
    const n = b.angry ? (G.w === 0 ? 2 : 3) : 1;
    const speed = (95 + G.w * 8) * G.ease;
    for (let k = 0; k < n; k++) {
      const a = base + (k - (n - 1) / 2) * 0.32;
      G.shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: 0 });
    }
    sfx.throwIt();
  }

  function hurtBoss() {
    const b = bossOf();
    const hp = G.percent >= G.cfg.goal ? 0
      : Math.max(1, Math.ceil(BOSS_HP * (G.cfg.goal - G.percent) / Math.max(1, G.cfg.goal - G.startPct)));
    if (!b || hp === 0) { G.bossHp = 0; return; } // the win animation takes over
    b.hurt = hp < G.bossHp ? 0.7 : 0.35; // every fence makes him flinch; losing a heart is a big one
    if (hp >= G.bossHp) return;
    G.bossHp = hp;
    G.shake = Math.max(G.shake, 0.3);
    floatText(b.x, b.y - b.h / 2 - 6, 'אאוץ׳!', '#FF8FA3');
    burst(b.x, b.y - 20, ['#FFD23F', '#FFFFFF', '#FF8FA3'], 12);
    sfx.ouch();
    if (hp <= 2 && !b.angry) {
      b.angry = true;
      b.speed *= 1.2; b.vx *= 1.2; b.vy *= 1.2;
      setTimeout(() => { if (G && G.state === 'play' && bossOf() === b) floatText(b.x, b.y - b.h / 2 - 6, 'הבוס כועס!', '#FF6B2C'); }, 600);
    }
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
    while (e.acc >= 1) { e.acc -= 1; e.fx = e.cx; e.fy = e.cy; crawlStep(e); }
    // Glide between cells instead of jumping 4px at a time (that read as flicker).
    let gx = e.cx, gy = e.cy;
    if (e.fx !== undefined && Math.abs(e.fx - e.cx) + Math.abs(e.fy - e.cy) === 1) {
      gx = e.fx + (e.cx - e.fx) * e.acc; gy = e.fy + (e.cy - e.fy) * e.acc;
    }
    e.x = gx * CELL + CELL / 2; e.y = gy * CELL + CELL / 2;
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
    const bite = gained * 100 / INTERIOR;
    if (bite >= BITE_PCT && G.bite < BITE_PCT) {
      const [bx, by] = trail[Math.floor(trail.length / 2)] || [p.x, p.y];
      floatText(bx * CELL, by * CELL, 'ביס ענק! 🍰', '#FFD23F');
    }
    G.bite = Math.max(G.bite, bite);

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
    if (G.bossFight) hurtBoss();
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
    input.dir = null; input.hold = false; padRelease();
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
    const boss = G.bossFight && bossOf();
    if (boss) {
      // The boss spins away into the sky instead of just vanishing.
      G.defeat = { x: boss.x, y: boss.y, img: boss.img, w: boss.w, h: boss.h };
      floatText(boss.x, boss.y - boss.h / 2, 'ניצחת את הבוס!', '#FFD23F');
      G.enemies = G.enemies.filter((e) => e !== boss);
      sfx.defeat();
    }
    for (const s of G.shots) burst(s.x, s.y, ['#FFFFFF', '#FFD23F'], 4);
    G.shots = [];
    for (const e of G.enemies) {
      burst(e.x, e.y, ['#FFFFFF', '#FFD23F', '#D8D2E3'], e.kind === 'boss' ? 18 : 8);
    }
    for (const it of G.items) burst(it.x, it.y, ['#FFFFFF', '#FFD23F'], 6);
    G.enemies = []; G.items = []; G.player.trail = [];
    input.dir = null; padRelease();
    sfx.win();
    const doneNow = (G.percent >= claimTarget(G.cfg) ? 1 : 0) | (G.bite >= BITE_PCT ? 2 : 0) | (G.lives >= G.maxLives ? 4 : 0);
    finishWin(clamp(G.lives, 1, 3), doneNow, 2600);
  }

  // Shared by both games: save the win (stars, times, challenges, gems, a newly unlocked dino), then show the win card.
  function finishWin(stars, doneNow, delay) {
    const d = store.data, r = rec(), WORLDS = worldsNow(), perkKey = curGame().perk;
    r.stars[G.key] = Math.max(r.stars[G.key] || 0, stars);
    r.streak = r.streak || {};
    r.streak[G.key] = 0;
    r.best = r.best || {};
    const time = G.playT, prevBest = r.best[G.key];
    const record = !prevBest || time < prevBest;
    if (record) r.best[G.key] = time;
    r.times = r.times || {};
    r.times[G.key] = [time, ...(r.times[G.key] || [])].slice(0, 3); // the last 3 wins, newest first
    // Challenges: new ones pay gems once; every win pays a little too.
    r.chal = r.chal || {};
    const before = r.chal[G.key] || 0, fresh = doneNow & ~before;
    r.chal[G.key] = before | doneNow;
    const freshCount = [1, 2, 4].filter((b) => fresh & b).length;
    const gemsWon = GEMS_PER_WIN + freshCount * GEMS_PER_CHAL;
    d.gems = (d.gems || 0) + gemsWon;
    let unlocked = null;
    const world = WORLDS[G.w];
    if (G.l === world.levels.length - 1 && world.unlock && !r.unlocked.includes(world.unlock)) {
      r.unlocked.push(world.unlock);
      unlocked = world.unlock;
    }
    store.save();

    setTimeout(() => {
      if (!G || G.state !== 'won') return;
      $('#winStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : 'off'}">★</span>`).join('');
      $('#winChal').innerHTML = chalRow(G.cfg, r.chal[G.key], fresh);
      $('#winScore').innerHTML = `<span class="gem-win">💎 +${gemsWon}</span><span>ניקוד: ${G.score}</span>`;
      if (freshCount) setTimeout(() => sfx.power(), 900);
      // First win of a level just sets the time; beating an old time gets the "new record" badge.
      $('#winTime').innerHTML = `<span>⏱ <bdi>${fmtTime(time)}</bdi></span>${
        record && prevBest ? '<span class="record">שיא חדש!</span>'
          : !record ? `<span class="best">השיא <bdi>${fmtTime(prevBest)}</bdi></span>` : ''}`;
      if (record && prevBest) setTimeout(() => sfx.power(), 1200);
      const u = $('#unlock');
      if (unlocked) {
        const [joins, them] = JOINS[unlocked] || ['מצטרף', 'אותו'];
        $('#unlockImg').src = `assets/${CHARS[unlocked].img}.svg`;
        const name = CHARS[unlocked].name;
        $('#unlockText').innerHTML = `${name} ${joins}!<small class="perk-line">${CHARS[unlocked][perkKey]}</small>`;
        // One tap switches to the new friend right away; another tap goes back to the old one.
        const pick = $('#pickBtn'), before = r.selected;
        const show = () => {
          const on = r.selected === unlocked;
          pick.textContent = on ? `✓ ${name} ${JOINS[unlocked] ? 'נבחרה' : 'נבחר'} (לביטול לחצו)` : `לשחק עם ${name}!`;
          pick.classList.toggle('done', on);
        };
        show();
        pick.onclick = () => {
          const on = r.selected === unlocked;
          r.selected = on ? before : unlocked; store.save();
          if (!on) sfx.power(); else sfx.pop();
          show();
        };
        u.hidden = false;
      } else u.hidden = true;
      const lastLevel = G.l >= world.levels.length - 1;
      const lastWorld = G.w >= WORLDS.length - 1;
      $('#winTitle').textContent = lastLevel && lastWorld ? 'ניצחת את כל המשחק!' : G.bossFight ? 'ניצחת את הבוס!' : 'כל הכבוד!';
      $('#nextBtn').textContent = lastLevel ? 'לעולם הבא' : 'לשלב הבא';
      $('#nextBtn').hidden = lastLevel && lastWorld;
      $('#win').hidden = false;
      for (let i = 0; i < stars; i++) setTimeout(() => sfx.tone(880 + i * 220, 0.18, 'triangle', 0.1), 380 + i * 300);
    }, delay);
  }

  function lose() {
    G.state = 'lost';
    const r = rec();
    r.streak = r.streak || {};
    r.streak[G.key] = (r.streak[G.key] || 0) + 1;
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
        const big = G.bossFight && e.kind === 'boss';
        if (big && e.angry) {
          c.fillStyle = `rgba(232,85,61,${0.25 + 0.12 * Math.sin(G.t * 8)})`;
          c.beginPath(); c.ellipse(e.x, e.y + 8, e.w * 0.55, e.h * 0.45, 0, 0, Math.PI * 2); c.fill();
        }
        c.save();
        let ox = 0, k = 1;
        if (big && e.hurt > 0) ox = Math.sin(e.hurt * 60) * 5;
        if (big && e.windup > 0) k = 1 + 0.08 * Math.sin((0.7 - e.windup) * 30);
        if (big && G.state === 'ready') {
          // Entrance: the boss pops in and wiggles while the "בוס!" banner is up.
          const t = Math.min(1, (2.6 - G.readyT) / 0.6);
          k = (1 - (1 - t) ** 3) * (1 + 0.06 * Math.sin(G.t * 14));
        }
        if (e.kind === 'lava') {
          // A slow, soft squish instead of a fast up-down shake.
          const s = Math.sin(e.anim * 4);
          c.translate(e.x, e.y + s * 1.2);
          c.scale(1 + s * 0.05, 1 - s * 0.05);
        } else c.translate(e.x + ox, e.y + Math.sin(e.anim * (e.kind === 'boss' ? 6 : 14)) * (e.kind === 'boss' ? 2 : 3));
        c.scale(k, k);
        const goingRight = e.vx > 0;
        if (e.faceLeft ? goingRight : !goingRight) c.scale(-1, 1);
        if (big && e.hurt > 0 && Math.floor(e.hurt * 14) % 2 === 0) c.globalAlpha = 0.45;
        c.drawImage(spr(e.img, e.w, e.h), -e.w / 2, -e.h / 2, e.w, e.h);
        c.restore();
        c.globalAlpha = 1;
        if (big && e.windup > 0) {
          // The shot grows at the boss's mouth so there's time to see it coming.
          const m = bossMouth(e);
          drawShot(c, m.x, m.y, SHOT_R * (1 - e.windup / 0.7) + 2, G.t * 7);
        }
        if (G.freeze > 0) {
          c.fillStyle = 'rgba(189,235,255,0.45)';
          c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
          c.beginPath(); c.arc(e.x, e.y, e.w * 0.45, 0, Math.PI * 2); c.fill(); c.stroke();
        }
      }
      for (const s of G.shots) drawShot(c, s.x, s.y, SHOT_R, s.spin);
    }
    if (won && G.defeat) {
      const d = G.defeat, t = Math.min(1, G.winT / 1.2);
      if (t < 1) {
        c.save();
        c.globalAlpha = 1 - t * t;
        c.translate(d.x, d.y - t * 140 - Math.sin(t * Math.PI) * 30);
        c.rotate(t * 9);
        c.scale(1 - t * 0.7, 1 - t * 0.7);
        c.drawImage(spr(d.img, d.w, d.h), -d.w / 2, -d.h / 2, d.w, d.h);
        c.restore();
        c.globalAlpha = 1;
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
      c.translate(-pw / 2, -ph / 2 - 6);
      drawDino(c, G.ch, G.outfit, pw, ph, G.t, spr(G.ch.img, pw, ph));
      c.restore();
    }
    if (p.shield && !won) {
      c.strokeStyle = 'rgba(189,235,255,0.9)'; c.lineWidth = 3;
      c.beginPath(); c.arc(px, py - 4, 30 + Math.sin(G.t * 5) * 2, 0, Math.PI * 2); c.stroke();
    }
    if (p.boost > 0 && p.lastDir && input.dir) {
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

  function drawShot(c, x, y, r, spin) {
    const kind = G.bossInfo.shot, s = SHOTS[kind];
    c.save();
    c.translate(x, y); c.rotate(spin);
    c.lineWidth = 3; c.strokeStyle = INK; c.lineJoin = 'round';
    c.beginPath();
    if (kind === 'star' || kind === 'snow') {
      const pts = kind === 'star' ? 5 : 6, inner = kind === 'star' ? 0.5 : 0.62;
      for (let i = 0; i < pts * 2; i++) {
        const a = i * Math.PI / pts - Math.PI / 2, rr = i % 2 ? r * inner : r * 1.25;
        if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    } else c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = s.fill; c.fill(); c.stroke();
    if (kind === 'fire') {
      c.fillStyle = s.core; c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.fill();
    } else if (kind === 'coconut') {
      c.fillStyle = s.core;
      for (const a of [0, 2.1, 4.2]) { c.beginPath(); c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.18, 0, Math.PI * 2); c.fill(); }
    } else {
      c.fillStyle = s.core; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, Math.PI * 2); c.fill();
    }
    c.restore();
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
    $('.meter').classList.toggle('boss', G.bossFight);
    if (G.bossFight) {
      // Boss levels show the boss's hearts draining instead of a percentage.
      $('#levelName').textContent = 'בוס!';
      const left = clamp((G.cfg.goal - G.percent) / Math.max(1, G.cfg.goal - G.startPct), 0, 1);
      $('#meterFill').style.width = `${left * 100}%`;
      $('#meterNum').innerHTML = [...Array(BOSS_HP)].map((_, i) => `<span class="${i < G.bossHp ? 'on' : 'off'}">♥</span>`).join('')
        + `<div class="boss-pct"><bdi>${G.percent}%</bdi> מתוך <bdi>${G.cfg.goal}%</bdi></div>`;
      return;
    }
    $('#levelName').textContent = `שלב ${G.l + 1}`;
    $('#meterFill').style.width = `${Math.min(100, G.percent / G.cfg.goal * 100)}%`;
    $('#meterGoal').style.insetInlineStart = 'calc(100% - 3px)';
    $('#meterNum').innerHTML = `<bdi>${G.percent}%</bdi> מתוך <bdi>${G.cfg.goal}%</bdi>`;
  }

  // ---------- Input: arrow pad or swipes, arrows on a keyboard ----------
  const input = { dir: null, id: null, ax: 0, ay: 0, padId: null };
  const gameEl = $('#game');
  const MODES = ['pad', 'swipe'];
  const controlMode = () => (MODES.includes(store.data.controlMode) ? store.data.controlMode : 'pad');

  function applyControlMode() {
    const m = controlMode(), isBlocks = !!(G && G.mode === 'blocks');
    $('#pad').hidden = m !== 'pad' || isBlocks;
    $('#bpad').hidden = m !== 'pad' || !isBlocks;
    $('#hint').hidden = true;
    $('#controlSeg').classList.toggle('swipe', m === 'swipe');
    for (const b of document.querySelectorAll('#controlSeg button')) {
      b.classList.toggle('on', b.dataset.m === m);
      b.setAttribute('aria-checked', b.dataset.m === m);
    }
    if (screen === 'game') resizeBoard();
  }
  const resizeBoard = () => { if (G && G.mode === 'blocks') blocks.resize(); else resize(); };

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
    input.dir = name ? { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[name] : null;
  }
  pad.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    skipIntro(); // pressing an arrow during the intro starts right away and moves
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

  // Tapping the intro card (or anywhere on the board) skips the wait.
  function skipIntro() {
    if (!G || G.state !== 'ready' || paused || G.readyT > G.readyMax - 0.3) return; // ignore a tap left over from the Play button
    G.readyT = 0;
    startPlay();
  }
  $('#boardWrap').addEventListener('pointerdown', skipIntro);

  // Swipe mode: a swipe sets a direction and the dino keeps going that way until it's blocked
  // or the cut closes. Swiping again (even without lifting the finger) turns.
  // Touching the dino (or close to him) stops him; a touch anywhere else does nothing until it slides.
  const SWIPE_MIN = 22; // px of finger travel that counts as a swipe
  input.hold = false;
  const toBoard = (e) => {
    const r = cv.getBoundingClientRect();
    return { lx: (e.clientX - r.left) / r.width * VW - PAD, ly: (e.clientY - r.top) / r.height * VH - PAD };
  };
  const STOP_R = 44; // board units: a tap this close to the dino stops him
  const nearDino = (e) => {
    const { lx, ly } = toBoard(e), p = G.player;
    return Math.hypot(lx - (p.x * CELL + CELL / 2), ly - (p.y * CELL + CELL / 2 - 6)) < STOP_R;
  };
  gameEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, .overlay, .hud, .pad')) return;
    if (controlMode() !== 'swipe' || (G && G.mode === 'blocks')) return;
    sfx.init();
    input.id = e.pointerId; input.ax = e.clientX; input.ay = e.clientY; input.swiped = false;
    try { gameEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    // On or near the dino: stop right there, in the dirt too. If the finger then slides, that's a new swipe.
    if (G && G.state === 'play' && !paused && nearDino(e)) { input.dir = null; input.hold = true; }
  });
  gameEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== input.id || !G || G.state !== 'play' || paused) return;
    const dx = e.clientX - input.ax, dy = e.clientY - input.ay;
    if (Math.hypot(dx, dy) < SWIPE_MIN) return;
    input.dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    input.ax = e.clientX; input.ay = e.clientY; input.swiped = true; input.hold = false; // next swipe measured from here
  });
  const endPointer = (e) => {
    if (e.pointerId !== input.id) return;
    input.id = null;
  };
  gameEl.addEventListener('pointerup', endPointer);
  gameEl.addEventListener('pointercancel', endPointer);

  const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  window.addEventListener('keydown', (e) => {
    if (screen !== 'game') return;
    if (e.key === 'Escape' || e.key === 'p') { togglePause(true); return; }
    if (G && G.mode === 'blocks') { blocks.key(e, true); return; }
    const k = KEYS[e.key];
    if (k) { e.preventDefault(); sfx.init(); input.dir = { x: k[0], y: k[1] }; }
  });
  window.addEventListener('keyup', (e) => {
    if (G && G.mode === 'blocks') { blocks.key(e, false); return; }
    const k = KEYS[e.key];
    if (k && input.dir && input.dir.x === k[0] && input.dir.y === k[1]) input.dir = null;
  });

  // ---------- Screens ----------
  function show(name) {
    screen = name;
    for (const id of ['hub', 'title', 'map', 'game', 'shop']) $(`#${id}`).hidden = id !== name;    if (name === 'hub') buildHub();
    if (name === 'title') buildTitle();
    if (name === 'map') buildMap();
    if (name === 'shop') buildShop();
  }
  function hideOverlays() { for (const id of ['pause', 'win', 'lose']) $(`#${id}`).hidden = true; }

  // The hub: pick a game. Each card shows how many stars you have in it.
  function buildHub() {
    const d = store.data;
    for (const g of Object.keys(GAMES)) {
      const r = rec(g), total = GAMES[g].worlds.reduce((n, wd) => n + wd.levels.length * 3, 0);
      const got = Object.values(r.stars).reduce((n, s) => n + s, 0);
      $(`#hub [data-game="${g}"] .card-stars`).innerHTML = `★ <bdi>${got}/${total}</bdi>`;
    }
    $('#hubGems').textContent = `💎 ${d.gems || 0}`;
    $('#muteBtn').textContent = d.muted ? '🔇' : '🔊';
  }
  function openGame(g) {
    GAME = g; store.data.game = g; store.save();
    $('#title').dataset.game = g;
    show('title');
  }
  for (const card of document.querySelectorAll('#hub .game-card')) {
    card.addEventListener('click', () => { sfx.init(); sfx.tap(); goFullscreen(); openGame(card.dataset.game); });
  }

  function buildTitle() {
    const d = rec(), [l1, l2] = curGame().logo;
    $('#titleLogo').innerHTML = `${l1}<br><span>${l2}</span>`;
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
    $('#charPerk').textContent = `${sel.name}: ${sel[curGame().perk]}`;
    $('#titleGems').textContent = `💎 ${store.data.gems || 0}`;
  }

  // ---------- Wardrobe shop ----------
  // Tap an item: if you own it, put it on / take it off. If not, try it on and a buy button shows up.
  const shop = { slot: 'head', char: 'pip', trying: null };
  const shopOutfit = () => {
    const o = { ...store.data.outfit };
    if (shop.trying) o[OUT.BY_ID[shop.trying].slot] = shop.trying;
    return o;
  };
  function openShop() {
    shop.char = anyUnlocked(rec().selected) ? rec().selected : 'pip'; shop.trying = null;
    shop.from = screen; // the wardrobe opens from the hub or from a game's start screen; home goes back there
    show('shop');
  }
  function buildShop() {
    const d = store.data;
    d.owned = d.owned || []; d.outfit = d.outfit || {};
    $('#shopGems').textContent = `💎 ${d.gems || 0}`;
    for (const t of document.querySelectorAll('.shop-tabs .tab')) t.classList.toggle('on', t.dataset.slot === shop.slot);
    const grid = $('#shopGrid');
    grid.innerHTML = '';
    for (const it of OUT.ITEMS.filter((i) => i.slot === shop.slot)) {
      const owned = d.owned.includes(it.id), worn = d.outfit[it.slot] === it.id;
      const b = document.createElement('button');
      b.className = `item${owned ? ' owned' : ''}${worn ? ' worn' : ''}${shop.trying === it.id ? ' trying' : ''}${
        !owned && (d.gems || 0) < it.price ? ' pricey' : ''}`;
      b.setAttribute('aria-label', it.name);
      b.innerHTML = `<canvas></canvas><span class="tag">${worn ? '✓ לבוש' : owned ? 'שלי' : `💎 ${it.price}`}</span>`;
      b.addEventListener('click', () => {
        if (slidRecently()) return; // the finger lift after a slide
        sfx.init(); sfx.tap();
        if (owned) {
          d.outfit[it.slot] = worn ? null : it.id;
          shop.trying = null; store.save();
        } else shop.trying = shop.trying === it.id ? null : it.id;
        buildShop();
      });
      grid.appendChild(b);
      const cv2 = b.querySelector('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2.5), size = 64;
      cv2.width = cv2.height = Math.round(size * dpr);
      const c2 = cv2.getContext('2d'); c2.scale(dpr, dpr);
      OUT.drawIcon(c2, it.id, size, 0.35);
    }
    const tr = shop.trying && OUT.BY_ID[shop.trying];
    const buy = $('#shopBuy');
    if (tr) {
      const short = tr.price - (d.gems || 0);
      $('#shopItemName').textContent = tr.name;
      buy.hidden = false;
      buy.disabled = short > 0;
      buy.innerHTML = short > 0 ? `חסרים עוד 💎 ${short}` : `לקנות ב-💎 ${tr.price}`;
    } else {
      const worn = OUT.SLOTS.map((s) => d.outfit[s]).filter(Boolean).length;
      $('#shopItemName').textContent = worn ? '' : 'לחצו על בגד כדי לנסות אותו';
      buy.hidden = true;
    }
    $('#shopPrev').hidden = $('#shopNext').hidden = openChars().length < 2;
  }
  function shopCycle(step) {
    const open = openChars();
    shop.char = open[(open.indexOf(shop.char) + step + open.length) % open.length];
    sfx.tap();
  }
  $('#shopBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openShop(); });
  $('#hubShopBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openShop(); });
  $('#shopBack').addEventListener('click', () => { sfx.tap(); shop.trying = null; show(shop.from || 'hub'); });
  // The dino in the wardrobe slides too: drag him sideways (or use the arrows) to change dino.
  function openChars() { return CHAR_ORDER.filter(anyUnlocked); }
  const heroSlide = attachSlide({
    areas: [$('.shop-stage')],
    el: $('#shopHero'),
    ignore: (e) => !!e.target.closest('button'),
    canGo: () => openChars().length > 1,
    apply: (step) => shopCycle(step),
  });
  $('#shopPrev').addEventListener('click', () => heroSlide.go(-1));
  $('#shopNext').addEventListener('click', () => heroSlide.go(1));
  $('#shopHero').addEventListener('click', () => { if (!slidRecently()) heroSlide.go(1); });
  // Swipeable pages (shop tabs, map worlds). The page follows the finger; let go far or fast enough
  // and it slides out while the next one slides in. RTL: the next page is to the left, so a finger
  // moving right (dir +1) brings it in.
  let lastSlideAt = 0; // taps right after a slide are the finger lift, not a real tap
  const slidRecently = () => performance.now() - lastSlideAt < 400;
  function attachSlide({ areas, el, canGo, apply, ignore }) {
    let sw = null, busy = false;
    const width = () => el.getBoundingClientRect().width || innerWidth;
    // never wait forever: a backgrounded page can pause animations
    const done = (a, ms) => Promise.race([a.finished.catch(() => {}), new Promise((r) => setTimeout(r, ms + 120))]);
    async function go(step, from = 0) {
      if (busy || !canGo(step)) return;
      busy = true;
      const dir = step > 0 ? 1 : -1, w = width() * 0.9;
      const outMs = Math.max(90, 190 * (1 - Math.abs(from) / w));
      const out = el.animate([{ translate: `${from}px 0` }, { translate: `${dir * w}px 0` }],
        { duration: outMs, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
      el.style.translate = '';
      try {
        await done(out, outMs);
        await apply(step);
        const inn = el.animate([{ translate: `${-dir * w}px 0` }, { translate: '0px 0' }],
          { duration: 280, easing: 'cubic-bezier(.15,.85,.3,1)', fill: 'forwards' });
        out.cancel();
        await done(inn, 280);
        inn.cancel();
      } finally {
        out.cancel();
        busy = false;
      }
    }
    const snapBack = (from) => {
      el.style.translate = '';
      if (from) el.animate([{ translate: `${from}px 0` }, { translate: '0px 0' }], { duration: 240, easing: 'cubic-bezier(.15,.85,.3,1)' });
    };
    for (const area of areas) {
      area.addEventListener('pointerdown', (e) => {
        sw = busy || (ignore && ignore(e)) ? null
          : { id: e.pointerId, x: e.clientX, y: e.clientY, track: false, off: 0, vx: 0, lx: e.clientX, lt: e.timeStamp };
      });
      area.addEventListener('pointermove', (e) => {
        if (!sw || e.pointerId !== sw.id) return;
        const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        if (!sw.track) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) sw.track = true;
          else { if (Math.abs(dy) > 12) sw = null; return; }
        }
        lastSlideAt = performance.now();
        const dt = e.timeStamp - sw.lt;
        if (dt > 0) sw.vx = (e.clientX - sw.lx) / dt;
        sw.lx = e.clientX; sw.lt = e.timeStamp;
        sw.off = canGo(dx > 0 ? 1 : -1) ? dx : dx * 0.25; // rubber band at the ends
        el.style.translate = `${sw.off}px 0`;
      });
      const end = (e) => {
        if (!sw || e.pointerId !== sw.id) return;
        const s = sw; sw = null;
        if (!s.track) return;
        lastSlideAt = performance.now();
        const dir = s.off > 0 ? 1 : -1;
        const far = Math.abs(s.off) > width() * 0.22, flick = Math.abs(s.vx) > 0.45 && Math.sign(s.vx) === dir;
        if (e.type === 'pointerup' && canGo(dir) && (far || flick)) go(dir, s.off);
        else snapBack(s.off);
      };
      area.addEventListener('pointerup', end);
      area.addEventListener('pointercancel', end);
    }
    return { go: (step) => go(step) };
  }

  const shopSlide = attachSlide({
    areas: [$('#shopGrid'), $('.shop-tabs')],
    el: $('#shopGrid'),
    canGo: (step) => { const i = OUT.SLOTS.indexOf(shop.slot) + step; return i >= 0 && i < OUT.SLOTS.length; },
    apply: (step) => { sfx.tap(); shop.slot = OUT.SLOTS[OUT.SLOTS.indexOf(shop.slot) + step]; shop.trying = null; buildShop(); },
  });
  for (const t of document.querySelectorAll('.shop-tabs .tab')) {
    t.addEventListener('click', () => {
      if (slidRecently()) return;
      const step = OUT.SLOTS.indexOf(t.dataset.slot) - OUT.SLOTS.indexOf(shop.slot);
      if (step) shopSlide.go(step);
    });
  }
  $('#shopBuy').addEventListener('click', () => {
    const d = store.data, it = OUT.BY_ID[shop.trying];
    if (!it || (d.gems || 0) < it.price) return;
    d.gems -= it.price;
    d.owned.push(it.id);
    d.outfit[it.slot] = it.id;
    shop.trying = null;
    store.save();
    sfx.win();
    const hero = $('#shopHero');
    hero.classList.remove('cheer'); void hero.offsetWidth; hero.classList.add('cheer');
    buildShop();
  });

  function currentMapWorld() {
    const WORLDS = worldsNow();
    let w = rec().mapWorld;
    if (!Number.isInteger(w) || w < 0 || w >= WORLDS.length) {
      w = 0; // default to the furthest world that is open
      for (let i = 0; i < WORLDS.length; i++) if (worldOpen(i)) w = i;
    }
    return w;
  }
  // Level spots and prize spot on each world's 360x780 map picture. Keep in sync with LAYOUTS in tools/make_maps.py.
  const MAP_LAYOUTS = [
    { nodes: [[95, 625], [262, 530], [100, 420], [262, 305], [150, 195]], prize: [262, 120] },
    { nodes: [[85, 640], [255, 615], [285, 410], [115, 365], [110, 215]], prize: [265, 125] },
    { nodes: [[250, 650], [95, 560], [255, 455], [90, 335], [245, 225]], prize: [95, 120] },
    { nodes: [[180, 640], [295, 480], [190, 325], [65, 455], [95, 220]], prize: [265, 120] },
    { nodes: [[180, 655], [215, 545], [150, 435], [210, 325], [165, 215]], prize: [285, 125] },
  ];
  GAMES.dig.bosses = BOSSES;
  GAMES.dig.map = { img: (w) => `assets/map-${w + 1}.svg`, boss: (w) => `assets/boss-${w + 1}.svg`, layouts: MAP_LAYOUTS };

  function buildMap() {
    const WORLDS = worldsNow(), r = rec(), CHALS = curGame().chals, MAP = curGame().map, BOSSES = curGame().bosses;
    const w = currentMapWorld();
    const world = WORLDS[w];
    $('#map').dataset.game = GAME;
    $('#map').dataset.world = String(w + 1);
    $('#mapBg').src = MAP.img(w);
    const prize = CHARS[world.unlock];
    const prizeImg = $('#mapPrize');
    prizeImg.src = `assets/${prize.img}.svg`;
    prizeImg.classList.toggle('locked', !r.unlocked.includes(world.unlock));
    const layout = MAP.layouts[w];
    prizeImg.style.left = `${layout.prize[0] / 360 * 100}%`;
    prizeImg.style.top = `${layout.prize[1] / 780 * 100}%`;
    // The prize looks toward the middle of the map.
    const lookRight = layout.prize[0] < 180;
    prizeImg.style.transform = `translate(-50%, -50%)${prize.faceLeft === lookRight ? ' scaleX(-1)' : ''}`;
    $('#worldName').textContent = world.name;
    $('#worldNum').textContent = `עולם ${w + 1} מתוך ${WORLDS.length}`;
    $('#prevWorld').disabled = w === 0;
    $('#nextWorld').disabled = w === WORLDS.length - 1;
    $('#worldLocked').hidden = worldOpen(w);
    $('#worldLocked').textContent = `מסיימים את עולם ${w} כדי לפתוח`;
    const box = $('#levels');
    box.innerHTML = '';
    world.levels.forEach((lvl, i) => {
      const stars = r.stars[`${w + 1}-${i + 1}`] || 0;
      const open = levelOpen(w, i);
      const b = document.createElement('button');
      b.className = `level${open ? '' : ' locked'}${lvl.bossFight ? ' boss' : ''}`;
      b.style.left = `${layout.nodes[i][0] / 360 * 100}%`;
      b.style.top = `${layout.nodes[i][1] / 780 * 100}%`;
      const label = lvl.bossFight ? `בוס: ${BOSSES[w].name}` : `שלב ${i + 1}`;
      b.setAttribute('aria-label', open ? label : `${label}, נעול`);
      const face = lvl.bossFight ? `<img class="boss-face" src="${MAP.boss(w)}" alt="">` : '';
      const best = (r.best || {})[`${w + 1}-${i + 1}`];
      const done = (r.chal || {})[`${w + 1}-${i + 1}`] || 0;
      const marks = CHALS.map((ch) => `<span class="cm${done & ch.bit ? ' on' : ''}">${ch.icon}</span>`).join('');
      const timeTag = best && open ? `<span class="best-time">⏱ ${fmtTime(best)} ${marks}</span>` : '';
      b.innerHTML = `${face}${lvl.bossFight ? 'בוס' : i + 1}<span class="st">${[0, 1, 2].map((k) => `<span class="${k < stars ? 'on' : 'off'}">★</span>`).join('')}</span>${timeTag}`;
      b.disabled = !open;
      b.addEventListener('click', () => {
        if (slidRecently()) return; // the finger lift after a slide
        sfx.init(); sfx.tap(); showLevelInfo(w, i);
      });
      box.appendChild(b);
    });
  }

  // Level card: what the level is, your times and challenges, and a big play button.
  let infoLevel = null;
  function showLevelInfo(w, l) {
    infoLevel = [w, l];
    const WORLDS = worldsNow(), d = rec(), cfg = WORLDS[w].levels[l], key = `${w + 1}-${l + 1}`;
    const stars = d.stars[key] || 0, best = (d.best || {})[key];
    $('#infoWorld').textContent = WORLDS[w].name;
    $('#infoTitle').textContent = cfg.bossFight ? `בוס: ${curGame().bosses[w].name}` : `שלב ${l + 1}`;
    $('#infoFace').hidden = !cfg.bossFight;
    if (cfg.bossFight) $('#infoFace').src = curGame().map.boss(w);
    $('#infoGoal').innerHTML = curGame().goal(cfg);
    $('#infoStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < stars ? 'on' : 'off'}">★</span>`).join('');
    $('#infoBest').innerHTML = best ? `⏱ השיא <bdi>${fmtTime(best)}</bdi>` : 'עוד לא ניצחת כאן';
    const recent = ((d.times || {})[key] || []);
    $('#infoTimes').hidden = recent.length === 0;
    $('#infoTimes').innerHTML = `פעמים אחרונות: ${recent.map((t) => `<bdi>${fmtTime(t)}</bdi>`).join(' · ')}`;
    $('#infoChal').innerHTML = chalRow(cfg, (d.chal || {})[key] || 0);
    $('#levelInfo').hidden = false;
  }
  $('#infoPlay').addEventListener('click', () => {
    sfx.tap(); $('#levelInfo').hidden = true;
    if (infoLevel) playLevel(infoLevel[0], infoLevel[1]);
  });
  $('#infoClose').addEventListener('click', () => { sfx.tap(); $('#levelInfo').hidden = true; });
  $('#levelInfo').addEventListener('click', (e) => { if (e.target.id === 'levelInfo') $('#levelInfo').hidden = true; });
  // Map pictures are decoded ahead of time so a new world never shows up blank mid-slide.
  const mapPics = {};
  const preloadMaps = () => {
    if (mapPics[GAME]) return;
    mapPics[GAME] = [];
    const MAP = curGame().map;
    for (let i = 0; i < worldsNow().length; i++) {
      for (const src of [MAP.img(i), MAP.boss(i)]) {
        const im = new Image(); im.src = src; im.decode().catch(() => {}); mapPics[GAME].push(im);
      }
    }
  };
  const mapSlide = attachSlide({
    areas: [$('#map')],
    el: $('#mapStage'),
    ignore: (e) => !$('#levelInfo').hidden || !!e.target.closest('.overlay, .world-nav, .map-head, .home-btn'),
    canGo: (step) => { const w = currentMapWorld() + step; return w >= 0 && w < WORLDS.length; },
    apply: async (step) => {
      rec().mapWorld = currentMapWorld() + step; store.save(); sfx.tap(); buildMap();
      await Promise.race([$('#mapBg').decode().catch(() => {}), new Promise((r) => setTimeout(r, 250))]);
    },
  });
  function pageWorld(delta) { preloadMaps(); mapSlide.go(delta); }
  $('#map').addEventListener('pointerdown', preloadMaps);

  function togglePause(on) {
    if (screen !== 'game' || !G || G.state === 'won' || G.state === 'lost') return;
    paused = on;
    $('#pause').hidden = !on;
    $('#pauseMuteBtn').classList.toggle('muted', !!store.data.muted);
    $('#pauseDino').src = `assets/${G.ch.img}.svg`;
    input.dir = null; padRelease();
  }

  // Full screen is asked for once. If the player leaves it (for example to open the browser menu
  // and install the app), we don't pull them back in. The installed app is full screen already.
  let fsDone = false;
  const installed = () => ['fullscreen', 'standalone'].some((m) => window.matchMedia && matchMedia(`(display-mode: ${m})`).matches);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) fsDone = true; });
  function goFullscreen() {
    const el = document.documentElement;
    if (fsDone || installed() || document.fullscreenElement || !el.requestFullscreen) return;
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
  // Browsers only allow full screen right after a tap, so the first tap anywhere outside a level does it.
  document.addEventListener('pointerup', () => { if (screen !== 'game') goFullscreen(); }, true);
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
    store.data = { stars: {}, best: {}, unlocked: ['pip'], selected: 'pip', streak: {}, muted, controlMode, ctrl3: 1,
      gems: 0, owned: [], outfit: {}, chal: {}, times: {}, blocks: freshRecords() };
    store.save();
    G = null;
    sfx.tap();
    settingsStep(false);
    $('#resetDone').hidden = false;
    buildHub();
  });

  // Start a level of whichever game is open.
  function playLevel(w, l) { return curGame().start(w, l); }
  $('#mapBack').addEventListener('click', () => { sfx.tap(); show('title'); });
  $('#titleHome').addEventListener('click', () => { sfx.tap(); show('hub'); });
  $('#muteBtn').addEventListener('click', () => { store.data.muted = !store.data.muted; store.save(); sfx.init(); sfx.tap(); buildHub(); });
  $('#pauseBtn').addEventListener('click', () => { sfx.tap(); togglePause(true); });
  $('#resumeBtn').addEventListener('click', () => { sfx.tap(); togglePause(false); });
  // Tapping outside the pause panel closes it and keeps playing
  $('#pause').addEventListener('click', (e) => { if (e.target.id === 'pause') { sfx.tap(); togglePause(false); } });
  $('#restartBtn').addEventListener('click', () => { sfx.tap(); playLevel(G.w, G.l); });
  $('#pauseMapBtn').addEventListener('click', () => { sfx.tap(); paused = false; hideOverlays(); show('map'); });
  $('#pauseMuteBtn').addEventListener('click', () => {
    store.data.muted = !store.data.muted; store.save(); sfx.tap();
    $('#pauseMuteBtn').classList.toggle('muted', !!store.data.muted);
  });
  // Controls slider: drag the knob to a side, or tap anywhere on it to flip
  {
    const seg = $('#controlSeg'), thumb = seg.querySelector('.thumb');
    let drag = null;
    const setMode = (m) => {
      if (m !== controlMode()) { store.data.controlMode = m; store.save(); }
      sfx.tap(); applyControlMode();
    };
    seg.addEventListener('pointerdown', (e) => {
      const span = thumb.offsetWidth + 4;
      drag = { id: e.pointerId, x: e.clientX, span, start: controlMode() === 'swipe' ? -span : 0, off: null };
      seg.setPointerCapture(e.pointerId);
    });
    seg.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (drag.off === null && Math.abs(dx) < 6) return;
      seg.classList.add('dragging');
      drag.off = clamp(drag.start + dx, -drag.span, 0);
      thumb.style.transform = `translateX(${drag.off}px)`;
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      seg.classList.remove('dragging'); thumb.style.transform = '';
      if (e.type === 'pointercancel') return;
      if (d.off === null) setMode(controlMode() === 'pad' ? 'swipe' : 'pad');
      else setMode(d.off < -d.span / 2 ? 'swipe' : 'pad');
    };
    seg.addEventListener('pointerup', end);
    seg.addEventListener('pointercancel', end);
    // Keyboard users still get the two buttons
    for (const b of seg.querySelectorAll('button')) b.addEventListener('click', (e) => { if (e.detail === 0) setMode(b.dataset.m); });
  }
  $('#pauseHomeBtn').addEventListener('click', () => { sfx.tap(); paused = false; hideOverlays(); show('title'); });
  $('#nextBtn').addEventListener('click', () => {
    sfx.tap();
    if (G.l + 1 < worldsNow()[G.w].levels.length) playLevel(G.w, G.l + 1);
    else { rec().mapWorld = G.w + 1; store.save(); playLevel(G.w + 1, 0); }
  });
  $('#prevWorld').addEventListener('click', () => pageWorld(-1));
  $('#nextWorld').addEventListener('click', () => pageWorld(1));
  $('#winRetryBtn').addEventListener('click', () => { sfx.tap(); playLevel(G.w, G.l); });
  $('#winMapBtn').addEventListener('click', () => { sfx.tap(); rec().mapWorld = G.w; hideOverlays(); show('map'); });
  $('#retryBtn').addEventListener('click', () => { sfx.tap(); playLevel(G.w, G.l); });
  $('#loseMapBtn').addEventListener('click', () => { sfx.tap(); hideOverlays(); show('map'); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) togglePause(true);
    else if (screen === 'game') keepAwake();
  });
  window.addEventListener('resize', () => { if (screen === 'game') resizeBoard(); });

  // ---------- The blocks game (blocks.js) gets the shared pieces ----------
  const blocks = window.DinoBlocks({
    $, store, rec, sfx, CHARS, images, BOSSES, BOSS_HP, DIFFICULTY, SHOTS, WORLDS,
    G: () => G, setG: (g) => { G = g; }, isPaused: () => paused, setPaused: (v) => { paused = v; },
    loadScene, show, hideOverlays, buildLives, keepAwake, applyControlMode, controlMode, startPlay, skipIntro,
    finishWin, lose, chalRow, fmtTime, drawDino, drawShot,
  });
  GAMES.blocks = blocks.game;

  // ---------- Main loop ----------
  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (G && screen === 'game') {
      if (G.mode === 'blocks') { if (!paused) blocks.update(dt); blocks.render(); }
      else { if (!paused) update(dt); render(); }
    }
    if (screen === 'title') paintDino($('#titleHero'), rec().selected, store.data.outfit, t / 1000);
    if (screen === 'hub') paintDino($('#hubHero'), rec().selected, store.data.outfit, t / 1000);
    if (screen === 'shop') paintDino($('#shopHero'), shop.char, shopOutfit(), t / 1000);
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  store.load();
  // Arrows are the default again. Everyone is moved back to arrows once (ctrl3 not set); swipe stays in the pause menu.
  if (!store.data.ctrl3) { store.data.controlMode = 'pad'; store.data.ctrl3 = 1; delete store.data.ctrl2; store.save(); }
  if (store.data.game === 'blocks') GAME = 'blocks';
  loadImages().then(() => {
    show('hub');
    requestAnimationFrame(frame);
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Debug hook for testing in a desktop browser.
  window.__dino = {
    get G() { return G; }, startLevel, store, input, shop, blocks, openGame, playLevel, rec,
    tick(n = 1, dt = 1 / 60) {
      const b = G && G.mode === 'blocks';
      for (let i = 0; i < n; i++) { if (b) blocks.update(dt); else update(dt); }
      if (b) blocks.render(); else render();
    },
  };
})();
