// DRAFT — not shipped. The composition never read right: a hand-drawn pixel gorge needs hand-placed
// shapes, and a function that only knows noise and gradients cannot place them. Kept for the record.
// 峡谷飞瀑 / Canyon Falls — a wide forest gorge with waterfalls.
//
// 384×240 is 16:10, the shape this scene is built for, and close to the pixel grid the reference art uses
// (about 4 screen pixels per dot at 1080p), so stretching to a full desktop keeps the blocks the same weight.
//
// The rock never moves, and repainting 92k pixels of stone every frame is what would cost the frame budget.
// So the terrain is painted once into a cached buffer (keyed by size + ramp) and copied in with a typed-array
// copy; only the water, the spray, the light and the fireflies are drawn per frame.
//
// The wall is built the way a pixel artist builds one: a near-flat skyline with two stepped ledges, a face of
// horizontal strata and vertical cracks, a lit lip on every edge, and the water running in a channel cut into
// the face — never floating in front of it.
import { clamp, fit, rand, hex, TAU, mix } from "../../../src/core/index.js";
import { createFrame, painterFor } from "../../../src/core/index.js";
import { clip, rows, field, sample } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Canyon Falls",
  desc: "A wide forest gorge: old trees lean in over the near bank, a pale valley opens behind them, and two waterfalls drop off the stepped ledges of the right wall, running in channels cut into the rock.",
  tags: ["canyon", "waterfall", "forest", "cliff", "moss", "mist", "wide", "16:10", "ambient", "loop"],
  size: [384, 240],
  origin: [0, 0],
  duration: 16,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    other: ["#0a1a12", "#123021", "#25492c", "#3f6b3c", "#87a98c", "#cfdcc8", "#f3f6e9"],
    density: 1,
  },
};

const W = 384, H = 240;
const GROUND = 196;                                   // where the wall meets the dark bank / pool

const ROCK = field(6111, 256, 128, [4, 8, 16, 32]);
const FINE = field(7331, 256, 128, [8, 16, 32, 64]);
const FOLI = field(9203, 256, 128, [4, 8, 16, 32]);
// ---- the falls: x, top, bottom, width, strength, speed ----------------------------------------
const FALLS = [
  { x: 300, y0: 64, y1: 196, w: 26, a: 0.95, sp: 1.0 },
  { x: 352, y0: 40, y1: 112, w: 14, a: 0.8, sp: 0.9 },
  { x: 246, y0: 140, y1: 196, w: 9, a: 0.5, sp: 0.6 },
  { x: 186, y0: 132, y1: 194, w: 20, a: 0.36, sp: 0.4 },
];

// ---- the right wall: built out of rock lumps, so its silhouette and shading are organic -------------
// Each lump is a convex mass; coverage is the max over lumps plus noise, and the light comes from the
// gradient of that coverage — which is how a hand-built cliff gets its ridges without hand-placing pixels.
const LUMPS = [
  { x: 252, y: 62, rx: 62, ry: 40, n: 11 },
  { x: 316, y: 54, rx: 58, ry: 36, n: 12 },
  { x: 378, y: 66, rx: 52, ry: 44, n: 13 },
  { x: 238, y: 112, rx: 44, ry: 40, n: 21 },
  { x: 296, y: 108, rx: 56, ry: 42, n: 22 },
  { x: 356, y: 116, rx: 56, ry: 46, n: 23 },
  { x: 250, y: 168, rx: 52, ry: 44, n: 31 },
  { x: 310, y: 172, rx: 58, ry: 42, n: 32 },
  { x: 370, y: 168, rx: 50, ry: 46, n: 33 },
];
/** How much rock is at (x, y): >1 inside, 0 outside, feathered by a fine noise. */
function cover(x, y) {
  let m = 0;
  for (const L of LUMPS) {
    const dx = (x - L.x) / L.rx, dy = (y - L.y) / L.ry;
    const v = 1 - (dx * dx + dy * dy);
    if (v > m) m = v;
  }
  return m + (sample(FINE, x * 0.06, y * 0.06) - 0.5) * 0.22;
}
function wallTop(x) {
  if (x < 214) return 999;
  for (let y = 20; y < 200; y++) if (cover(x, y) > 0.06) return y;
  return 999;
}

