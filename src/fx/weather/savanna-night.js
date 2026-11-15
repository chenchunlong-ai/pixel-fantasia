// A baobab silhouetted against the Milky Way, after a long-exposure night photo: a deep navy-to-amber sky,
// a ragged river of starlight with dust lanes, twinkling stars, an acacia-studded horizon, grass that ripples
// like water in the wind, drifting fireflies and the odd shooting star.
//
// Everything is a pure function of t: the tree is grown once from a seed and only its twigs sway, the noise
// fields scroll a whole number of cells per loop, and every oscillation completes a whole number of cycles in
// `duration` seconds, so the loop has no seam and nothing accumulates.
//
// The picture is built the pixel-art way: every pixel is one colour from the palette, chosen by an ordered
// (Bayer) threshold, so gradients and glows dither into the ramp instead of blending smoothly.
import { clamp, fit, lerp, rand, Rng, smooth, TAU, WHITE } from "../../core/index.js";
import { bayer, clip, field, pass, rows, sample, trips, wave } from "../weather/_lib.js";

export const meta = {
  name: "Savanna Night",
  desc: "A baobab against the Milky Way: twinkling stars, a slow river of starlight, grass rippling like water, fireflies and shooting stars.",
  tags: ["scene", "night", "stars", "savanna", "landscape", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 24,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    // 0-1 silhouette, 2-6 night sky, 7-8 starlight, 9-11 warm light
    palette: [
      "#04050c", "#070b17", "#0a1220", "#0d182a", "#112035", "#172a44",
      "#1e3554", "#274366", "#39445c", "#574a4a", "#7d5136", "#a96336",
      "#cc7d42", "#eda05a", "#ffc887", "#fff0cc",
    ],
    seed: 21,
    density: 1,
  },
};

const D = 24; // the loop length, seconds
const TOP = -170; // local top of the canvas
const HZ = -34; // the horizon line
const BOT = 10; // local bottom of the canvas
const GAL = (x) => -104 + 0.16 * x + 5 * Math.sin(x * 0.016 + 0.8) + 2 * Math.sin(x * 0.041 + 2.1);

// ---- noise -------------------------------------------------------------------------------------
// Baked once per seed: rebuilding these per frame would cost more than everything else together.
let FIELDS = null;
let FIELDS_SEED = -1;

function fieldsOf(seed) {
  if (FIELDS && FIELDS_SEED === seed) return FIELDS;
  FIELDS = {
    FM: field(seed * 31 + 7, 256, 128, [4, 8, 16, 32]),
    FD: field(seed * 17 + 5, 256, 128, [4, 8, 16]),
    FG: field(seed * 53 + 3, 256, 128, [4, 8, 16, 32]),
  };
  FIELDS_SEED = seed;
  return FIELDS;
}

// ---- colour ------------------------------------------------------------------------------------
// A colour between two palette entries, picked per pixel by the Bayer threshold: the classic dither.
// Same 4x4 Bayer matrix the library uses, kept local so the inner loops avoid two floors per call.
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
// A static 8x8 rim pattern for the leaf clumps: a hash per pixel is slower and looks the same.
const RIM = new Float32Array(64).map((_, i) => rand(1337, i, 7));
const GAUSS = new Float32Array(168).map((_, i) => Math.exp(-((i / 32) * (i / 32)) / 2));

function pick(ramp, pos, x, y) {
  const top = ramp.length - 1.001;
  const p = pos < 0 ? 0 : pos > top ? top : pos;
  const i = p | 0;
  return BAY[((y & 3) << 2) | (x & 3)] < p - i ? ramp[i + 1] : ramp[i];
}

const MW = (C) => [C[5], C[6], C[7], C[8], WHITE];

// ---- the tree ----------------------------------------------------------------------------------
// Grown once per seed: a thick leaning trunk, five gnarly limbs forking three times into fine twigs, and
// sparse leaf clusters along the tips. Every piece remembers how far out it is (sw) and its own phase, so
// the wind bends the tips and leaves the trunk still.
let TREE = null;
let TREE_SEED = -1;

