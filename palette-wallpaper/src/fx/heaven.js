// 天堂 · 星河云海 / Heaven, Above the Sea of Stars.
//
// Night above a cloud sea. The sky is banded flat colour (no ordered dither anywhere: at this size a Bayer
// pattern over a smooth sky reads as noise, which is exactly what the first version got wrong), the Milky Way
// crosses it as a spine with a bright core, dust lanes and a fine grain of stars, a crescent moon hangs clear of
// it, and the cloud sea below is moonlit silver at the back and deepening to navy at the bottom, with the first
// light of dawn still burning along the horizon underneath.
import { clamp, fit, rand, hex, smooth, TAU, mix } from "../../../src/core/index.js";
import { clip, rows, field, sample } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Heaven",
  desc: "Above the cloud sea at night: a flat-banded sky crossed by the Milky Way, a crescent moon clear of it, a fine grain of stars that twinkle, the cloud sea moonlit silver at the back and navy at the bottom, dawn still burning along the horizon, dust rising through the shafts and the odd feather sinking.",
  tags: ["sky", "stars", "milky-way", "moon", "clouds", "night", "heaven", "sea", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 16,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    other: ["#03060d", "#0a1226", "#152342", "#1e3255", "#33496f", "#93aad2", "#e6eeff"],
    density: 1,
  },
};

const D = 16, W = 320, Y0 = -170, Y1 = 10;
const HZ = -46;                     // the horizon: sky above, cloud sea below
const BLACK = hex("#02040a");
const GLOWPALE = hex("#ffeed4");    // the dawn still burning under the cloud sea
const MOON = hex("#f4f2ea");
const MW_CORE = hex("#eff1ff");
const MW_EDGE = hex("#9199e0");
const DUST = hex("#070c1c");
const q2 = (p) => clip(p, meta);

// the Milky Way's spine: a shallow diagonal with a slow wave, so it never reads as a straight band
const spineX = (x) => -132 + 0.12 * x + 11 * Math.sin(x * 0.013) + 4 * Math.sin(x * 0.045 + 1.2);
const F1 = field(37, 256, 128, [3, 6, 12, 24]);   // dust lanes and knots along the band
const F2 = field(53, 160, 96, [2, 4, 8, 16]);     // fine grain

// stars are decided once, not per frame: a fixed sky is what makes it read as a sky and not as static.
// Most of them lie along the band — that is what the Milky Way actually is at this scale, a river of stars —
// with a thinner scatter everywhere else and the odd bright one with a glint.
const STARS = [];
{
  // tiers are quantised at build time (user's spec): 3 sizes, 5 brightness levels, 5 twinkle
  // frequencies, and a slight blue/violet tint on roughly a third of the stars — the craft is
  // the shooting-stars scene's: dim dots, plain px, px+glow, and a rare cross-glint
  const tier = (r) => (r < 0.6 ? 0 : r < 0.92 ? 1 : r < 0.985 ? 2 : 3);   // dot / mid / bright+halo / glint (few of the loud ones)
  const tint = (r) => (r < 0.2 ? "#b9c8ff" : r < 0.35 ? "#c4b8ff" : "#dfe6ff");   // a little blue/violet
  const push = (x, y, near, rr, ri) => {
    if (y < -169 || y > HZ - 20) return;
    const m = starMag(near, rr);
    STARS.push({
      x: Math.round(x), y: Math.round(y),
      m: 0.18 + 0.18 * Math.floor(Math.min(1, m) * 4.999),              // 5 brightness levels
      tier: tier(rand(801, ri, 9)),
      w: 1 + Math.floor(rand(801, ri, 5) * 4.999),                      // 5 twinkle frequencies
      p: rand(801, ri, 6) * TAU,
      col: tint(rand(801, ri, 10)),
      g: rand(801, ri, 7) < 0.05,
    });
  };
  for (let i = 0; i < 340; i++) {
    const x = -160 + rand(801, i, 1) * 320;
    const u = rand(801, i, 2) - 0.5;
    // two thirds hug the spine within +-26 px, the rest fan out to +-55
    const spread = rand(801, i, 8) < 0.66 ? 26 : 55;
    const y = spineX(x) + u * 2 * spread * (1 + 0.12 * Math.sin(x * 0.05));
    push(x, y, 1 - Math.min(1, Math.abs(y - spineX(x)) / 40), rand(801, i, 4), i);
  }
  for (let i = 0; i < 120; i++) {
    const x = -160 + rand(861, i, 1) * 320;
    const y = -169 + rand(861, i, 2) * 121;
    if (Math.abs(y - spineX(x)) < 34) continue;
    push(x, y, 0.15, rand(861, i, 3), 1000 + i);
  }
}

