// 沙尘暴：a sandstorm on the tornado framework with the funnel taken out — a black sky, the
// storm deck pressing down, and the sand itself carrying the scene: dust banks rolling across
// the plain, grains hopping off the ground, banks rolling and sand sifting down — no bolts,
// the dust, no straight lines, no swirl rings (user: they read as scratches and circles, not sand).
// Own copy for the palette wallpaper, built on ./_tornado.js (noFunnel + noBolt mode).
import { cycle, rand, TAU, hex } from "../../../src/core/index.js";
import { clip, rows, trips } from "../../../src/fx/weather/_lib.js";
import { setMeta, makeTornado } from "./_tornado.js";

export const meta = {
  name: "Sandstorm",
  desc: "A sandstorm under a black sky: dust banks roll across the plain, thick sand sifts down and grains hop off the ground as the storm deck churns overhead.",
  tags: ["weather", "sandstorm", "desert", "sand", "dust", "storm", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { density: 1, seed: 21 },
};
setMeta(meta);

const D = 10, FH = 150, DEN = meta.options.density;
const C = ["#171310", "#26201a", "#3a3226", "#524836", "#6e6046", "#8e7c58", "#b4a080", "#dcccb0"];
const Dst = ["#241c10", "#3e301c", "#5c4830", "#826648", "#a8906c"].map(hex);
const SAND = ["#3e301c", "#6e5232", "#a87c46", "#d8a860", "#f0d096"].map(hex);

const TH = {
  D, FH, C, Dst,
  noFunnel: true, // the storm, not a funnel: the framework draws deck, wind and hooks only
  noBolt: true,   // user: no lightning in the sandstorm
  noWind: true,   // user: the wind streaks read as straight flying lines — gone
  bolt: "#e8d8a8", boltHot: "#ffffff", footGlow: hex("#a8906c"),
  sky(p) {
    // pure black — the lit deck and the flying sand carry the frame
    rows(p, meta, -170, 9, (y, R) => {
      R.c.fill(hex("#000000"));
      R.a.fill(1);
      R.b.fill(0);
    });
  },
  ground(p, q, t, S) {
    // the desert floor: a lit lip at the horizon, then dark sand
    rows(p, meta, 0, 9.5, (y, R) => {
      R.c.fill(y < 1 ? hex("#6a5232") : y < 4 ? hex("#2e2214") : hex("#16100a"));
      R.a.fill(1);
      R.b.fill(0);
    });
    // grains hopping off the ground and bounding downwind
    cycle(t, D, Math.round(26 * DEN), S * 23, (r) => r.range(0.05, 0.1), (age, life, R, i) => {
      const k = age / life, x0 = -150 + R.range(0, 300), v = 40 + R.range(0, 50);
      const x = x0 + v * age, y = -0.5 - Math.abs(Math.sin(age * 14 + i)) * (3 + R.range(0, 5)) * (1 - k);
      q.dot(x, y, SAND[1 + Math.floor(R.range(0, 3))], (1 - k) * 0.9);
    });
  },
  fall(p, q, t, S, near) {
    // sand sifting down out of the deck everywhere, thicker near the ground
    const sd = S * 47 + near;
    trips(t, D, Math.round((near ? 60 : 105) * DEN), sd, 4, 6, (u, k, m, i) => {   // more falling dust (user)
      const j = ((k % m) + m) % m, R = (c) => rand(sd, i, j, c);
      const x = -170 + R(1) * 340 + Math.sin(u * TAU * (1 + R(2)) + R(3) * 6) * 7;
      const y = -172 + 170 * u, drift = 26 * u;
      const c = u < 0.5 ? SAND[3] : SAND[2];
      q.dot(x + drift, y, c, (near ? 0.8 : 0.45) * (0.4 + 0.6 * Math.sin(Math.PI * u)));
    });
  },
  debris(p, q, g, t, S, back) {
    // dust banks: big soft slabs of sand rolling across the plain, lit on their upper edge
    cycle(t, D, Math.round(10 * DEN), S * 19 + (back ? 0 : 1), (r) => r.range(0.3, 0.5), (age, life, R) => {
      const k = age / life, x0 = -170 + R.range(0, 340), v = (back ? 18 : 30) + R.range(0, 14);
      const x = x0 + v * age, y = -3 - R.range(0, 14), rx = 16 + R.range(0, 22), ry = rx * 0.4;
      const a = Math.sin(Math.PI * k) * (back ? 0.5 : 0.7);
      q.disc(x, y, rx, Dst[back ? 1 : 2], a * 0.8);
      q.disc(x + rx * 0.3, y - ry * 0.4, rx * 0.6, Dst[back ? 2 : 3], a * 0.6);
      if (!back) q.disc(x - rx * 0.2, y - ry * 0.5, rx * 0.4, Dst[4], a * 0.4);
    });
  },
};

const api = makeTornado(TH);
export function drawBack(p, t, o) { api.drawBack(p, t, o); }
export function draw(p, t, o) { api.draw(p, t, o); }