function wall(q) {
  const DEEP = hex("#22343a"), BODY = hex("#394f55"), FACE = hex("#4d666c"), LIT = hex("#7e979b");
  const MOSS = hex("#2f4c2b"), MOSS_HL = hex("#4f7043");
  rows(q, meta, 18, GROUND, (y, R) => {
    for (let i = 214; i < R.w; i++) {
      const c = cover(i, y);
      if (c <= 0.02) continue;
      // light from the top-left: the gradient of the coverage is the surface normal
      const gx = cover(i + 1, y) - cover(i - 1, y);
      const gy = cover(i, y + 1) - cover(i, y - 1);
      const light = clamp(0.5 - gx * 3.4 - gy * 3.0 + (sample(FINE, i * 0.05, y * 0.05) - 0.5) * 0.5, 0, 1);
      let col = light > 0.72 ? LIT : light > 0.55 ? FACE : light > 0.34 ? BODY : DEEP;
      if (c < 0.12) col = mix(col, DEEP, 0.55);                       // the rim darkens into the silhouette
      if (y > GROUND - 14) col = mix(col, DEEP, 0.55);
      R.c[i] = col;
    }
  });
  // moss on every lump shoulder the light reaches
  for (let i = 216; i < W; i += 1) {
    const top = wallTop(i);
    if (top > GROUND - 8) continue;
    if (sample(FOLI, i * 0.11, top * 0.11) > 0.5) {
      q.px(i, top + 0.6, MOSS);
      q.px(i, top + 1.7, mix(MOSS, MOSS_HL, 0.5));
      if (sample(FOLI, i * 0.24, 3.3) > 0.6) { q.px(i, top - 0.4, MOSS_HL); q.px(i + 1, top - 0.4, MOSS); }
    }
  }
}

// ---- a hazy rock spur inside the gap ------------------------------------------------------------
function gapSpur(q) {
  const BODY = hex("#7d9183"), FACE = hex("#93a794"), LIT = hex("#b0c2ab"), MOSS = hex("#47603f");
  const SPUR = [
    { x: 130, y: 168, rx: 54, ry: 50 }, { x: 176, y: 150, rx: 46, ry: 56 }, { x: 108, y: 190, rx: 44, ry: 40 },
  ];
  rows(q, meta, 96, GROUND, (y, R) => {
    for (let i = 96; i < 220 && i < R.w; i++) {
      let m = 0;
      for (const S of SPUR) {
        const dx = (i - S.x) / S.rx, dy = (y - S.y) / S.ry;
        const v = 1 - (dx * dx + dy * dy);
        if (v > m) m = v;
      }
      m += (sample(FINE, i * 0.07, y * 0.07) - 0.5) * 0.2;
      if (m <= 0.02) continue;
      const gx = 1 - 0, gy = 0;
      const n = sample(FINE, i * 0.05, y * 0.05);
      R.c[i] = m < 0.1 ? LIT : n > 0.55 ? FACE : BODY;
    }
  });
  for (let i = 98; i < 218; i += 2) {
    let m = 0;
    for (const S of SPUR) {
      const dx = (i - S.x) / S.rx;
      m = Math.max(m, 1 - dx * dx);
    }
    if (m <= 0.3) continue;
    if (sample(FOLI, i * 0.15, 2.2) > 0.55) q.px(i, 148 + (1 - m) * 40, MOSS);
  }
}
// ---- the trees leaning in from the left: foliage is many small leaf clumps, edges ragged --------
function trees(q) {
  const TRUNK = hex("#2b2417"), TRUNK2 = hex("#463b25"), MOSSY = hex("#2f4a22");
  const DARK = hex("#12301a"), MIDG = hex("#21452a"), LIT = hex("#3c6a3a"), HL = hex("#5e8c54");

  const TRUNKS = [
    { x: 42, top: -10, w: 16, lean: 0.10 },
    { x: 92, top: 6, w: 12, lean: -0.07 },
    { x: 136, top: 24, w: 8, lean: 0.09 },
  ];
  for (const T of TRUNKS) {
    for (let y = Math.max(0, Math.floor(T.top)); y < GROUND + 12; y++) {
      const u = (y - T.top) / (GROUND + 12 - T.top);
      const x = T.x + u * u * T.lean * 130;
      const half = (T.w / 2) * (1 - u * 0.3);
      for (let i = -half; i <= half; i += 0.8) {
        const n = sample(FINE, (x + i) * 0.1, y * 0.05);
        const s = (i + half) / (half * 2);
        q.px(x + i, y, s < 0.22 ? TRUNK2 : n > 0.56 ? MOSSY : TRUNK);
      }
    }
  }

  // canopy built from leaf clumps: dense core, ragged edge, lit from the top-left
  const CLUMPS = [];
  for (let i = 0; i < 46; i++) {
    CLUMPS.push({
      x: rand(1201, i, 1) * 210,
      y: 6 + rand(1201, i, 2) * 86,
      r: 9 + rand(1201, i, 3) * 13,
    });
  }
  for (let y = 0; y < 130; y++) {
    for (let x = 0; x < 230; x++) {
      let best = 0, bias = 0;
      for (const C of CLUMPS) {
        const dx = x - C.x, dy = y - C.y;
        const d2 = dx * dx + dy * dy;
        const r2 = C.r * C.r;
        if (d2 > r2 * 1.5) continue;
        const v = 1 - d2 / r2;
        if (v > best) { best = v; bias = -dy * 0.5 - dx * 0.12; }
      }
      const n = sample(FOLI, x * 0.09, y * 0.09);
      const s = best + (n - 0.5) * 0.45;
      if (s < 0.42) continue;
      const light = bias / 60 + (n - 0.5) * 0.8;
      q.px(x, y, light > 0.34 ? HL : light > 0.1 ? LIT : light > -0.12 ? MIDG : DARK);
    }
  }

  // vines hanging off the canopy
  for (let i = 0; i < 16; i++) {
    const x0 = 12 + rand(611, i, 1) * 180;
    const y0 = 52 + rand(611, i, 2) * 40;
    const len = 6 + rand(611, i, 3) * 26;
    const sway = 1 + rand(611, i, 4) * 2;
    for (let y = 0; y < len; y++) {
      const x = x0 + Math.sin(y * 0.2 + i) * sway * (y / len);
      q.px(x, y0 + y, mix(TRUNK2, MIDG, y / len));
      if (y > len - 3) q.px(x + 1, y0 + y, MIDG);
    }
  }
}

