// 冰龙卷：a cyclone over a frozen lake under a pure black sky. The floor is black ice strewn with
// the library's own ice pieces — blade() ice spikes standing round the vortex foot and hanging
// from the cloud base, snowflakes whipping past. The funnel, cloud deck and lightning come from
// the shared scene core (_tornado.js, after the library's own nature/tornado; the ice pieces are
// the library's ice/_lib).
import { cycle, rand, smooth, wrap, TAU, hex, WHITE } from "../../core/index.js";
import { clip, rows, trips } from "./_lib.js";
import { blade, snowflake } from "../ice/_lib.js";
import { setMeta, makeTornado } from "./_tornado.js";

export const meta = {
  name: "Ice cyclone",
  desc: "A cyclone spinning on black ice: ice spikes stand round its foot and hang from the cloud base, snow whips past, shards spiral up the funnel and a cold bolt splits the dark.",
  tags: ["weather", "tornado", "ice", "winter", "storm", "lightning", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { density: 1, seed: 16 },
};
setMeta(meta);

const D = 10, FH = 150, DEN = meta.options.density;
const C = ["#101828", "#1c2a44", "#2a3e60", "#3c547c", "#527098", "#7290b4", "#a2c0d8", "#d8ecf8"];
const Dst = ["#24344c", "#3c5474", "#6284a8", "#9cc0dc", "#e2f2fc"].map(hex);
const ICE = ["#24344c", "#3c5474", "#527098", "#7290b4", "#a2c0d8", "#d8ecf8", "#eef8ff"].map(hex);

// ice spikes standing on the floor, taller near the funnel where the cold updraft feeds them
const spikes = Array.from({ length: 11 }, (_, i) => {
  const x = -140 + i * 28 + rand(16, i, 45) * 12;
  return { x, h: (4 + rand(16, i, 46) * 7) * (1 + Math.max(0, 1 - Math.abs(x) / 110) * 1.2), w: 2.2 + rand(16, i, 47) * 1.6 };
});
// icicles hanging from the storm deck's base
const icicles = [-120, -66, -8, 58, 112].map((x, i) => ({ x, h: 5 + rand(16, i, 48) * 7, w: 2 + rand(16, i, 49) * 1.4 }));

const TH = {
  D, FH, C, Dst,
  bolt: "#a2e0ff", boltHot: "#ffffff", footGlow: hex("#9cc0dc"),
  sky(p) {
    // pure black — the pale funnel and the ice carry the frame
    rows(p, meta, -170, 9, (y, R) => {
      R.c.fill(hex("#000000"));
      R.a.fill(1);
      R.b.fill(0);
    });
  },
  ground(p, q, t, S) {
    // the black ice sheet: a faint cold sheen at the horizon edge, then darkness
    rows(p, meta, 0, 9.5, (y, R) => {
      R.c.fill(y < 1 ? hex("#3c5474") : y < 3 ? hex("#101c2c") : hex("#060a12"));
      R.a.fill(1);
      R.b.fill(0);
    });
    // ice blades standing on the sheet, lit on their left face
    for (const sp of spikes) blade(q, sp.x, 1, sp.x + (rand(16, sp.x, 51) - 0.5) * 3, 1 - sp.h, sp.w, ICE, { glint: 0.5 });
    // icicles hanging from the storm deck, pointing down at the frame's top
    for (const ic of icicles) blade(q, ic.x, -169, ic.x, -169 + ic.h, ic.w, ICE, { a: 0.9, glint: 0.4 });
    // cold light pooling where the funnel stands
    q.glow(0, 3, 40, hex("#9cc0dc"), 0.16);
  },
  fall(p, q, t, S, near) {
    // 它在下冰雨：a fall of ice — steep white ice-streaks plunging past the funnel, snowflakes
    // tumbling down among them, far ones thin, near ones with a cold glint
    const sd = S * 43 + near;
    trips(t, D, Math.round((near ? 60 : 130) * DEN), sd, 5, 7, (u, k, m, i) => {
      const j = wrap(k, m), R = (c) => rand(sd, i, j, c);
      const end = -10 - R(1) * (near ? 6 : 80), y = -174 + (end + 174) * u;
      const x = -168 + R(2) * 336 - (end - y) * 0.12;
      const kind = R(3);
      if (kind < 0.7) {
        // an ice streak, near-vertical
        const L = (near ? 7 : 3) + R(4) * (near ? 5 : 2);
        q.line(x, y - L, x, y, near ? hex("#d8ecf8") : hex("#3c5474"), near ? 0.9 : 0.6);
        if (near) { q.px(x, y, WHITE); q.px(x, y - L * 0.4, hex("#a2c0d8"), 0.8); }
      } else {
        // a tumbling snowflake drifting down
        snowflake(q, x + Math.sin(u * TAU * 2 + R(5) * 6) * 5, y, 1 + R(6) * 1.4, u * R(7) * 12, 0, ICE, { a: near ? 0.95 : 0.55 });
      }
      if (near && R(8) < 0.25) q.glow(x, y, 3, hex("#a2c0d8"), 0.12);
    });
  },
  groundFront(p, q, t, S) {
    // snow snatched off the sheet, whipping toward the vortex foot
    cycle(t, D, Math.round(18 * DEN), S * 23, (r) => r.range(0.06, 0.11), (age, life, R, i) => {
      const k = age / life, x0 = -150 + R.range(0, 300), pull = Math.max(0, 1 - Math.abs(x0) / 110);
      const x = x0 + Math.sign(-x0 || 1) * 36 * pull * k, y = -1 - Math.abs(Math.sin(age * 20 + i)) * 4 * (1 - k) - 8 * k;
      snowflake(q, x, y, 1 + R.range(0, 1.6), age * R.range(6, 12), 0, ICE, { a: (1 - k) * 0.95 });
    });
  },
  debris(p, q, g, t, S, back) {
    // shards of ice and snow flecks spiralling up and flung off the top
    cycle(t, D, Math.round(20 * DEN), S * 17 + (back ? 0 : 1), (r) => r.range(0.35, 0.55), (age, life, R) => {
      const k = age / life, u = smooth(0.05, 1.1, k), th = R.range(0, TAU) + (2.2 + R.range(0, 1)) * TAU * k, sn = Math.sin(th);
      if (sn > 0 === back) return;
      const r = g.rad(u) * (1.05 + R.range(0, 0.5)), x = g.ax(u) + r * Math.cos(th), y = Math.max(-168, -u * FH + r * 0.28 * sn);
      const fk = 1 - smooth(0.8, 1, k), spin = age * R.range(4, 9);
      if (R.next() < 0.6) {
        // a shard: a short bright sliver turning as it flies
        const ca = Math.cos(spin) * 2.2, sa = Math.sin(spin) * 1.2;
        q.line(x - ca, y - sa, x + ca, y + sa, R.next() < 0.5 ? ICE[6] : ICE[4], fk);
        q.dot(x + ca, y + sa, WHITE, fk);
      } else snowflake(q, x, y, 1 + R.range(0, 1.4), spin, 0, ICE, { a: fk * 0.9 });
    });
  },
};

const api = makeTornado(TH);
export function drawBack(p, t, o) { api.drawBack(p, t, o); }
export function draw(p, t, o) { api.draw(p, t, o); }
