// 落叶龙卷：an autumn whirlwind under a pure black sky — a dusty funnel picks the litter up:
// dozens of the library's own leaves spiral up it and are flung off the top. The funnel, cloud
// deck and lightning come from the shared scene core (_tornado.js, after the library's own
// nature/tornado and its drawLeaf).
import { cycle, rand, smooth, TAU, hex } from "../../core/index.js";
import { clip, rows } from "./_lib.js";
import { drawLeaf } from "../nature/_lib.js";
import { setMeta, makeTornado } from "./_tornado.js";

export const meta = {
  name: "Leaf cyclone",
  desc: "An autumn whirlwind on black: a dusty funnel picks the litter up — leaves spiral up it in their dozens and are flung off the top as a bolt splits the dark.",
  tags: ["weather", "tornado", "leaves", "autumn", "wind", "storm", "lightning", "ambient", "loop"],
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
    // a strip of dark earth, the litter lying on it
    rows(p, meta, 0, 9.5, (y, R) => {
      R.c.fill(y < 1 ? hex("#2e2214") : hex("#120c06"));
      R.a.fill(1);
      R.b.fill(0);
    });
    for (let i = 0; i < Math.round(46 * DEN); i++) {
      const R = (n) => rand(S * 9 + 2, i, 0, n);
      const x = -158 + R(1) * 316, y = 1 + Math.floor(R(2) * 4) * 2, o = R(3) < 0.5 ? 0 : 4;
      drawLeaf(q, x, y, 4.5 + R(4) * 2.2, 1.8 + R(5) * 0.7, (R(6) - 0.5) * 1.4, 0.4 + R(7) * 0.25, [LEAF[o], LEAF[o + 1], LEAF[o + 2], LEAF[o + 3]], 1);
    }
  },
  debris(p, q, g, t, S, back) {
    // the wind's harvest: leaves and twigs spiralling up the funnel and flung off the top
    cycle(t, D, Math.round(32 * DEN), S * 17 + (back ? 0 : 1), (r) => r.range(0.35, 0.55), (age, life, R) => {
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
  },
};

const api = makeTornado(TH);
export function drawBack(p, t, o) { api.drawBack(p, t, o); }
export function draw(p, t, o) { api.draw(p, t, o); }