// ---- the near bank: black mossy rock, ferns, one small warm light -------------------------------
function bank(q) {
  const DARK = hex("#08120c"), MID = hex("#122218"), MOSSY = hex("#1c3719"), FERN = hex("#2a5227");
  rows(q, meta, GROUND - 10, 240, (y, R) => {
    const n0 = sample(ROCK, 3.1, y * 0.08);
    for (let i = 0; i < R.w; i++) {
      const n = n0 * 0.55 + 0.45 * sample(FOLI, i * 0.07, y * 0.06);
      const crest = GROUND - 4 + n * 14;
      if (y < crest) continue;
      const k = clamp((y - crest) / 14, 0, 1);
      const rim = y - crest < 1.6;                         // a thin lit rim on the crest
      R.c[i] = rim ? mix(MOSSY, hex("#6f8a63"), 0.35) : n > 0.62 ? mix(MOSSY, MID, 0.5) : mix(DARK, MID, k * 0.4);
    }
  });
  for (let i = 0; i < 32; i++) {
    const x0 = rand(707, i, 1) * 380;
    const y0 = 212 + rand(707, i, 2) * 26;
    const h = 5 + rand(707, i, 3) * 10;
    const tilt = (rand(707, i, 4) - 0.5) * 1.6;
    for (let y = 0; y < h; y++) {
      const x = x0 + tilt * y * 0.5;
      q.px(x, y0 - y, mix(FERN, MOSSY, y / h));
      if (y > 1) { q.px(x - 1, y0 - y, MOSSY); q.px(x + 1, y0 - y, MOSSY); }
    }
  }
  const LX = 206, LY = 222;
  q.px(LX - 1, LY - 5, hex("#f0c46a")); q.px(LX, LY - 5, hex("#ffe08a"));
  q.px(LX - 1, LY - 4, hex("#a86c22")); q.px(LX, LY - 4, hex("#c98f33"));
  q.add(LX, LY - 5, hex("#ffb347"), 0.6);
  q.add(LX, LY - 6, hex("#ffb347"), 0.28);
}

// ---- water: a sheet with a bright core, darker edges, and streaks scrolling down ----------------
function falls(q, t, NL, dn) {
  const WHITE = hex("#fbfdf4"), PALE = hex("#e4efe1"), SHADE = hex("#a9bcc2");
  for (const F of FALLS) {
    const n = Math.max(5, Math.round(F.w * 1.1));
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5;                       // -0.5..0.5 across the sheet
      const core = 1 - Math.abs(u) * 2;                  // 1 at the middle, 0 at the edges
      const wob = Math.sin(u * 4 + t * 0.5 + F.x * 0.03) * 1.6;
      const col = F.x + u * F.w * 0.9 + wob;
      const top = Math.floor(F.y0 + Math.abs(u) * 5);
      const bot = F.y1 - Math.floor((1 - Math.abs(u * 2)) * 6);
      for (let y = top; y < bot; y++) {
        const ph = (y * 0.45 + t * (11 + F.sp * 8) + rand(F.x, i, 1) * 32) % 14;
        const streak = ph < 4 ? 1 : ph < 8 ? 0.72 : 0.5;
        const taper = clamp((y - top) / 5, 0, 1) * clamp((bot - y) / 7, 0, 1);   // fade in at the lip, out at the base
        const a = core * core * (1.15 - 0.35 * Math.abs(u * 2)) * streak * taper * F.a;
        if (a <= 0.02) continue;
        const c = core > 0.55 ? (ph < 3 ? WHITE : PALE) : mix(PALE, SHADE, 1 - core);
        q.blend(col, y, c, a);
        if (core > 0.5) q.blend(col + 0.8, y, mix(PALE, WHITE, 0.6), a * 0.7);
      }
    }
    // the lip where the water leaves the rock, and the churn where it lands
    for (let i = -F.w / 2 - 2; i <= F.w / 2 + 2; i += 1) {
      q.blend(F.x + i, F.y0, WHITE, 0.8 * F.a);
      q.blend(F.x + i, F.y0 + 1, PALE, 0.65 * F.a);
      const churn = Math.sin(i * 0.8 + t * 2.6);
      q.blend(F.x + i * 1.15, F.y1 - 2 + churn * 1.6, WHITE, (0.3 + 0.25 * Math.abs(churn)) * F.a);
    }
  }
}

