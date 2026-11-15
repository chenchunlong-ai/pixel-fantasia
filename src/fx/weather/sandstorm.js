// 沙尘暴 v2：a brownout rebuilt on the blizzard's streak-and-sheet skeleton, dressed with the
// library's own pieces — gasPuff dust banks rolling across the sky and along the ground (each
// born once a loop, so the churn never seams), grit stones tumbling through the air (nature/_lib
// drawRock), wind streaks with bright heads. The streak layers, gusty sheets and dune crests
// follow Sprite Fusion's open-source snow (https://www.spritefusion.com/pixel-art-vfx/snow),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { cycle, fit, clamp, smooth, rand, wrap, mix, TAU, hex } from "../../core/index.js";
import { clip, rows, field, sample, trips } from "./_lib.js";
import { gasPuff, drawRock, stoneShape } from "../nature/_lib.js";

export const meta = {
  name: "Sandstorm",
  desc: "A brownout: the air itself turns to dust — banks of rolling sand clouds pass overhead, grit tumbles through the gale, streaks race past flat and dunes stream their crests away.",
  tags: ["weather", "sandstorm", "sand", "dust", "wind", "desert", "storm", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#140c04", "#2c1c0c", "#54371a", "#7c5626", "#a67a3a", "#caa05c", "#e6c488", "#f8e8c0"],
    density: 1,
    seed: 10,
  },
};

const D = 8;
const gustAt = (x, t) => 0.5 + 0.5 * Math.sin(TAU * ((x + 160) / 400 - (2 * t) / D) + 0.8);
const bank = (x) => -3 + 1.6 * Math.sin(x * 0.04 + 2) + 0.9 * Math.sin(x * 0.11 + 1);
// far to near: how many, crossings a loop, streak length, fall while crossing, colours (tail, body, head)
const LAYERS = [
  { n: 250, m: [3, 4], len: [3, 6], drop: [4, 18], col: [3, 4, 5] },
  { n: 130, m: [4, 5], len: [6, 10], drop: [8, 30], col: [4, 5, 6] },
  { n: 34, m: [6, 7], len: [12, 20], drop: [14, 40], col: [4, 6, 7], near: true },
];

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8);
  // the air itself is dust: a near-opaque brownout, darkest up high, warm low down
  rows(p, meta, -170, 9, (y, R) => {
    const k = (y + 170) / 180;
    R.c.fill(mix(hex("#0e0803"), C[3], k * k));
    R.a.fill(0.94 + 0.06 * k);
    R.b.fill(1);
  });
  sheets(p, t, S, C, 0);
  streaks(q, t, S, C, 0, o.density);
  streaks(q, t, S, C, 1, o.density);
  banks(q, t, S, C, 0, o.density);
  grit(q, t, S, C, 0, o.density);
  ground(p, q, t, S, C, o.density);
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8);
  sheets(p, t, S, C, 1);
  streaks(q, t, S, C, 2, o.density);
  banks(q, t, S, C, 1, o.density);
  grit(q, t, S, C, 1, o.density);
}

// sand streaks: each slot crosses the canvas a whole number of times a loop at its own height,
// drifting down as it goes; the gusts stretch and brighten it
function streaks(q, t, S, C, L, dn = 1) {
  const Ly = LAYERS[L], sd = S * 17 + L, [c0, c1, c2] = Ly.col.map((i) => C[i]);
  trips(t, D, Math.round(Ly.n * dn), sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m), R = (n) => rand(sd, i, j, n), drop = Ly.drop[0] + R(3) * (Ly.drop[1] - Ly.drop[0]);
    const x = -190 + 380 * u, y = -178 + R(1) * 182 + drop * u + 3 * Math.sin(u * TAU * (1 + R(5)) + R(6) * 6);
    if (y > bank(x) - 1) return;
    const g = gustAt(x, t);
    if (!Ly.near && R(7) > 0.45 + 0.75 * g) return;
    const L = (Ly.len[0] + R(2) * (Ly.len[1] - Ly.len[0])) * (0.7 + 0.6 * g), dx = 380 / (D / m), dy = drop / (D / m), l = Math.hypot(dx, dy);
    const ux = dx / l, uy = dy / l;
    q.line(x - ux * L, y - uy * L, x - ux * L * 0.45, y - uy * L * 0.45, c0, (v) => 0.3 + 0.7 * v);
    q.line(x - ux * L * 0.45, y - uy * L * 0.45, x - ux, y - uy, c1);
    q.px(x, y, g > 0.6 && Ly.near ? C[7] : c2);
    if (Ly.near) q.glow(x, y, 5, C[5], 0.1 + 0.1 * g);
  });
}