function treeOf(seed) {
  if (TREE && TREE_SEED === seed) return TREE;
  const R = new Rng(seed * 7919 + 31);
  const segs = [], clumps = [], twigs = [];

  // trunk: leaning, S-curved, with a flare where it meets the grass
  const trunk = [];
  for (let i = 0; i <= 4; i++) {
    const u = i / 4;
    trunk.push([lerp(-30, -22, u) + Math.sin(u * 3.3) * 2.4, lerp(10, -46, u)]);
  }
  segs.push({ x0: -35, y0: 7, x1: -30, y1: -2, w: 21, sw: 0, ph: 0 });
  for (let i = 0; i < 4; i++)
    segs.push({ x0: trunk[i][0], y0: trunk[i][1], x1: trunk[i + 1][0], y1: trunk[i + 1][1], w: lerp(16, 10, i / 3), sw: 0, ph: 0 });

  // angle 0 = right, -PI/2 = up. Two up-left, one tall, two out to the right, like the photo.
  const limbs = [
    [-2.75, 32, 7.2], [-2.24, 37, 6.6], [-1.66, 40, 6.0], [-1.05, 36, 5.4], [-0.3, 31, 4.8],
  ];
  for (const [a, l, w] of limbs)
    grow(R, -22 + R.range(-2, 2), -46 + R.range(-3, 3), a + R.range(-0.1, 0.1), l, w, 0, segs, clumps, twigs);

  TREE = { segs, clumps, twigs };
  TREE_SEED = seed;
  return TREE;
}

function grow(R, x, y, ang, len, w, depth, segs, clumps, twigs) {
  const n = depth === 0 ? 5 : 3;
  let cx = x, cy = y, a = ang;
  const pts = [[cx, cy]];
  for (let i = 1; i <= n; i++) {
    a += R.range(-0.16, 0.16) - 0.015;
    cx += Math.cos(a) * (len / n);
    cy += Math.sin(a) * (len / n);
    if (cy > HZ - 3) cy = HZ - 3; // a limb never dips below the ground
    pts.push([cx, cy]);
  }
  const ph = R.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const u = (i + 1) / n;
    segs.push({
      x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1],
      w: Math.max(1, w * (1 - 0.58 * u)), sw: 0.2 + 0.8 * u, ph,
    });
  }

  // the twig lace: hair-thin lines fanning out of every outer tip, leaves only at the very ends
  if (depth >= 3) {
    const fan = 3 + Math.floor(R.range(0, 3));
    for (let j = 0; j < fan; j++) {
      const fa = a + R.range(-0.85, 0.85), fl = 3 + R.range(0, 3.5);
      twigs.push({ x: cx, y: cy, a: fa, l: fl, ph });
    }
    if (depth >= 4) {
      const sd = Math.floor(R.range(0, 9999));
      for (let j = 0; j < 3; j++)
        clumps.push({
          x: cx + R.range(-1.6, 1.6), y: cy + R.range(-1.4, 1.4), r: 1.4 + R.range(0, 2.3), ph: R.range(0, TAU),
          cyc: 1 + Math.floor(R.range(0, 2)), amp: 0.4 + R.range(0, 0.7),
          sd: sd + j * 613, n: 6 + Math.floor(R.range(0, 5)),
        });
      return;
    }
  }

  for (let i = 0; i < 2; i++) {
    const na = a + (i === 0 ? -1 : 1) * R.range(0.5, 1.0);
    grow(R, cx, cy, na, len * R.range(0.55, 0.72), w * 0.58, depth + 1, segs, clumps, twigs);
  }
  if (depth === 0 && R.chance(0.45)) grow(R, cx, cy, a + R.range(-0.3, 0.3), len * 0.5, w * 0.48, depth + 1, segs, clumps, twigs);
  if (depth === 1 && R.chance(0.35)) grow(R, cx, cy, a + R.range(-0.4, 0.4), len * 0.45, w * 0.5, depth + 1, segs, clumps, twigs);
}