// ---- spray at the falls, and low mist drifting across the floor --------------------------------
function spray(q, t, NL, dn) {
  const MIST = hex("#e9f1e1");
  for (const F of FALLS) {
    const n = Math.round(5 + dn * 9 * F.a);
    for (let i = 0; i < n; i++) {
      const per = 3.5 + rand(F.x, i, 11) * 3;
      const u = t / per % 1;
      const x = F.x + (rand(F.x, i, 13) - 0.5) * F.w * (1.1 + u * 1.6);
      const y = F.y1 - 5 - u * (8 + rand(F.x, i, 14) * 16);
      const r = 2 + rand(F.x, i, 15) * 4.5;
      const a = 0.2 * Math.sin(Math.PI * u) * F.a;
      if (a > 0.02) q.disc(x, y, r, () => MIST, (d) => a * (1 - d * 0.85));
    }
  }
  for (let i = 0; i < 4; i++) {
    const per = 9 + rand(801, i, 1) * 5;
    const u = ((t / per) + rand(801, i, 2)) % 1;
    const x = -40 + u * (W + 80);
    const y = 180 + rand(801, i, 3) * 22;
    const rx = 32 + rand(801, i, 4) * 44, ry = 5 + rand(801, i, 5) * 7;
    const a = 0.14 * Math.sin(Math.PI * u) * dn;
    for (let yy = Math.floor(y - ry); yy <= y + ry; yy++)
      for (let xx = Math.floor(x - rx); xx <= x + rx; xx++) {
        const dx = (xx - x) / rx, dy = (yy - y) / ry;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        q.blend(xx, yy, MIST, a * (1 - d2));
      }
  }
}

// ---- light through the canopy ------------------------------------------------------------------
function rays(q, t, NL) {
  const K = hex("#fff6d8");
  const SHAFTS = [{ x: 112, w: 20, lean: 12 }, { x: 190, w: 14, lean: 20 }, { x: 256, w: 22, lean: 9 }];
  for (let si = 0; si < SHAFTS.length; si++) {
    const S = SHAFTS[si];
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.22 + si * 1.7);
    for (let y = 32; y < 198; y++) {
      const k = clamp((y - 32) / 80, 0, 1) * (1 - clamp((y - 148) / 50, 0, 1));
      if (k <= 0) continue;
      const cx = S.x + (y - 32) * (S.lean / 170);
      for (let i = -S.w / 2; i <= S.w / 2; i += 1.4) {
        const d = Math.abs(i) / (S.w / 2);
        const a = k * (1 - d) * (0.08 + pulse * 0.06);
        if (a > 0.01) q.light(cx + i, y, K, a);
      }
    }
  }
}

// ---- fireflies ---------------------------------------------------------------------------------
function fireflies(q, t, NL, dn) {
  const n = Math.round(5 + dn * 7);
  for (let i = 0; i < n; i++) {
    const per = 8 + rand(911, i, 1) * 6;
    const u = (t / per) % 1;
    const x = 24 + rand(911, i, 3) * 290 + Math.sin(u * TAU * 2 + i) * 12;
    const y = 158 + rand(911, i, 4) * 70 + Math.sin(u * TAU * 3 + i * 2) * 7;
    const a = Math.sin(Math.PI * u) * (0.5 + 0.5 * Math.sin(t * 3 + i * 2));
    if (a <= 0.03) continue;
    q.add(x, y, hex("#ffe38a"), a * 0.65);
    q.add(x, y - 1, hex("#c8ff9a"), a * 0.22);
  }
}
