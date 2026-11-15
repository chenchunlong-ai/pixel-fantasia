// 火龙卷：a tornado feeding on a burning field under a pure black sky. The floor is a field of
// fire drawn with the library's own flame pieces — flameTongue stands, flameBlade arcs bent hard
// toward the vortex, licks torn off and flying, embers and sparks whipped up into it. The funnel,
// cloud deck and lightning are the shared scene core (_tornado.js, after the library's own
// nature/tornado; the flame recipe is Sprite Fusion's open-source fire, MIT, (c) 2026 Hugo Duprez).
import { cycle, fit, rand, smooth, wrap, mix, TAU, hex } from "../../core/index.js";
import { clip, rows, trips } from "./_lib.js";
import { noiseFor, hotFirst, flameTongue, flameBlade, lick, ember, spark, LAYERS } from "../fire/_lib.js";
import { setMeta, makeTornado } from "./_tornado.js";

export const meta = {
  name: "Fire cyclone",
  desc: "A tornado feeding on a burning field: walls of flame lean into the vortex, licks and embers are torn off and whipped round it, a bolt splits the smoke.",
  tags: ["weather", "tornado", "fire", "extreme", "storm", "lightning", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    density: 1,
    seed: 14,
  },
};
setMeta(meta);

const D = 10, FH = 148, N = noiseFor(D), HOT = fit(meta.options.palette, 9), H = hotFirst(HOT), DEN = meta.options.density;
const EMB = [hex("#ffe26b"), hex("#ff8a2a"), hex("#c9281f"), hex("#8a1f17")];