// brighter the closer a star sits to the spine; hoisted so the table above can call it
function starMag(near, r) {
  const base = 0.18 + 0.55 * near + r * 0.35;
  return base > 1 ? 1 : base;
}
const MOONX = 96, MOONY = -137, MOONR = 7;
const SKYROWS = Y1 - Y0 + 1;
let SKYC = null, SKYK = null, SKYL = null, SKYREADY = false, SKYKEY = "";

export function drawBack(p, t, o) {
  const q = q2(p), NL = fit(o.other, 7), dn = o.density || 1;
  const ph = (TAU * t) / D;
  // seven flat bands, each a little lighter than the one above; the last two are warmed by the dawn below
  const SKY = [
    BLACK,                        // the top is pure black now (user: the old navy bands were too bright)
    mix(BLACK, NL[0], 0.28),
    mix(BLACK, NL[0], 0.55),
    mix(NL[0], NL[1], 0.55),
    mix(NL[1], NL[2], 0.6),
    mix(NL[2], BLACK, 0.3),
    mix(NL[2], NL[3], 0.7),
  ];
  // The sky never changes — only the stars twinkle and the clouds drift — so it is painted once and then copied.
  // Painting it per frame meant a noise lookup for every pixel of a 320 x 120 band of sky, which is most of the
  // frame time for a still image.
  // 32-bit colours carry their alpha in bits 24-31, which float32 rounds away — the cache has to be float64
  if (!SKYC) SKYC = new Float64Array(W * SKYROWS), SKYL = new Float64Array(W * SKYROWS), SKYK = new Float32Array(W * SKYROWS);
  const fresh = !SKYREADY || SKYKEY !== NL.join();
  rows(p, meta, Y0, Y1, (y, R) => {
    const base = (y - Y0) * W;
    if (!fresh) {
      for (let i = 0; i < W; i++) {
        R.c[i] = SKYC[base + i];
        R.a[i] = 1;
        R.b[i] = 0;
        R.l[i] = SKYL[base + i];
        R.k[i] = SKYK[base + i];
      }
      return;
    }
    const f = clamp((y - Y0) / (HZ + 3 - Y0), 0, 1);
    // flat banding: no dither, no noise. The band edges are placed by curve, not by a threshold pattern.
    const band = clamp(Math.floor(f * f * 6.2), 0, SKY.length - 1);
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      R.c[i] = SKY[band];
      R.a[i] = 1;
      R.b[i] = 0;
      R.l[i] = 0;
      R.k[i] = 0;
      // the dawn under the sea, bleeding up into the lowest strip of sky
      if (y > HZ - 26) {
        const k = Math.pow(clamp((y - (HZ - 26)) / 26, 0, 1), 2.2);
        R.c[i] = mix(R.c[i], GLOWPALE, k * 0.5);
      }
      if (y < HZ - 18) milky(R, i, x, y, 0);
      SKYC[base + i] = R.c[i];
      SKYL[base + i] = R.l[i];
      SKYK[base + i] = R.k[i];
    }
  });
  SKYREADY = true;
  SKYKEY = NL.join();
  dawn(q, NL);
  milkyStars(q, ph, NL);
  moon(q, ph);
  sea(q, t, ph, NL, dn);
  far(q, t, ph, NL, dn);

  meteor(q, t);
  motes(q, t, NL, dn);
}

