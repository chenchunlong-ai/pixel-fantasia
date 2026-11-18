// 异次元时空裂痕 / Otherworld rift.
// Space itself cracks open along a long diagonal, and another universe is on the other side of the break:
// warm gold and jade instead of our cold indigo. The breach is a zig-zag of hard kinks — not an ellipse, not
// an axis band — with a near-black lip and a ragged bite along the whole length, so it reads as a pane of sky
// that was struck and split rather than a glowing ribbon painted over it.
// Depth is shaded, not drawn: the wall of the break sits in shadow, the far side is lit, and the deepest line
// carries a thin hot seam. Warm gas and a second starfield live in there. Small plates of our own starfield
// break off the lip and drift away trailing jade light, and a short secondary fracture runs off the main one
// like a crack in glass.
// Nothing detonates: the break breathes, and once a loop a pulse of light runs down it.
// Every pixel is a pure function of t; the geometry is baked once into a distance field.
import { clamp, fit, rand, hex, smooth, TAU, mix } from "../../../src/core/index.js";
import { clip, rows, field, sample, wave, trips } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Otherworld rift",
  desc: "Space cracks open along a long diagonal and another universe shows through: warm gold and jade instead of our cold indigo. The breach zig-zags with hard kinks, ringed by a near-black lip; the wall of the break sits in shadow while the far side burns, warm gas and a second starfield turning inside the gap. Plates of our own sky break off the lip and drift away trailing jade light, and a short secondary fracture runs off the main one like a crack in glass. Once a loop a pulse of light runs down the break.",
  tags: ["weather", "scene", "rift", "otherworld", "space", "stars", "jade", "gold", "aurora", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 16,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    other: ["#010509", "#03232c", "#0a5152", "#128c7c", "#2fd0a6", "#9bf5cf", "#f7fff2"],
    density: 1,
    seed: 23,
  },
};

const D = 16;
const W = 320;
const Y0 = -180, Y1 = 10, H = Y1 - Y0;

// ---- the breach: a long diagonal zig-zag with hard kinks (canvas-local coords) ------------------------------
const PTS = [
  [-111, -214], [-93, -196], [-69, -180], [-53, -160], [-27, -146],
  [-5, -128], [19, -114], [37, -94], [63, -80], [85, -60],
  [111, -48], [158, -10], [206, 30], [258, 76], [312, 124],
];
const SEG = (() => {
  const out = [];
  let acc = 0;
  for (let k = 0; k < PTS.length - 1; k++) {
    const [x0, y0] = PTS[k], [x1, y1] = PTS[k + 1];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    out.push({ x0, y0, dx, dy, len, L2: len * len, acc, nx: -dy / len, ny: dx / len });
    acc += len;
  }
  return out;
})();
const TOT = SEG[SEG.length - 1].acc + SEG[SEG.length - 1].len;

const F1 = field(211, 256, 128, [4, 8, 16, 32]); // the other world's gas
const F2 = field(223, 256, 128, [6, 12, 24]);    // its filaments and dust
const F3 = field(233, 128, 64, [3, 6, 12]);      // the lip's raggedness / warm gas

const q2 = (p) => clip(p, meta);

// a baked field: distance to the spine, the arc parameter there, and which side of it
let DF = null, TT = null, SD = null;
function bake() {
  DF = new Float32Array(W * H);
  TT = new Float32Array(W * H);
  SD = new Int8Array(W * H);
  for (let y = Y0; y < Y1; y++) {
    const ry = y + 0.5;
    for (let i = 0; i < W; i++) {
      const rx = i - 160 + 0.5;
      let best = 1e9, bt = 0, bs = 1;
      for (let k = 0; k < SEG.length; k++) {
        const S = SEG[k];
        let f = ((rx - S.x0) * S.dx + (ry - S.y0) * S.dy) / S.L2;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        const px = S.x0 + S.dx * f, py = S.y0 + S.dy * f;
        const d2 = (rx - px) * (rx - px) + (ry - py) * (ry - py);
        if (d2 < best) {
          best = d2;
          bt = (S.acc + f * S.len) / TOT;
          bs = S.dx * (ry - S.y0) - S.dy * (rx - S.x0) >= 0 ? 1 : -1;
        }
      }
      const idx = (Math.round(y) - Y0) * W + i;
      DF[idx] = Math.sqrt(best);
      TT[idx] = bt;
      SD[idx] = bs;
    }
  }
}

