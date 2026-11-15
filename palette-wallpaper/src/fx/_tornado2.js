// The machinery the four tornado wallpapers share: a snaking funnel that spins, wind bands streaking round it,
// a cloud collar where it meets the dark, lightning and the spiral of debris it drags up.
//
// The backdrop is deliberately near-black for every variant - the storm lives in the funnel and the ground, so
// the same darkness works behind fire, water, ice and leaves, and desktop icons stay readable on top of it.
//
// Everything is a pure function of t: the noise scrolls a whole tile per loop and every spin is a whole number
// of turns in `duration`, so the loops have no seam.
import { clamp, mix, rng, smooth, TAU, WHITE, bolt } from "../../../src/core/index.js";
import { field, rows } from "../../../src/fx/weather/_lib.js";

export const SY = 0.26;
const DITH = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---- baked noise, one field per seed ------------------------------------------------------------
let NF = null, NF_KEY = "";
function noiseOf(S) {
  if (NF && NF_KEY === S) return NF;
  NF = field(S * 13 + 7, 256, 128, [4, 8, 16, 32]).d;
  NF_KEY = S;
  return NF;
}

/**
 * The funnel's shape over time. o: { height, width, sway, ground }.
 * ax(u) is the axis, rad(u) the radius; u = 0 at the ground, 1 at the cloud base.
 */
export function geo(o, t, D) {
  const FH = o.height ?? 94, G = o.ground ?? -16, ph = (TAU * t) / D;
  const sway = o.sway ?? 8;
  const ax = (u) => sway * (Math.sin(ph - 2.1 * u) * (0.25 + 0.75 * u) + 0.34 * Math.sin(2 * ph + 1.1 - 3.6 * u) * u);
  const rad = (u) => 4.5 + ((o.width ?? 26) - 4.5) * Math.pow(u, 1.55) + 10 * Math.pow(smooth(0.82, 1, u), 2);
  return { FH, G, ph, ax, rad };
}

// ---- sky ----------------------------------------------------------------------------------------
/**
 * A storm sky that dissolves into black at its base, so every scene shares the same dark backdrop.
 * C is a 7-step ramp from black to the flash colour; only the top of the ramp is used when there is no lightning.
 */
export function sky(p, meta, t, D, C, S, o = {}) {
  const F = noiseOf(S), base = o.base ?? -110, drift = o.drift ?? 96, flash = o.flash ?? 0;
  const top = -170, span = base - top;
  rows(p, meta, top, base, (y, R) => {
    const sy = Math.floor(y + 170), vy = (y - top) / span;
    const fx0 = (t / D) * drift;
    for (let x = 0; x < 320; x++) {
      const v = F[(sy & 127) * 256 + (((x * 0.7 + fx0) & 255) | 0)];
      const q = clamp((v - 0.5) * 2.7 + 0.5, 0, 1);
      const g = q + (DITH[((sy & 3) << 2) | (x & 3)] / 16 - 0.5) * 0.2;
      let c = g < 0.3 ? C[0] : g < 0.48 ? C[1] : g < 0.64 ? C[2] : g < 0.8 ? C[3] : C[4];
      if (flash > 0.02) c = mix(c, C[6], Math.min(1, flash * (0.45 + 0.55 * v) * (0.35 + 0.65 * vy)));
      R.c[x] = c;
      R.a[x] = (1 - smooth(0.45, 0.95, vy)) * 0.96; // fade the cloud wall out into the black
      R.b[x] = 1;
      if (flash > 0.06) R.k[x] = flash * 0.4 * v * (1 - smooth(0.5, 1, vy));
    }
  });
}

