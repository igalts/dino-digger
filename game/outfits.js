'use strict';
// Wardrobe: funny things the dinos can wear. Pure looks, no powers.
// Every item is a few vector shapes (SVG path strings drawn with Path2D), so the same
// drawing is used on the game board, on the title screen and in the shop.
(() => {
  const INK = '#2B1B3D';
  const C = (x, y, r) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 `;
  const E = (x, y, rx, ry) => `M${x - rx} ${y} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 `;

  // Where things sit on each dino, in that dino's own picture coordinates (as if facing right).
  // k = size of the dino's head compared to Pip's; flip = the picture faces left (Rex).
  // waist is [x, y, width]; everything else is [x, y].
  const ANCHORS = {
    pip:   { k: 1,    head: [146, 48],  eye: [164, 94],  nose: [190, 106], mouth: [180, 118], neck: [136, 132], back: [80, 94],   waist: [92, 140, 100],  seat: [52, 142],  tail: [8, 144] },
    stegi: { k: 0.75, head: [166, 109], eye: [172, 120], nose: [192, 128], mouth: [186, 140], neck: [148, 144], back: [98, 98],   waist: [100, 140, 104], seat: [52, 140],  tail: [8, 104] },
    petra: { k: 0.7,  head: [104, 63],  eye: [111, 84],  nose: [156, 90],  mouth: [128, 99],  neck: [102, 107], back: [100, 104], waist: [100, 140, 46],  seat: [100, 152], tail: [14, 80] },
    anki:  { k: 0.7,  head: [172, 108], eye: [178, 134], nose: [194, 140], mouth: [187, 148], neck: [156, 150], back: [96, 90],   waist: [100, 150, 120], seat: [44, 146],  tail: [14, 134] },
    rafi:  { k: 0.7,  head: [145, 58],  eye: [158, 74],  nose: [179, 80],  mouth: [170, 86],  neck: [136, 100], back: [104, 100], waist: [100, 132, 70],  seat: [74, 134],  tail: [10, 124] },
    rex:   { k: 1.25, flip: true, head: [66, 30], eye: [70, 62], nose: [21, 72], mouth: [44, 90], neck: [106, 118], back: [140, 96], waist: [128, 150, 116], seat: [178, 148], tail: [232, 66] },
  };

  // slot: one item per slot is worn. at: anchor. behind: drawn behind the dino.
  // fit: stretch to the waist width. box: [x, y, w, h] used to fit the shop icon.
  // Part anim: spin (propeller), flicker (flame). Item anim: bob, wobble, flap.
  const ITEMS = [
    // ---------- Hats ----------
    { id: 'party', name: 'כובע מסיבה', slot: 'head', price: 5, at: 'head', rot: -12, box: [-22, -60, 44, 66], parts: [
      { d: 'M-17 0 L0 -50 L17 0 Q0 6 -17 0 Z', fill: '#FF8FA3' },
      { d: 'M-13 -11 Q0 -7 13 -11 M-8.5 -24 Q0 -21 8.5 -24 M-4.5 -36 Q0 -34 4.5 -36', stroke: '#FFD23F', sw: 4 },
      { d: C(0, -53, 6), fill: '#4FC3F7' },
    ] },
    { id: 'banana', name: 'בננה', slot: 'head', price: 5, at: 'head', rot: 8, box: [-32, -32, 70, 36], parts: [
      { d: 'M-28 -22 Q0 2 28 -22 Q31 -14 25 -9 Q0 8 -25 -9 Q-31 -14 -28 -22 Z', fill: '#FFD23F' },
      { d: 'M-20 -11 Q0 1 20 -11', stroke: '#F2B705', sw: 3 },
      { d: 'M27 -21 L31 -29 L35 -27', stroke: '#7B4A12', sw: 4 },
      { d: C(-10, -8, 1.6) + C(8, -7, 1.6), fill: '#7B4A12', sw: 0 },
    ] },
    { id: 'chef', name: 'כובע שף', slot: 'head', price: 8, at: 'head', box: [-30, -56, 60, 58], parts: [
      { d: 'M-15 0 L-15 -16 Q-30 -20 -26 -34 Q-21 -48 -8 -42 Q0 -56 10 -44 Q25 -48 26 -32 Q27 -20 15 -16 L15 0 Z', fill: '#FFFFFF' },
      { d: 'M-15 -7 L15 -7', stroke: '#D8D2E3', sw: 3 },
      { d: 'M-6 -20 Q-4 -28 -8 -34 M6 -20 Q8 -30 4 -36', stroke: '#D8D2E3', sw: 2.5 },
    ] },
    { id: 'duck', name: 'ברווזון', slot: 'head', price: 12, at: 'head', anim: 'wobble', box: [-28, -38, 56, 40], parts: [
      { d: 'M-22 -6 Q-28 -16 -24 -22 L-14 -16 Q-6 -20 10 -18 Q24 -14 20 -2 Q0 4 -22 -6 Z', fill: '#FFD23F' },
      { d: C(8, -27, 10), fill: '#FFD23F' },
      { d: 'M16 -29 L27 -27 Q26 -22 16 -22 Z', fill: '#FF9F1C', sw: 3 },
      { d: C(10, -30, 2), fill: INK, sw: 0 },
      { d: 'M-10 -12 Q0 -4 6 -12', sw: 3 },
    ] },
    { id: 'pirate', name: 'כובע פיראט', slot: 'head', price: 12, at: 'head', box: [-38, -36, 76, 40], parts: [
      { d: 'M-36 2 Q-34 -26 0 -34 Q34 -26 36 2 Q0 -10 -36 2 Z', fill: '#3A2A4D' },
      { d: 'M-31 -3 Q0 -14 31 -3', stroke: '#FFD23F', sw: 3 },
      { d: 'M-8 -9 L8 -2 M8 -9 L-8 -2', stroke: '#FFFFFF', sw: 3 },
      { d: C(0, -19, 7), fill: '#FFFFFF', sw: 2.5 },
      { d: C(-2.6, -20, 1.8) + C(2.6, -20, 1.8), fill: INK, sw: 0 },
    ] },
    { id: 'viking', name: 'קסדת ויקינג', slot: 'head', price: 15, at: 'head', box: [-42, -42, 84, 44], parts: [
      { d: 'M-18 -14 Q-38 -14 -40 -40 Q-28 -30 -14 -26 Z', fill: '#FFF3D6' },
      { d: 'M18 -14 Q38 -14 40 -40 Q28 -30 14 -26 Z', fill: '#FFF3D6' },
      { d: 'M-22 0 Q-22 -30 0 -30 Q22 -30 22 0 Z', fill: '#B0BEC5' },
      { d: 'M-24 -8 L24 -8 L24 1 L-24 1 Z', fill: '#FFD23F', sw: 3.5 },
      { d: C(-14, -4, 1.8) + C(-5, -4, 1.8) + C(5, -4, 1.8) + C(14, -4, 1.8), fill: INK, sw: 0 },
      { d: 'M-6 -26 Q-12 -20 -12 -12', stroke: '#FFFFFF', sw: 3 },
    ] },
    { id: 'propeller', name: 'כובע פרופלור', slot: 'head', price: 15, at: 'head', box: [-24, -42, 56, 46], parts: [
      { d: 'M0 -24 L0 -35', sw: 4 },
      { d: 'M-22 0 Q-22 -26 0 -26 L0 0 Z', fill: '#E8553D', sw: 0 },
      { d: 'M0 -26 Q22 -26 22 0 L0 0 Z', fill: '#FFD23F', sw: 0 },
      { d: 'M-22 0 Q-22 -26 0 -26 Q22 -26 22 0 Z', sw: 4 },
      { d: 'M14 -3 L31 1 L15 4 Z', fill: '#4FC3F7', sw: 3 },
      { d: E(0, -37, 20, 4), fill: '#5CCB5F', sw: 3, anim: 'spin', pivot: [0, -37] },
      { d: C(0, -37, 3), fill: '#E8553D', sw: 2 },
    ] },
    { id: 'cake', name: 'עוגת יום הולדת', slot: 'head', price: 20, at: 'head', box: [-24, -52, 48, 54], parts: [
      { d: 'M-21 0 L-21 -20 L21 -20 L21 0 Z', fill: '#C98A55' },
      { d: 'M-19 -9 L19 -9', stroke: '#FF8FA3', sw: 4 },
      { d: 'M-22 -20 L22 -20 L22 -14 Q17 -8 12 -14 Q6 -7 0 -14 Q-6 -7 -12 -14 Q-17 -8 -22 -14 Z', fill: '#FFFFFF', sw: 3.5 },
      { d: 'M-3 -21 L-3 -36 L3 -36 L3 -21 Z', fill: '#4FC3F7', sw: 3 },
      { d: 'M0 -50 Q7 -42 0 -38 Q-7 -42 0 -50 Z', fill: '#FF9F1C', sw: 2.5, anim: 'flicker', pivot: [0, -38] },
      { d: C(-14, -18, 2.6) + C(14, -18, 2.6), fill: '#E8253D', sw: 0 },
    ] },
    { id: 'crown', name: 'כתר זהב', slot: 'head', price: 40, at: 'head', box: [-29, -37, 58, 39], parts: [
      { d: 'M-22 0 L-25 -26 L-12 -13 L0 -32 L12 -13 L25 -26 L22 0 Z', fill: '#FFD23F' },
      { d: 'M-21 -6 L21 -6', stroke: '#F2B705', sw: 3 },
      { d: C(0, -11, 4.5), fill: '#E8253D', sw: 2.5 },
      { d: C(-13, -10, 3) + C(13, -10, 3), fill: '#4FC3F7', sw: 2.5 },
      { d: C(-25, -27, 3) + C(0, -33, 3) + C(25, -27, 3), fill: '#FFFFFF', sw: 2.5 },
    ] },

    // ---------- Face ----------
    { id: 'mustache', name: 'שפם ענק', slot: 'face', price: 5, at: 'mouth', box: [-34, -12, 68, 22], parts: [
      { d: 'M0 -2 Q-8 -10 -17 -4 Q-25 4 -32 -6 Q-28 10 -15 7 Q-6 5 0 3 Q6 5 15 7 Q28 10 32 -6 Q25 4 17 -4 Q8 -10 0 -2 Z', fill: '#5A3825', sw: 3 },
    ] },
    { id: 'clown', name: 'אף ליצן', slot: 'face', price: 5, at: 'nose', box: [-12, -12, 24, 24], parts: [
      { d: C(0, 0, 9), fill: '#E8253D', sw: 3.5 },
      { d: C(-3, -3, 2.6), fill: '#FFFFFF', sw: 0, alpha: 0.85 },
    ] },
    { id: 'shades', name: 'משקפי שמש', slot: 'face', price: 8, at: 'eye', box: [-36, -12, 68, 24], parts: [
      { d: 'M-12 -6 L-34 -4', sw: 4 },
      { d: 'M-13 -9 L12 -9 Q14 9 0 9 Q-13 9 -13 -9 Z', fill: INK },
      { d: 'M12 -7 L19 -7', sw: 4 },
      { d: 'M19 -9 L29 -9 Q30 5 24 7 Q19 6 19 -9 Z', fill: INK },
      { d: 'M-7 -4 L-2 1 M-9 1 L-6 4', stroke: '#FFFFFF', sw: 2.5 },
    ] },
    { id: 'nerd', name: 'משקפיים ענקיים', slot: 'face', price: 8, at: 'eye', box: [-38, -17, 72, 34], parts: [
      { d: 'M-15 -2 L-36 0', sw: 4 },
      { d: C(0, 0, 15), fill: '#DFF6FF', sw: 0, alpha: 0.45 },
      { d: C(0, 0, 15), sw: 5 },
      { d: 'M15 -2 L21 -2', sw: 4 },
      { d: 'M21 -11 Q31 -11 31 0 Q31 11 21 11', sw: 5 },
      { d: 'M-8 -8 Q-4 -11 0 -10', stroke: '#FFFFFF', sw: 3 },
    ] },
    { id: 'snorkel', name: 'שנורקל', slot: 'face', price: 12, at: 'eye', box: [-40, -52, 62, 68], parts: [
      { d: 'M-20 -2 L-20 -42 Q-20 -48 -13 -48', sw: 9 },
      { d: 'M-20 -2 L-20 -42 Q-20 -48 -13 -48', stroke: '#FFD23F', sw: 5 },
      { d: 'M-12 -4 L-36 -2', sw: 9 },
      { d: 'M-12 -4 L-36 -2', stroke: '#FF9F1C', sw: 5 },
      { d: 'M-12 -13 L15 -13 Q20 0 15 13 L-12 13 Q-16 0 -12 -13 Z', fill: '#4FC3F7', alpha: 0.55, sw: 0 },
      { d: 'M-12 -13 L15 -13 Q20 0 15 13 L-12 13 Q-16 0 -12 -13 Z', sw: 4.5 },
      { d: 'M-5 -8 L1 -2', stroke: '#FFFFFF', sw: 3 },
    ] },

    // ---------- Body ----------
    { id: 'diaper', name: 'חיתול', slot: 'body', price: 5, at: 'seat', box: [-24, -16, 48, 34], parts: [
      { d: 'M-20 -12 L20 -12 Q24 8 0 16 Q-24 8 -20 -12 Z', fill: '#FFFFFF' },
      { d: 'M-18 -8 L18 -8', stroke: '#BDEBFF', sw: 4 },
      { d: C(-8, 4, 2.2) + C(7, 2, 2.2) + C(0, 10, 2.2), fill: '#FFD23F', sw: 0 },
      { d: 'M6 -4 L16 -2', stroke: '#9AA5B1', sw: 2.5 },
      { d: C(5, -4, 2), fill: '#FF8FA3', sw: 1.5 },
    ] },
    { id: 'bowtie', name: 'פפיון', slot: 'body', price: 6, at: 'neck', box: [-19, -13, 38, 26], parts: [
      { d: 'M0 0 L-15 -10 Q-18 0 -15 10 Z', fill: '#E8553D' },
      { d: 'M0 0 L15 -10 Q18 0 15 10 Z', fill: '#E8553D' },
      { d: C(-9, -3, 1.8) + C(-8, 5, 1.8) + C(9, -3, 1.8) + C(8, 5, 1.8), fill: '#FFFFFF', sw: 0 },
      { d: C(0, 0, 4.5), fill: '#C43A2B', sw: 3 },
    ] },
    { id: 'donut', name: 'גלגל דונאט', slot: 'body', price: 10, at: 'waist', fit: true, box: [-56, -20, 112, 44], parts: [
      { d: 'M-50 -8 Q0 -24 50 -8 Q58 6 48 16 Q0 30 -48 16 Q-58 6 -50 -8 Z', fill: '#E8A15C' },
      { d: 'M-48 -6 Q0 -21 48 -6 Q52 2 46 6 Q38 1 32 8 Q24 2 14 8 Q4 2 -6 8 Q-16 2 -26 8 Q-36 2 -46 6 Q-52 2 -48 -6 Z', fill: '#FF8FC8', sw: 3 },
      { d: 'M-30 -6 L-25 -8 M12 -10 L17 -12 M-38 0 L-35 3 M22 -2 L24 2', stroke: '#4FC3F7', sw: 2.5 },
      { d: 'M-10 -11 L-6 -8 M30 -5 L34 -8 M2 -4 L7 -5 M-20 1 L-17 -2', stroke: '#FFD23F', sw: 2.5 },
    ] },
    { id: 'tutu', name: 'חצאית בלט', slot: 'body', price: 12, at: 'waist', fit: true, box: [-58, -16, 116, 36], parts: [
      { d: 'M-50 -4 Q-44 -12 -36 -6 Q-28 -14 -18 -7 Q-9 -14 0 -7 Q9 -14 18 -7 Q28 -14 36 -6 Q44 -12 50 -4 L56 8 Q48 16 40 9 Q32 18 22 10 Q12 18 2 10 Q-8 18 -18 10 Q-28 18 -38 9 Q-48 16 -56 8 Z', fill: '#FFB6D9', sw: 3.5 },
      { d: 'M-40 2 L-44 8 M-20 2 L-22 9 M0 2 L0 9 M20 2 L22 9 M40 2 L44 8', stroke: '#FF8FC8', sw: 2.5 },
    ] },
    { id: 'cape', name: 'גלימת גיבור', slot: 'body', price: 15, at: 'back', behind: true, anim: 'flap', box: [-74, -28, 92, 48], parts: [
      { d: 'M14 -4 Q-20 -28 -70 -16 Q-60 -4 -68 8 Q-50 2 -46 16 Q-32 4 -22 16 Q-8 2 14 8 Z', fill: '#E8553D' },
      { d: 'M-52 -8 Q-30 -14 -6 -6', stroke: '#B83B2E', sw: 3 },
      { d: 'M-34 -2 L-30 -10 L-26 -3 L-18 -5 L-24 1 L-21 8 L-29 4 L-36 8 L-33 1 L-40 -3 Z', fill: '#FFD23F', sw: 2 },
    ] },
    { id: 'balloon', name: 'בלון', slot: 'body', price: 25, at: 'tail', behind: true, anim: 'bob', box: [-16, -142, 36, 144], parts: [
      { d: 'M0 0 Q-12 -30 4 -60 Q14 -80 2 -100', sw: 2.5 },
      { d: 'M2 -100 L-3 -94 L7 -94 Z', fill: '#E8253D', sw: 2.5 },
      { d: E(2, -120, 17, 21), fill: '#E8253D' },
      { d: 'M-7 -128 Q-6 -134 0 -136', stroke: '#FFFFFF', sw: 3.5 },
    ] },
  ];
  const BY_ID = {};
  for (const it of ITEMS) {
    BY_ID[it.id] = it;
    for (const p of it.parts) p.path = new Path2D(p.d);
  }

  function drawParts(c, it, t) {
    if (it.anim === 'bob') c.translate(0, Math.sin(t * 3) * 3);
    if (it.anim === 'wobble') c.rotate(Math.sin(t * 4) * 0.12);
    if (it.anim === 'flap') c.rotate(Math.sin(t * 6) * 0.08);
    if (it.rot) c.rotate(it.rot * Math.PI / 180);
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of it.parts) {
      c.save();
      if (p.anim) {
        const [px, py] = p.pivot;
        c.translate(px, py);
        if (p.anim === 'spin') c.scale(Math.cos(t * 14) || 0.05, 1);
        if (p.anim === 'flicker') c.scale(1 + Math.sin(t * 17) * 0.1, 1 + Math.sin(t * 23) * 0.18);
        c.translate(-px, -py);
      }
      if (p.alpha) c.globalAlpha *= p.alpha;
      if (p.fill) { c.fillStyle = p.fill; c.fill(p.path); }
      const sw = p.sw === undefined ? 4 : p.sw;
      if (sw > 0) { c.strokeStyle = p.stroke || INK; c.lineWidth = sw; c.stroke(p.path); }
      c.restore();
    }
  }

  // Draw the outfit on a dino. The context must already be in the dino picture's own coordinates.
  // layer: 'back' (things behind the dino) or 'front'.
  function drawOn(c, charId, outfit, layer, t) {
    const a = ANCHORS[charId];
    if (!a || !outfit) return;
    for (const slot of ['body', 'head', 'face']) {
      const it = BY_ID[outfit[slot]];
      if (!it || !!it.behind !== (layer === 'back')) continue;
      const at = a[it.at];
      c.save();
      c.translate(at[0], at[1]);
      const sx = it.fit ? at[2] / 100 : a.k, sy = it.fit ? Math.max(a.k, 0.8) : a.k;
      c.scale(a.flip ? -sx : sx, sy);
      drawParts(c, it, t);
      c.restore();
    }
  }

  // A shop icon: the item alone, fitted into a size x size square.
  function drawIcon(c, id, size, t) {
    const it = BY_ID[id];
    if (!it) return;
    const [x, y, w, h] = it.box;
    const s = (size * 0.8) / Math.max(w, h);
    c.save();
    c.translate(size / 2 - (x + w / 2) * s, size / 2 - (y + h / 2) * s);
    c.scale(s, s);
    drawParts(c, Object.assign({}, it, { anim: null }), 0);
    c.restore();
  }

  window.DinoOutfits = { ITEMS, BY_ID, ANCHORS, drawOn, drawIcon, SLOTS: ['head', 'face', 'body'] };
})();