/** A point on the spine and its normal, from the arc parameter. */
function spineAt(t) {
  t = clamp(t, 0, 1);
  const target = t * TOT;
  let k = 0;
  while (k < SEG.length - 1 && SEG[k].acc + SEG[k].len < target) k++;
  const S = SEG[k], f = clamp((target - S.acc) / (S.len || 1), 0, 1);
  return [S.x0 + S.dx * f, S.y0 + S.dy * f, S.nx, S.ny];
}

// ---- width and the torn lip --------------------------------------------------------------------------------
// three places where it gapes wide, and between them it nearly closes
const BUR = [[0.27, 0.05, 2.2], [0.56, 0.06, 1.7], [0.82, 0.04, 1.2]];
function width(t) {
  const taper = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.42);
  const base = (2.6 + 3.0 * (0.5 + 0.5 * Math.sin(Math.PI * t * 1.9 + 0.7))) * (0.28 + 0.72 * taper);
  let g = 1;
  for (let k = 0; k < BUR.length; k++) {
    const dt = (t - BUR[k][0]) / BUR[k][1], dd = dt * dt;
    if (dd < 9) g = Math.max(g, 1 + BUR[k][2] * (1 / (1 + 1.6 * dd)));
  }
  return 2.2 + base * g;
}
// the lip bites in and out: a random bite every ~3px of the length, deeper where it gapes
function bite(t, side) {
  const s = t * 96, n = Math.floor(s), f = s - n;
  const a = (n2) => (rand(501, n2, side > 0 ? 1 : 2) - 0.5) * 4.4;
  return a(n) + (a(n + 1) - a(n)) * f + (sample(F3, t * 150, side * 11) - 0.5) * 2.2;
}

// ---- the sky we are standing in ----------------------------------------------------------------------------
const SKY0 = hex("#05060f"), SKY1 = hex("#0d1024"), BLACK = hex("#000000");
const GOLD = hex("#ffd489"), WARM = hex("#e8a94f"), MINT = hex("#9bf5cf"), JADE = hex("#2fd0a6");

function space(p, t, dn) {
  rows(p, meta, Y0, Y1, (y, R) => {
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      const n = sample(F1, x * 0.02 - 6 * (t / D), y * 0.02 + 60);
      const a = Math.max(0, n - 0.66) * 0.3;
      const vgx = (i - 150) / 200, vgy = (y + 88) / 130;
      const vg = 1 - 0.33 * Math.min(1, vgx * vgx + vgy * vgy);
      R.c[i] = mix(BLACK, a > 0.02 ? mix(SKY0, SKY1, Math.min(1, a * 2)) : SKY0, vg);
      R.a[i] = 1;
    }
  });
  // our stars: cold, sparse, none inside the breach
  const q = q2(p);
  const n = Math.round(190 * Math.min(1.5, dn));
  for (let i = 0; i < n; i++) {
    const x = -158 + rand(19, i, 1) * 316, y = -174 + rand(19, i, 2) * 180;
    const idx = (Math.floor(y) - Y0) * W + Math.floor(x + 160);
    if (DF[idx] && DF[idx] < width(TT[idx]) + 2) continue;
    const c = 1 + Math.floor(rand(19, i, 3) * 3), tw = wave(t, D, c, rand(19, i, 4) * TAU);
    const k = rand(19, i, 5);
    if (k < 0.62) q.dot(x, y, hex("#8d93b8"), 0.16 + 0.3 * Math.max(0, tw));
    else if (k < 0.9) q.dot(x, y, hex("#ccd2f0"), 0.3 + 0.42 * Math.max(0, tw));
    else {
      q.px(x, y, hex("#f0f4ff"));
      q.glow(x, y, 2.6, hex("#8fa4ee"), 0.3 + 0.28 * tw);
    }
  }
}