// ---- the sky -----------------------------------------------------------------------------------
// Everything that depends only on x or only on y is baked once: the pass below runs 30 times a second.
const GALX = new Float32Array(320);
const W1X = new Float32Array(320);
const HOTX = new Float32Array(320);
const SKY_POS = new Float32Array(200);
const SKY_HZ = new Float32Array(200);
const SKY_BF = new Float32Array(200);
// Ground tables: the land edge, the two wind waves and the warm pool are all separable into x and y.
const GRD_EDGE = new Float32Array(320);
const GS1 = new Float32Array(320);
const GC1 = new Float32Array(320);
const GS2 = new Float32Array(320);
const GC2 = new Float32Array(320);
const GEX = new Float32Array(320);
// Reused band-noise samples (the field cells are far wider than one pixel).
let BN1 = 0, BN2 = 0, BD = 0;
{
  for (let i = 0; i < 320; i++) {
    const x = i - 160 + 0.5;
    GALX[i] = -104 + 0.16 * x + 5 * Math.sin(x * 0.016 + 0.8) + 2 * Math.sin(x * 0.041 + 2.1);
    W1X[i] = 12 + 3.5 * Math.sin(x * 0.02 + 1.2);
    HOTX[i] = (0.25 + 0.75 * Math.exp(-((x - 30) * (x - 30)) / 24000)) * (0.72 + 0.28 * Math.sin(x * 0.0093 + 1.7));
    // an uneven land edge, so the horizon is a silhouette and not a ruler line
    GRD_EDGE[i] = HZ + 0.9 * Math.sin(x * 0.036 + 1.2) + 0.5 * Math.sin(x * 0.113 + 0.3);
    GS1[i] = Math.sin(x * 0.052);
    GC1[i] = Math.cos(x * 0.052);
    GS2[i] = Math.sin(x * 0.107 + 1.3);
    GC2[i] = Math.cos(x * 0.107 + 1.3);
    GEX[i] = Math.exp(-((x + 30) * (x + 30)) / 6400);
  }
  for (let j = 0; j < 200; j++) {
    const y = TOP + j + 0.5;
    const v = clamp((y - TOP) / (HZ - TOP));
    SKY_POS[j] = 0.85 + 5.9 * Math.pow(v, 1.15);
    SKY_HZ[j] = smooth(HZ - 30, HZ - 2, y);
    SKY_BF[j] = smooth(HZ + 12, HZ - 20, y);
  }
}

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 16), A = o.density ?? 1;
  const { FM, FD, FG } = fieldsOf(S);
  const drift = (t / D) * 6; // whole cells per loop: no seam

  // sky: one dithered ramp from near-black overhead to dusty amber on the horizon, with the star river
  // stippled over it and the dust lanes knocked out of the band. Row by row, because a per-pixel
  // callback for every one of the 43k sky pixels is the difference between 30 fps and 8.
  rows(q, meta, TOP, HZ + 1, (y, R) => {
    const yi = y | 0, j = yi - TOP;
    const pos = SKY_POS[j];
    const hz = SKY_HZ[j];
    const bf = SKY_BF[j];
    const glowK = Math.pow(hz, 1.8) * 4.7;

    // refresh the shared band noise at the left edge of every row
    BN1 = sample(FM, -160 * 0.5 + drift, y * 0.85 + 40);
    BN2 = sample(FM, -160 * 0.25 - drift * 0.6 + 90, y * 0.4 + 12);
    BD = sample(FD, -160 * 0.78 + 60 - drift * 0.4, y * 1.25);

    for (let i = 0; i < 320; i++) {
      let c = pick(C, pos, i - 160, yi);

      // the band: a bright core and a wide halo. Outside the halo there is nothing to draw.
      const d = yi - GALX[i];
      const w1 = W1X[i];
      if (d > -w1 * 3.8 && d < w1 * 3.8) {
        // the noise cells are 8-16 px wide, so sampling every second column is already oversampling
        if ((i & 1) === 0) {
          const x = i - 160;
          BN1 = sample(FM, x * 0.5 + drift, y * 0.85 + 40);
          BN2 = sample(FM, x * 0.25 - drift * 0.6 + 90, y * 0.4 + 12);
          BD = sample(FD, x * 0.78 + 60 - drift * 0.4, y * 1.25);
        }
        // exp(-u^2/2) sampled every 1/32 over [0, 5.2]: two table reads instead of two exps per pixel
        const u = (d < 0 ? -d : d) * 32;
        const ci = u / w1;
        const hi = u / (w1 * 2.3);
        const core = ci < 167 ? GAUSS[ci | 0] : 0;
        const halo = hi < 167 ? GAUSS[hi | 0] : 0;
        let k = (core * 0.95 + halo * 0.1) * (0.25 + 1.35 * BN1) * (0.55 + 0.7 * BN2);
        const dt2 = (BD - 0.42) * 2.78;
        if (dt2 > 0) k *= 1 - 0.8 * (dt2 > 1 ? 1 : dt2);
        k *= bf * 0.75 + bf * 0.4 * hz;
        // the river of stars is grain, not a wash: the noise decides coverage, a hash breaks the grid
        if (k > 0.08 && k * 0.9 > rand(i - 160, yi, 7)) c = pick(MW(C), k * 3.6, i - 160, yi);
      }

      // the horizon glow stays ordered-dithered: it is a smooth band, not grain
      const g = glowK * HOTX[i];
      if (g > 0.02) c = pick(C, pos + g, i - 160, yi);

      R.c[i] = c;
      R.a[i] = 1;
    }
  });

  ridge(q, S, C);
  horizonTrees(q, t, S, C);
  ground(q, t, S, C, A, FG, drift);
}

