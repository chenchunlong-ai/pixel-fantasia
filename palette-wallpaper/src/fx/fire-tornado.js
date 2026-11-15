// 火焰龙卷风：a tornado over a scorched plain under a pure black sky — the previous version's
// funnel, ember swarm, meteor strikes and scorched ground, NOW with this round's ground flames
// added: tongues of fire leaning into the vortex along the whole field. Own copy for the palette
// wallpaper, adapted from the engine's weather/fire-cyclone.
import { cycle, rand, smooth, wrap, TAU, hex } from "../../../src/core/index.js";
import { clip, rows, trips } from "../../../src/fx/weather/_lib.js";
import { spark } from "../../../src/fx/fire/_lib.js";
import { setMeta, makeTornado } from "./_tornado.js";

export const meta = {
  name: "Fire tornado",
  desc: "A tornado over a burning plain: walls of flame lean into the vortex, embers orbit the funnel, meteors crash down out of the dark, bolts split the smoke.",
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

const D = 10, FH = 148, DEN = meta.options.density;
const EMB = [hex("#ffe26b"), hex("#ff8a2a"), hex("#c9281f"), hex("#8a1f17")];

const TH = {
  D, FH,
  C: ["#1c0d0a", "#301410", "#4a2018", "#6a3222", "#8f4a2e", "#b86840", "#e09a58", "#ffc984"],
  Dst: ["#200a06", "#3a1410", "#5c2416", "#8a3c1e", "#c86a28"],
  bolt: "#c8b8ff", boltHot: "#ffffff", footGlow: hex("#ff8a2a"),
  sky(p) {
    // pure black: the funnel, its ember swarm and the meteors carry the whole frame
    rows(p, meta, -170, 9, (y, R) => {
      R.c.fill(hex("#000000"));
      R.a.fill(1);
      R.b.fill(0);
    });
  },
  ground(p, q, t, S) {
    // the scorched plain: bare dark earth, dying embers pulsing in it
    rows(p, meta, 0, 9.5, (y, R) => {
      R.c.fill(y < 1 ? hex("#2a0f08") : hex("#0c0504"));
      R.a.fill(1);
      R.b.fill(0);
    });
    for (let i = 0; i < Math.round(16 * DEN); i++) {
      const R = (n) => rand(S * 13 + 3, i, 0, n);
      const x = -154 + R(1) * 308, y = 1 + Math.floor(R(2) * 4) * 2;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((TAU * t) / D * (1 + R(3)) + i * 2.1));
      q.dot(x, y, EMB[Math.floor(R(4) * 3)], tw * 0.9);
    }
    q.glow(0, 2, 60, hex("#ff8a2a"), 0.14);
  },
  fall(p, q, t, S, near) {
    // 它在下手雨：burning embers rain down out of the smoke, each a fire bead with a tail
    const sd = S * 41 + near;
    trips(t, D, Math.round((near ? 34 : 60) * DEN), sd, 4, 6, (u, k, m, i) => {
      const j = ((k % m) + m) % m, R = (c) => rand(sd, i, j, c);
      const x = -170 + R(1) * 340 + Math.sin(u * TAU * 2 + R(2) * 6) * 6;
      const y = -172 + 170 * u, sw = Math.sin(u * TAU * (1 + R(3)) + R(4) * 6) * 8;
      const k2 = 1 - Math.abs(u - 0.5) * 1.2;
      const c = u < 0.4 ? hex("#ffe26b") : u < 0.75 ? hex("#ff8a2a") : hex("#c9281f");
      q.dot(x + sw, y, c, k2);
      q.line(x + sw, y - 3, x + sw, y - 1, hex("#c9281f"), k2 * 0.7);
      if (near && R(5) < 0.5) q.glow(x + sw, y, 3 + R(6) * 2, c, 0.3 * k2);
      if (u > 0.94 && near) q.px(x + sw, 3, hex("#8a1f17"), 0.6);
    });
  },
  groundFront(p, q, t, S) {
    // sparks streaking across the plain toward the vortex
    cycle(t, D, Math.round(12 * DEN), S * 33, (r) => r.range(0.05, 0.09), (age, life, R) => {
      const k = age / life, x0 = -140 + R.range(0, 280), vx = Math.sign(-x0 || 1) * (40 + R.range(0, 40));
      spark(q, x0, 1 - k * 10, vx, -30 * R.range(0.5, 1), 1 - k, EMB);
    });
  },
  debris(p, q, g, t, S, back) {
    // burning scraps snatched off the plain, spiralling up and flung off the top
    cycle(t, D, Math.round(20 * DEN), S * 17 + (back ? 0 : 1), (r) => r.range(0.4, 0.6), (age, life, R) => {
      const k = age / life, u = smooth(0.05, 1.1, k), th = R.range(0, TAU) + (2.2 + R.range(0, 1)) * TAU * k, sn = Math.sin(th);
      if (sn > 0 === back) return;
      const r = g.rad(u) * (1.1 + R.range(0, 0.5)), x = g.ax(u) + r * Math.cos(th), y = Math.max(-168, -u * FH + r * 0.28 * sn);
      const fk = 1 - smooth(0.8, 1, k), c = k < 0.5 ? hex("#ffc23d") : k < 0.8 ? hex("#ff8a2a") : hex("#8a1f17");
      q.dot(x, y, c, fk);
      q.line(x, y, x - 2, y + 1, hex("#5c2416"), fk * 0.9);
      if (back) return;
      q.glow(x, y, 3, c, 0.3 * fk);
    });
    // the swarm: embers held in orbit round the funnel at every height, the fire's halo
    for (let i = 0; i < Math.round(30 * DEN); i++) {
      const R = (n) => rand(S * 57 + (back ? 0 : 1), i, 1, n);
      const u = 0.06 + R(1) * 0.86, rr = g.rad(u) * (1.25 + R(2) * 1.0), w = 1.4 + R(3) * 1.8;
      const th = R(4) * TAU + (TAU * w * t) / D, sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const x = g.ax(u) + rr * Math.cos(th), y = Math.max(-168, -u * FH + rr * 0.28 * sn);
      const c = R(5) < 0.5 ? EMB[0] : R(5) < 0.8 ? EMB[1] : EMB[2];
      const tw = 0.55 + 0.45 * Math.sin((TAU * t) / D * (2 + R(6) * 3) + i);
      q.dot(x, y, c, tw);
      if (!back && R(7) < 0.35) q.glow(x, y, 3, c, 0.22 * tw);
    }
  },
};