// ---- the breach ----------------------------------------------------------------------------------------------
function wound(p, t, dn, NL) {
  const drift = t / D;
  const travel = drift;                                    // the pulse runs the whole break once per loop
  const breath = 0.5 + 0.5 * Math.sin(TAU * drift * 2);     // slow swell, seamless over the loop
  const TOPM = NL[NL.length - 1], NEAR = NL[NL.length - 2] || TOPM, MID = NL[4] || NEAR;
  const VOID = hex("#02040a");
  rows(p, meta, Y0, Y1, (y, R) => {
    for (let i = 0; i < W; i += 2) {
      const idx = (Math.round(y) - Y0) * W + i;
      const tt0 = TT[idx];
      const uu = tt0 * 22 + 3;
      // the fields are smooth, so one set of noise lookups serves both columns of the pair
      const dn0 = (DF[idx] - bite(tt0, SD[idx])) / width(tt0);
      const nA = sample(F1, uu * 3.1 - drift * 4, dn0 * 0.6 + 12);
      const nB = sample(F2, uu * 7.4 - drift * 9, dn0 * 1.4 + 44);
      const n3 = sample(F2, tt0 * 40 + 61, dn0 * 0.9);                 // the spill's mottling
      const pb = 1 / (1 + 70 * Math.pow(tt0 - travel, 2));             // the pulse
      for (let s = 0; s < 2 && i + s < W; s++) {
        const ii = i + s, id2 = idx + s;
        const tt = TT[id2], w = width(tt);
        const dn2 = (DF[id2] - bite(tt, SD[id2])) / w;   // 0 at the deepest line, 1 at the lip
        if (dn2 > 1.6) continue;
        if (dn2 < 1) {
          // ---- the other side. z = 1 at the deepest line, 0 at the lip: depth is shaded, not drawn
          const z = 1 - Math.min(1, dn2);
          const wall = Math.pow(z, 2.4);
          // the wall of the break is in shadow; the far side is lit
          let h = 0.04 + 0.32 * wall * clamp((nA - 0.42) * 1.9, 0, 1) + 0.26 * wall * clamp((nB - 0.5) * 2.3, 0, 1);
          // warm gold gas turning over in the deep half — the other universe's own weather
          const warmth = clamp((nB - 0.5) * 2.9, 0, 1) * smooth(0.2, 0.95, z);
          // a hot seam at the very deepest line, thin and hard
          const seam = Math.pow(1 - Math.min(1, dn2 / 0.14), 1.7);
          h = Math.max(h, seam * 0.82);
          // the rim just inside the lip holds a mint edge
          const rim = smooth(0.8, 1, dn2);
          if (rim > 0) h = Math.max(h, 0.7 + 0.28 * rim * (0.4 + 0.6 * nA));
          h = clamp(h + pb * (0.3 * wall + 0.12) + breath * 0.05, 0, 1);
          const li = Math.min(NL.length - 1.001, h * (NL.length - 1));
          let col = NL[Math.max(0, li | 0)];
          if (warmth > 0.02) col = mix(col, warmth > 0.62 ? WARM : GOLD, Math.min(0.85, warmth * 0.7));
          if (h > 0.86 && warmth < 0.2) col = mix(col, MINT, 0.35);
          R.c[ii] = col;
          R.a[ii] = 1;
          R.b[ii] = 1;
          if (h > 0.74) (R.l[ii] = warmth > 0.5 ? WARM : TOPM), (R.k[ii] = 0.13 * (h - 0.74) * 3.4);
          continue;
        }
        // the near-black lip: the wall of the hole
        const lip = 1 - Math.abs(dn2 - 1.08) / 0.07;
        if (lip > 0) {
          R.c[ii] = VOID;
          R.a[ii] = Math.min(1, lip * 0.95);
          R.b[ii] = 1;
          continue;
        }
        // jade light spilling onto our sky
        const g = 1 - (dn2 - 1.14) / 0.42;
        if (g > 0) {
          const a = g * g * (0.09 + 0.32 * n3) * (0.75 + 0.45 * breath);
          R.c[ii] = MID;
          R.a[ii] = Math.min(0.85, a);
          R.b[ii] = 1;
          if (a > 0.08) (R.l[ii] = NEAR), (R.k[ii] = Math.min(0.22, a * 0.16));
        }
      }
    }
  });
  // glints riding the lip
  const q = q2(p);
  trips(t, D, Math.round(18 * dn), 517, 2, 3, (u2, k, m, i) => {
    const tt = rand(517, i, 1) * 0.96 + 0.02, side = rand(517, i, 2) < 0.5 ? -1 : 1;
    const [sx, sy, nx, ny] = spineAt(tt);
    const off = width(tt) + 1.4 + rand(517, i, 3) * 3;
    const a = Math.sin(Math.PI * u2) * 0.75;
    if (a < 0.14) return;
    const X = sx + nx * side * off, Y = sy + ny * side * off;
    q.dot(X, Y, hex("#dffdf0"), a);
    if (a > 0.5) q.light(X, Y, MINT, 0.1 * a);
  });
}