// A low dark ridge where the plain meets the sky: the glow sits behind it, not on the grass.
function ridge(q, S, C) {
  for (let x = -160; x < 160; x++) {
    const n = rand(S, Math.floor(x / 3), 111);
    const h = 0.6 + 1.7 * (0.5 + 0.5 * Math.sin(x * 0.019 + 0.7)) * (0.45 + 0.75 * n) + 0.9 * (0.5 + 0.5 * Math.sin(x * 0.071 + 2.3));
    for (let y = HZ - h; y <= HZ + 1; y++) q.px(x, y, C[0]);
  }
}

// The far treeline: small flat-topped acacias, only their canopies move.
function horizonTrees(q, t, S, C) {
  for (let i = 0; i < 9; i++) {
    const x = -150 + rand(S, i, 31) * 300;
    const y = HZ + 1;
    const h = 3 + rand(S, i, 32) * 6;
    const cw = 3.4 + rand(S, i, 35) * 5.5;
    const sw = wave(t, D, 1 + Math.floor(rand(S, i, 33) * 2), rand(S, i, 34) * TAU) * 0.28;
    const forked = rand(S, i, 37) > 0.5;
    q.line(x, y, x + sw * 0.4 + (forked ? -0.8 : 0), y - h * 0.55, C[0]);
    if (forked) q.line(x + sw * 0.4, y - h * 0.5, x + sw + 1.2, y - h * 0.8, C[0]);
    q.ellipse(x + sw, y - h * 0.86, cw, 1 + rand(S, i, 36) * 0.9, C[0]);
    q.ellipse(x + sw + cw * 0.45, y - h * 0.72, cw * 0.6, 0.9, C[0]);
    q.ellipse(x + sw - cw * 0.4, y - h * 0.76, cw * 0.45, 0.8, C[0]);
  }
}

