// 水龙卷：a waterspout over a flooded plain under a pure black sky. The floor is standing water
// drawn with the library's own water pieces — lace shimmer crawling over the pools, rings
// spreading where spray falls back, spray skidding off the surface into the vortex. The funnel,
// cloud deck and lightning come from the shared scene core (_tornado.js, after the library's own
// nature/tornado; the water surface follows the library's water/_lib, after Sprite Fusion's
// open-source water, MIT, (c) 2026 Hugo Duprez).
import { cycle, rand, smooth, wrap, TAU, hex, WHITE } from "../../core/index.js";
import { clip, rows, trips } from "./_lib.js";
import { WATER, lace, ring } from "../water/_lib.js";
const W = WATER.map(hex); // the lib palette is hex strings; the painter wants packed colours
import { setMeta, makeTornado } from "./_tornado.js";

export const meta = {
  name: "Waterspout",
  desc: "A tornado standing on a flooded plain: black cloud above, black water below, lace shimmer crawling over the pools, spray whipped off into the vortex, a bolt splitting the dark.",
  tags: ["weather", "tornado", "waterspout", "water", "storm", "lightning", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { density: 1, seed: 15 },
};
setMeta(meta);

const D = 10, FH = 150, DEN = meta.options.density;
const C = ["#0e1620", "#1a2634", "#28394c", "#3a4f68", "#4f6884", "#6e8aa6", "#9ab4cc", "#cfe0ec"];
const Dst = ["#223244", "#3a5068", "#5c7c98", "#8ab0c8", "#cfe4f2"].map(hex);

// the flooded floor: shallow water everywhere, broken into pools that catch what little light there is
const pools = Array.from({ length: 9 }, (_, i) => {
  const x = -158 + i * 36 + rand(15, i, 61) * 14, w = 24 + rand(15, i, 63) * 24;
  return { x0: x, x1: x + w, y: 2 + Math.floor(rand(15, i, 62) * 5), rx: (24 + rand(15, i, 63) * 24) / 2 };
});

const TH = {
  D, FH, C, Dst,
  bolt: "#c8b8ff", boltHot: "#ffffff", footGlow: hex("#8ab0c8"),
  sky(p) {
    // pure black — cloud, spout and water carry the frame
    rows(p, meta, -170, 9, (y, R) => {
      R.c.fill(hex("#000000"));
      R.a.fill(1);
      R.b.fill(0);
    });
  },
  ground(p, q, t, S) {
    // black water with a lit lip at the horizon edge; each pool shimmers with crawling lace
    rows(p, meta, 0, 9.5, (y, R) => {
      R.c.fill(y < 1 ? hex("#3a5068") : hex("#060a0e"));
      R.a.fill(1);
      R.b.fill(0);
    });
    for (const pool of pools) {
      // the lace: a living net of glints crawling over the water, brighter toward the pool's heart
      const k = 0.5 + 0.3 * Math.sin((TAU * t) / D + pool.x0);
      lace(q, (pool.x0 + pool.x1) / 2, pool.y, pool.rx, 2.4, k, W, t, (pool.x0 + 160) * 0.11);
      q.px(Math.round((pool.x0 + pool.x1) / 2), pool.y, hex("#cdf1ff"));
    }
    cycle(t, D, Math.round(12 * DEN), S * 29, (r) => r.range(0.16, 0.28), (age, life, R) => {
      const pool = pools[Math.floor(R.range(0, pools.length))];
      const X = (pool.x0 + pool.x1) / 2 + R.range(-pool.rx * 0.5, pool.rx * 0.5);
      const k = (age / life) * 0.9;
      ring(q, X, pool.y, 1 + k * 9, 0.24, 1 - k, W, { n: 2, gap: 3, glint: 0.4 * (1 - k), seed: R.int(0, 99) });
    });
  },
  fall(p, q, t, S, near) {
    // driving rain sweeping past the spout, after the thunderstorm's: slanted streaks with lit
    // heads, far ones thin and dim, near ones long and bright
    const SL = 0.42, ux = SL / Math.hypot(SL, 1), uy = 1 / Math.hypot(SL, 1);
    const LAY = near
      ? { n: 70, m: [26, 32], L: [9, 14], c: [hex("#6e8aa6"), hex("#9ab4cc"), hex("#cfe0ec")] }
      : { n: 200, m: [20, 25], L: [3, 5], c: [hex("#28394c"), hex("#3a4f68"), hex("#4f6884")] };
    const sd = S * 37 + near;
    trips(t, D, Math.round(LAY.n * DEN), sd, LAY.m[0], LAY.m[1], (u, k, m, i) => {
      const j = wrap(k, m), R = (c) => rand(sd, i, j, c);
      const end = -14 - R(1) * (near ? 4 : 90), y = -176 + (end + 176) * u;
      const x = -170 + R(2) * 360 - (end - y) * SL;
      const L = LAY.L[0] + R(3) * (LAY.L[1] - LAY.L[0]);
      q.line(x - ux * L, y - uy * L, x - ux * L * 0.45, y - uy * L * 0.45, LAY.c[0], near ? 1 : 0.7);
      q.line(x - ux * L * 0.45, y - uy * L * 0.45, x - ux, y - uy, LAY.c[1]);
      q.px(x, y, LAY.c[2]);
      if (near) q.glow(x, y - 2, 4, Dst[3], 0.1);
    });
  },
  groundFront(p, q, t, S) {
    // spray skidding off the surface toward the vortex foot, beading as it flies
    cycle(t, D, Math.round(16 * DEN), S * 23, (r) => r.range(0.06, 0.1), (age, life, R, i) => {
      const k = age / life, x0 = -150 + R.range(0, 300), pull = Math.max(0, 1 - Math.abs(x0) / 110);
      const x = x0 + Math.sign(-x0 || 1) * 38 * pull * k, y = -1 - Math.abs(Math.sin(age * 22 + i)) * 5 * (1 - k) - 9 * k;
      q.dot(x, y, k < 0.5 ? hex("#cdf1ff") : hex("#86d3f5"), 1 - k);
      if (R.next() < 0.3) q.dot(x - 1, y + 1, hex("#45a9e3"), (1 - k) * 0.7);
    });
  },
  debris(p, q, g, t, S, back) {
    // spray torn off the water, spiralling up the funnel and flung off the top
    cycle(t, D, Math.round(22 * DEN), S * 17 + (back ? 0 : 1), (r) => r.range(0.35, 0.55), (age, life, R) => {
      const k = age / life, u = smooth(0.05, 1.1, k), th = R.range(0, TAU) + (2.2 + R.range(0, 1)) * TAU * k, sn = Math.sin(th);
      if (sn > 0 === back) return;
      const r = g.rad(u) * (1.05 + R.range(0, 0.5)), x = g.ax(u) + r * Math.cos(th), y = Math.max(-168, -u * FH + r * 0.28 * sn);
      const fk = 1 - smooth(0.8, 1, k);
      q.dot(x, y, k < 0.45 ? Dst[4] : Dst[3], fk);
      if (!back && R.next() < 0.3) q.line(x, y, x + 1, y + 2, Dst[3], fk * 0.8); // a drop running back down
    });
  },
};

const api = makeTornado(TH);
export function drawBack(p, t, o) { api.drawBack(p, t, o); }
export function draw(p, t, o) { api.draw(p, t, o); }