export function draw(p, t, o) {
  const q = q2(p), NL = fit(o.other, 7);
  feathers(q, t, NL, (o.density || 1) * 6);
}

// the band itself. Three layers of light over the flat sky — a wide veil, the arm, a bright core — plus a dust
// lane that wanders along it. The knots come from a noise field along the spine, so the river of light has
// bright stretches and dim ones instead of an even smear.
function milky(R, i, x, y, ph) {
  const sp = spineX(x);
  const d = Math.abs((y - sp) * 0.7) * (1 + 0.08 * Math.sin(ph + x * 0.05));
  if (d > 100) return;
  const nz = sample(F1, x * 0.016 + 3, y * 0.016 + 3);          // knots along the band
  const knot = 0.35 + 0.65 * nz;
  const veil = clamp(1 - d / 96, 0, 1);
  const arm = clamp(1 - d / (44 + 10 * nz), 0, 1);
  const core = clamp(1 - d / (15 + 9 * nz), 0, 1);
  R.c[i] = mix(R.c[i], mix(MW_EDGE, MW_CORE, 0.2), veil * veil * 0.05);
  R.c[i] = mix(R.c[i], mix(MW_EDGE, MW_CORE, 0.45), arm * arm * 0.12);
  if (core > 0) {
    R.c[i] = mix(R.c[i], MW_CORE, core * knot * 0.45);
    // the dust lane: a narrow dark rift offset from the spine, wandering as it goes
    const off = 13 + 9 * Math.sin(x * 0.021 + 0.7) + 5 * Math.sin(x * 0.068 + 2);
    const lane = clamp(1 - Math.abs(d - off) / 3.6, 0, 1) * (0.55 + 0.45 * Math.sin(x * 0.14 + 1.4));
    if (lane > 0) R.c[i] = mix(R.c[i], DUST, lane * 0.6 * (0.4 + 0.6 * nz));
    const lane2 = clamp(1 - Math.abs(d + off * 0.8) / 3.0, 0, 1);
    if (lane2 > 0) R.c[i] = mix(R.c[i], DUST, lane2 * 0.35 * (0.3 + 0.7 * nz));
    // granulation: single-pixel flecks of light inside the band, so the glow has grain instead of reading as haze
    const hx = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const f = hx - Math.floor(hx);
    if (f > 0.9) R.c[i] = mix(R.c[i], MW_CORE, 0.04 + 0.08 * nz);   // far fewer, far dimmer flecks (user: too bright, too many)
    R.k[i] = 0.04 * core * knot;                                    // the bloom was blowing the band out white
    R.l[i] = MW_CORE;
  }
}
// the grain: fixed stars, each on its own slow twinkle, a handful with a four-pixel glint
function milkyStars(q, ph, NL) {
  for (let i = 0; i < STARS.length; i++) {
    const S = STARS[i];
    const tw = 0.62 + 0.38 * Math.sin(ph * S.w + S.p);   // w is an integer 1..5: five twinkle rates
    if (tw < 0.3) continue;
    const a = S.m * tw;
    const col = mix(hex(S.col), MW_CORE, clamp(S.m * 0.6, 0, 0.6));
    // brightness MUST ride on q.dot alpha: q.px is solid and would flatten the five levels
    // into identical bright blobs (looked like snow)
    if (S.tier === 0) {                                   // dim speck
      q.dot(S.x, S.y, col, a * 0.6);
    } else if (S.tier === 1) {                            // mid star
      q.dot(S.x, S.y, col, a);
    } else if (S.tier === 2) {                            // bright star + soft halo
      q.dot(S.x, S.y, col, Math.min(1, a * 1.15));
      q.glow(S.x, S.y, 2.4, col, 0.13 * a);
    } else {                                              // the rare bright one: cross glint
      q.px(S.x, S.y, mix(col, "#ffffff", 0.45));
      q.glow(S.x, S.y, 3, col, 0.16 * a);
      if (S.g && tw > 0.75) {
        q.px(S.x - 1, S.y, col); q.px(S.x + 1, S.y, col);
        q.px(S.x, S.y - 1, col); q.px(S.x, S.y + 1, col);
        q.glow(S.x, S.y, 5, MW_CORE, 0.2 * a);
      }
    }
  }
}

