'use strict';
// מפלצת הראשים: a flying shooter. A many-headed monster flies up through five dragon worlds; its heads shoot on their own.
// It starts with one head (fire); beating each world's boss grows a new head with its own power:
// ice slows, poison keeps hurting, lightning jumps between enemies, wind blows enemy shots away, stars chase enemies.
// Drag a finger anywhere to fly (the monster moves with the finger, it doesn't jump under it).
// Coins and power-ups fall from beaten enemies. Every kill fills the roar; a full roar clears the screen.
// app.js builds the pieces around it (save, sounds, map, win card) and hands them in as `core`.
window.DinoHydra = (core) => {
  const { $, store, rec, sfx, images } = core;
  const INK = '#2B1B3D';
  const VW = 360, VH = 640;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (k) => 1 - (1 - k) * (1 - k);

  // ---------- Heads ----------
  const HEADS = {
    fire:   { name: 'ראש האש',    c: '#FF9F1C', dark: '#D9730D', light: '#FFE0A8', perk: 'יורק כדורי אש ישר קדימה' },
    ice:    { name: 'ראש הקרח',   c: '#5BC8F5', dark: '#2A8FD0', light: '#E6F7FF', perk: 'קרח שמאט את האויבים' },
    poison: { name: 'ראש הרעל',   c: '#7ED957', dark: '#3FA244', light: '#D6F5B8', perk: 'בועות רעל שממשיכות לפגוע' },
    bolt:   { name: 'ראש הברק',   c: '#FFD23F', dark: '#D9A400', light: '#FFF6C9', perk: 'ברק שקופץ בין כמה אויבים' },
    wind:   { name: 'ראש הרוח',   c: '#8FE3D9', dark: '#2A9C92', light: '#FFFFFF', perk: 'רוח שמעיפה את היריות של האויבים' },
    star:   { name: 'ראש הכוכבים', c: '#FF8FC8', dark: '#D9558F', light: '#FFE3F0', perk: 'כוכבים שמחפשים אויבים לבד' },
  };
  const HEAD_ORDER = ['fire', 'ice', 'poison', 'bolt', 'wind', 'star'];
  Object.keys(HEADS).forEach((id) => { HEADS[id].id = id; });
  const BODY = { c: '#8E5BD9', dark: '#6A3FB8', belly: '#E3D6FF', stripe: '#C9B5F0', wing: '#39C1B5', wingIn: '#9FE8E0' };

  // ---------- Worlds and levels ----------
  // len: seconds of enemy waves in the level. Boss levels have a short way in, then the boss.
  const L = (len) => ({ len });
  const WORLDS = [
    { name: 'שמי הר הגעש', unlock: 'ice', bg: 'hbg-1', A: 'small', B: 'spit', motes: ['#FF9F1C', '#FFD23F'], moteUp: true,
      levels: [L(42), L(48), L(52), L(56), L(14)] },
    { name: 'יער הדרקונים', unlock: 'poison', bg: 'hbg-2', A: 'small', B: 'spit', motes: ['#B8EE8A', '#FFD23F'],
      levels: [L(50), L(54), L(58), L(60), L(14)] },
    { name: 'ים הדרקונים', unlock: 'bolt', bg: 'hbg-3', A: 'small', B: 'spit', motes: ['#FFFFFF', '#BFF0FF'],
      levels: [L(54), L(58), L(60), L(62), L(14)] },
    { name: 'הרי הקרח', unlock: 'wind', bg: 'hbg-4', A: 'small', B: 'spit', motes: ['#FFFFFF', '#E6F7FF'],
      levels: [L(56), L(60), L(62), L(64), L(14)] },
    { name: 'דרקוני החלל', unlock: 'star', bg: 'hbg-5', A: 'small', B: 'spit', motes: ['#FFF6C9', '#BFD3FF'], streaks: true,
      levels: [L(58), L(62), L(64), L(66), L(14)] },
  ];
  WORLDS.forEach((wd) => { wd.levels[wd.levels.length - 1].bossFight = true; });
  const BOSSES = [
    { name: 'דרקון האש',     hp: 220, attacks: ['fan', 'summon', 'aimed', 'fan'] },
    { name: 'דרקון היער', hp: 340, attacks: ['aimed', 'charge', 'fan', 'summon'] },
    { name: 'דרקון הים',     hp: 430, attacks: ['ring', 'fan', 'spiral', 'aimed'] },
    { name: 'דרקון הקרח',    hp: 530, attacks: ['ring', 'summon', 'fan', 'charge', 'aimed'] },
    { name: 'דרקון הכוכבים', hp: 640, attacks: ['spiral', 'fan', 'summon', 'ring', 'charge', 'aimed'] },
  ];
  const KILL_PCT = 80;

  // ---------- Level scripts: the same waves every time you play a level ----------
  function mulberry(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function buildScript(w, l, cfg) {
    const rnd = mulberry((w + 1) * 1009 + l * 131 + 17);
    const g = w * 5 + l;
    const len = cfg.len;
    const gap = clamp(3.3 - g * 0.06, 1.95, 3.3);
    const kinds = ['line', 'vee', 'snake', 'swoop'];
    if (g >= 1) kinds.push('shooters');
    if (g >= 2) kinds.push('rain');
    if (g >= 3) kinds.push('shooters');
    const tanks = cfg.bossFight ? [] : g === 0 ? [0.6] : [0.4, 0.8];
    const ev = [];
    let t = 2, ti = 0, last = '';
    while (t < len) {
      let type;
      if (ti < tanks.length && t >= tanks[ti] * len) { type = 'tank'; ti++; }
      else { do type = kinds[Math.floor(rnd() * kinds.length)]; while (type === last); }
      last = type;
      ev.push({ t, type, side: rnd() < 0.5 ? -1 : 1, x: 70 + rnd() * 220, seed: Math.floor(rnd() * 1e9) });
      t += gap * (type === 'tank' ? 2.1 : type === 'shooters' ? 1.45 : 1) * (0.85 + rnd() * 0.3);
    }
    if (cfg.bossFight) ev.push({ t: len, type: 'boss' });
    let foes = 0, coins = 0;
    for (const e of ev) for (const s of formation(e, w)) { foes++; coins += s.coins; }
    if (cfg.bossFight) coins += BOSS_COINS;
    Object.assign(cfg, { script: ev, foes, coins, coinGoal: Math.max(5, Math.round(coins * 0.6)) });
  }
  // The enemies of one wave: what they are, how they move, when they show up.
  function formation(ev, w) {
    const rnd = mulberry(ev.seed || 1);
    const sp = 1 + w * 0.09; // enemies get a little quicker world by world
    const out = [];
    const A = (o) => out.push({ kind: 'A', coins: 1, delay: 0, ...o });
    const B = (o) => out.push({ kind: 'B', coins: 2, delay: 0, ...o });
    switch (ev.type) {
      case 'line': {
        const n = w >= 2 ? 6 : 5;
        for (let i = 0; i < n; i++) A({ mv: 'down', x0: 40 + i * (280 / (n - 1)), y0: -30, v: 72 * sp, amp: 12, f: 2, ph: i, delay: i * 0.1 });
        break;
      }
      case 'vee':
        for (let i = 0; i < 5; i++) A({ mv: 'down', x0: 180 + (i - 2) * 58, y0: -30, v: 82 * sp, amp: 0, f: 0, ph: 0, delay: Math.abs(i - 2) * 0.28 });
        break;
      case 'snake': {
        const x0 = clamp(ev.x, 95, 265);
        for (let i = 0; i < 7; i++) A({ mv: 'down', x0, y0: -30, v: 88 * sp, amp: 72, f: 2.1, ph: 0, delay: i * 0.3 });
        break;
      }
      case 'swoop': {
        const s = ev.side, y = 50 + rnd() * 70;
        for (let i = 0; i < 5; i++) {
          A({ mv: 'swoop', p0: [s < 0 ? -30 : VW + 30, y], p1: [180, 420 + rnd() * 40], p2: [s < 0 ? VW + 40 : -40, 150 + rnd() * 90],
            dur: 4.4 / sp, delay: i * 0.36, face: true });
        }
        break;
      }
      case 'rain': {
        const n = 6 + Math.min(4, w);
        for (let i = 0; i < n; i++) A({ mv: 'fall', x0: 30 + rnd() * 300, y0: -30, v: (165 + rnd() * 30) * sp, vx: rand(-14, 14), delay: i * 0.5 });
        break;
      }
      case 'shooters': {
        const n = w >= 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          B({ mv: 'hover', x0: n === 2 ? 110 + i * 140 : 70 + i * 110, y0: -36, stop: 100 + (i % 2) * 55, tin: 1.5, hold: 5.5, v: 95,
            amp: 18, delay: i * 0.4, every: 2.5 - w * 0.12 });
        }
        break;
      }
      case 'tank':
        B({ mv: 'hover', tank: true, x0: clamp(ev.x, 110, 250), y0: -60, stop: 150, tin: 2.4, hold: 9, v: 70, amp: 40, every: 1.7 - w * 0.06, coins: 6 });
        break;
      default: break;
    }
    return out;
  }
  const BOSS_COINS = 16;
  WORLDS.forEach((wd, w) => wd.levels.forEach((cfg, l) => buildScript(w, l, cfg)));

  // Challenges: each pays gems once, like in the other games.
  const CHALS = [
    { bit: 1, icon: '👾', label: () => `${KILL_PCT}%` },
    { bit: 2, icon: '🪙', label: (cfg) => `${cfg.coinGoal}` },
    { bit: 4, icon: '🥚', label: () => 'כל הביצים' },
  ];
  const goalText = (cfg) => (cfg.bossFight ? '💥 מנצחים את הבוס' : `👾 <bdi>${cfg.foes}</bdi> אויבים בדרך`);

  // ---------- Map: level spots on each hmap-N picture (keep in sync with tools/make_hydra_art.py) ----------
  const iconCache = {};
  function paintURL(key, w, h, draw) {
    if (!iconCache[key]) {
      const s = document.createElement('canvas');
      s.width = w; s.height = h;
      draw(s.getContext('2d'));
      iconCache[key] = s.toDataURL();
    }
    return iconCache[key];
  }
  const headURL = (id) => paintURL(`h-${id}`, 160, 160, (c) => { c.translate(80, 86); drawHead(c, id, 0, 0, 46, 0, 0, 0); });
  const bossURL = (w) => paintURL(`b-${w}`, 240, 250, (c) => { c.translate(120, 132); c.scale(1.18, 1.18); drawBoss(c, w, 0.4, null); });
  const heroURL = (n) => paintURL(`hero-${n}`, 200, 200, (c) => { c.translate(100, 118); c.scale(1.15, 1.15); drawHydra(c, 0, 0, headsList().slice(0, n), 0.3, {}); });
  const MAP = {
    img: (w) => `assets/hmap-${w + 1}.svg`,
    boss: bossURL,
    layouts: [
      { nodes: [[90, 605], [250, 520], [110, 420], [255, 318], [140, 215]], prize: [255, 120] },
      { nodes: [[270, 605], [110, 535], [235, 440], [95, 340], [235, 230]], prize: [110, 120] },
      { nodes: [[180, 605], [295, 500], [190, 400], [70, 300], [190, 205]], prize: [290, 118] },
      { nodes: [[80, 605], [210, 545], [300, 430], [160, 360], [70, 235]], prize: [235, 130] },
      { nodes: [[180, 605], [80, 500], [260, 420], [110, 320], [250, 215]], prize: [150, 115] },
    ],
  };
  // The prize of a world is a new head.
  const prize = (id) => ({ src: headURL(id), title: `${HEADS[id].name} גדל!`, line: HEADS[id].perk, faceLeft: false, pick: false });
  const headsList = () => { const r = rec('hydra'); return HEAD_ORDER.filter((h) => h === 'fire' || r.unlocked.includes(h)); };

  // ---------- Canvas ----------
  const cv = $('#hcv');
  const ctx = cv.getContext('2d');
  let RES = 1, sprites = {}, tileCv = null;
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
    const g = core.G();
    if (g && g.mode === 'hydra') buildTile(g);
  }
  // The ground far below: one picture that repeats as it scrolls, a little darker so shots stand out.
  function buildTile(g) {
    tileCv = document.createElement('canvas');
    tileCv.width = Math.round(VW * RES); tileCv.height = Math.round(VH * RES);
    const c = tileCv.getContext('2d'), img = images[g.world.bg];
    if (img) c.drawImage(img, 0, 0, tileCv.width, tileCv.height);
    else { c.fillStyle = '#3A2E5A'; c.fillRect(0, 0, tileCv.width, tileCv.height); }
    c.fillStyle = 'rgba(20,12,36,.22)';
    c.fillRect(0, 0, tileCv.width, tileCv.height);
  }

  // ---------- Level start ----------
  let G = null;
  async function start(w, l) {
    const world = WORLDS[w], cfg = world.levels[l], r = rec('hydra');
    await core.loadScene(world.bg);
    if (WORLDS[w + 1]) core.loadScene(WORLDS[w + 1].bg);
    const key = `${w + 1}-${l + 1}`;
    const help = (r.streak[key] || 0) >= 3 ? 0.85 : 1; // a little quiet help after 3 losses in a row
    const boss = !!cfg.bossFight;
    const heads = headsList();
    G = {
      mode: 'hydra', w, l, cfg, key, world, help, bossFight: boss, bossInfo: BOSSES[w],
      ch: { src: heroURL(heads.length) },
      lives: 3, maxLives: 3, score: 0, coins: 0, kills: 0, spawned: 0, foesGone: 0,
      state: 'ready', readyT: boss ? 3.2 : 2.4, t: 0, playT: 0, st: 0, shownSec: -1, ev: 0,
      P: { x: VW / 2, y: VH + 80, tx: VW / 2, ty: VH - 120, inv: 0, power: 1, cool: {}, open: {}, heads, dead: 0 },
      enemies: [], shots: [], bullets: [], fx: [], pickups: [], particles: [], gusts: [],
      motes: [], scroll: 0, roar: 0, roarFx: 0, shake: 0, flash: 0, boss: null, winT: 0, ending: false,
      killsSincePower: 0, eggDue: false, hudKey: '',
    };
    G.readyMax = G.readyT;
    for (let i = 0; i < 26; i++) G.motes.push(newMote(true));
    core.setG(G);
    core.setPaused(false);
    core.hideOverlays();
    const game = $('#game');
    game.dataset.world = `h${w + 1}`;
    game.classList.remove('blocks');
    game.classList.add('hydra');
    core.show('game');
    resize();
    core.buildLives();
    hud(true);
    $('#timerNum').textContent = core.fmtTime(0);
    const b = $('#banner');
    const best = (r.best || {})[key];
    const bestLine = best ? `<small class="best-line">⏱ השיא <bdi>${core.fmtTime(best)}</bdi></small>` : '';
    const head = boss
      ? `<div class="ready-world">${world.name}</div><div class="ready-title boss">בוס: ${BOSSES[w].name}</div>`
      : `<div class="ready-world">${world.name}</div><div class="ready-title">שלב ${l + 1}</div>`;
    const how = [heads.length === 1 ? '🐲 הראש יורה לבד, רק מזיזים את המפלצת' : `🐲 ${heads.length} ראשים יורים לבד`];
    if (boss) how.push('🎯 יורים בבוס עד שהלבבות שלו נגמרים');
    else if (w === 0 && l === 0) how.push('🪙 אוספים מטבעות שנופלים מהאויבים');
    b.innerHTML = `<div class="ready-card">${head}<div class="ready-goal">${goalText(cfg)}</div>${
      how.map((s) => `<div class="ready-how">${s}</div>`).join('')}${bestLine}${
      core.chalRow(cfg, (r.chal || {})[key] || 0, 0, CHALS)}<div class="ready-bar"><i style="animation-duration:${G.readyT}s"></i></div></div>`;
    b.className = 'banner';
    if (boss) sfx.boss(); else sfx.ready();
    b.hidden = false;
    held.left = held.right = held.up = held.down = false;
    sw.id = null;
    core.applyControlMode();
    core.keepAwake();
  }

  // ---------- Enemies ----------
  const FOES = {
    small: { r: 15, hp: 2 },
    spit:  { r: 18, hp: 6 },
  };

  const hpK = () => 1 + G.w * 0.5;
  function spawnWave(ev) {
    if (ev.type === 'boss') { bossEnters(); return; }
    for (const s of formation(ev, G.w)) addEnemy(s);
  }
  function addEnemy(s, summon = false) {
    const kind = s.kind === 'A' ? G.world.A : G.world.B, F = FOES[kind];
    const size = s.tank ? 1.85 : 1;
    const hp = (s.tank ? 36 : F.hp) * hpK() * G.help;
    const e = { ...s, kind, size, r: F.r * size, hp, maxHp: hp, t: -s.delay, x: -200, y: -200, slow: 0, poison: 0, pdps: 0,
      flash: 0, push: 0, shootT: (s.every || 2) * rand(0.5, 1), seen: false, summon, anim: Math.random() * 6, rot: 0 };
    if (!summon) G.spawned++;
    place(e);
    G.enemies.push(e);
  }
  // Where an enemy is at its own time e.t (slowed enemies live slower, so they move slower along their path).
  function place(e) {
    const t = Math.max(0, e.t);
    let x = e.x, y = e.y;
    if (e.mv === 'down') { x = e.x0 + e.amp * Math.sin(t * e.f + e.ph); y = e.y0 + e.v * t; }
    else if (e.mv === 'fall') { x = e.x0 + e.vx * t; y = e.y0 + e.v * t; e.rot += 0.03; }
    else if (e.mv === 'swoop') {
      const u = t / e.dur, a = 1 - u;
      x = a * a * e.p0[0] + 2 * a * u * e.p1[0] + u * u * e.p2[0];
      y = a * a * e.p0[1] + 2 * a * u * e.p1[1] + u * u * e.p2[1];
      if (u > 1.05) e.gone = true;
    } else if (e.mv === 'hover') {
      if (t < e.tin) { x = e.x0; y = e.y0 + (e.stop - e.y0) * easeOut(t / e.tin); }
      else if (t < e.tin + e.hold) { const h = t - e.tin; x = e.x0 + e.amp * Math.sin(h * 0.9); y = e.stop + Math.sin(h * 2) * 6; }
      else { const h = t - e.tin - e.hold; x = e.x0 + e.amp * Math.sin(e.hold * 0.9); y = e.stop - e.v * h * h * 0.6; e.leaving = true; }
    }
    if (e.face) { const dx = x - e.x, dy = y - e.y; if (dx * dx + dy * dy > 0.01) e.rot = Math.atan2(dy, dx) - Math.PI / 2; }
    e.x = x; e.y = y + e.push;
  }
  function updateEnemies(dt) {
    for (const e of G.enemies) {
      const k = e.slow > 0 ? 0.45 : 1;
      e.t += dt * k; e.anim += dt * k;
      if (e.slow > 0) e.slow -= dt;
      if (e.flash > 0) e.flash -= dt;
      e.push *= Math.pow(0.08, dt);
      if (e.t < 0) continue;
      place(e);
      if (!e.seen && e.y > -10 && e.y < VH) e.seen = true;
      if (e.poison > 0) {
        e.poison -= dt;
        hurt(e, e.pdps * dt, true);
        if (Math.random() < dt * 8) G.particles.push({ x: e.x + rand(-e.r, e.r), y: e.y, vx: 0, vy: -30, life: 0.6, max: 0.6, color: '#9BF06E', size: rand(2, 4), bubble: true });
      }
      // Shooters aim at the dragon while they're on the screen.
      if (e.kind === G.world.B && e.every && e.t > (e.tin || 0) && !e.leaving && e.y > 20 && e.y < VH * 0.6) {
        e.shootT -= dt * k;
        if (e.shootT <= 0) { e.shootT = e.every / G.help; enemyShoot(e); }
      }
      // Bumping into the dragon hurts both.
      if (G.state === 'play' && dist(e, G.P) < e.r * 0.8 + 10) { hit(); hurt(e, 4); }
      if (e.y > VH + 50 || e.y < -140 && e.seen || e.x < -80 || e.x > VW + 80) e.gone = true;
    }
    for (const e of G.enemies) if (e.gone && !e.dead && !e.summon) G.foesGone++;
    G.enemies = G.enemies.filter((e) => !e.gone && !e.dead);
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function enemyShoot(e) {
    const P = G.P, a = Math.atan2(P.y - e.y, P.x - e.x), s = (120 + G.w * 10) * G.help;
    if (e.tank) { const n = G.w >= 3 ? 5 : 3; for (let i = 0; i < n; i++) bullet(e.x, e.y + e.r * 0.5, a + (i - (n - 1) / 2) * 0.24, s); }
    else bullet(e.x, e.y + e.r * 0.4, a, s);
    sfx.tone(300, 0.08, 'triangle', 0.025, 0, 200);
  }
  function bullet(x, y, a, s, r = 5.5) { G.bullets.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r, t: 0 }); }

  // Damage. Kill: coins, sometimes a power-up, and some roar.
  function hurt(e, dmg, quiet = false) {
    if (e.dead || e.t < 0) return;
    e.hp -= dmg;
    if (!quiet) e.flash = 0.08;
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    e.dead = true;
    G.kills += e.summon ? 0 : 1;
    G.score += e.tank ? 200 : e.kind === G.world.B ? 40 : 15;
    G.roar = Math.min(1, G.roar + (e.tank ? 0.25 : 0.045));
    boom(e.x, e.y, e.r);
    if (!e.summon) for (let i = 0; i < e.coins; i++) drop('coin', e.x + rand(-e.r, e.r) * 0.6, e.y + rand(-e.r, e.r) * 0.6);
    G.killsSincePower++;
    if (e.tank || G.killsSincePower >= 26) { G.killsSincePower = 0; drop('power', e.x, e.y); }
    if (e.tank && G.lives < G.maxLives) drop('egg', e.x + 18, e.y);
    sfx.tone(e.tank ? 160 : 520, e.tank ? 0.4 : 0.1, e.tank ? 'sawtooth' : 'square', 0.04, 0, e.tank ? 60 : 1300);
  }
  function boom(x, y, r) {
    const n = Math.round(6 + r * 0.6);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, 170);
      G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), max: 0.6,
        color: ['#FFD23F', '#FF9F1C', '#FFFFFF', '#FF6B7A'][i % 4], size: rand(2.5, 5), drag: true });
    }
    G.fx.push({ type: 'ring', x, y, r: r * 0.6, t: 0.3, max: 0.3, grow: r * 3 });
  }
  function drop(type, x, y) {
    G.pickups.push({ type, x, y, vx: rand(-40, 40), vy: rand(-90, -40), t: 0, spin: Math.random() * 6 });
  }

  // ---------- The boss ----------
  function bossEnters() {
    const info = BOSSES[G.w];
    const hp = info.hp * G.help;
    G.boss = { x: VW / 2, y: -120, hp, max: hp, t: 0, atk: 0, atkT: 2.6, act: null, enter: 1.8, r: 52, flash: 0, charge: null };
    sfx.boss();
    hud(true);
  }
  function updateBoss(dt) {
    const B = G.boss;
    if (!B || B.dead) return;
    B.t += dt;
    if (B.flash > 0) B.flash -= dt;
    const homeX = VW / 2 + Math.sin(B.t * 0.55) * 105, homeY = 118 + Math.sin(B.t * 1.3) * 10;
    if (B.enter > 0) {
      B.enter -= dt;
      B.x = homeX; B.y = homeY - 240 * easeOut(Math.max(0, B.enter) / 1.8);
      return;
    }
    if (B.charge) {
      // A dive: shakes in place (with a warning), dashes down at the dragon, then flies back up.
      const c = B.charge;
      c.t += dt;
      if (c.t < 0.8) { B.x = c.x + Math.sin(c.t * 60) * 3; B.y = c.y; }
      else if (c.t < 1.5) { const k = easeOut((c.t - 0.8) / 0.7); B.x = c.x + (c.tx - c.x) * k; B.y = c.y + (VH * 0.6 - c.y) * k; }
      else if (c.t < 2.6) { const k = easeOut((c.t - 1.5) / 1.1); B.x = c.tx + (homeX - c.tx) * k; B.y = VH * 0.6 + (homeY - VH * 0.6) * k; }
      else B.charge = null;
    } else { B.x += (homeX - B.x) * Math.min(1, dt * 2); B.y += (homeY - B.y) * Math.min(1, dt * 2); }
    if (G.state === 'play' && dist(B, G.P) < B.r * 0.8 + 10) hit();
    if (B.act) { runAttack(B, dt); return; }
    B.atkT -= dt * (B.hp < B.max / 2 ? 1.35 : 1);
    if (B.atkT <= 0) {
      const list = BOSSES[G.w].attacks;
      B.act = { type: list[B.atk % list.length], t: 0, n: 0 };
      B.atk++;
      B.atkT = (2.5 - G.w * 0.12) / G.help;
    }
  }
  function runAttack(B, dt) {
    const a = B.act, P = G.P, s = (115 + G.w * 9) * G.help;
    a.t += dt;
    const aim = Math.atan2(P.y - B.y, P.x - B.x);
    if (a.type === 'fan') {
      if (a.t > 0.45 && a.n < 2) {
        a.n++;
        const n = 5 + Math.min(2, G.w);
        for (let i = 0; i < n; i++) bullet(B.x, B.y + 34, aim + (i - (n - 1) / 2) * 0.2 + (a.n === 2 ? 0.1 : 0), s);
        sfx.tone(260, 0.15, 'triangle', 0.05, 0, 140);
        a.t = 0.2;
      }
      if (a.n >= 2) B.act = null;
    } else if (a.type === 'aimed') {
      if (a.t > 0.3 + a.n * 0.2 && a.n < 4) { a.n++; bullet(B.x, B.y + 34, aim, s * 1.15, 6.5); sfx.tone(400, 0.08, 'square', 0.03, 0, 250); }
      if (a.n >= 4) B.act = null;
    } else if (a.type === 'ring') {
      if (a.t > 0.5) {
        const n = 14, off = Math.random() * TAU;
        for (let i = 0; i < n; i++) bullet(B.x, B.y, off + i * TAU / n, s * 0.8);
        sfx.tone(200, 0.3, 'sine', 0.06, 0, 400);
        B.act = null;
      }
    } else if (a.type === 'spiral') {
      const every = 0.09;
      while (a.t > 0.3 + a.n * every && a.n < 22) { const k = a.n++; bullet(B.x, B.y + 10, Math.PI / 2 + Math.sin(k * 0.45) * 1.2, s * 0.85); }
      if (a.n >= 22) B.act = null;
    } else if (a.type === 'summon') {
      if (a.t > 0.5) {
        for (let i = 0; i < 3; i++) {
          const sd = i - 1;
          addEnemy({ kind: 'A', coins: 0, delay: i * 0.25, mv: 'swoop', p0: [B.x, B.y + 20], p1: [B.x + sd * 150, VH * 0.75],
            p2: [B.x + sd * 260, -60], dur: 4.2, face: true }, true);
        }
        sfx.tone(600, 0.2, 'triangle', 0.05, 0, 900);
        B.act = null;
      }
    } else if (a.type === 'charge') {
      if (!B.charge) { B.charge = { t: 0, x: B.x, y: B.y, tx: clamp(P.x, 60, VW - 60) }; sfx.tone(120, 0.6, 'sawtooth', 0.05, 0, 240); }
      B.act = null;
    }
  }
  function hurtBoss(dmg) {
    const B = G.boss;
    if (!B || B.dead || B.enter > 0) return;
    B.hp -= dmg; B.flash = 0.07;
    if (B.hp <= 0) { B.hp = 0; B.dead = true; win(); }
  }

  // ---------- The monster's heads ----------
  // Necks fan out from the body; the first heads get the middle spots. More heads: wider fan, longer necks.
  const SPREAD = [0, 0.42, 0.72, 0.92, 1.1, 1.24];
  const neckLen = (a, n) => 30 + n * 2.2 - Math.abs(a) * 6;
  const HEAD_R = 14;
  function headSlots(n) {
    const S = SPREAD[n - 1] || 1.12;
    const angs = [...Array(n)].map((_, i) => (n === 1 ? 0 : -S + (2 * S * i) / (n - 1)));
    const order = angs.map((a, i) => i).sort((i, j) => Math.abs(angs[i]) - Math.abs(angs[j]) || angs[i] - angs[j]);
    const slots = new Array(n);
    order.forEach((slot, k) => { slots[k] = angs[slot]; });
    return slots; // slots[k] = angle of the k-th head
  }
  function headPos(P, k, n, t) {
    const a = headSlots(n)[k] + Math.sin(t * 2.6 + k * 1.7) * 0.06;
    const len = neckLen(a, n);
    const bx = Math.sin(a) * 9, by = -6;
    return { x: P.x + bx + Math.sin(a) * len, y: P.y + by - Math.cos(a) * len, a };
  }
  const COOL = { fire: 0.17, ice: 0.34, poison: 0.55, bolt: 1.0, wind: 0.72, star: 0.5 };
  function shootHeads(dt) {
    const P = G.P, n = P.heads.length, pw = P.power;
    P.heads.forEach((id, k) => {
      P.open[id] = Math.max(0, (P.open[id] || 0) - dt * 6);
      P.cool[id] = (P.cool[id] || rand(0, 0.2)) - dt;
      if (P.cool[id] > 0) return;
      P.cool[id] += id === 'bolt' ? COOL.bolt - (pw - 1) * 0.12 : COOL[id];
      const h = headPos(P, k, n, G.t);
      P.open[id] = 1;
      const S = (x, y, a, sp, o) => G.shots.push({ id, x, y, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, t: 0, ...o });
      if (id === 'fire') {
        if (pw === 1) S(h.x, h.y - 8, 0, 560, { dmg: 1 });
        else if (pw === 2) { S(h.x - 5, h.y - 8, 0, 560, { dmg: 1 }); S(h.x + 5, h.y - 8, 0, 560, { dmg: 1 }); }
        else { S(h.x, h.y - 8, 0, 560, { dmg: 1 }); S(h.x - 4, h.y - 6, -0.13, 540, { dmg: 1 }); S(h.x + 4, h.y - 6, 0.13, 540, { dmg: 1 }); }
        if (G.shotSound = !G.shotSound) sfx.tone(880, 0.04, 'triangle', 0.012, 0, 660);
      } else if (id === 'ice') {
        const angs = pw === 1 ? [0] : pw === 2 ? [-0.08, 0.08] : [-0.15, 0, 0.15];
        for (const a of angs) S(h.x, h.y - 8, a + h.a * 0.25, 480, { dmg: 1, slow: 1.4 + pw * 0.3 });
      } else if (id === 'poison') {
        S(h.x, h.y - 8, h.a * 0.3, 380, { dmg: 1, poison: 2.2, pdps: 0.9 + pw * 0.5, r: 6 + pw });
      } else if (id === 'bolt') {
        zap(h, 2 + pw, 2);
      } else if (id === 'wind') {
        G.gusts.push({ x: h.x, y: h.y - 10, vy: -330, life: 0.85, w: 44 + pw * 10, dmg: 0.8 * pw, hit: new Set() });
      } else if (id === 'star') {
        S(h.x, h.y - 8, h.a * 0.8 - 0.3, 320, { dmg: 1.6, home: true, life: 2.4, spin: 0 });
        if (pw >= 3) S(h.x, h.y - 8, h.a * 0.8 + 0.3, 320, { dmg: 1.6, home: true, life: 2.4, spin: 0 });
        if (pw === 2) P.cool[id] -= 0.1;
      }
    });
  }
  // Lightning: hits the closest enemy (or the boss), then jumps on to the next closest ones.
  function zap(from, jumps, dmg) {
    const pts = [{ x: from.x, y: from.y }];
    let at = from;
    const done = new Set();
    for (let j = 0; j < jumps; j++) {
      let best = null, bd = j === 0 ? 330 : 125;
      for (const e of G.enemies) {
        if (e.dead || e.t < 0 || done.has(e) || e.y < -10) continue;
        const d = dist(e, at);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best && G.boss && !G.boss.dead && G.boss.enter <= 0 && j === 0 && dist(G.boss, at) < 420) {
        pts.push({ x: G.boss.x + rand(-20, 20), y: G.boss.y + rand(-10, 20) });
        hurtBoss(dmg * 1.5);
        break;
      }
      if (!best) break;
      done.add(best);
      pts.push({ x: best.x, y: best.y });
      hurt(best, dmg);
      at = best;
    }
    if (pts.length > 1) {
      G.fx.push({ type: 'bolt', pts: pts.map((p, i) => (i ? p : { ...p })), t: 0.16, max: 0.16, seed: Math.random() * 100 });
      sfx.tone(1400, 0.06, 'sawtooth', 0.02, 0, 500);
    }
  }
  function updateShots(dt) {
    for (const s of G.shots) {
      s.t += dt;
      if (s.home) {
        s.life -= dt;
        s.spin += dt * 8;
        const tgt = nearestFoe(s);
        if (tgt) {
          const want = Math.atan2(tgt.y - s.y, tgt.x - s.x), cur = Math.atan2(s.vy, s.vx);
          let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const na = cur + clamp(d, -5 * dt, 5 * dt), sp = Math.hypot(s.vx, s.vy);
          s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
        }
        if (s.life <= 0) s.dead = true;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y < -20 || s.y > VH + 20 || s.x < -20 || s.x > VW + 20) { s.dead = true; continue; }
      const r = s.r || 5;
      const B = G.boss;
      if (B && !B.dead && B.enter <= 0 && Math.abs(s.x - B.x) < B.r + r && Math.abs(s.y - B.y) < B.r * 0.85 + r) {
        s.dead = true; hurtBoss(s.dmg); sparkHit(s); continue;
      }
      for (const e of G.enemies) {
        if (e.dead || e.t < 0) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + r) ** 2) {
          s.dead = true;
          if (s.slow) e.slow = Math.max(e.slow, s.slow);
          if (s.poison) {
            for (const o of G.enemies) if (!o.dead && dist(o, e) < 46) { o.poison = s.poison; o.pdps = s.pdps; }
            G.fx.push({ type: 'cloud', x: e.x, y: e.y, t: 0.5, max: 0.5 });
          }
          hurt(e, s.dmg);
          sparkHit(s);
          break;
        }
      }
    }
    G.shots = G.shots.filter((s) => !s.dead);
    for (const g of G.gusts) {
      g.life -= dt; g.y += g.vy * dt;
      for (const b of G.bullets) if (Math.abs(b.x - g.x) < g.w / 2 && Math.abs(b.y - g.y) < 18) { b.dead = true; puff(b.x, b.y); }
      for (const e of G.enemies) {
        if (e.dead || e.t < 0 || g.hit.has(e)) continue;
        if (Math.abs(e.x - g.x) < g.w / 2 + e.r && Math.abs(e.y - g.y) < 18 + e.r) { g.hit.add(e); e.push -= 26; hurt(e, g.dmg); }
      }
      const B = G.boss;
      if (B && !B.dead && B.enter <= 0 && !g.hit.has(B) && Math.abs(B.x - g.x) < g.w / 2 + B.r && Math.abs(B.y - g.y) < 18 + B.r * 0.8) {
        g.hit.add(B); hurtBoss(g.dmg);
      }
    }
    G.gusts = G.gusts.filter((g) => g.life > 0 && g.y > -30);
  }
  function nearestFoe(s) {
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e.dead || e.t < 0 || e.y < 0) continue;
      const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best && G.boss && !G.boss.dead && G.boss.enter <= 0) best = G.boss;
    return best;
  }
  const SPARK = { fire: ['#FFD23F', '#FF9F1C'], ice: ['#E6F7FF', '#5BC8F5'], poison: ['#D6F5B8', '#7ED957'], star: ['#FFE3F0', '#FF8FC8'] };
  function sparkHit(s) {
    const cols = SPARK[s.id] || ['#FFFFFF'];
    for (let i = 0; i < 3; i++) G.particles.push({ x: s.x, y: s.y, vx: rand(-80, 80), vy: rand(-60, 40), life: 0.25, max: 0.25, color: cols[i % 2], size: rand(1.5, 3) });
  }
  function puff(x, y) {
    for (let i = 0; i < 4; i++) G.particles.push({ x, y, vx: rand(-50, 50), vy: rand(-80, -20), life: 0.35, max: 0.35, color: 'rgba(255,255,255,.9)', size: rand(2, 3.5) });
  }

  // ---------- The dragon ----------
  function hit() {
    const P = G.P;
    if (P.inv > 0 || G.state !== 'play') return;
    G.lives--;
    core.buildLives();
    P.inv = 2.6; G.shake = 0.35; G.flash = 0.25;
    // A clear moment to recover: enemy shots near the dragon pop.
    for (const b of G.bullets) if (dist(b, P) < 170) { b.dead = true; puff(b.x, b.y); }
    for (let i = 0; i < 14; i++) G.particles.push({ x: P.x, y: P.y, vx: rand(-150, 150), vy: rand(-150, 100), life: 0.6, max: 0.6, color: ['#FFFFFF', '#FF8FA3', '#5CCB5F'][i % 3], size: rand(3, 5), drag: true });
    sfx.ouch();
    if (G.lives <= 0) { G.state = 'dying'; P.dead = 0.001; core.lose(); }
  }
  function updatePlayer(dt) {
    const P = G.P;
    if (P.inv > 0) P.inv -= dt;
    if (G.state === 'play') {
      // Keys and the arrow pad move the dragon at a steady speed; the finger moves its target directly.
      let vx = (held.right ? 1 : 0) - (held.left ? 1 : 0), vy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const d = core.input && core.input.dir;
      if (d && core.controlMode() === 'pad') { vx += d.x; vy += d.y; }
      if (vx || vy) {
        const m = Math.hypot(vx, vy) || 1;
        P.tx += vx / m * 270 * dt; P.ty += vy / m * 270 * dt;
      }
      P.tx = clamp(P.tx, 26, VW - 26); P.ty = clamp(P.ty, VH * 0.3, VH - 46);
    }
    const k = Math.min(1, dt * 20);
    P.x += (P.tx - P.x) * k; P.y += (P.ty - P.y) * k;
  }

  // ---------- Pickups ----------
  function updatePickups(dt) {
    const P = G.P;
    for (const p of G.pickups) {
      p.t += dt; p.spin += dt * 5;
      const d = dist(p, P);
      if (G.state === 'play' && (d < 110 || G.ending) && p.t > 0.35) {
        const sp = G.ending ? 520 : 420;
        p.vx = (P.x - p.x) / Math.max(1, d) * sp; p.vy = (P.y - p.y) / Math.max(1, d) * sp;
      } else { p.vx *= Math.pow(0.2, dt); p.vy = Math.min(80, p.vy + 260 * dt); }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (G.state === 'play' && d < 24) { p.dead = true; collect(p); }
      if (p.y > VH + 20) p.dead = true;
    }
    G.pickups = G.pickups.filter((p) => !p.dead);
  }
  function collect(p) {
    const P = G.P;
    if (p.type === 'coin') {
      G.coins++; G.score += 5;
      sfx.tone(1320 + (G.coins % 4) * 110, 0.06, 'triangle', 0.035);
    } else if (p.type === 'power') {
      if (P.power < 3) { P.power++; floatText(P.x, P.y - 50, P.power === 3 ? 'כוח מלא!' : 'עוד כוח!', '#FFD23F'); }
      else { G.score += 300; floatText(P.x, P.y - 50, '+300', '#FFD23F'); }
      sfx.power();
    } else if (p.type === 'egg') {
      if (G.lives < G.maxLives) { G.lives++; core.buildLives(); floatText(P.x, P.y - 50, 'ביצה!', '#FFFFFF'); }
      sfx.power();
    }
  }

  // ---------- Roar: clears the screen ----------
  const ROAR_BTN = { x: 42, y: VH - 42, r: 27 };
  function roar() {
    if (G.state !== 'play' || G.roar < 1) return;
    G.roar = 0; G.roarFx = 0.9; G.shake = 0.5; G.flash = 0.35;
    for (const b of G.bullets) { b.dead = true; puff(b.x, b.y); }
    for (const e of G.enemies) if (e.t >= 0 && e.y > -20) hurt(e, 12 * hpK());
    if (G.boss && !G.boss.dead && G.boss.enter <= 0) hurtBoss(G.boss.max * 0.07);
    for (const id of G.P.heads) G.P.open[id] = 2;
    sfx.tone(110, 0.7, 'sawtooth', 0.09, 0, 55); sfx.tone(220, 0.5, 'square', 0.04, 0.05, 90);
  }

  // ---------- Background ----------
  function newMote(anyY) {
    const wd = G.world;
    return { x: rand(0, VW), y: anyY ? rand(0, VH) : wd.moteUp ? VH + 10 : -10, v: wd.streaks ? rand(160, 320) : rand(30, 90) * (wd.moteUp ? -1 : 1),
      vx: rand(-10, 10), r: rand(1.2, 3), c: wd.motes[Math.floor(Math.random() * wd.motes.length)], tw: Math.random() * 6 };
  }
  const CLOUDS = [];
  for (let i = 0; i < 4; i++) CLOUDS.push({ x: rand(0, VW), y: i * 190, s: rand(0.7, 1.2) });

  // ---------- Update ----------
  const held = { left: false, right: false, up: false, down: false };
  function update(dt) {
    G.t += dt;
    for (const k of ['shake', 'flash', 'roarFx']) if (G[k] > 0) G[k] -= dt;
    G.scroll = (G.scroll + dt * (G.state === 'won' ? 90 : 46)) % VH;
    for (const c of CLOUDS) { c.y += dt * 110; if (c.y > VH + 80) { c.y -= VH + 240; c.x = rand(0, VW); c.s = rand(0.7, 1.2); } }
    for (const m of G.motes) { m.y += m.v * dt; m.x += m.vx * dt; m.tw += dt * 4; if (m.y > VH + 12 || m.y < -12) Object.assign(m, newMote(false)); }
    updateParticles(dt);
    for (const f of G.fx) f.t -= dt;
    G.fx = G.fx.filter((f) => f.t > 0);
    if (G.state === 'ready') {
      G.readyT -= dt;
      const k = easeOut(clamp(1 - G.readyT / G.readyMax, 0, 1));
      G.P.y = VH + 80 + (G.P.ty - VH - 80) * Math.min(1, k * 1.4); G.P.x = G.P.tx;
      if (G.readyT <= 0) core.startPlay();
      return;
    }
    if (G.state === 'won') { updateWin(dt); return; }
    updatePlayer(dt);
    if (G.state === 'dying') {
      const P = G.P;
      P.dead += dt; P.y += dt * 140 * P.dead; P.ty = P.y;
      updateEnemies(dt); updateBullets(dt); updateShots(dt);
      return;
    }
    if (G.state !== 'play') return;
    G.playT += dt;
    if (Math.floor(G.playT) !== G.shownSec) { G.shownSec = Math.floor(G.playT); $('#timerNum').textContent = core.fmtTime(G.playT); }
    G.st += dt;
    const sc = G.cfg.script;
    while (G.ev < sc.length && sc[G.ev].t <= G.st) spawnWave(sc[G.ev++]);
    shootHeads(dt);
    updateShots(dt);
    updateEnemies(dt);
    updateBoss(dt);
    if (G.state !== 'play') return;
    updateBullets(dt);
    updatePickups(dt);
    // A normal level ends once the last wave is over: the dragon flies on and the coins left fly to it.
    if (!G.bossFight && G.ev >= sc.length && (G.enemies.length === 0 || G.st > G.cfg.len + 9)) {
      if (!G.ending) { G.ending = true; G.endT = 0; }
      G.endT += dt;
      if (G.endT > 1.1 || !G.pickups.length && G.endT > 0.5) win();
    }
    hud();
  }
  function updateBullets(dt) {
    const P = G.P;
    for (const b of G.bullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > VH + 20 || b.y < -30 || b.x < -20 || b.x > VW + 20) b.dead = true;
      else if (G.state === 'play' && (b.x - P.x) ** 2 + (b.y - P.y) ** 2 < (b.r + 7) ** 2) { b.dead = true; hit(); }
    }
    G.bullets = G.bullets.filter((b) => !b.dead);
  }

  // ---------- Win ----------
  const CONFETTI = ['#FFD23F', '#5CCB5F', '#FF8FA3', '#4FC3F7', '#8E5BD9', '#FF9F1C'];
  function win() {
    if (G.state === 'won') return;
    G.state = 'won'; G.winT = 0;
    for (const b of G.bullets) puff(b.x, b.y);
    G.bullets = [];
    for (const e of G.enemies) { boom(e.x, e.y, e.r * 0.6); }
    G.enemies = [];
    for (const p of G.pickups) if (p.type === 'coin') G.coins++;
    G.pickups = [];
    held.left = held.right = held.up = held.down = false;
    if (G.bossFight) {
      sfx.defeat();
      const B = G.boss;
      for (let i = 0; i < BOSS_COINS; i++) G.coins++;
      G.score += 1000;
      if (B) for (let i = 0; i < BOSS_COINS; i++) G.particles.push({ coin: true, x: B.x, y: B.y, vx: rand(-160, 160), vy: rand(-260, -60), life: 1.4, max: 1.4, spin: rand(0, 6) });
    }
    sfx.win();
    const pct = G.spawned ? G.kills / G.spawned * 100 : 100;
    const done = (pct >= KILL_PCT ? 1 : 0) | (G.coins >= G.cfg.coinGoal ? 2 : 0) | (G.lives >= G.maxLives ? 4 : 0);
    hud(true);
    core.finishWin(clamp(G.lives, 1, 3), done, G.bossFight ? 2800 : 2200);
  }
  function updateWin(dt) {
    G.winT += dt;
    const P = G.P, B = G.boss;
    if (B && G.bossFight) {
      if (G.winT < 1.2 && Math.random() < 0.5) boom(B.x + rand(-50, 50), B.y + rand(-40, 40), 14);
      if (!G.bossPopped && G.winT > 1.2) {
        G.bossPopped = true; G.shake = 0.5;
        boom(B.x, B.y, 60);
        sfx.tone(70, 0.45, 'sawtooth', 0.1, 0, 35);
        floatText(B.x, B.y + 40, 'ניצחת את הבוס!', '#FFD23F');
      }
    }
    // The dragon takes a lap of honour: up and out of the top.
    const flyAt = G.bossFight ? 1.6 : 0.4;
    if (G.winT > flyAt) { P.y -= dt * 260 * Math.min(1, (G.winT - flyAt) * 1.5); P.ty = P.y; }
    for (const id of P.heads) P.open[id] = Math.max(0, (P.open[id] || 0) - dt * 3);
    if (!G.confettiDone && G.winT > (G.bossFight ? 1.6 : 0.8)) {
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
  function floatText(x, y, text, color) { G.particles.push({ x, y, vx: 0, vy: -40, life: 1.3, max: 1.3, color, text }); }
  function updateParticles(dt) {
    for (const q of G.particles) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.conf) { q.rot += q.vr * dt; q.sway += dt * 4; q.x += Math.sin(q.sway) * 30 * dt; }
      else if (q.coin) { q.vy += 420 * dt; q.spin += dt * 8; }
      else if (q.drag) { q.vx *= Math.pow(0.05, dt); q.vy *= Math.pow(0.05, dt); }
      else if (!q.text && !q.bubble) q.vy += 160 * dt;
    }
    G.particles = G.particles.filter((q) => q.life > 0);
    if (G.particles.length > 420) G.particles.splice(0, G.particles.length - 420);
  }

  // ---------- HUD ----------
  function hud(force) {
    const B = G.boss;
    const pct = Math.min(100, Math.round(G.st / Math.max(1, G.cfg.len) * 100));
    const key = G.bossFight ? `b${B ? Math.ceil(5 * B.hp / B.max) : 5}|${B ? Math.round(B.hp / B.max * 100) : 100}` : `n${pct}`;
    if (!force && key === G.hudKey) return;
    G.hudKey = key;
    $('.meter').classList.toggle('boss', G.bossFight);
    if (G.bossFight) {
      $('#levelName').textContent = 'בוס!';
      const left = B ? B.hp / B.max : 1, hearts = Math.ceil(5 * left);
      $('#meterFill').style.width = `${left * 100}%`;
      $('#meterNum').innerHTML = [...Array(5)].map((_, i) => `<span class="${i < hearts ? 'on' : 'off'}">♥</span>`).join('')
        + `<div class="boss-pct">${BOSSES[G.w].name}</div>`;
      return;
    }
    $('#levelName').textContent = `שלב ${G.l + 1}`;
    $('#meterFill').style.width = `${pct}%`;
    $('#meterGoal').style.insetInlineStart = 'calc(100% - 3px)';
    $('#meterNum').innerHTML = `🏁 <bdi>${pct}%</bdi>`;
  }

  // ---------- Render ----------
  function render() {
    const c = ctx;
    c.setTransform(RES, 0, 0, RES, 0, 0);
    if (G.shake > 0) c.translate(rand(-4, 4) * G.shake * 2, rand(-4, 4) * G.shake * 2);
    // ground far below, scrolling down
    if (tileCv) {
      const y = Math.round(G.scroll * RES) / RES;
      c.drawImage(tileCv, 0, y - VH, VW, VH);
      c.drawImage(tileCv, 0, y, VW, VH);
    }
    drawMotes(c);
    for (const p of G.pickups) drawPickup(c, p);
    for (const e of G.enemies) if (e.t >= 0) drawEnemy(c, e);
    if (G.boss && !(G.bossPopped)) drawBossLive(c);
    for (const g of G.gusts) drawGust(c, g);
    for (const s of G.shots) drawShot(c, s);
    drawHydraLive(c);
    for (const b of G.bullets) drawBullet(c, b);
    drawFx(c);
    drawClouds(c);
    drawParticles(c);
    drawUI(c);
    if (G.flash > 0) { c.fillStyle = `rgba(255,255,255,${G.flash * 0.9})`; c.fillRect(-10, -10, VW + 20, VH + 20); }
  }
  function drawMotes(c) {
    for (const m of G.motes) {
      c.globalAlpha = 0.5 + Math.sin(m.tw) * 0.3;
      c.fillStyle = m.c;
      if (G.world.streaks) c.fillRect(m.x, m.y, 1.6, m.r * 6);
      else { c.beginPath(); c.arc(m.x, m.y, m.r, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  function drawClouds(c) {
    if (G.world.streaks) return;
    c.fillStyle = 'rgba(255,255,255,.16)';
    for (const k of CLOUDS) {
      c.beginPath();
      for (const [dx, dy, r] of [[0, 0, 34], [36, -12, 42], [76, 0, 32], [38, 14, 34]]) { c.moveTo(k.x + dx * k.s + r * k.s, k.y + dy * k.s); c.arc(k.x + dx * k.s, k.y + dy * k.s, r * k.s, 0, TAU); }
      c.fill();
    }
  }
  function drawHydraLive(c) {
    const P = G.P;
    if (G.state === 'dying' && P.dead > 1.5) return;
    if (P.inv > 0 && G.state === 'play' && Math.floor(P.inv * 12) % 2 === 0) c.globalAlpha = 0.35;
    // a soft shadow on the ground below
    c.fillStyle = 'rgba(20,12,36,.22)';
    c.beginPath(); c.ellipse(P.x + 22, P.y + 60, 30, 9, 0, 0, TAU); c.fill();
    drawHydra(c, P.x, P.y, P.heads, G.t, { open: P.open, roar: G.roarFx > 0, spin: G.state === 'dying' ? P.dead * 5 : 0 });
    c.globalAlpha = 1;
  }

  // The monster: a round furry body with little fluffy wings, and a neck with a head for every power it has.
  function fuzz(c, cx, cy, rx, ry, n, bump) {
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 0.5) / n) * TAU, a2 = ((i + 1) / n) * TAU;
      const p = (a, k) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
      if (i === 0) c.moveTo(...p(a0, 1));
      if (i < n) c.quadraticCurveTo(...p(a1, 1 + bump), ...p(a2, 1));
    }
    c.closePath();
  }
  function drawHydra(c, x, y, heads, t, o) {
    c.save(); c.translate(x, y);
    if (o.spin) c.rotate(o.spin);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    const flap = Math.sin(t * 16);
    // a short fuzzy tail
    const tw = Math.sin(t * 3);
    c.beginPath(); c.moveTo(0, 30); c.quadraticCurveTo(10 + tw * 5, 44, 2 + tw * 7, 52);
    c.lineWidth = 13; c.stroke(); c.strokeStyle = BODY.c; c.lineWidth = 7; c.stroke();
    c.beginPath(); c.arc(2 + tw * 7, 54, 6, 0, TAU); c.fillStyle = BODY.wing; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    // little fluffy wings that buzz fast
    for (const sd of [-1, 1]) {
      c.save(); c.translate(sd * 22, 4); c.rotate(sd * (-0.5 + flap * 0.35)); c.scale(sd, 1);
      c.beginPath();
      c.moveTo(0, 6); c.quadraticCurveTo(10, -20, 30, -16); c.quadraticCurveTo(36, -8, 28, -4);
      c.quadraticCurveTo(34, 2, 24, 6); c.quadraticCurveTo(26, 12, 14, 12); c.closePath();
      c.fillStyle = BODY.wing; c.fill(); c.lineWidth = 3.5; c.stroke();
      c.beginPath(); c.moveTo(4, 4); c.quadraticCurveTo(14, -6, 26, -10); c.strokeStyle = BODY.wingIn; c.lineWidth = 2.5; c.stroke();
      c.strokeStyle = INK; c.restore();
    }
    // necks
    const n = heads.length, slots = headSlots(n), pos = [];
    heads.forEach((id, k) => {
      const a = slots[k] + Math.sin(t * 2.6 + k * 1.7) * 0.06, len = neckLen(a, n);
      const bx = Math.sin(a) * 9, by = -6, hx = bx + Math.sin(a) * len, hy = by - Math.cos(a) * len;
      pos.push([hx, hy, a]);
      c.beginPath(); c.moveTo(bx * 0.7, 6); c.quadraticCurveTo(bx + Math.sin(a) * len * 0.3, by - len * 0.45, hx, hy);
      c.strokeStyle = INK; c.lineWidth = 15; c.stroke();
      c.strokeStyle = HEADS[id].dark; c.lineWidth = 9; c.stroke();
    });
    c.strokeStyle = INK;
    // body: round and furry
    fuzz(c, 0, 12, 25, 24, 14, 0.1);
    c.fillStyle = BODY.c; c.fill(); c.lineWidth = 4; c.stroke();
    fuzz(c, 0, 17, 14, 14, 9, 0.12); c.fillStyle = BODY.belly; c.fill();
    c.fillStyle = BODY.dark;
    for (const [sx, sy, r] of [[-15, 2, 3], [16, 6, 2.5], [-12, 26, 2.2], [14, 24, 3]]) { c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.fill(); }
    // little arms and feet
    for (const sd of [-1, 1]) {
      c.beginPath(); c.ellipse(sd * 22, 18, 5, 7, sd * -0.5, 0, TAU); c.fillStyle = BODY.c; c.fill(); c.lineWidth = 3; c.stroke();
      c.beginPath(); c.ellipse(sd * 12, 36, 7, 5, sd * 0.3, 0, TAU); c.fillStyle = BODY.dark; c.fill(); c.stroke();
      c.fillStyle = '#FFFFFF';
      for (const k of [-3, 0, 3]) { c.beginPath(); c.arc(sd * 12 + k, 39.5, 1.3, 0, TAU); c.fill(); }
    }
    // heads (the middle ones last, so they sit on top)
    const order = heads.map((_, k) => k).sort((i, j) => Math.abs(pos[j][2]) - Math.abs(pos[i][2]));
    for (const k of order) {
      const id = heads[k], [hx, hy, a] = pos[k];
      drawHead(c, id, hx, hy, HEAD_R, t + k, o.roar ? 1 : (o.open && o.open[id]) || 0, a);
    }
    c.restore();
  }
  // One head, looking up: snout on top, eyes below it, and its element's horns on the sides.
  function drawHead(c, id, x, y, r, t, open, a) {
    const H = HEADS[id];
    c.save(); c.translate(x, y); c.rotate(a * 0.5);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const lw = Math.max(2.5, r * 0.26);
    c.lineWidth = lw; c.strokeStyle = INK;
    // horns behind the head
    for (const sd of [-1, 1]) {
      c.save(); c.translate(sd * r * 0.82, r * 0.05); c.scale(sd, 1);
      c.beginPath();
      if (id === 'fire') { c.moveTo(-r * 0.1, -r * 0.3); c.quadraticCurveTo(r * 0.75, -r * 0.35, r * 0.62, -r * 1.05); c.quadraticCurveTo(r * 0.3, -r * 0.5, r * 0.05, r * 0.35); c.fillStyle = '#FFD23F'; }
      else if (id === 'ice') { c.moveTo(0, -r * 0.35); c.lineTo(r * 0.75, -r * 0.95); c.lineTo(r * 0.2, r * 0.3); c.fillStyle = '#E6F7FF'; }
      else if (id === 'poison') { c.arc(r * 0.18, -r * 0.2, r * 0.36, 0, TAU); c.fillStyle = '#B07CE8'; }
      else if (id === 'bolt') { c.moveTo(0, -r * 0.2); c.lineTo(r * 0.6, -r * 0.55); c.lineTo(r * 0.38, -r * 0.2); c.lineTo(r * 0.85, -r * 0.4); c.lineTo(r * 0.2, r * 0.3); c.fillStyle = '#FFF6C9'; }
      else if (id === 'wind') { c.moveTo(0, -r * 0.1); c.quadraticCurveTo(r * 0.8, -r * 0.4, r * 0.7, -r * 0.95); c.quadraticCurveTo(r * 0.35, -r * 0.8, r * 0.48, -r * 0.55); c.quadraticCurveTo(r * 0.3, -r * 0.1, r * 0.05, r * 0.3); c.fillStyle = '#FFFFFF'; }
      else { c.moveTo(0, -r * 0.3); c.lineTo(r * 0.5, -r * 0.9); c.lineTo(r * 0.3, r * 0.2); c.fillStyle = '#FFE3F0'; }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    // head
    c.beginPath(); c.ellipse(0, r * 0.08, r * 1.02, r, 0, 0, TAU);
    c.fillStyle = H.c; c.fill(); c.stroke();
    // snout
    c.beginPath(); c.ellipse(0, -r * 0.55, r * 0.72, r * 0.5, 0, 0, TAU);
    c.fillStyle = H.light; c.fill(); c.stroke();
    if (open > 0) {
      const m = Math.min(1, open);
      c.beginPath(); c.ellipse(0, -r * 0.78, r * 0.38 * (0.6 + 0.4 * m), r * 0.26 * m + 0.5, 0, 0, TAU);
      c.fillStyle = '#7A1F3D'; c.fill();
    }
    c.fillStyle = INK;
    for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * r * 0.25, -r * 0.42, r * 0.08, 0, TAU); c.fill(); }
    // eyes, looking up
    for (const sd of [-1, 1]) {
      c.beginPath(); c.arc(sd * r * 0.42, r * 0.18, r * 0.3, 0, TAU);
      c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = lw * 0.8; c.stroke();
      c.beginPath(); c.arc(sd * r * 0.4, r * 0.1, r * 0.16, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.arc(sd * r * 0.34, r * 0.05, r * 0.06, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
    }
    // cheeks and marks
    c.fillStyle = 'rgba(255,120,150,.45)';
    for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * r * 0.68, r * 0.55, r * 0.17, r * 0.11, 0, 0, TAU); c.fill(); }
    if (id === 'poison') {
      c.fillStyle = H.dark;
      for (const [sx, sy, sr] of [[-0.15, 0.72, 0.12], [0.2, 0.8, 0.09], [0.0, 0.55, 0.07]]) { c.beginPath(); c.arc(sx * r, sy * r, sr * r, 0, TAU); c.fill(); }
    } else if (id === 'star') {
      starPath(c, 0, r * 0.64, r * 0.2, r * 0.09, 5); c.fillStyle = '#FFFFFF'; c.fill();
    } else if (id === 'fire') {
      c.beginPath(); c.moveTo(-r * 0.15, r * 0.95); c.quadraticCurveTo(0, r * 0.5, r * 0.15, r * 0.95); c.fillStyle = '#FFD23F'; c.fill();
    }
    c.restore();
  }
  function starPath(c, x, y, R, r, n) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = i * Math.PI / n - Math.PI / 2, rr = i % 2 ? r : R;
      if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  // ---------- Shots ----------
  function drawShot(c, s) {
    c.save(); c.translate(s.x, s.y);
    c.lineWidth = 2; c.strokeStyle = INK;
    if (s.id === 'fire') {
      c.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      c.beginPath(); c.moveTo(0, -7); c.quadraticCurveTo(5, 1, 0, 8); c.quadraticCurveTo(-5, 1, 0, -7);
      c.fillStyle = '#FF9F1C'; c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, 1, 2, 3.5, 0, 0, TAU); c.fillStyle = '#FFF6C9'; c.fill();
    } else if (s.id === 'ice') {
      c.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      c.beginPath(); c.moveTo(0, -8); c.lineTo(4, 0); c.lineTo(0, 7); c.lineTo(-4, 0); c.closePath();
      c.fillStyle = '#BDEBFF'; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(0, -5); c.lineTo(1.5, 0); c.lineTo(0, 3); c.fillStyle = '#FFFFFF'; c.fill();
    } else if (s.id === 'poison') {
      const r = s.r || 6;
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = '#7ED957'; c.fill(); c.stroke();
      c.beginPath(); c.arc(-r * 0.35, -r * 0.35, r * 0.3, 0, TAU); c.fillStyle = '#E3FFD0'; c.fill();
    } else if (s.id === 'star') {
      c.rotate(s.spin);
      starPath(c, 0, 0, 8, 3.6, 5); c.fillStyle = '#FF8FC8'; c.fill(); c.stroke();
      c.beginPath(); c.arc(0, 0, 2, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
    }
    c.restore();
  }
  function drawGust(c, g) {
    const k = clamp(g.life / 0.85, 0, 1);
    c.save(); c.translate(g.x, g.y);
    c.globalAlpha = 0.35 + 0.5 * k;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-g.w / 2, 8); c.quadraticCurveTo(0, -14, g.w / 2, 8);
    c.strokeStyle = INK; c.lineWidth = 7; c.stroke();
    c.strokeStyle = '#E6FFFB'; c.lineWidth = 4; c.stroke();
    c.beginPath(); c.moveTo(-g.w / 3, 16); c.quadraticCurveTo(0, 2, g.w / 3, 16);
    c.strokeStyle = '#8FE3D9'; c.lineWidth = 3; c.stroke();
    c.restore();
    c.globalAlpha = 1;
  }
  function drawBullet(c, b) {
    const pulse = 1 + Math.sin(b.t * 16) * 0.08;
    c.beginPath(); c.arc(b.x, b.y, (b.r + 3) * pulse, 0, TAU); c.fillStyle = 'rgba(255,61,127,.28)'; c.fill();
    c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fillStyle = '#FF3D7F'; c.fill();
    c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.42, 0, TAU); c.fillStyle = '#FFE3EE'; c.fill();
  }
  function drawFx(c) {
    for (const f of G.fx) {
      const k = f.t / f.max;
      if (f.type === 'ring') {
        c.beginPath(); c.arc(f.x, f.y, f.r + f.grow * (1 - k), 0, TAU);
        c.strokeStyle = `rgba(255,236,170,${k})`; c.lineWidth = 4 * k + 1; c.stroke();
      } else if (f.type === 'cloud') {
        c.fillStyle = `rgba(140,230,100,${0.35 * k})`;
        c.beginPath(); c.arc(f.x, f.y, 46 * (1.2 - k * 0.4), 0, TAU); c.fill();
      } else if (f.type === 'bolt') {
        const rnd = mulberry(Math.floor(f.seed + f.t * 60));
        c.beginPath();
        f.pts.forEach((p, i) => {
          if (i === 0) { c.moveTo(p.x, p.y); return; }
          const q = f.pts[i - 1];
          for (let s = 1; s <= 4; s++) {
            const u = s / 4, jx = s < 4 ? (rnd() - 0.5) * 18 : 0, jy = s < 4 ? (rnd() - 0.5) * 18 : 0;
            c.lineTo(q.x + (p.x - q.x) * u + jx, q.y + (p.y - q.y) * u + jy);
          }
        });
        c.globalAlpha = Math.min(1, k * 2);
        c.strokeStyle = INK; c.lineWidth = 6; c.lineJoin = 'round'; c.stroke();
        c.strokeStyle = '#FFE95C'; c.lineWidth = 3.5; c.stroke();
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.4; c.stroke();
        c.globalAlpha = 1;
      }
    }
    if (G.roarFx > 0) {
      const k = 1 - G.roarFx / 0.9;
      c.beginPath(); c.arc(G.P.x, G.P.y - 20, 40 + k * 520, 0, TAU);
      c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; c.lineWidth = 14 * (1 - k) + 2; c.stroke();
    }
  }
  function drawPickup(c, p) {
    c.save(); c.translate(p.x, p.y);
    if (p.type === 'coin') drawCoin(c, 0, 0, 6.5, p.spin);
    else if (p.type === 'power') {
      const b = 1 + Math.sin(p.t * 8) * 0.08;
      c.scale(b, b);
      c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fillStyle = 'rgba(255,210,63,.3)'; c.fill();
      c.beginPath(); c.moveTo(0, -12); c.lineTo(11, -2); c.lineTo(7, 11); c.lineTo(-7, 11); c.lineTo(-11, -2); c.closePath();
      c.fillStyle = '#FF6FA8'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
      c.beginPath(); c.moveTo(-5, 3); c.lineTo(0, -3); c.lineTo(5, 3); c.moveTo(-5, 8); c.lineTo(0, 2); c.lineTo(5, 8);
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5; c.lineCap = 'round'; c.stroke();
    } else if (p.type === 'egg') {
      c.rotate(Math.sin(p.t * 5) * 0.25);
      c.drawImage(sprite('egg', 22, 27), -11, -13.5, 22, 27);
    }
    c.restore();
  }
  function drawCoin(c, x, y, r, spin) {
    const sx = Math.max(0.2, Math.abs(Math.cos(spin)));
    c.save(); c.translate(x, y); c.scale(sx, 1);
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = '#FFD23F'; c.fill();
    c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.strokeStyle = '#E0A800'; c.lineWidth = 1.6; c.stroke();
    c.restore();
  }
  function drawParticles(c) {
    for (const q of G.particles) {
      const a = clamp(q.life / q.max, 0, 1);
      c.globalAlpha = q.conf ? Math.min(1, q.life) : a;
      if (q.text) {
        c.font = '700 20px Fredoka, Rubik, sans-serif'; c.textAlign = 'center';
        c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(q.text, q.x, q.y);
        c.fillStyle = q.color; c.fillText(q.text, q.x, q.y);
      } else if (q.conf) {
        c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.fillStyle = q.color; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore();
      } else if (q.coin) {
        drawCoin(c, q.x, q.y, 6, q.spin);
      } else if (q.bubble) {
        c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.strokeStyle = q.color; c.lineWidth = 1.5; c.stroke();
      } else {
        c.fillStyle = q.color;
        c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
  // On the board: the roar button (bottom left), the power level and the coins (top).
  function drawUI(c) {
    const b = ROAR_BTN, full = G.roar >= 1, pulse = full ? 1 + Math.sin(G.t * 8) * 0.06 : 1;
    c.save(); c.translate(b.x, b.y); c.scale(pulse, pulse);
    if (full) { c.beginPath(); c.arc(0, 0, b.r + 9, 0, TAU); c.fillStyle = 'rgba(255,210,63,.35)'; c.fill(); }
    c.beginPath(); c.arc(0, 0, b.r, 0, TAU); c.fillStyle = full ? '#FFD23F' : 'rgba(43,27,61,.65)'; c.fill();
    c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    if (!full) {
      c.beginPath(); c.arc(0, 0, b.r - 5, -Math.PI / 2, -Math.PI / 2 + TAU * G.roar);
      c.strokeStyle = '#FFD23F'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke();
    }
    c.globalAlpha = full ? 1 : 0.7;
    drawHead(c, 'fire', 0, 3, 11, G.t, full ? 1 : 0.2, 0);
    c.globalAlpha = 1;
    c.font = '700 13px Fredoka, Rubik, sans-serif'; c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = INK;
    const label = full ? 'שאגה!' : 'שאגה';
    c.strokeText(label, 0, -b.r - 6); c.fillStyle = full ? '#FFD23F' : '#FFFFFF'; c.fillText(label, 0, -b.r - 6);
    c.restore();
    // power pips
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.arc(82 + i * 16, VH - 30, 5.5, 0, TAU);
      c.fillStyle = i < G.P.power ? '#FF6FA8' : 'rgba(43,27,61,.55)'; c.fill();
      c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    }
    // coins
    drawCoin(c, VW - 64, 20, 8, 0);
    c.font = '700 17px Fredoka, Rubik, sans-serif'; c.textAlign = 'left';
    c.lineWidth = 4; c.strokeStyle = INK;
    const txt = `${G.coins}`;
    c.strokeText(txt, VW - 52, 26); c.fillStyle = G.coins >= G.cfg.coinGoal ? '#FFD23F' : '#FFFFFF'; c.fillText(txt, VW - 52, 26);
  }

  // ---------- Enemies, drawn ----------
  function drawEnemy(c, e) {
    c.save(); c.translate(e.x, e.y);
    c.scale(e.size, e.size);
    if (e.rot) c.rotate(e.rot);
    const P = DRAGONS[G.w];
    if (e.kind === 'spit') { c.scale(1.22, 1.22); drawDragon(c, e.anim, P, G.w, { angry: true, open: e.shootT < 0.35 ? 1 : 0 }); }
    else drawDragon(c, e.anim, P, G.w, {});
    c.restore();
    if (e.flash > 0 || e.slow > 0) {
      c.beginPath(); c.arc(e.x, e.y, e.r * 0.95, 0, TAU);
      c.fillStyle = e.flash > 0 ? 'rgba(255,255,255,.6)' : 'rgba(150,220,255,.38)'; c.fill();
    }
    if (e.tank && e.hp < e.maxHp) {
      const w = 44;
      c.fillStyle = INK; c.fillRect(e.x - w / 2 - 2, e.y - e.r - 12, w + 4, 8);
      c.fillStyle = '#FF6B7A'; c.fillRect(e.x - w / 2, e.y - e.r - 10, w * e.hp / e.maxHp, 4);
    }
  }
  // Every world has its own dragons: the same family of shapes in the world's colours,
  // with the world's mark on the tail (a flame, a leaf, a fin, an icicle, a star).
  const DRAGONS = [
    { c: '#E8553D', dark: '#B83B2E', belly: '#FFD08A', wing: '#FF9F1C', horn: '#FFE0A8' },
    { c: '#3FA244', dark: '#2B6E30', belly: '#D9F59A', wing: '#7ED957', horn: '#FFE29A' },
    { c: '#2A8FD0', dark: '#1B5E9E', belly: '#B8F2EA', wing: '#4FC3F7', horn: '#E6F7FF' },
    { c: '#9FDCF5', dark: '#5B9FCC', belly: '#FFFFFF', wing: '#E6F7FF', horn: '#3E8FD0' },
    { c: '#5B3E9E', dark: '#3A2670', belly: '#D8C2FF', wing: '#B07CE8', horn: '#FFD23F' },
  ];
  function fillStroke(c, fill) { c.fillStyle = fill; c.fill(); c.stroke(); }
  // A dragon flying down at you: tail up top, wings out, head at the bottom. About 50 wide.
  function drawDragon(c, t, P, w, o) {
    const k = o.lw || 1, f = Math.sin(t * (o.boss ? 6 : 13));
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    // tail
    const sw = Math.sin(t * 3), tx = Math.sin(t * 3 + 1) * 5, ty = -27;
    c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(sw * 8, -18, tx, ty);
    c.lineWidth = 7 * k; c.stroke(); c.lineWidth = 7 * k - 3.4 * k; c.strokeStyle = P.c; c.stroke();
    c.strokeStyle = INK; c.lineWidth = 2.2 * k;
    c.save(); c.translate(tx, ty); c.rotate(sw * 0.3);
    c.beginPath();
    if (w === 0) { c.moveTo(0, -9); c.quadraticCurveTo(5, -2, 3, 3); c.quadraticCurveTo(0, 5, -3, 3); c.quadraticCurveTo(-5, -2, 0, -9); fillStroke(c, '#FFD23F'); }
    else if (w === 1) { c.ellipse(0, -4, 3.6, 6, 0, 0, TAU); fillStroke(c, '#7ED957'); c.beginPath(); c.moveTo(0, 1); c.lineTo(0, -8); c.stroke(); }
    else if (w === 2) { c.moveTo(0, 0); c.lineTo(-6, -7); c.lineTo(6, -7); c.closePath(); fillStroke(c, P.wing); }
    else if (w === 3) { c.moveTo(0, -9); c.lineTo(3.5, -2); c.lineTo(0, 2); c.lineTo(-3.5, -2); c.closePath(); fillStroke(c, '#E6F7FF'); }
    else { for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 2.3 : 5.5; i ? c.lineTo(Math.cos(a) * r, -3 + Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, -3 + Math.sin(a) * r); } c.closePath(); fillStroke(c, '#FFD23F'); }
    c.restore();
    // wings
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * 5, -4);
      c.quadraticCurveTo(sd * 14, -17 - f * 6, sd * 25, -11 - f * 7);
      c.lineTo(sd * 21, -3 - f * 3); c.quadraticCurveTo(sd * 17, -4, sd * 15, 1);
      c.quadraticCurveTo(sd * 11, -1, sd * 7, 4); c.closePath();
      c.lineWidth = 2.4 * k; fillStroke(c, P.wing);
      c.beginPath(); c.moveTo(sd * 6, -3); c.lineTo(sd * 21, -9 - f * 5); c.strokeStyle = P.dark; c.lineWidth = 1.6 * k; c.stroke(); c.strokeStyle = INK;
    }
    // body, with spikes down the back
    c.lineWidth = 2.4 * k;
    for (const y of [-9, -4]) { c.beginPath(); c.moveTo(-2.4, y + 1); c.lineTo(0, y - 3.5); c.lineTo(2.4, y + 1); fillStroke(c, P.horn); }
    c.beginPath(); c.ellipse(0, -1, 8.5, 9.5, 0, 0, TAU); fillStroke(c, P.c);
    c.beginPath(); c.ellipse(0, 0.5, 4.6, 6.2, 0, 0, TAU); c.fillStyle = P.belly; c.fill();
    // horns (fins for sea dragons)
    for (const sd of [-1, 1]) {
      c.beginPath();
      if (w === 2) { c.moveTo(sd * 4, 6); c.lineTo(sd * 10.5, 2); c.lineTo(sd * 7.5, 10); }
      else if (w === 3) { c.moveTo(sd * 3, 4); c.lineTo(sd * 9, -2.5); c.lineTo(sd * 6.5, 6.5); }
      else if (o.boss) { c.moveTo(sd * 3, 4.5); c.quadraticCurveTo(sd * 10, 2, sd * 11, -5); c.quadraticCurveTo(sd * 10, 5, sd * 6.5, 7.5); }
      else { c.moveTo(sd * 3, 4.5); c.quadraticCurveTo(sd * 8, 3, sd * 8.5, -1); c.quadraticCurveTo(sd * 8.5, 5, sd * 6.5, 7); }
      c.closePath(); fillStroke(c, P.horn);
    }
    if (w === 1) { c.beginPath(); c.ellipse(0, 2.6, 2.4, 4, 0, 0, TAU); fillStroke(c, '#7ED957'); }
    // head
    c.beginPath(); c.ellipse(0, 9, 7.4, 6.8, 0, 0, TAU); fillStroke(c, P.c);
    c.beginPath(); c.ellipse(0, 13, 5, 3.5, 0, 0, TAU); fillStroke(c, P.belly);
    c.fillStyle = INK;
    for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 1.8, 14, 0.75, 0, TAU); c.fill(); }
    if (o.open) { c.beginPath(); c.ellipse(0, 16, 3, 1.9, 0, 0, TAU); c.fillStyle = '#7A1F3D'; c.fill(); }
    if (o.boss) {
      c.fillStyle = '#FFFFFF';
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 3.6, 15); c.lineTo(sd * 2.6, 17.6); c.lineTo(sd * 1.6, 15.6); c.closePath(); c.fill(); }
    }
    for (const sd of [-1, 1]) {
      c.beginPath(); c.arc(sd * 3.2, 7.6, 2.4, 0, TAU); c.fillStyle = o.boss ? '#FFE95C' : '#FFFFFF'; c.fill(); c.lineWidth = 1.4 * k; c.stroke();
      c.beginPath(); c.arc(sd * 3.1, 8.3, 1.25, 0, TAU); c.fillStyle = INK; c.fill();
      if (o.angry) { c.beginPath(); c.moveTo(sd * 5.8, 4.6); c.lineTo(sd * 1.2, 6.2); c.lineWidth = 1.6 * k; c.stroke(); }
    }
  }
  function crown(c, x, y, w) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -w * 0.5); c.lineTo(-w / 4, -w * 0.22); c.lineTo(0, -w * 0.62); c.lineTo(w / 4, -w * 0.22);
    c.lineTo(w / 2, -w * 0.5); c.lineTo(w / 2, 0); c.closePath();
    c.fillStyle = '#FFD23F'; c.fill(); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, -w * 0.15, w * 0.09, 0, TAU); c.fillStyle = '#FF6B7A'; c.fill(); c.lineWidth = 2; c.stroke();
    c.restore();
  }
  // The boss: a huge crowned dragon of the world.
  function drawBoss(c, w, t, B) {
    c.save(); c.scale(3.3, 3.3);
    drawDragon(c, t * 0.8, DRAGONS[w], w, { boss: true, angry: true, open: B && B.act ? 1 : 0, lw: 0.55 });
    c.restore();
  }
  function drawBossLive(c) {
    const B = G.boss;
    c.save(); c.translate(B.x, B.y);
    if (B.charge && B.charge.t < 0.8) {
      // the warning before a dive: a red stripe where it will come down
      c.save(); c.translate(B.charge.tx - B.x, 0);
      c.fillStyle = `rgba(255,80,110,${0.18 + 0.12 * Math.sin(B.charge.t * 30)})`;
      c.fillRect(-46, 30, 92, VH * 0.6);
      c.restore();
    }
    drawBoss(c, G.w, G.t, B);
    if (B.flash > 0) { c.beginPath(); c.arc(0, 0, B.r, 0, TAU); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill(); }
    c.restore();
  }

  // ---------- Title screen: the heads instead of the dinos ----------
  let shownHead = 'fire';
  function buildTitle() {
    const r = rec('hydra'), box = $('#chars');
    box.innerHTML = '';
    HEAD_ORDER.forEach((id, i) => {
      const open = id === 'fire' || r.unlocked.includes(id);
      const b = document.createElement('button');
      b.className = `char head${open ? '' : ' locked'}${shownHead === id ? ' sel' : ''}`;
      b.setAttribute('aria-label', open ? HEADS[id].name : `נעול, נפתח אחרי עולם ${i}`);
      b.innerHTML = `<img src="${headURL(id)}" alt="">${open ? '' : '<span class="lock">🔒</span>'}`;
      b.addEventListener('click', () => {
        sfx.init(); sfx.tap();
        shownHead = id; buildTitle();
        if (!open) $('#charPerk').textContent = `${HEADS[id].name} גדל אחרי עולם ${i}`;
      });
      box.appendChild(b);
    });
    const H = HEADS[shownHead], open = shownHead === 'fire' || r.unlocked.includes(shownHead);
    $('#charPerk').textContent = open ? `${H.name}: ${H.perk}` : `${H.name} גדל אחרי עולם ${HEAD_ORDER.indexOf(shownHead)}`;
  }
  function paintHero(cv2, t) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = cv2.clientWidth || 200, chh = cv2.clientHeight || 200;
    if (cv2.width !== Math.round(cw * dpr) || cv2.height !== Math.round(chh * dpr)) { cv2.width = Math.round(cw * dpr); cv2.height = Math.round(chh * dpr); }
    const c = cv2.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv2.width, cv2.height);
    const s = Math.min(cw / 150, chh / 135);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * cw / 2, dpr * (chh * 0.58));
    const heads = headsList(), open = {};
    heads.forEach((id, k) => { open[id] = Math.max(0, Math.sin(t * 3 - k * 0.8)) * 0.8; });
    drawHydra(c, 0, 0, heads, t, { open });
  }

  // ---------- Controls ----------
  // Touch: drag anywhere and the dragon moves with the finger (it doesn't jump under it).
  // A tap on the roar button (or two quick taps anywhere) roars when it's full.
  const sw = { id: null };
  const wrap = $('#boardWrap');
  const toBoard = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH, k: VW / r.width }; };
  let lastTap = 0;
  const playing = () => G && G.mode === 'hydra' && G.state === 'play' && !core.isPaused();
  wrap.addEventListener('pointerdown', (e) => {
    if (!G || G.mode !== 'hydra' || e.target.closest('button, .overlay')) return;
    core.skipIntro();
    if (!playing()) return;
    sfx.init();
    const p = toBoard(e);
    if (G.roar >= 1 && Math.hypot(p.x - ROAR_BTN.x, p.y - ROAR_BTN.y) < ROAR_BTN.r + 14) { roar(); return; }
    Object.assign(sw, { id: e.pointerId, cx: e.clientX, cy: e.clientY, px: G.P.tx, py: G.P.ty, k: p.k * 1.2, t: e.timeStamp, moved: 0 });
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sw.id || !playing()) return;
    const dx = e.clientX - sw.cx, dy = e.clientY - sw.cy;
    sw.moved = Math.max(sw.moved, Math.hypot(dx, dy));
    G.P.tx = clamp(sw.px + dx * sw.k, 26, VW - 26);
    G.P.ty = clamp(sw.py + dy * sw.k, VH * 0.3, VH - 46);
    // If the finger pushes past an edge, start counting from there, so coming back moves right away.
    sw.px = G.P.tx - dx * sw.k; sw.py = G.P.ty - dy * sw.k;
  });
  const swEnd = (e) => {
    if (e.pointerId !== sw.id) return;
    sw.id = null;
    if (!playing() || e.type === 'pointercancel') return;
    if (sw.moved < 12 && e.timeStamp - sw.t < 260) {
      if (e.timeStamp - lastTap < 340) { roar(); lastTap = 0; } else lastTap = e.timeStamp;
    }
  };
  wrap.addEventListener('pointerup', swEnd);
  wrap.addEventListener('pointercancel', swEnd);

  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  function key(e, down) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (down && !e.repeat) { core.skipIntro(); if (playing()) roar(); } return; }
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (down) core.skipIntro();
    held[k] = down;
  }
  function onPause() { held.left = held.right = held.up = held.down = false; sw.id = null; }

  return {
    game: { logo: ['מפלצת', 'הראשים!'], worlds: WORLDS, chals: CHALS, perk: 'perk', goal: goalText, start, bosses: BOSSES, map: MAP,
      prize, buildTitle, paintHero },
    update: (dt) => { G = core.G(); update(dt); },
    render: () => { G = core.G(); render(); },
    resize, key, onPause, HEADS,
  };
};