const TH = {
  D, FH,
  C: ["#1c0d0a", "#301410", "#4a2018", "#6a3222", "#8f4a2e", "#b86840", "#e09a58", "#ffc984"],
  Dst: ["#200a06", "#3a1410", "#5c2416", "#8a3c1e", "#c86a28"],
  bolt: "#c8b8ff", boltHot: "#ffffff", footGlow: hex("#ff8a2a"),
  sky(p) {
    // pure black: the fire and the funnel carry the whole frame
    rows(p, meta, -170, 9, (y, R) => {
      R.c.fill(hex("#000000"));
      R.a.fill(1);
      R.b.fill(0);
    });
  },
  ground(p, q, t, S) {
    // the burning field: a band of standing flame across the whole floor. Near the funnel the
    // flames stand taller and their tips are dragged toward the vortex; farther out they lean
    // with the inflow wind. Licks get torn off the taller ones and fly.
    for (let y = 0; y <= 9; y++) {
      const c = y < 2 ? hex("#180806") : hex("#0c0504");
      for (let x = -160; x < 160; x++) q.blend(x, y, c, 1);
    }
    for (let i = 0; i < Math.round(26 * DEN); i++) {
      const R = (n) => rand(S * 13 + 3, i, 0, n);
      const x = -154 + i * (308 / 26) + R(1) * 7, ac = Math.abs(x), pull = Math.max(0, 1 - ac / 120);
      const n = (S * 3 + i) * 19;
      const h = (5 + R(2) * 9) * (1 + pull * 1.3);
      // the tip swept hard toward the funnel — the fire is being drunk, not just burning
      const lean = -Math.sign(x) * (5 + 20 * pull) + (R(3) - 0.5) * 3;
      flameTongue(q, x, 2, h, 1.6 + R(4) * 1.4, lean, N, n, H, LAYERS, 0.7, 1.6);
      // taller flames shed licks that fly toward the vortex
      if (h > 9 && R(5) < 0.6) {
        const k = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((TAU * t) / D * (1 + R(6)) + i));
        lick(q, x + lean * 0.7, 2 - h - k * 5, k, 1.2 + R(7) * 1.2, H);
      }
      // far out, low arcs of flame swept flat by the inflow
      if (pull < 0.25 && R(8) < 0.5)
        flameBlade(q, x, 1, -Math.sign(x) * 0.9, -0.25, 6 + R(9) * 6, 1.2, 3, N, n + 31, H);
    }
    // pools of light where the fire stands thickest
    for (let i = 0; i < 5; i++) {
      const x = -120 + i * 60 + rand(S, i, 44) * 20;
      q.glow(x, 2, 26, hex("#ff8a2a"), 0.16);
    }
    q.glow(0, 2, 60, hex("#ff8a2a"), 0.2);
  },
  fall(p, q, t, S, near) {
    // 它在下手雨：burning embers rain down out of the smoke — licks of flame torn off the vortex
    // fall back through the dark, each a fire bead with a short tail above it and a glow
    const sd = S * 41 + near;
    trips(t, D, Math.round((near ? 34 : 60) * DEN), sd, 4, 6, (u, k, m, i) => {
      const j = wrap(k, m), R = (c) => rand(sd, i, j, c);
      const x = -170 + R(1) * 340 + Math.sin(u * TAU * 2 + R(2) * 6) * 6;
      const y = -172 + 170 * u, sw = Math.sin(u * TAU * (1 + R(3)) + R(4) * 6) * 8;
      const k2 = 1 - Math.abs(u - 0.5) * 1.2;
      const c = u < 0.4 ? hex("#ffe26b") : u < 0.75 ? hex("#ff8a2a") : hex("#c9281f");
      q.dot(x + sw, y, c, k2);
      q.line(x + sw, y - 3, x + sw, y - 1, hex("#c9281f"), k2 * 0.7); // the trail it leaves going down
      if (near && R(5) < 0.5) q.glow(x + sw, y, 3 + R(6) * 2, c, 0.3 * k2);
      if (u > 0.94 && near) q.px(x + sw, 3, hex("#8a1f17"), 0.6); // it lands in the fire and dies
    });
  },
  groundFront(p, q, t, S) {
    // embers climbing off the field and sparks streaking toward the vortex
    cycle(t, D, Math.round(30 * DEN), S * 21, (r) => r.range(0.1, 0.2), (age, life, R, i) => {
      const k = age / life, x0 = -150 + R.range(0, 300), pull = Math.max(0, 1 - Math.abs(x0) / 130);
      const x = x0 + Math.sign(-x0 || 1) * (26 + 30 * pull) * k + 4 * Math.sin(age * 9 + i);
      const y = 2 - (14 + 22 * pull) * k;
      ember(q, x, y, 1 - k, R.range(1.2, 2.4), EMB, i * 2.3);
    });
    cycle(t, D, Math.round(12 * DEN), S * 33, (r) => r.range(0.05, 0.09), (age, life, R) => {
      const k = age / life, x0 = -140 + R.range(0, 280), vx = Math.sign(-x0 || 1) * (40 + R.range(0, 40));
      spark(q, x0, 1 - k * 10, vx, -30 * R.range(0.5, 1), 1 - k, EMB);
    });
  },
  debris(p, q, g, t, S, back) {
    // burning scraps snatched off the field, spiralling up and flung off the top
    cycle(t, D, Math.round(18 * DEN), S * 17 + (back ? 0 : 1), (r) => r.range(0.4, 0.6), (age, life, R) => {
      const k = age / life, u = smooth(0.05, 1.1, k), th = R.range(0, TAU) + (2.2 + R.range(0, 1)) * TAU * k, sn = Math.sin(th);
      if (sn > 0 === back) return;
      const r = g.rad(u) * (1.1 + R.range(0, 0.5)), x = g.ax(u) + r * Math.cos(th), y = Math.max(-168, -u * FH + r * 0.28 * sn);
      const fk = 1 - smooth(0.8, 1, k), c = k < 0.5 ? hex("#ffc23d") : k < 0.8 ? hex("#ff8a2a") : hex("#8a1f17");
      q.dot(x, y, c, fk);
      q.line(x, y, x - 2, y + 1, hex("#5c2416"), fk * 0.9);
      if (back) return;
      q.glow(x, y, 3, c, 0.3 * fk);
    });
  },
};

const api = makeTornado(TH);
export function drawBack(p, t, o) { api.drawBack(p, t, o); }
export function draw(p, t, o) { api.draw(p, t, o); }