// ---- the funnel ---------------------------------------------------------------------------------
// the body: a smoke column, lit along one flank, its texture shearing as the rows spin
export function body(p, C, g, t, D, S, o = {}) {
  const { FH, G, ax, rad } = g, N = noiseOf(S), spin = (t / D) * 512;
  const glow = o.glow ?? 0.5;
  const wob = (u) => 0.86 + 0.3 * N[((u * 34 + (t / D) * 64) | 0) & 255]; // a ragged, breathing silhouette
  for (let y = Math.round(G - FH); y <= G; y++) {
    const u = (G - y) / FH, cx = ax(u), r = rad(u) * wob(u);
    const fade = Math.min(1, u * 10 + 0.1) * (1 - smooth(0.8, 1.02, u));
    if (fade <= 0) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const c = (x + 0.5 - cx) / r;
      if (c < -1 || c > 1) continue;
      const edge = Math.sqrt(1 - c * c);
      const v = N[((c * 40 + y * 1.7 + spin) | 0) & 255];
      const lit = (1 - c) * 0.5; // the left flank catches the light
      const lv = 0.03 + v * 0.5 + edge * 0.24 + lit * 0.36 * glow;
      const col = lv > 0.9 ? C[7] : lv > 0.78 ? C[6] : lv > 0.66 ? C[5] : lv > 0.54 ? C[4] : lv > 0.42 ? C[3] : lv > 0.3 ? C[2] : C[1];
      p.blend(x, y, col, (0.5 + 0.5 * edge) * fade);
    }
  }
}

// wind bands: 1 px streaks wrapped round the funnel, bright at the head, fading along the tail
export function bands(p, C, g, t, D, S, back) {
  const { FH, G, ax, rad } = g;
  for (let j = 0; j < 70; j++) {
    const R = rng(S, j), u = (j + R.range(0.05, 0.95)) / 70, K = R.int(2, 4), span = R.range(0.8, 2.2), lvl = R.next();
    const cx = ax(u), r = rad(u) * R.range(1.0, 1.12), y0 = G - u * FH, head = R.range(0, TAU) + (TAU * K * t) / D;
    if (u > 0.98) continue;
    for (let s = 0; s <= span; s += 0.5 / Math.max(2, r)) {
      const th = head - s, sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const k = s / span, x = cx + r * Math.cos(th), y = y0 + r * SY * sn, lit2 = Math.cos(th) < 0.2;
      let i = lvl < 0.15 ? 2 : k < 0.15 && lvl > 0.55 ? 7 : k < 0.45 ? (lit2 ? 6 : 5) : lit2 ? 5 : 4;
      if (back) i = Math.max(1, i - 2);
      if (k < 0.5) p.dot(x, y, C[i], 1);
      else p.blend(x, y, C[i], 2 * (1 - k));
    }
  }
}

// the collar: a torn bank of cloud sitting on the base, mostly black, its underside catching the funnel's light
export function crown(p, C, rim, g, t, D, S, back, flash) {
  const { FH, G, ax, rad } = g, cx = ax(1), r = rad(1), y0 = G - FH;
  for (let j = 0; j < 11; j++) {
    const R = rng(S + 3, j);
    const th = R.range(0, TAU) + (TAU * R.int(1, 2) * t) / D;
    const rr = r * R.range(0.8, 2.3);
    const x = cx + rr * Math.cos(th) * 1.6;
    const y = y0 - R.range(0, 9) + rr * SY * Math.sin(th) * 0.8;
    const s = R.range(6, 12);
    p.disc(x, y, s, C[1], 0.55);
    p.disc(x, y - s * 0.4, s * 0.7, C[0], 0.6);
  }
  // a rim of lit vapour along the underside of the bank, brightest where the funnel's mouth is
  for (let j = 0; j < 26; j++) {
    const R = rng(S + 9, j);
    const th = R.range(0, TAU) + (TAU * R.int(1, 2) * t) / D;
    const rr = r * R.range(0.55, 1.9);
    const x = cx + rr * Math.cos(th) * 1.6, y = y0 + 1 + R.range(0, 3) + rr * SY * Math.sin(th) * 0.5;
    const a = Math.max(0, 1 - rr / (r * 2)) * (0.35 + 0.5 * flash);
    p.dot(x, y, mix(C[2], rim, 0.4 + flash * 0.5), a);
    if (a > 0.2) p.dot(x, y + 1, C[1], a * 0.7);
  }
  if (flash > 0.1) p.glow(cx, y0 - 2, r * 2.2, rim, 0.12 * flash);
}