// a small crescent, kept clear of the band so it stays the second thing you notice
function moon(q, ph) {
  const dim = 0.72 + 0.28 * Math.sin(ph * 0.4 + 1.1);
  q.glow(MOONX, MOONY, 26, mix(MOON, MW_EDGE, 0.45), 0.05 * dim);
  q.glow(MOONX, MOONY, 12, MOON, 0.07 * dim);
  for (let y = -MOONR; y <= MOONR; y++) {
    for (let x = -MOONR; x <= MOONR; x++) {
      const d2 = (x * x) / (MOONR * MOONR) + (y * y) / (MOONR * MOONR);
      if (d2 > 1) continue;
      // the shadow disc eats the left half of it, leaving the sliver on the right
      const ex = (x + 3.4), ey = y - 0.6;
      if ((ex * ex) / (MOONR * MOONR) + (ey * ey) / (MOONR * MOONR) < 0.92) continue;
      const lit = clamp(1 - d2 * 0.35, 0, 1);
      q.px(MOONX + x, MOONY + y, mix(mix(MOON, MW_CORE, 0.35), hex("#fffdf2"), lit * 0.6));
    }
  }
}

// the dawn still burning along the horizon, wide and low, never a spotlight
function dawn(q, NL) {
  q.glow(-18, HZ + 4, 150, GLOWPALE, 0.045);
  q.glow(-18, HZ + 2, 74, mix(NL[5], GLOWPALE, 0.7), 0.05);
  q.glow(-18, HZ, 30, GLOWPALE, 0.07);
}

// the cloud sea, built the way a cumulus field reads from above: rows of flattened lobes, far rows pale and hazy,
// near rows bigger and cooler, each lobe lit on its crown and falling into shadow at its own feet
const ROWS = [
  { y: -42, rx: [9, 18], tone: 5, lit: 0.34, n: 26 },
  { y: -33, rx: [11, 21], tone: 4, lit: 0.18, n: 24 },
  { y: -24, rx: [12, 23], tone: 4, lit: 0.07, n: 22 },
  { y: -14, rx: [16, 28], tone: 3, lit: 0.02, n: 17 },
  { y: -4, rx: [20, 36], tone: 2, lit: 0, n: 13 },
  { y: 2, rx: [24, 44], tone: 2, lit: 0, n: 9 },
];

const sea = (q, t, ph, NL, dn) => {
  const CREST = mix(NL[6], GLOWPALE, 0.45);
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r];
    const n = Math.round(row.n * Math.min(1.7, dn));
    for (let k = 0; k < n; k++) {
      const R = (j) => rand(121 + r * 9, k, j);
      const big = R(7) < (r === 0 ? 0.3 : 0.12) ? (r === 0 ? 2.3 : 1.6) : 1;
      const rx = (row.rx[0] + Math.pow(R(1), 1.4) * (row.rx[1] - row.rx[0])) * big;
      const ry = rx * (0.36 + R(2) * 0.26);
      const cx = -170 + ((k + 0.5) / n) * 340 + (R(3) - 0.5) * rx * 1.4 + (1 + r * 0.4) * Math.sin(ph + k * 0.8);
      const cy = row.y + (R(4) - 0.5) * 14 - ry * 0.5 + 1.5 * Math.sin(ph + k * 1.5);
      const base = row.tone + (R(5) < 0.34 ? 1 : 0) - (R(6) < 0.2 ? 1 : 0);
      for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const top = cy - ry * Math.sqrt(Math.max(0, 1 - dx * dx));
        const bot = cy + ry * 1.15;
        for (let y = Math.floor(top); y < bot; y++) {
          const v = (y + 0.5 - top) / (bot - top);
          const tone = clamp(v < 0.3 ? base + 1 : (v > 0.86 && r > 3 ? base - 1 : base), 0, 6);
          let col = NL[tone];
          if (row.lit > 0) col = mix(col, tone >= 5 ? GLOWPALE : mix(NL[5], GLOWPALE, 0.4), row.lit);
          if (v < 0.22 && R(8) < 0.5) col = mix(col, CREST, 0.05 + 0.1 * (1 - row.lit));
          q.px(x, y, col);
          if (v < 0.1 && R(8) < 0.5) q.light(x, y, mix(NL[6], GLOWPALE, 0.4), 0.1 * (1 - row.lit * 0.5));
        }
      }
    }
  }
};

