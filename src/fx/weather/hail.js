// 冰雹：hail, an extreme storm after the rain recipe (Sprite Fusion's open-source rain,
// https://www.spritefusion.com/pixel-art-vfx/rain, MIT License, Copyright (c) 2026 Hugo Duprez):
// depth layers of falling ice under a green-black sky — far stones fade into the dark, near ones
// are round white cores that bounce once where they land, flash on impact, and ring the puddles.
import { fit, clamp, smooth, rand, wrap, mix, WHITE, hex } from "../../core/index.js";
import { clip, pass, field, sample, trips, crown, bayer } from "./_lib.js";

export const meta = {
  name: "Hail",
  desc: "An ice storm: white hailstones plunge at four depths under a green-black sky, bounce and flash where they land, ring the puddles, mist low on the frozen ground.",
  tags: ["weather", "hail", "ice", "storm", "extreme", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 8,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#0d1420", "#18243a", "#26385a", "#3a547e", "#5878a4", "#8cb0d8", "#c8e4f8", "#ffffff"],
    density: 1,
    seed: 12,
  },
};

const D = 8, SLANT = -0.08, UX = SLANT / Math.hypot(SLANT, 1), UY = 1 / Math.hypot(SLANT, 1);
// the depths, far to near: how many, falls a loop (hail falls fast), radius, colors (rim, body, core), where they land
const LAYERS = [
  { n: 170, m: [11, 14], r: 0.8, col: [2, 2, 4], stop: [-80, -6] },
  { n: 120, m: [15, 18], r: 1.1, col: [2, 3, 5], stop: [-45, -2] },
  { n: 100, m: [20, 24], r: 1.6, col: [3, 4, 6], z: [0, 1.4] },
  { n: 44, m: [26, 30], r: 2.6, col: [3, 5, 7], z: [2, 6.5], near: true },
];

// puddles on the icy floor, as in the rain
function pools(S) {
  return Array.from({ length: 5 }, (_, i) => {
    const x = -150 + i * 66 + rand(S, i, 61) * 30, w = 16 + rand(S, i, 63) * 26;
    return { x0: x, x1: x + w, y: 3 + Math.floor(rand(S, i, 62) * 3) };
  });
}
const poolAt = (P, x, y) => P.find((p) => x >= p.x0 + 2 && x <= p.x1 - 2 && Math.abs(y - p.y) < 1.5);

export function drawBack(p, t, o) {
  t = Math.round(t * 3e4) / 3e4;
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8), P = pools(S);
  // a green-black hail sky, the ominous cast hailstorm light loves, thicker toward the ground
  const haze = mix(hex("#0c1410"), C[1], 0.55);
  pass(p, meta, -170, -0.5, (x, y, out) => {
    out.c = haze;
    out.a = 0.62 + 0.3 * smooth(-170, 0, y);
    out.b = 1;
  });
  floor(q, t, S, C, P);
  for (let L = 0; L < 3; L++) layer(q, t, S, C, P, L, o.density);
  mist(p, t, S, C);
}

export function draw(p, t, o) {
  t = Math.round(t * 3e4) / 3e4;
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8), P = pools(S);
  layer(q, t, S, C, P, 3, o.density);
}

// one depth of hail: each stone falls a whole number of times a loop, somewhere new each time;
// near stones bounce once where they land
function layer(q, t, S, C, P, L, density) {
  const Ly = LAYERS[L], sd = S * 11 + L, [c0, c1, c2] = Ly.col.map((i) => C[i]);
  const n = Math.round(Ly.n * density);
  trips(t, D, n, sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m), R = (c) => rand(sd, i, j, c);
    const end = Ly.z ? Ly.z[0] + R(1) * (Ly.z[1] - Ly.z[0]) : Ly.stop[0] + R(1) * (Ly.stop[1] - Ly.stop[0]);
    const y0 = -172 - Ly.r, y = y0 + (end - y0) * u, x = -166 + R(2) * 332 - (end - y) * SLANT;
    const a = Ly.z ? 1 : Math.min(1, (1 - u) * 5);
    stone(q, x, y, Ly.r * (0.8 + R(3) * 0.4), c0, c1, c2, a);
    if (Ly.near) q.glow(x, y - 2, 4, C[5], 0.12);
    if (!Ly.z) return;
    // the stones before this one landed: a bounce, a flash, or rings sliding along a puddle
    const dur = D / m;
    for (let back = 1; back < 4; back++) {
      const age = u * dur + (back - 1) * dur;
      if (age > 0.55) break;
      const jp = wrap(k - back, m), z = Ly.z[0] + rand(sd, i, jp, 1) * (Ly.z[1] - Ly.z[0]), xp = -166 + rand(sd, i, jp, 2) * 332;
      if (rand(sd, i, jp, 5) > (Ly.near ? 1 : 0.7)) continue;
      const pool = Ly.near && poolAt(P, xp, z);
      if (pool) rings(q, xp, pool, age, C);
      else bounce(q, xp, z, age, Ly.r * (0.8 + rand(sd, i, jp, 3) * 0.4), c2, c1, C);
    }
  });
}

