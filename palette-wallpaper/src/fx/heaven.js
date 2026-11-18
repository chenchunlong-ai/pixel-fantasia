// 天堂 / Heaven.
// Seen from above the clouds at first light: the sun sits just behind the cloud sea, so the sky runs from deep blue
// at the top to cream at the horizon, shafts fan up and out, and the sea itself is brightest where it meets the glow
// and falls away into cool shadow toward the bottom of the frame. Cumulus tops poke up over the horizon, a few small
// ones float higher, and near clouds rise as dark silhouettes along the bottom edge with only their rims lit.
// Dust rises through the light; now and then a feather sinks past.
// Technique borrowed from the library: weather/god-rays (a fan of shafts as angle math, dust that lights up only
// inside a beam) and weather/clouds (a lit crest stepping down into the body).
import { clamp, fit, rand, hex, smooth, TAU, mix } from "../../../src/core/index.js";
import { clip, rows, field, sample } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Heaven",
  desc: "Above the clouds at first light: the sun sits behind the cloud sea, the sky runs from deep blue to cream and shafts fan up out of the glow, the sea is brightest at the horizon and falls into cool shadow below, with cumulus tops poking up and near clouds rising as dark rims along the bottom. Dust rises through the light; feathers sink through it.",
  tags: ["sky", "clouds", "sun", "light", "holy", "heaven", "sea", "dawn", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 14,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    other: ["#08122c", "#10224a", "#1c3f78", "#2f5f9a", "#6e97c2", "#c9cfc6", "#fff6dd"],
    density: 1,
  },
};

const D = 14, W = 320, Y0 = -170, Y1 = 10;
const BLACK = hex("#04060e");
const CREAM = hex("#fff4d8");
const F1 = field(31, 256, 128, [4, 8, 16, 32]);
const F2 = field(47, 192, 96, [3, 6, 12, 24]);
const F3 = field(59, 128, 64, [4, 8, 16]);
const SUNX = -52, SUNY = -34;               // the sun is behind the cloud sea, just under the horizon
const HZ = -46;                             // the horizon: sky above, cloud sea below
const q2 = (p) => clip(p, meta);

// a 4x4 ordered dither, so gradients step like pixel art instead of banding or hatching
const BAY = new Float32Array(16);
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) BAY[y * 4 + x] = ([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y][x] + 0.5) / 16;
const bayer = (x, y) => BAY[(((y | 0) & 3) * 4) + ((x | 0) & 3)];

const SHAFTS = [
  { c: -0.9, h: 0.1, k: 0.34, b: 1, sw: 0.010 },
  { c: -0.52, h: 0.06, k: 0.5, b: 2, sw: 0.008 },
  { c: -0.2, h: 0.1, k: 0.74, b: 1, sw: 0.012 },
  { c: 0.16, h: 0.07, k: 0.46, b: 2, sw: 0.009 },
  { c: 0.5, h: 0.09, k: 0.32, b: 1, sw: 0.011 },
  { c: 0.86, h: 0.12, k: 0.2, b: 3, sw: 0.013 },
];
const STR = new Float32Array(384);

function shaftAt(x, y, sh) {
  const dy = y - SUNY, ang = (x - SUNX) / dy, fall = clamp(1.3 - dy / 470, 0, 1);
  let e = 0;
  for (const s of sh) {
    const q = Math.abs(ang - s.c) / s.h;
    if (q < 1) e += s.k * (1 - q * q) * (1 - q * q);
  }
  if (e <= 0) return 0;
  return e * fall * (0.72 + 0.4 * STR[clamp(Math.floor((ang + 1.4) * 140), 0, 383)]);
}

function shafts(t) {
  for (let i = 0; i < 384; i++) {
    const a = i / 384;
    STR[i] = 0.5 + 0.5 * Math.sin(a * 150 + Math.sin((TAU * t) / D) * 1.8) * Math.sin(a * 61 - (TAU * t) / D * 2);
  }
  return SHAFTS.map((s, i) => ({
    c: s.c + s.sw * Math.sin((TAU * t) / D + i * 1.7),
    h: s.h * (1 + 0.14 * Math.sin((TAU * s.b * t) / D + i)),
    k: s.k * (0.74 + 0.26 * Math.sin((TAU * s.b * t) / D + i * 2.2)),
  }));
}