// 地面火焰（this round's ground fire): tongues of flame across the whole field, taller and swept
// harder toward the vortex the closer they stand, each wobbling on its own clock
function flames(p, t, S, C, front) {
  for (let x = -160; x < 160; x++) {
    const R = (n) => rand(S * 3 + (front ? 1 : 0), x + 400, n);
    if (R(0) < (front ? 0.4 : 0.62)) continue;
    const ph = R(1) * TAU, k = Math.round(D / (0.35 + R(2) * 0.55));
    const near = 1 + 1.1 * Math.exp(-Math.pow(x / 44, 2));
    const wob = 0.7 + 0.45 * Math.sin((TAU * k * t) / D + ph) + 0.15 * Math.sin((TAU * 2 * k * t) / D + ph * 2.1);
    const h = Math.max(1, (2 + R(3) * 4.5) * near * wob);
    const drift = 0.5 + R(4);
    for (let i = 0; i < h; i++) {
      const u = i / h;
      const c = u > 0.88 ? C[6] : u > 0.68 ? C[5] : u > 0.46 ? C[4] : u > 0.24 ? C[3] : C[2];
      const xx = x + (0 - x) * 0.1 * u * u + Math.sin((TAU * k * t) / D + ph + 1.3) * drift * u * u;
      p.dot(xx, 1 - i, c, u > 0.9 ? 0.85 : 1);
      if (i < h * 0.55) p.dot(xx + (u > 0.3 ? 1 : -1), 1 - i, u > 0.3 ? C[3] : C[2], 0.6);
    }
    if (h > 6) p.light(x, -h * 0.4, C[4], 0.05);
  }
}

const api = makeTornado(TH);

// 流星：twice a loop a meteor tears down out of the dark and slams into the plain — a white-hot
// head with a fire trail, then a flash, a flat shockwave ring and a spray of embers
const METEOR_T = [0.16, 0.64], TF = 0.9, IMPACT_LIFE = 1.3;
function meteors(q, t, S) {
  for (let b = 0; b < METEOR_T.length; b++) {
    const a = (t / D - METEOR_T[b] + 1) % 1;
    if (a * D > TF + IMPACT_LIFE) continue;
    const R = (n) => rand(S * 61 + 9 + b, 3, 5, n);
    const x0 = -120 + b * 190 + R(1) * 50, vx = b % 2 ? 74 : -66;
    const xi = x0 + vx * TF, s = a * D;
    if (s < TF) {
      const x = x0 + vx * s, y = -175 + (183 / TF) * s;
      for (let j = 1; j <= 7; j++) {
        const k = 1 - j / 8;
        q.px(x - vx * j * 0.055, y - (183 / TF) * j * 0.055, j < 3 ? hex("#fff3a6") : j < 5 ? hex("#ffc23d") : hex("#c9281f"), 0.25 + 0.75 * k);
      }
      q.px(x, y, hex("#ffffff"));
      q.px(x + 1, y, hex("#fff3a6"));
      q.glow(x, y, 10, hex("#ffc23d"), 0.5);
    } else {
      const age = s - TF, k = age / IMPACT_LIFE, fade = 1 - k;
      const fl = Math.exp(-age * 6);
      q.glow(xi, 5, 26 + 30 * fl, hex("#fff3a6"), 0.55 * fl);
      q.disc(xi, 5, 4 + 5 * fl, hex("#ffe26b"), 0.8 * fl);
      const r = 5 + 80 * k;
      for (let j = 0; j < 30; j++) {
        const th = (j / 30) * TAU + R(2) * 0.2;
        q.px(xi + Math.cos(th) * r, 6 + Math.sin(th) * r * 0.32, j % 3 ? hex("#ff8a2a") : hex("#ffc23d"), fade * 0.85);
      }
      for (let j = 0; j < 12; j++) {
        const Rj = (n) => rand(S * 71 + b * 13 + j, 1, 2, n);
        const th = Rj(1) * TAU, v = 22 + Rj(2) * 40;
        const ex = xi + Math.cos(th) * v * age, ey = 6 - Math.sin(th) * (14 + Rj(3) * 18) * age + 70 * age * age;
        if (ey < 10) q.dot(ex, ey, j % 2 ? hex("#ffc23d") : hex("#ff8a2a"), fade);
      }
      q.glow(xi, 4, 60, hex("#ff8a2a"), 0.3 * fade);
    }
  }
}

export function drawBack(p, t, o) { api.drawBack(p, t, o); }
export function draw(p, t, o) {
  api.draw(p, t, o);
  const C = [...TH.C.map(hex), hex("#fff3a6")];
  flames(p, t, o.seed, C, false);
  flames(p, t, o.seed, C, true);
  meteors(clip(p, meta), t, o.seed);
}