// small distant cumulus above the sea: crisp pale tops, cooler flat bottoms
function far(q, t, ph, NL, dn) {
  const n = Math.round(11 * Math.min(1.6, dn));
  for (let k = 0; k < n; k++) {
    const R = (j) => rand(91, k, j);
    const cx = -150 + R(1) * 300 + 7 * Math.sin(ph + k * 1.3);   // was 9*(t/D): raw t jumped 9px at the loop wrap (the '卡一下')
    const cy = -104 + R(2) * 42;
    const r = 3 + R(3) * 6;
    const w = r * 2.6;
    for (let x = Math.ceil(cx - w / 2); x <= Math.floor(cx + w / 2); x++) {
      const dx = (x + 0.5 - cx) / (w / 2);
      const top = cy - r * Math.sqrt(Math.max(0, 1 - dx * dx));
      const bot = cy + r * 0.5;
      for (let y = Math.floor(top); y < bot; y++) {
        const v = (y + 0.5 - top) / (bot - top);
        const col = v < 0.3 ? mix(NL[5], NL[6], 0.55) : v < 0.62 ? mix(NL[4], NL[5], 0.55) : mix(NL[3], NL[4], 0.5);
        q.px(x, y, col);
        if (v < 0.25) q.light(x, y, NL[6], 0.18);
      }
    }
  }
}

// one meteor per loop, in the upper sky, gone in under a second
function meteor(q, t) {
  const u = (t / D) % 1;
  if (u < 0.06 || u > 0.115) return;
  const k = (u - 0.06) / 0.055;
  const hx = -140 + k * 180, hy = -166 + k * 34;
  for (let i = 0; i < 9; i++) {
    const a = 1 - i / 9;
    q.px(hx - i * 1.6, hy - i * 0.3, mix(MW_EDGE, hex("#ffffff"), a));
    if (i < 3) q.glow(hx - i * 1.6, hy - i * 0.3, 3, MW_CORE, 0.16 * a);
  }
}

// stardust drifting up out of the dawn: a fleck of warm light where it crosses the glow
function motes(q, t, NL, dn) {
  const n = Math.round(80 * Math.min(1.6, dn));
  for (let i = 0; i < n; i++) {
    const R = (k) => rand(61, i, k);
    const ph = ((t / D) * (0.5 + R(2) * 1.1) + R(3)) % 1;
    const y = HZ - 4 - ph * 120 - (R(4) - 0.5) * 4;
    const x = -160 + R(5) * 320 + (7 + R(6) * 12) * Math.sin((TAU * t / D) * (1 + Math.floor(R(7) * 2)) + R(8) * TAU);
    if (y > HZ - 2) continue;
    // only where the dawn reaches: they fade with height
    const e = clamp(1 - (HZ - y) / 74, 0, 1) * (0.5 + 0.5 * R(1));
    if (e < 0.2) continue;
    q.px(x, y, mix(NL[5], GLOWPALE, e));
    if (R(9) < 0.3) q.glow(x, y, 2.4, GLOWPALE, 0.1 * e);
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
    q.px(x, y, mix(NL[6], hex("#ffffff"), 0.55));
    q.px(x + tilt, y + 1, mix(NL[5], NL[6], 0.45));
    q.px(x - 1, y, NL[5]);
    q.px(x, y + 2, NL[4]);
    q.glow(x, y, 4, MW_CORE, 0.13 * a);
  }
}