export function drawBack(p, t, o) {
  const q = q2(p), NL = fit(o.other, 7), dn = o.density || 1;
  const sh = shafts(t);
  // the sky: deep at the top, paling to cream at the horizon, with the light washing through the bottom of it
  const SKY = [
    mix(NL[0], BLACK, 0.6),
    NL[0],
    mix(NL[0], NL[1], 0.7),
    mix(NL[1], NL[3], 0.6),
    mix(NL[3], NL[5], 0.45),
    mix(NL[4], CREAM, 0.42),
    mix(NL[4], CREAM, 0.76),
  ];
  rows(p, meta, Y0, Y1, (y, R) => {
    const f = clamp((y - Y0) / (HZ + 2 - Y0), 0, 1);
    const fi = Math.pow(f, 1.5) * (SKY.length - 1), k0 = Math.min(SKY.length - 2, fi | 0), fr = fi - k0;
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      const dxs = (x - SUNX) / 120, dys = (y - SUNY) / 170;
      const gl = clamp(1 - Math.sqrt(dxs * dxs + dys * dys), 0, 1);
      R.c[i] = mix(fr > bayer(x, y) ? SKY[k0 + 1] : SKY[k0], CREAM, gl * gl * 0.8);
      R.a[i] = 1;
      R.b[i] = 0;
      const e = shaftAt(x, y, sh);
      if (e < 0.05) continue;
      // the shaft is warm where it passes near the horizon and cooler overhead
      const wm = clamp(1 - (y - HZ) / -180, 0, 1);
      R.c[i] = mix(R.c[i], e > 0.7 ? CREAM : mix(NL[5], CREAM, wm), Math.min(0.52, e * 0.55));
      R.l[i] = CREAM;
      R.k[i] = e * 0.16;
    }
  });
  // a wide dawn bloom on the horizon, not a spotlight
  q.glow(SUNX, SUNY, 110, mix(NL[4], CREAM, 0.45), 0.09);
  q.glow(SUNX, SUNY, 52, mix(NL[5], CREAM, 0.6), 0.11);
  q.glow(SUNX, SUNY + 2, 22, CREAM, 0.16);
  sea(q, t, sh, NL, dn);
  far(q, t, sh, NL, dn);
  motes(q, t, sh, NL, dn);
}

export function draw(p, t, o) {
  const q = q2(p), NL = fit(o.other, 7);
  feathers(q, t, NL, (o.density || 1) * 6);
}

// the cloud sea, built the way a cumulus field reads from above: rows of flattened lobes, far rows pale and hazy,
// near rows bigger and cooler, each lobe lit on its crown and falling into shadow at its own feet
const ROWS = [
  { y: -42, rx: [9, 18], tone: 5, cream: 0.55, n: 26 },
  { y: -33, rx: [11, 21], tone: 4, cream: 0.34, n: 24 },
  { y: -24, rx: [12, 23], tone: 4, cream: 0.16, n: 22 },
  { y: -14, rx: [14, 26], tone: 3, cream: 0.05, n: 20 },
  { y: -4, rx: [16, 30], tone: 3, cream: 0, n: 18 },
  { y: 2, rx: [22, 38], tone: 3, cream: 0, n: 13 },
];

