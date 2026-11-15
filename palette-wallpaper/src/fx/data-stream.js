// A wall of falling code: three depths of green glyphs scrolling down a dark screen, each column with its own
// speed, trail and flicker, bright heads throwing a little light, and a sparse near layer of big characters in
// front. No image, no particles that accumulate: the head of every column is a function of t, and every column
// wraps a whole number of times and every glyph flickers a whole number of times per `duration`, so the loop has
// no seam. Density thins the columns; the palette recolours them (try PAL.cyber or PAL.neon).
import { fit, hex, mix, PAL } from "../../../src/core/index.js";
import { FONTS } from "../../../src/core/index.js";
import { rows } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Data Stream",
  desc: "Falling code in three depths: green glyphs scroll down a dark screen, bright heads casting light, gaps and flickers, big characters drifting in front.",
  tags: ["scifi", "data", "rain", "matrix", "code", "terminal", "night", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: PAL.matrix,
    seed: 5,
    density: 1,
  },
};

const W = 320, H = 180, D = 12;

// the fine layer: 4x6 cells, 80 columns, 3x5 glyphs
const CW = 4, CH = 6, COLS = 80, LA = 52;
// the near layer: 16x16 cells, 20 columns, 5x7 glyphs at double size
const BCW = 16, BCH = 16, BCOLS = 20, LB = 24;

const NAMES = "0123456789ABCDEFX#%*+-<>=:/".split("");

// Glyph bitmasks per row, from the library's own pixel fonts, centred in a fixed-width cell.
function atlas(font, w, h) {
  const F = FONTS[font];
  return NAMES.map((ch) => {
    const g = F.glyphs[ch] ?? F.glyphs[ch.toUpperCase()];
    const out = new Uint8Array(h);
    if (!g) return out;
    const off = Math.max(0, Math.floor((w - g.w) / 2));
    for (let r = 0; r < Math.min(h, g.rows.length); r++) {
      let m = 0;
      for (let c = 0; c < g.w && off + c < w; c++) if (g.rows[r][c]) m |= 1 << (off + c);
      out[r] = m;
    }
    return out;
  });
}
const GA = atlas("mini", 3, 5);
const GB = atlas("big", 5, 7);
const GN = GA.length;

// the near layer's glyphs, each pixel doubled: 10x14 in a 16x16 cell
function atlas2() {
  const F = FONTS.big;
  return NAMES.map((ch) => {
    const g = F.glyphs[ch] ?? F.glyphs[ch.toUpperCase()];
    const out = new Uint16Array(14);
    if (!g) return out;
    const off = Math.max(0, Math.floor((10 - g.w * 2) / 2));
    for (let r = 0; r < 14; r++) {
      const src = g.rows[r >> 1];
      let m = 0;
      for (let c = 0; c < g.w; c++) if (src[c]) m |= (1 << (off + c * 2)) | (1 << (off + c * 2 + 1));
      out[r] = m;
    }
    return out;
  });
}
const GB2 = atlas2();

// a tiny deterministic hash, 0..1
function rnd(a, b, c) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- per-seed columns ---------------------------------------------------------------------------
let CFG = null, CFG_KEY = "";
function cfg(S) {
  if (CFG && CFG_KEY === S) return CFG;
  const A = [], B = [];
  for (let c = 0; c < COLS; c++) {
    const r1 = rnd(S, c, 11), r2 = rnd(S, c, 12), r3 = rnd(S, c, 13), r4 = rnd(S, c, 14);
    // depth: 0 far (dim, slow), 1 mid (the bulk of the rain)
    const depth = r1 < 0.34 ? 0 : 1;
    const k = depth === 0 ? 1 : 2; // wraps per loop
    const flick = [2, 3, 4, 6][Math.floor(r3 * 4)];
    A.push({
      depth,
      speed: (k * LA) / D,
      phase: r2 * LA,
      trail: Math.round(depth === 0 ? 4 + r2 * 5 : 7 + r2 * 8),
      bias: depth === 0 ? -2 : 0,
      flick,
      // staggered, so every column doesn't swap glyph on the same frame
      foff: Math.floor(rnd(S, c, 16) * flick * D),
      glow: depth === 0 ? 0.04 : 0.16,
      on: r4,
    });
  }
  for (let c = 0; c < BCOLS; c++) {
    const r1 = rnd(S, 900 + c, 21), r2 = rnd(S, 900 + c, 22), r3 = rnd(S, 900 + c, 23);
    const flick = [1, 2, 3][Math.floor(r3 * 3)];
    B.push({
      speed: ((r3 < 0.55 ? 1 : 2) * LB) / D,
      phase: r1 * LB,
      trail: 2 + Math.round(r2 * 4),
      flick,
      foff: Math.floor(rnd(S, 900 + c, 25) * flick * D),
      on: r1 < 0.3,
      gate: rnd(S, 900 + c, 24),
    });
  }
  CFG = { A, B };
  CFG_KEY = S;
  return CFG;
}