// a hailstone: a round white core, an ice-blue body, a dark rim
function stone(q, x, y, r, rim, body, core, a) {
  if (r < 1.1) {
    q.dot(x, y, core, a);
    return;
  }
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const d = (dx * dx + dy * dy) / (r * r);
      if (d > 1) continue;
      q.px(x + dx, y + dy, d > 0.55 ? body : d > 0.18 ? core : WHITE, a * (d > 0.9 ? 0.7 : 1));
    }
  if (r > 1.8) q.px(x - r * 0.35, y - r * 0.35, WHITE, a); // the cold glint
}

// a landed stone: one low bounce, then a white flash where it struck
function bounce(q, x, z, age, r, c2, c1, C) {
  const bt = 0.22; // the bounce lasts this fraction of the loop unit
  if (age < 0.06) {
    q.dot(x, z, WHITE);
    q.glow(x, z - 1, 5, C[5], 0.35 * (1 - age / 0.06));
    return;
  }
  if (age > bt) return;
  const k = age / bt, h = 5 * r * 0.28 * Math.sin(Math.PI * k), fade = 1 - k;
  // a hop forward, shrinking
  stone(q, x + 2 * k, z - h, r * (1 - 0.45 * k), C[3], c1, c2, fade);
}

// a stone in a puddle: a bright point, then rings seen edge-on, sliding apart, twice
function rings(q, x, pool, age, C) {
  const X = Math.round(x), y = pool.y;
  if (age < 0.05) q.px(X, y, C[7]);
  for (let r = 0; r < 2; r++) {
    const a = age - r * 0.16, u = a / 0.5;
    if (u <= 0 || u >= 1) continue;
    const w = Math.round(1 + 7 * Math.sqrt(u)), c = u < 0.4 && !r ? C[6] : C[5];
    for (const s of [-1, 1])
      for (let d = 0; d < (u < 0.6 ? 2 : 1); d++) {
        const px = X + s * (w - d);
        if (px > pool.x0 && px < pool.x1) q.px(px, y, c);
      }
  }
}

// the icy floor: a lit lip over a dark line, a cold sheen, puddle strips holding the sky
function floor(q, t, S, C, P) {
  pass(q, meta, 0, 9.5, (x, y, out) => {
    if (y < 1) return void ((out.c = C[4]), (out.l = C[5]), (out.k = 0.08));
    if (y < 2) return void (out.c = C[1]);
    out.c = C[0];
    out.a = 0.55;
    out.b = 1;
    for (const p of P)
      if (x >= p.x0 && x < p.x1 && Math.floor(y) === p.y) {
        const edge = x < p.x0 + 2 || x >= p.x1 - 2;
        out.c = edge ? C[3] : C[4];
        out.a = 1;
        out.b = 0;
        out.l = C[5];
        out.k = 0.06;
      }
  });
  // a glint that slides slowly along each puddle
  P.forEach((p, i) => {
    const gx = Math.round(p.x0 + 3 + (p.x1 - p.x0 - 6) * (0.5 + 0.5 * Math.sin((Math.PI * 2 * t) / D + i * 1.9)));
    q.px(gx, p.y, C[6]);
    q.glow(gx, p.y, 4, C[5], 0.2);
  });
}

// mist kicked up by the impacts, drifting low along the ground
function mist(p, t, S, C) {
  const M = field(S + 9, 256, 128, [4, 8, 16, 32]), drift = (256 * t) / D, crest = mix(C[4], C[5], 0.5);
  const dens = (x, y) => {
    const prof = smooth(-22, -4, y) * (1 - smooth(7, 10, y));
    return prof * (0.62 + (sample(M, x * 0.45 + drift, y * 4 + 30) - 0.5) * 2);
  };
  pass(p, meta, -20, 9, (x, y, out) => {
    const d = dens(x, y);
    if (d < 0.28) return;
    const th = bayer(x, y) * 0.06;
    out.b = 1;
    if (d > 0.46 + th && dens(x, y - 1) < 0.43) (out.c = crest), (out.a = 0.5);
    else (out.c = d > 0.58 + th ? C[4] : C[3]), (out.a = clamp((d - 0.28) * 1.6) * 0.5);
    out.l = C[4];
    out.k = (d - 0.3) * 0.1;
  });
}