// ---- the ground --------------------------------------------------------------------------------
function ground(q, t, S, C, A, FG, drift) {
  // Per-column and per-row tables: the wind is two sine waves whose phase slides with depth, so the
  // angle addition formula removes four transcendental calls per pixel.
  rows(q, meta, HZ, BOT, (y, R) => {
    const yi = y | 0;
    const v = (y - HZ) / (BOT - HZ); // 0 at the horizon, 1 at the viewer
    const w1 = (TAU * 2 * t) / D + v * 3.2;
    const w2 = -(TAU * 3 * t) / D - v * 2.4;
    const s1 = Math.sin(w1), c1 = Math.cos(w1), s2 = Math.sin(w2), c2 = Math.cos(w2);
    const ey = Math.exp(-((y - 4) * (y - 4)) / 1100);

    for (let i = 0; i < 320; i++) {
      const x = i - 160;
      if (y < GRD_EDGE[i]) {
        R.c[i] = 0;
        continue;
      }
      const n1 = sample(FG, x * 0.5 + drift * 0.4, y * 1.1 + 7);
      const n2 = sample(FG, x * 1.35 - drift, y * 2.4 + 31);
      // two travelling waves: the grass rolls like water
      const wind = 0.5 + 0.34 * (GS1[i] * c1 + GC1[i] * s1) + 0.16 * (GS2[i] * c2 + GC2[i] * s2);
      const b = clamp(0.16 + 0.6 * n1 * (0.7 + 0.6 * wind) + 0.24 * n2);

      // the pool of warm light under the tree: the ground colour simply climbs the ramp towards amber
      const L = clamp(GEX[i] * ey * (0.62 + 0.55 * n2) * (0.7 + 0.45 * wind) * 1.35);
      let c = pick(
        C,
        1.42 - 0.9 * v + 0.7 * b + 2.6 * (1 - v) * (1 - v) * (1 - v) + 11.5 * L,
        x,
        yi
      );

      R.c[i] = c;
      R.a[i] = 1;
    }
  });

  grass(q, t, S, C, A);
}

// Short blades, dense near the viewer: the texture that makes the field read as grass rather than paper.
function grass(q, t, S, C, A) {
  const N = Math.round(1500 * A);
  for (let i = 0; i < N; i++) {
    const x = rand(S, i, 21) * 320 - 160;
    const v = Math.pow(rand(S, i, 22), 0.62);
    const y = HZ + 1 + v * (BOT - HZ - 1);
    const h = 2 + Math.floor(rand(S, i, 23) * (2 + v * 3.4));
    const sw = wave(t, D, 2 + Math.floor(rand(S, i, 24) * 2), rand(S, i, 25) * TAU) * (0.25 + v * 0.9);
    const lit = clamp(1.1 - Math.hypot(x + 22, (y + 22) * 1.6) / 58);
    // inside the glow the blades read as dark silhouettes against the lit field
    // blades are silhouettes: dark against the lit field, a faint texture in the shadow
    const c = lit > 0.3 ? C[0] : C[1];
    for (let k = 0; k < h; k++) q.px(x + sw * (k / h), y - k, c);
  }
  // a few taller tufts catch the light
  for (let i = 0; i < Math.round(36 * A); i++) {
    const x = rand(S, i, 121) * 320 - 160;
    const v = Math.pow(rand(S, i, 122), 0.5);
    const y = HZ + 2 + v * (BOT - HZ - 2);
    const lit = clamp(1 - Math.hypot(x + 22, (y + 22) * 1.6) / 52);
    const sw = wave(t, D, 2 + Math.floor(rand(S, i, 123) * 2), rand(S, i, 124) * TAU) * (0.4 + v);
    const c = lit > 0.28 ? C[8] : C[3];
    for (let j = 0; j < 2; j++) q.line(x + j * 1.1 - 0.5, y, x + sw + j * 1.1 - 0.5, y - 2 - rand(S, i, 125 + j) * 2, c);
  }
}

