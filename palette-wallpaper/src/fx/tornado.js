// 龙卷风：a whirlwind on a bare plain under a pure black sky — a dusty funnel with leaves and
// grass whirling round it at every height (the swarm the engine's own nature/tornado is loved
// for), spiralling up and flung off the top. Own copy for the palette wallpaper, adapted from
// the engine's weather/leaf-cyclone with the ground litter stripped off per feedback. The
// funnel, cloud deck and lightning come from the shared scene core (./_tornado.js) and drawLeaf
// from the library's nature/_lib.
import { cycle, rand, smooth, TAU, hex } from "../../../src/core/index.js";
import { clip, rows } from "../../../src/fx/weather/_lib.js";
import { drawLeaf } from "../../../src/fx/nature/_lib.js";
import { setMeta, makeTornado } from "./_tornado.js";

export const meta = {
  name: "Tornado",
  desc: "A whirlwind on a bare plain: leaves and grass whirl round the funnel at every height, spiral up it in their dozens and are flung off the top as bolts split the dark.",
  tags: ["weather", "tornado", "leaves", "wind", "storm", "lightning", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#4a200c", "#a8541c", "#e8962e", "#ffd27a", "#123818", "#2f7a2a", "#6cb83a", "#c8f070"],
    density: 1,
    seed: 17,
  },
};
setMeta(meta);

const D = 10, FH = 146, DEN = meta.options.density;
const C = ["#171310", "#26201a", "#3a3226", "#524836", "#6e6046", "#8e7c58", "#b4a080", "#dcccb0"];
const Dst = ["#241c10", "#3e301c", "#5c4830", "#826648", "#a8906c"].map(hex);
const LEAF = meta.options.palette.map(hex);

const TH = {
  D, FH, C, Dst,
  bolt: "#e8d8a8", boltHot: "#ffffff", footGlow: hex("#a8906c"),
  sky(p) {
    // pure black — the lit funnel and the coloured leaves carry the frame
    rows(p, meta, -170, 9, (y, R) => {
      R.c.fill(hex("#000000"));
      R.a.fill(1);
      R.b.fill(0);
    });
  },
  ground(p, q, t, S) {
    // a strip of bare dark earth — no litter: the leaves all belong to the wind
    rows(p, meta, 0, 9.5, (y, R) => {
      R.c.fill(y < 1 ? hex("#2e2214") : hex("#120c06"));
      R.a.fill(1);
      R.b.fill(0);
    });
  },
  debris(p, q, g, t, S, back) {
    // the wind's harvest: leaves and twigs spiralling up the funnel and flung off the top
    cycle(t, D, Math.round(44 * DEN), S * 17 + (back ? 0 : 1), (r) => r.range(0.35, 0.55), (age, life, R) => {
      const k = age / life, u = smooth(0.05, 1.1, k), th = R.range(0, TAU) + (2.2 + R.range(0, 1)) * TAU * k, sn = Math.sin(th);
      if (sn > 0 === back) return;
      const r = g.rad(u) * (1.05 + R.range(0, 0.5)), x = g.ax(u) + r * Math.cos(th), y = Math.max(-168, -u * FH + r * 0.28 * sn);
      const fk = 1 - smooth(0.8, 1, k), spin = age * R.range(8, 16), kind = R.next();
      if (kind < 0.78) {
        const o = R.next() < 0.5 ? 0 : 4;
        drawLeaf(q, x, y, 4 + R.range(0, 2.4), 1.7 + R.range(0, 0.6), spin, age * R.range(4, 9), [LEAF[o], LEAF[o + 1], LEAF[o + 2], LEAF[o + 3]], fk);
      } else {
        // a twig: a short dark line tumbling
        const ca = Math.cos(spin) * 2.6, sa = Math.sin(spin) * 2.6;
        q.line(x - ca, y - sa, x + ca, y + sa, LEAF[0], fk);
        q.dot(x + ca, y + sa, LEAF[1], fk);
      }
    });
    // the swarm: leaves held in orbit round the funnel at every height — the halo that makes it
    for (let i = 0; i < Math.round(30 * DEN); i++) {
      const R = (n) => rand(S * 63 + (back ? 0 : 1), i, 3, n);
      const u = 0.06 + R(1) * 0.86, rr = g.rad(u) * (1.3 + R(2) * 1.1), w = 1.2 + R(3) * 1.6;
      const th = R(4) * TAU + (TAU * w * t) / D, sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const x = g.ax(u) + rr * Math.cos(th), y = Math.max(-168, -u * FH + rr * 0.28 * sn);
      const spin = t * (8 + R(9) * 8) + i, o = R(5) < 0.5 ? 0 : 4;
      drawLeaf(q, x, y, 3.4 + R(6) * 1.8, 1.5 + R(7) * 0.5, spin, age0(th), [LEAF[o], LEAF[o + 1], LEAF[o + 2], LEAF[o + 3]], 0.9);
    }
  },
};

// the orbiting leaves tumble as they circle: a cheap roll phase from their angle
function age0(th) { return th * 2.4; }

const api = makeTornado(TH);
export function drawBack(p, t, o) { api.drawBack(p, t, o); }
export function draw(p, t, o) { api.draw(p, t, o); }