// ---- lightning ----------------------------------------------------------------------------------
const PEAKS = [0.2, 0.47, 0.78];
/** 0..1 flash strength; zero at both ends of the loop. */
export function flashAt(t, D) {
  const q = t / D;
  let f = 0;
  for (let i = 0; i < PEAKS.length; i++) {
    const d = Math.abs(q - PEAKS[i]);
    if (d < 0.016) f = Math.max(f, 1 - d / 0.016);
    const d2 = Math.abs(q - PEAKS[i] - 0.012);
    if (d2 < 0.006) f = Math.max(f, 0.55 * (1 - d2 / 0.006));
  }
  return f;
}

/** A bolt from (x0, y0) down to (x1, y1), plus the light it throws. */
export function strike(p, C, S, t, D, x0, y0, x1, y1, f) {
  if (f <= 0.05) return;
  const n = Math.floor((t / D) * 60);
  const R = rng(S + n, 5);
  const path = bolt(R, x0, y0, x1, y1, { jag: 0.3, depth: 3 });
  p.polyline(path, f > 0.6 ? WHITE : C[6], Math.min(1, f * 1.6));
  p.glow((x0 + x1) / 2, (y0 + y1) / 2, 60, C[6], 0.35 * f);
  p.glow(x1, y1, 26, C[5], 0.28 * f);
}

// ---- debris -------------------------------------------------------------------------------------
/**
 * Particles that get pulled in at the foot and spiral up the funnel. fn(x, y, k, R, front) draws one, where
 * k is its life 0..1 and front tells which side of the funnel it is on. An integer number of journeys per
 * loop keeps the seam shut.
 */
export function spiral(p, t, D, S, g, count, fn) {
  const { FH, G, ax, rad } = g;
  for (let i = 0; i < count; i++) {
    const R = rng(S, i);
    const turns = Math.max(1, Math.round(D / (1.5 + R.next() * 2.2)));
    const k = ((t / D) * turns + R.next()) % 1;
    const u = 0.02 + 0.96 * Math.pow(k, 0.85);
    const th = R.range(0, TAU) + R.int(2, 3) * TAU * k;
    const sn = Math.sin(th);
    const rr = rad(u) * (1.08 + R.range(0, 0.22)) + 3;
    const x = ax(u) + rr * Math.cos(th), y = G - u * FH + rr * SY * sn;
    fn(x, y, k, R, sn > 0);
  }
}

/** Grit and mist boiling out of the foot, swept round the floor. */
export function skirt(p, t, D, S, g, Dst, count, front) {
  const cx0 = g.ax(0);
  for (let i = 0; i < count; i++) {
    const R = rng(S + 11, i);
    const turns = Math.max(1, Math.round(D / (0.9 + R.next() * 0.8)));
    const k = ((t / D) * turns + R.next()) % 1;
    const th = R.range(0, TAU) + R.int(5, 9) * TAU * k, sn = Math.sin(th);
    if (sn > 0 !== front) continue;
    const rr = 5 + k * R.range(14, 30);
    const x = cx0 + rr * Math.cos(th), y = g.G + 1 - k * R.range(4, 14) + rr * SY * sn;
    const s = R.range(3, 6) * (0.6 + 0.8 * k), a = Math.min(1, k * 6) * (1 - k) * 0.6;
    p.disc(x, y + s * 0.15, s, Dst[front ? 2 : 1], a);
    p.disc(x - s * 0.2, y - s * 0.3, s * 0.55, Dst[front ? 3 : 2], a * 0.8);
  }
}