// ---- stars -------------------------------------------------------------------------------------
function stars(q, t, S, C, A) {
  const N = Math.round(1500 * A);
  for (let i = 0; i < N; i++) {
    let x, y;
    if (rand(S, i, 41) < 0.72) {
      // most stars live in the band, which is what gives the Milky Way its grain
      x = rand(S, i, 42) * 320 - 160;
      y = GAL(x) + (rand(S, i, 43) - 0.5) * 50 * (0.35 + rand(S, i, 44));
    } else {
      x = rand(S, i, 45) * 320 - 160;
      y = TOP + 2 + rand(S, i, 46) * (HZ - TOP - 8);
    }
    if (y > HZ - 2 || y < TOP + 1) continue;
    const m = rand(S, i, 47);
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * wave(t, D, 1 + Math.floor(rand(S, i, 48) * 3), rand(S, i, 49) * TAU));
    const a = (0.3 + 0.7 * m * m) * tw;
    if (a < 0.22) continue;
    // crisp one-pixel stars, the brightness deciding the colour rather than a blend
    q.blend(x, y, WHITE, 0.3 + 0.7 * a);
  }

  // a handful of bright stars: a core, two arms, a soft halo
  for (let i = 0; i < 9; i++) {
    const x = -150 + rand(S, i, 51) * 300;
    const y = TOP + 8 + rand(S, i, 52) * 104;
    if (y > HZ - 8) continue;
    const tw = 0.55 + 0.45 * wave(t, D, 1 + Math.floor(rand(S, i, 53) * 2), rand(S, i, 54) * TAU);
    q.px(x, y, WHITE);
    q.px(x - 1, y, C[7]);
    q.px(x + 1, y, C[7]);
    q.px(x, y - 1, C[7]);
    q.px(x, y + 1, C[7]);
    q.glow(x, y, 3.2 + tw * 1.8, C[14], tw * 0.4);
  }

  // shooting stars: two a loop, quick and thin
  trips(t, D, 2, S + 71, 1, 1, (u, k, m, i) => {
    if (u > 0.11) return;
    const s = u / 0.11;
    const x0 = -140 + rand(S, i, 61) * 280;
    const y0 = TOP + 10 + rand(S, i, 62) * 70;
    const dx = 34 + rand(S, i, 63) * 46;
    const dy = 14 + rand(S, i, 64) * 12;
    const fade = Math.sin(Math.PI * s);
    for (let j = 0; j < 14; j++) {
      const f = j / 14;
      if (fade * (1 - f) < 0.25) break;
      q.px(x0 + dx * s - dx * 0.5 * f, y0 + dy * s - dy * 0.5 * f, j === 0 ? WHITE : C[8]);
    }
    q.glow(x0 + dx * s, y0 + dy * s, 3.2, C[14], fade * 0.4);
  });
}

// ---- fireflies ---------------------------------------------------------------------------------
function fireflies(q, t, S, C, A) {
  const N = Math.round(22 * A);
  for (let i = 0; i < N; i++) {
    const bx = -150 + rand(S, i, 81) * 300;
    const by = HZ + 4 + rand(S, i, 82) * (BOT - HZ - 10);
    const x = bx + Math.sin((TAU * (1 + Math.floor(rand(S, i, 83) * 2)) * t) / D + rand(S, i, 84) * TAU) * (3 + rand(S, i, 85) * 9);
    const y = by - Math.abs(Math.cos((TAU * (1 + Math.floor(rand(S, i, 86) * 2)) * t) / D + rand(S, i, 87) * TAU)) * (2 + rand(S, i, 88) * 5);
    const blink = 0.5 + 0.5 * wave(t, D, 1 + Math.floor(rand(S, i, 89) * 3), rand(S, i, 90) * TAU);
    if (blink < 0.3) continue;
    q.blend(x, y, blink > 0.7 ? WHITE : C[13], 0.55 + blink * 0.45);
    if (blink > 0.55) q.glow(x, y, 2 + blink * 1.6, C[13], blink * 0.45);
  }
}