const sea = (q, t, sh, NL, dn) => {
  const CREAM2 = mix(NL[6], CREAM, 0.5);
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r];
    const n = Math.round(row.n * Math.min(1.7, dn));
    for (let k = 0; k < n; k++) {
      const R = (j) => rand(121 + r * 9, k, j);
      // sizes run the whole range, with the odd outsized mound, so the field never reads as tiled scallops
      const big = R(7) < (r === 0 ? 0.3 : 0.12) ? (r === 0 ? 2.3 : 1.6) : 1;
      const rx = (row.rx[0] + Math.pow(R(1), 1.4) * (row.rx[1] - row.rx[0])) * big;
      const ry = rx * (0.36 + R(2) * 0.26);
      const cx = -170 + ((k + 0.5) / n) * 340 + (R(3) - 0.5) * rx * 1.4 + (1 + r * 0.4) * Math.sin((TAU * t) / D + k * 0.8);
      const cy = row.y + (R(4) - 0.5) * 14 - ry * 0.5 + 1.5 * Math.sin((TAU * t) / D + k * 1.5);
      // the deeper into the frame a lobe sits, the cooler and darker it gets: that is what gives the sea its depth
      const base = row.tone + (R(5) < 0.34 ? 1 : 0) - (R(6) < 0.2 ? 1 : 0);
      const e = shaftAt(cx, cy - ry, sh) * 0.6;
      for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const top = cy - ry * Math.sqrt(Math.max(0, 1 - dx * dx));
        const bot = cy + ry * 1.15;
        for (let y = Math.floor(top); y < bot; y++) {
          const v = (y + 0.5 - top) / (bot - top);
          // two tones per lobe only: a third, darker step under every lobe turns the field into overlapping scales
          const tone = clamp(v < 0.3 ? base + 1 : (v > 0.82 && r > 2 ? base - 1 : base), 0, 6);
          let col = NL[tone];
          if (row.cream > 0) col = mix(col, tone >= 5 ? CREAM : mix(NL[5], CREAM, 0.5), row.cream);
          if (v < 0.24 && R(8) < 0.5) col = mix(col, CREAM2, 0.16 + 0.3 * Math.min(1, e));
          q.px(x, y, col);
          if (v < 0.1 && R(8) < 0.5) q.light(x, y, CREAM, (0.14 + 0.26 * Math.min(1, e)) * (1 - row.cream * 0.4));
        }
      }
    }
  }
};
// small distant cumulus above the sea: crisp pale tops, cooler flat bottoms
function far(q, t, sh, NL, dn) {
  const n = Math.round(11 * Math.min(1.6, dn));
  for (let k = 0; k < n; k++) {
    const R = (j) => rand(91, k, j);
    const cx = -150 + R(1) * 300 + 9 * (t / D) + 6 * Math.sin((TAU * t) / D + k);
    const cy = -120 + R(2) * 56;
    const r = 3 + R(3) * 6;
    const w = r * 2.6;
    const e = shaftAt(cx, cy, sh);
    for (let x = Math.ceil(cx - w / 2); x <= Math.floor(cx + w / 2); x++) {
      const dx = (x + 0.5 - cx) / (w / 2);
      const top = cy - r * Math.sqrt(Math.max(0, 1 - dx * dx));
      const bot = cy + r * 0.5;
      for (let y = Math.floor(top); y < bot; y++) {
        const v = (y + 0.5 - top) / (bot - top);
        const col = v < 0.3 ? mix(NL[6], CREAM, 0.35 + 0.4 * Math.min(1, e)) : v < 0.62 ? mix(NL[5], NL[6], 0.4) : mix(NL[4], NL[5], 0.3);
        q.px(x, y, col);
        if (v < 0.25) q.light(x, y, CREAM, 0.28);
      }
    }
  }
}

// dust drifting up through the light: invisible in the shade, a fleck of gold where it crosses a shaft
function motes(q, t, sh, NL, dn) {
  const n = Math.round(100 * Math.min(1.6, dn));
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(61, i, k);
    const ph = ((t / D) * (0.5 + R(2) * 1.1) + R(3)) % 1;
    const y = HZ - 8 - ph * 150 - (R(4) - 0.5) * 4;
    const x = -160 + R(5) * 320 + (7 + R(6) * 12) * Math.sin((TAU * t / D) * (1 + Math.floor(R(7) * 2)) + R(8) * TAU);
    if (y > HZ - 4) continue;
    const e = shaftAt(x, y, sh) * (0.4 + 0.6 * R(1));
    if (e < 0.13) continue;
    const k2 = Math.min(1, e);
    q.px(x, y, mix(NL[6], CREAM, k2));
    q.glow(x, y, R(9) < 0.3 ? 3.2 : 2.2, CREAM, 0.22 * k2);
  }
}

// a few feathers sinking through the light, rocking side to side
function feathers(q, t, NL, n) {
  for (let i = 0; i < Math.round(n); i++) {
    const R = (k) => rand(71, i, k), life = 0.6 + R(1) * 0.24;
    const ph = (t / D + R(2)) % 1;
    if (ph > life) continue;
    const u = ph / life;
    const y = HZ - 6 + u * 150;
    const x = -140 + R(3) * 280 + 22 * Math.sin((TAU * u) * (1.2 + R(4) * 1.4) + R(5) * TAU) * u;
    const a = 1 - smooth(0.72, 1, u);
    if (a <= 0.2) continue;
    const tilt = Math.sin((TAU * u) * 2 + R(6) * TAU) > 0 ? 1 : -1;
    q.px(x, y, mix(NL[6], CREAM, 0.6));
    q.px(x + tilt, y + 1, mix(NL[5], NL[6], 0.4));
    q.px(x - 1, y, NL[5]);
    q.px(x, y + 2, NL[4]);
    q.glow(x, y, 4, CREAM, 0.22 * a);
  }
}