// sheets of blown sand: translucent bands racing with the wind, thick in a gust; the far pass
// also thickens the brownout behind everything
const GX = new Float32Array(320), WV = new Float32Array(320);
function sheets(p, t, S, C, near) {
  const F = field(S * 3 + 7 + near, 256, 128), shift = (256 * (near ? 3 : 2) * t) / D, c = near ? C[6] : C[5], y0 = near ? -105 : -170;
  const sy = near ? 4.5 : 3.2, th = near ? 0.5 : 0.46;
  for (let i = 0; i < 320; i++) (GX[i] = gustAt(i - 160 + 0.5, t)), (WV[i] = 5 * Math.sin((i - 160) * 0.021 - (TAU * t) / D + near * 2));
  rows(p, meta, y0, 4, (y, R) => {
    const fade = near ? smooth(-105, -40, y) : 1;
    for (let i = 0; i < 320; i++) {
      const g = GX[i], n = sample(F, (i - 160) * 0.16 - shift, (y + WV[i]) * sy + 40), d = (n - th) * 2.4 * (0.35 + g) * fade;
      if (near) {
        if (d <= 0.02) continue;
        R.c[i] = c;
        R.a[i] = Math.min(0.55, d);
      } else {
        R.c[i] = d > 0.08 ? c : mix(C[2], C[3], 0.5);
        R.a[i] = Math.min(1, 0.2 + 0.14 * g + Math.max(0, d)); // a light veil: the sky fill carries the brownout
      }
      R.b[i] = 1;
      if (d > 0.05) (R.l[i] = C[5]), (R.k[i] = d * 0.07);
    }
  });
}

// banks of rolling dust: clusters of soft puffs crossing the scene, each puff swelling and dying
// on its own clock (born once a loop). Far banks ride high and dim; the near bank rolls low,
// big and bright, over the dunes
function banks(q, t, S, C, near, dn = 1) {
  const sd = S * 31 + near, n = Math.round((near ? 9 : 14) * dn);
  cycle(t, D, n, sd, (r) => r.range(0.3, 0.55), (age, life, R, i) => {
    const k = age / life, born = t - age;
    const y0 = near ? bank(-160) + 6 : -150 + R.range(0, 70);
    const x = -190 + 380 * (((R.range(0, 1) + born / D) % 1)) + (near ? 0 : 0);
    const g = gustAt(x, t), np = near ? 5 : 3;
    for (let j = 0; j < np; j++) {
      const jr = (n2) => rand(sd, i, j, n2);
      const px = x + (j - (np - 1) / 2) * (near ? 14 : 9) + jr(1) * 5, py = y0 - jr(2) * (near ? 16 : 10) + j * 2;
      const r = (near ? 7 : 4.5) + jr(3) * 3, fade = Math.sin(Math.PI * Math.min(1, k * 1.15));
      const a = (near ? 0.5 : 0.3) * fade;
      gasPuff(q, px, py, r * (0.7 + 0.5 * fade), a, C[near ? 2 : 1], C[near ? 3 : 2], C[near ? 4 : 3], near && jr(4) < 0.4 ? C[5] : 0);
    }
    if (near) q.glow(x, y0 - 6, 30, C[4], 0.1);
  });
}

// grit torn off the dunes: pebbles and stones tumbling through the gale, hopping as they go
function grit(q, t, S, C, near, dn = 1) {
  const sd = S * 43 + near, n = Math.round((near ? 10 : 16) * dn);
  cycle(t, D, n, sd, (r) => r.range(0.2, 0.4), (age, life, R, i) => {
    const k = age / life, x0 = -170 + R.range(0, 60), v = 55 + R.range(0, 60);
    const x = x0 + v * age, hop = Math.abs(Math.sin(age * (6 + R.range(0, 5)) + i)) * (near ? 9 : 5) * (1 - k * 0.5);
    const y = bank(x) - 1 - hop - k * (near ? 10 : 4);
    const spin = age * R.range(8, 16), s = (near ? 2.6 : 1.6) + R.range(0, 1.2);
    drawRock(q, x, y, s, spin, stoneShape(R, 5), C, (1 - k) * (near ? 1 : 0.75), false);
  });
}

// the ground: dunes with a lit crest, sand streaming low along them, plumes blown off the crests
function ground(p, q, t, S, C, dn = 1) {
  const F = field(S * 5 + 1, 256, 128), shift = (256 * 4 * t) / D;
  for (let i = 0; i < 320; i++) (GX[i] = gustAt(i - 160 + 0.5, t)), (WV[i] = bank(i - 160 + 0.5));
  rows(p, meta, -18, 9, (y, R) => {
    for (let i = 0; i < 320; i++) {
      const x = i - 160 + 0.5, top = WV[i], d = y - top;
      if (d >= 0) {
        R.c[i] = d < 1 ? C[6] : d < 2 ? C[5] : d < 4 ? C[4] : C[3];
        if (d < 1) (R.l[i] = C[6]), (R.k[i] = 0.1);
        continue;
      }
      // spindrift: a low, fast, streaky haze of sand hugging the dunes
      if (y < -15) continue;
      const n = sample(F, x * 0.5 - shift, y * 3 + 9), s = (n - 0.5) * 3 * smooth(-15, -1, y) * (0.4 + GX[i]);
      if (s > 0.02) (R.c[i] = C[5]), (R.a[i] = Math.min(0.55, s)), (R.b[i] = 1);
    }
  });
  // grains skipping along the crest
  trips(t, D, Math.round(46 * dn), S * 23, 8, 10, (u, k, m, i) => {
    const j = wrap(k, m), x = -175 + 350 * u, y = bank(x) - 1 - rand(S, i, j, 1) * 6 * Math.abs(Math.sin(u * 9 + i));
    q.px(x, y, rand(S, i, j, 2) < 0.5 ? C[6] : C[5]);
    q.px(x - 1, y, C[4]);
  });
}