// Tall blades along the bottom edge, in silhouette: they give the flat plain a foreground.
function foreground(q, t, S, C) {
  for (let i = 0; i < 150; i++) {
    const x = rand(S, i, 141) * 320 - 160;
    const near = 1 - Math.abs(x + 24) / 200;
    if (rand(S, i, 142) > 0.3 + near * 0.7) continue;
    const len = 3 + rand(S, i, 143) * 11;
    const lean = (rand(S, i, 144) - 0.5) * 0.55;
    const sw = wave(t, D, 2 + Math.floor(rand(S, i, 145) * 2), rand(S, i, 146) * TAU) * 0.7;
    const blades = 1 + Math.floor(rand(S, i, 147) * 3);
    for (let b = 0; b < blades; b++) {
      const bx = x + b * (0.9 + rand(S, i, 148 + b));
      let px = bx, py = BOT + 1;
      const l2 = len * (0.6 + rand(S, i, 152 + b) * 0.7);
      for (let k = 0; k < l2; k++) {
        px += lean + sw * 0.4 * (k / l2);
        py -= 1;
        if (py < -8) break;
        q.px(px, py, C[0]);
      }
    }
  }
}

// ---- front layer -------------------------------------------------------------------------------
export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 16), A = o.density ?? 1;

  stars(q, t, S, C, A);

  // the tree: trunk and limbs stay put, twigs and leaf clusters ride the wind
  const T = treeOf(S);
  const bend = 1.05;

  // Branches are one or two strokes unless they are thick enough to need a proper beam: shading the
  // bounding box of every twig costs far more than the silhouette it draws.
  for (const s of T.segs) {
    const off = s.sw === 0 ? 0 : (wave(t, D, 2, s.ph) * bend + wave(t, D, 3, s.ph * 1.4) * 0.3) * s.sw;
    const x0 = s.x0 + off, y0 = s.y0, x1 = s.x1 + off, y1 = s.y1;
    if (s.w < 2.2) q.line(x0, y0, x1, y1, C[0]);
    else if (s.w < 4) {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * 0.72, ny = (dx / L) * 0.72;
      q.line(x0 - nx, y0 - ny, x1 - nx, y1 - ny, C[0]);
      q.line(x0 + nx, y0 + ny, x1 + nx, y1 + ny, C[0]);
    } else q.beam(x0, y0, x1, y1, s.w, C[0]);
  }

  for (const w of T.twigs) {
    const off = wave(t, D, 3, w.ph) * 1.4;
    q.line(w.x + off * 0.4, w.y, w.x + Math.cos(w.a) * w.l + off, w.y + Math.sin(w.a) * w.l, C[0]);
  }

  // leaf clusters: loose stipples of black, so the crown reads as leaves and not as discs
  for (const c of T.clumps) {
    const dx = wave(t, D, c.cyc, c.ph) * c.amp;
    const dy = Math.cos((TAU * c.cyc * t) / D + c.ph * 1.7) * c.amp * 0.2;
    const cx = c.x + dx, cy = c.y + dy;
    // a filled blob with a ragged rim: opaque enough to read as foliage against the starfield
    const rx = c.r * 1.2, ry = c.r * 0.72;
    const ex = Math.ceil(rx), ey = Math.ceil(ry);
    for (let yy = -ey; yy <= ey; yy++)
      for (let xx = -ex; xx <= ex; xx++) {
        const d2 = (xx / rx) * (xx / rx) + (yy / ry) * (yy / ry);
        if (d2 > 1) continue;
        const edge = 0.66 + 0.62 * RIM[((yy & 7) << 3) | (xx & 7)];
        if (d2 > edge) continue;
        q.px(cx + xx, cy + yy, C[0]);
      }
    // a few loose leaves around the rim, so the edge is not a clean ellipse
    for (let j = 0; j < 6; j++) {
      const a = rand(c.sd, j, 1) * TAU;
      const r = c.r * (1.05 + rand(c.sd, j, 2) * 0.5);
      q.px(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 0.8, C[0]);
    }
  }

  foreground(q, t, S, C);

  // the shadow pooling at the base grounds the silhouette
  q.ellipse(-27, 8, 30, 3.4, C[0], 0.5);

  fireflies(q, t, S, C, A);
}