// ---- the screen behind the rain, baked once per palette -----------------------------------------
let BG = null, BG_KEY = "";
function bgOf(C) {
  const key = C.join(",");
  if (BG && BG_KEY === key) return BG;
  const out = new Uint32Array(W * H);
  const top = C[0], deep = mix(C[0], 0x000000, 0.7);
  for (let y = 0; y < H; y++) {
    const vy = y / (H - 1);
    for (let x = 0; x < W; x++) {
      let c = mix(top, deep, vy * 0.9);
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      const v = dx * dx + dy * dy;
      if (v > 0.5) c = mix(c, 0x000000, (v - 0.5) * 0.42);
      if (y & 1) c = mix(c, 0x000000, 0.16); // a CRT scanline every other row
      out[y * W + x] = c;
    }
  }
  // the far columns sit behind the haze, so their greens are pulled toward the backdrop
  const dim = C.map((c) => mix(c, top, 0.5));
  BG = { pix: out, dim };
  BG_KEY = key;
  return BG;
}

export function drawBack(p, t, o) {
  const S = o.seed | 0, C = fit(o.palette, 8), A = cfg(S).A, SC = bgOf(C), BG = SC.pix, DIM = SC.dim, dens = o.density ?? 1;
  rows(p, meta, -170, 9, (y, R) => {
    const ry = Math.floor(y + 170);
    R.c.set(BG.subarray(ry * W, ry * W + W));
    const r = (ry / CH) | 0, gy = ry - r * CH, ink = gy < 5;
    for (let c = 0; c < COLS; c++) {
      const a = A[c];
      if (a.on > dens * 0.66) continue;
      let h = a.phase + a.speed * t;
      h -= Math.floor(h / LA) * LA;
      let d = h - r;
      if (d < 0) d += LA;
      if (d >= a.trail) continue;
      const u = d / a.trail, id = c * 137 + r;
      if (u > 0.2 && rnd(S, id, 3) < 0.13) continue; // holes in the trail
      let lv = u < 0.04 ? 7 : u < 0.13 ? 6 : 5 - Math.floor(Math.pow((u - 0.13) / 0.87, 0.75) * 4.2);
      if (u > 0.32 && rnd(S, id, 4) < 0.1) lv--; // dimmer cells, so the trail isn't a solid rod
      lv += a.bias;
      if (lv < 1) continue;
      if (lv > 7) lv = 7;
      const ft = (Math.floor(t * a.flick) + a.foff) % (a.flick * D);
      const m = ink ? GA[(rnd(S, id, 100 + ft) * GN) | 0][gy] : 0;
      const col = a.depth === 0 ? DIM[lv] : C[lv], base = c * CW;
      if (m & 1) R.c[base] = col;
      if (m & 2) R.c[base + 1] = col;
      if (m & 4) R.c[base + 2] = col;
      if (lv >= 6) {
        const k = lv === 7 ? a.glow : a.glow * 0.45;
        R.k[base] = k; R.k[base + 1] = k; R.k[base + 2] = k;
        R.l[base] = C[4]; R.l[base + 1] = C[4]; R.l[base + 2] = C[4];
      }
    }
  });
}

export function draw(p, t, o) {
  const S = o.seed | 0, C = fit(o.palette, 8), B = cfg(S).B, dens = o.density ?? 1;
  rows(p, meta, -170, 9, (y, R) => {
    const ry = Math.floor(y + 170);
    const r = (ry / BCH) | 0, gy = ry - r * BCH - 1;
    if (gy < 0 || gy > 13) return;
    for (let c = 0; c < BCOLS; c++) {
      const a = B[c];
      if (!a.on || a.gate > dens) continue;
      let h = a.phase + a.speed * t;
      h -= Math.floor(h / LB) * LB;
      let d = h - r;
      if (d < 0) d += LB;
      if (d >= a.trail) continue;
      const u = d / a.trail;
      let lv = u < 0.12 ? 7 : u < 0.35 ? 5 : 4 - Math.floor(Math.pow((u - 0.35) / 0.65, 0.8) * 2.2);
      if (lv < 3) continue;
      const ft = (Math.floor(t * a.flick) + a.foff) % (a.flick * D);
      const m = GB2[(rnd(S, 5000 + c * 97 + r, ft) * GN) | 0][gy];
      if (!m) continue;
      const col = C[lv], base = c * BCW + 3;
      for (let i = 0; i < 10; i++) if (m & (1 << i)) R.c[base + i] = col;
      if (lv >= 6) {
        const k = lv === 7 ? 0.9 : 0.45;
        for (let i = 0; i < 10; i++) { R.k[base + i] = k; R.l[base + i] = C[4]; }
      }
    }
  });
}