// ---- the other sky's stars: warm, clearly not ours ------------------------------------------------------------
function otherStars(p, t, dn) {
  const q = q2(p);
  const n = Math.round(46 * Math.min(1.5, dn));
  for (let i = 0; i < n; i++) {
    const tt = 0.04 + rand(541, i, 1) * 0.92;
    const side = rand(541, i, 2) < 0.5 ? -1 : 1;
    const [sx, sy, nx, ny] = spineAt(tt);
    const off = side * (rand(541, i, 3) - 0.5) * 2 * width(tt) * 0.82;
    const X = sx + nx * off, Y = sy + ny * off;
    const tw = 0.45 + 0.55 * Math.max(0, wave(t, D, 1 + (i % 3), rand(541, i, 4) * TAU));
    const k = rand(541, i, 5);
    if (k < 0.55) q.dot(X, Y, hex("#ffdf9c"), 0.72 * tw);
    else if (k < 0.85) q.dot(X, Y, hex("#e8fff6"), 0.7 * tw);
    else {
      q.px(X, Y, hex("#fffaf0"));
      q.glow(X, Y, 2.2, hex("#ffe1a8"), 0.3 * tw);
    }
  }
}

// ---- our sky breaking off: plates of starfield drifting away from the lip ------------------------------------
function fragments(p, t, dn) {
  const q = q2(p);
  const n = Math.round(14 * Math.min(1.5, dn));
  for (let i = 0; i < n; i++) {
    const tt = 0.06 + rand(601, i, 1) * 0.88;
    const side = rand(601, i, 2) < 0.5 ? -1 : 1;
    const span = 0.35 + rand(601, i, 3) * 0.4;                 // dies before the seam, so nothing pops
    const u = ((t / D + rand(601, i, 4)) % 1) / span;
    if (u >= 1) continue;
    const fade = Math.sin(Math.PI * Math.min(1, u));
    const off = width(tt) + 1.5 + u * (12 + rand(601, i, 5) * 34);
    const [sx, sy, nx, ny] = spineAt(tt);
    const wob = Math.sin(u * 5 + rand(601, i, 6) * TAU) * 2.4;
    const X = Math.round(sx + nx * side * off + ny * wob), Y = Math.round(sy + ny * side * off - nx * wob);
    if (fade < 0.22) continue;
    q.px(X, Y, hex("#0a0c1a"));
    q.px(X + side, Y, hex("#0a0c1a"));
    q.px(X, Y - 1, hex("#0e1428"));
    if (rand(601, i, 7) < 0.55) q.dot(X + side, Y - 1, hex("#b9c2f0"), 0.6 * fade);
    else q.px(X + side, Y - 1, hex("#2a3352"));
    q.dot(X - side, Y + 1, JADE, 0.42 * fade);
  }
}

// ---- ribbons of jade light leaking out of the break -----------------------------------------------------------
function ribbons(p, t, dn) {
  const q = q2(p);
  const n = Math.round(4 * Math.min(1.4, dn));
  for (let j = 0; j < n; j++) {
    const t0 = 0.12 + rand(611, j, 1) * 0.7;
    const side = rand(611, j, 2) < 0.5 ? -1 : 1;
    const len = 24 + rand(611, j, 3) * 26;
    const ph = rand(611, j, 4) * TAU;
    const glow = 0.45 + 0.55 * Math.max(0, wave(t, D, 2, ph));
    for (let m = 0; m < 22; m++) {
      const f = m / 22;
      const tt = t0 + f * 0.1 * (rand(611, j, 5) - 0.5) * 2;
      const [sx, sy, nx, ny] = spineAt(tt);
      const off = width(tt) + 2 + f * len;
      const wob = Math.sin(f * 5.4 + ph + TAU * (t / D)) * (1.6 + f * 3);
      const X = sx + nx * side * off + ny * wob, Y = sy + ny * side * off - nx * wob;
      const a = glow * Math.pow(1 - f, 2.4) * 0.5;
      if (a > 0.06) q.dot(X, Y, f < 0.3 ? MINT : JADE, a);
    }
  }
}

// ---- a short secondary fracture, like a crack running off glass ---------------------------------------------
function branch(p, t) {
  const q = q2(p);
  const [ax, ay] = spineAt(0.44);
  const n = 26, len = 46, ph = 1.7;
  for (let m = 0; m < n; m++) {
    const f = m / n;
    const X = ax + Math.cos(2.5 + 0.4 * f) * f * len + Math.sin(f * 9 + ph) * 1.8;
    const Y = ay + Math.sin(2.5 + 0.4 * f) * f * len * 0.9 + Math.cos(f * 7 + ph) * 1.4;
    const a = Math.pow(1 - f, 1.6) * (0.3 + 0.18 * Math.max(0, wave(t, D, 3, ph)));
    if (a > 0.05) q.dot(X, Y, JADE, a * 0.7);
  }
}

// ---- cold stars with diffraction spikes ----------------------------------------------------------------------
function bigStars(p, t) {
  const q = q2(p);
  const spots = [[-140, -154], [-70, -22], [58, -166], [140, -96], [124, -18], [-18, -8]];
  for (let i = 0; i < spots.length; i++) {
    const [x, y] = spots[i], L = 8 + (i % 3) * 4;
    const pulse = 0.7 + 0.3 * wave(t, D, 2, i * 1.3);
    q.px(x, y, hex("#ffffff"));
    q.glow(x, y, L * 0.38, i % 2 ? hex("#a9b6ff") : hex("#9fc6ff"), 0.45 * pulse);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let s = 1; s <= L; s++) {
        const a = (1 - s / L) * (s % 2 ? 1 : 0.7) * pulse;
        if (s <= 2) q.px(x + dx * s, y + dy * s, hex("#e6ecff"));
        else q.dot(x + dx * s, y + dy * s, hex("#bfc9ee"), a * 0.75);
      }
    }
  }
}

// ---- entry ---------------------------------------------------------------------------------------------------
export function drawBack(p, t, o) {
  if (!DF) bake();
  const NL = fit(o.other, 7);
  space(p, t, o.density);
  wound(p, t, o.density, NL);
}
export function draw(p, t, o) {
  if (!DF) bake();

  otherStars(p, t, o.density);
  bigStars(p, t);
  fragments(p, t, o.density);
  ribbons(p, t, o.density);
}
