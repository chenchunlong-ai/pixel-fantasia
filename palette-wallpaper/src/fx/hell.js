// DRAFT — not shipped. Deregistered 2026-11-19 (user: the hell scene did not make the bar); kept for the
// water/silhouette techniques that are still worth reusing. Add it back to effects.js + params.js + i18n to ship.
// 地狱 / Hell.
// A dead black lake at dusk. The water is still until something moves under it: rings spread across the surface,
// a long shadow drifts beneath and never breaks through. Dead trees stand on the far bank and in the foreground as
// black silhouettes that sway, and red fog closes the distance down to a few metres — the far bank is barely there.
// Everything is seen through the mist, so nothing has a hard edge except the nearest branches.
// Technique borrowed from the library: water/ripple (elliptical rings fading outward), and smoke-heavy weather
// effects (translucent veils with a Bayer-dithered alpha).
import { clamp, fit, rand, hex, TAU, mix } from "../../../src/core/index.js";
import { clip, rows } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Hell",
  desc: "A dead black lake at dusk: rings spread across the still surface, a long shadow drifts beneath it and never breaks through, dead trees stand on the far bank and close to the camera as black silhouettes that sway, and red fog closes the distance down to a few metres.",
  tags: ["lake", "dead", "fog", "mist", "trees", "silhouette", "ripple", "underwater", "dread", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 14,
  loop: true,
  fps: 30,
  bg: "night",
  options: {
    other: ["#040205", "#12060a", "#25090f", "#3d0f16", "#5c1620", "#8a2a2a", "#c66b64"],
    density: 1,
  },
};

const D = 14, W = 320, Y0 = -170, Y1 = 10;
const BLACK = hex("#020103");
const HZ = -78;                             // the waterline: the far bank sits on it, everything below is water
const q2 = (p) => clip(p, meta);

const BAY = new Float32Array(16);
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) BAY[y * 4 + x] = ([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y][x] + 0.5) / 16;
const bayer = (x, y) => BAY[(((y | 0) & 3) * 4) + ((x | 0) & 3)];

// a cheap per-pixel grain, used for water texture and bark
function grainish(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 1023) / 1023;
}

export function drawBack(p, t, o) {
  const q = q2(p), NL = fit(o.other, 7), dn = o.density || 1;
  sky(p, q, t, NL);
  water(q, t, NL);
  bankMist(q, t, NL);
  farTrees(q, t, NL);
  rings(q, t, NL, dn);
  beneath(q, t, NL);
  nearBranches(q, t, NL);
}

export function draw(p, t, o) {
  const q = q2(p), NL = fit(o.other, 7);
  veils(q, t, NL, o.density || 1);
  motes(q, t, NL, (o.density || 1) * 12);
}

// the sky: black overhead, a dull sourceless red low down, and fog banks drifting through it
function sky(p, q, t, NL) {
  const S = [
    BLACK,
    mix(NL[0], BLACK, 0.5),
    NL[1],
    mix(NL[1], NL[2], 0.7),
    NL[2],
    mix(NL[2], NL[3], 0.7),
    mix(NL[3], NL[4], 0.6),
    mix(NL[4], NL[5], 0.55),
  ];
  rows(p, meta, Y0, HZ, (y, R) => {
    const f = clamp((y - Y0) / (HZ - Y0), 0, 1);
    const fi = Math.pow(f, 2.4) * (S.length - 1), k0 = Math.min(S.length - 2, fi | 0), fr = fi - k0;
    // two mist layers: the slow one sits high, the fast one hugs the bank
    const m1 = 0.5 + 0.5 * Math.sin(y * 0.05 + (TAU * t) / D + 1.2);
    const m2 = 0.5 + 0.5 * Math.sin(y * 0.11 - (TAU * t) / D * 1.8 + 2.5);
    const fogAmt = clamp((y - Y0) / 110, 0, 1) * (m1 * 0.55 + m2 * 0.45);
    const fogCol = mix(NL[3], NL[5], 0.55);
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      // the fog drifts sideways, so the banks are not flat bands
      const drift = 0.5 + 0.5 * Math.sin(x * 0.014 + (TAU * t) / D * 2.2);
      const famt = fogAmt * (0.35 + 0.65 * drift);
      const base = fr > bayer(x, y) ? S[k0 + 1] : S[k0];
      R.c[i] = mix(base, fogCol, famt * 0.45);
      R.a[i] = 1;
      R.b[i] = 0;
    }
  });
}

// the lake: black water, a dull reflection right under the bank, and a slow shifting sheen
function water(q, t, NL) {
  const W1 = mix(NL[1], BLACK, 0.55);
  const W0 = mix(NL[0], BLACK, 0.35);
  for (let y = Math.floor(HZ); y <= Y1 - 1; y++) {
    const d = (y - HZ) / (Y1 - HZ);                       // 0 at the bank, 1 at the bottom of the frame
    const refl = Math.max(0, 1 - d * 3.2);                // the fog's reflection, strongest at the bank
    const sh = Math.sin(y * 1.7 + (TAU * t) / D * 2.4);   // one sheen phase per row: cheap and it reads as water
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      const rippleX = Math.sin(x * 0.05 + y * 0.4 + (TAU * t) / D * 3);
      const base = mix(mix(W1, W0, Math.pow(d, 0.5)), NL[3], refl * 0.5);
      const sheen = (sh * rippleX) * 0.5 + 0.5;
      let c = mix(base, mix(NL[2], NL[3], 0.5), sheen * 0.14 * (0.4 + refl * 1.6));
      const g = grainish(x, y);
      if (g > 0.965 && sheen > 0.85) c = mix(c, NL[3], 0.35);   // the odd glint
      q.px(x, y, c);
    }
  }
}

// a mist bank hanging over the water: it hides the hard line between the fog and the lake, as soft colour, no dither
function bankMist(q, t, NL) {
  const col = mix(NL[3], NL[5], 0.35);
  for (let y = Math.floor(HZ - 14); y <= Math.floor(HZ + 12); y++) {
    const v = 1 - Math.abs(y + 0.5 - HZ) / 14;
    const a = 0.55 * Math.pow(Math.max(0, v), 1.6);
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      // the bank breathes: a slow wave travelling along it, so the fog has no straight edge either
      const w = 0.75 + 0.25 * Math.sin(x * 0.02 + (TAU * t) / D * 1.4) * Math.sin(x * 0.008 - (TAU * t) / D);
      q.blend(x, y, col, a * w);
    }
  }
}
// the far bank: dead trees standing at the waterline, black against the fog, swaying a little
function farTrees(q, t, NL) {
  const n = 9;
  const TRUNK = mix(NL[1], BLACK, 0.5);
  for (let k = 0; k < n; k++) {
    const R = (j) => rand(151, k, j);
    const bx = -168 + ((k + 0.5) / n) * 336 + (R(1) - 0.5) * 24;
    const h = 30 + R(2) * 62;
    const sway = (2 + R(3) * 5) * Math.sin((TAU * t) / D * (0.45 + R(4)) + R(5) * TAU);
    const lean = (R(6) - 0.5) * 10;
    const S = (u) => bx + sway * u * u + lean * u;         // the trunk bends with the sway
    // trunk: two pixels wide at the base, one higher up, with a couple of bark ticks
    for (let s = 0; s <= h; s++) {
      const u = s / h, x = S(u), y = HZ + 2 - s;
      q.px(x, y, TRUNK);
      if (u < 0.45) q.px(x - 1, y, TRUNK);
      if (u < 0.18 && grainish(x, y) > 0.62) q.px(x + 1, y, TRUNK);
    }
    // limbs: they leave the trunk and droop, like a dead willow
    for (let b = 0; b < 4; b++) {
      const rb = (j) => rand(157, k * 7 + b, j);
      const at = 0.3 + rb(1) * 0.62;
      const dir = rb(2) < 0.5 ? -1 : 1;
      const len = 8 + rb(3) * 20;
      const drop = 4 + rb(4) * 12;
      let x = S(at), y = HZ + 2 - h * at;
      for (let s = 0; s <= len; s++) {
        const u = s / len;
        q.px(x, y, TRUNK);
        x += dir * (1.1 - u * 0.5);
        y += (drop / len) * (0.4 + u * 1.2);
        if (u > 0.55 && grainish(x * 3, y * 3) > 0.55) q.px(x, y + 1, TRUNK);   // twigs hanging off the limb
      }
    }
    // its reflection: a broken vertical smear in the water under the trunk
    for (let s = 0; s < 12; s++) {
      const u = s / 12;
      const x = bx + sway * 0.9 + (grainish(s, k) - 0.5) * 3;
      q.blend(x, HZ + 3 + s, BLACK, 0.45 * (1 - u));
    }
  }
}

// what swims beneath: a long shadow crossing the lake, only ever a disturbance in the water, never a body
function beneath(q, t, NL) {
  const u = (t / D) % 1;
  const cx = -200 + u * 400;                    // it crosses the frame once per loop
  const cy = HZ + 44;
  const len = 120, hgt = 9;
  // a soft darkening of the water, no object outline: it should never resolve into a shape
  for (let x = Math.floor(cx - len * 0.5); x <= Math.floor(cx + len * 0.5); x++) {
    const p = (x + 0.5 - (cx - len * 0.5)) / len;
    const amt = Math.sin(p * Math.PI);
    if (amt <= 0.02) continue;
    const w = amt * hgt;
    for (let y = Math.floor(cy - w); y <= Math.floor(cy + w); y++) {
      const dy = Math.abs(y + 0.5 - cy) / (w + 0.4);
      if (dy > 1) continue;
      q.blend(x, y, mix(BLACK, NL[1], 0.25), 0.5 * (1 - dy * dy) * amt);
    }
    // the surface over its back is pushed up: one pale pixel per column, only along the top of the body
    if (amt > 0.28) q.blend(x, cy - w - 1, mix(NL[3], NL[5], 0.4), 0.55 * amt);
  }
}
// rings on the surface: something down there shifts, and the water answers
function rings(q, t, NL, dn) {
  const n = Math.round(5 * Math.min(1.6, dn));
  for (let k = 0; k < n; k++) {
    const R = (j) => rand(171, k, j);
    const cx = -130 + R(1) * 260 + 8 * Math.sin((TAU * t) / D + R(2) * TAU);
    const cy = HZ + 16 + R(3) * 44;
    const sp = 0.5 + R(4) * 0.7;
    const ph = ((t / D) * sp + R(5)) % 1;
    const r = 3 + ph * (30 + R(6) * 46);
    const flat = 0.14 + R(7) * 0.14;              // perspective: rings are ellipses, not circles
    const a = 0.8 * Math.pow(1 - ph, 1.4);
    const steps = Math.max(40, Math.round(TAU * r));
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * TAU;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * flat;
      // the ring catches the red light on its far side, and is a dark line on its near side
      const far = Math.sin(ang) < 0;
      if (far) {
        q.blend(x, y, mix(NL[4], NL[5], 0.3), Math.min(0.62, a * 0.75));
        if (a > 0.5) q.blend(x, y + 1, mix(NL[2], NL[3], 0.35), Math.min(0.5, a * 0.6));
      } else {
        q.blend(x, y, mix(NL[1], BLACK, 0.3), Math.min(0.7, a * 0.8));
      }
    }
  }
}

// the foreground: branches creeping into the frame from both corners, close enough to read as shapes
function nearBranches(q, t, NL) {
  const limbs = [
    { x0: -178, y0: 16, x1: -112, y1: -6, w: 6 },
    { x0: -146, y0: 10, x1: -122, y1: -44, w: 4 },
    { x0: 170, y0: 18, x1: 104, y1: 2, w: 5 },
    { x0: 152, y0: 10, x1: 134, y1: -36, w: 4 },
  ];
  const COL = mix(NL[0], BLACK, 0.3);
  for (let i = 0; i < limbs.length; i++) {
    const L = limbs[i];
    const sway = 2.4 * Math.sin((TAU * t) / D * 0.6 + i * 1.4);
    const x1 = L.x1 + sway * 2, y1 = L.y1 + sway;
    limb(q, L.x0, L.y0 + sway * 0.5, x1, y1, L.w, COL);
    for (let b = 0; b < 3; b++) {
      const R = (j) => rand(201, i * 5 + b, j);
      const ang = (R(1) - 0.5) * 2.2;
      const len = 9 + R(2) * 20;
      limb(q, x1, y1, x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len * 0.7,
        1.6 + R(3) * 1.6, COL);
    }
  }
}

// a tapering limb: a line with thickness, so branch shapes have weight
function limb(q, x0, y0, x1, y1, w, col) {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(2, Math.round(Math.hypot(dx, dy)));
  for (let s = 0; s <= n; s++) {
    const u = s / n;
    const x = x0 + dx * u, y = y0 + dy * u;
    const r = w * (1 - u * 0.45);
    const r2 = r * r;
    for (let oy = -Math.ceil(r); oy <= Math.ceil(r); oy++) {
      for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++) {
        if (ox * ox + oy * oy > r2) continue;
        q.px(x + ox, y + oy, col);
      }
    }
  }
}

// the mist: broad red veils crossing the frame, dithered so they read as air, not as a solid wall
function veils(q, t, NL, dn) {
  const n = Math.round(4 * Math.min(1.6, dn));
  for (let k = 0; k < n; k++) {
    const R = (j) => rand(211, k, j);
    const y0 = -130 + R(1) * 110;
    const h = 26 + R(2) * 34;
    const sp = 0.18 + R(3) * 0.22;
    const off = R(4) * W;
    const col = mix(NL[4], NL[5], 0.5 + R(5) * 0.4);
    const ph = R(6) * TAU;
    for (let y = Math.floor(y0); y < y0 + h; y++) {
      const v = (y - y0) / h;
      const a = 0.55 * (1 - Math.abs(v * 2 - 1));          // one amplitude per row
      const wob = 26 * Math.sin(y * 0.02 + (TAU * t) / D * sp * 2 + ph);
      for (let i = 0; i < W; i++) {
        if (bayer(i, y) > a * 1.4) continue;
        const x = i - 160 + 0.5;
        const sx = ((x + off + (t / D) * sp * 260 + wob + 80) % (W + 60)) - 30;
        const edge = clamp(1 - Math.abs(sx) / 190, 0, 1);
        if (edge <= 0) continue;
        q.blend(x, y, col, 0.2 * edge);
      }
    }
  }
}

// motes in the air: tiny flecks drifting with the mist, catching the low red light
function motes(q, t, NL, n) {
  for (let i = 0; i < Math.round(n); i++) {
    const R = (j) => rand(221, i, j);
    const layer = R(1);
    const sp = 0.1 + layer * 0.22;
    const y = -130 + R(3) * 150 + 5 * Math.sin(((t / D) * sp + R(2)) * TAU + R(4) * TAU);
    const x = -160 + (((R(5) * 320 + (t / D) * sp * 320) % 320) + 320) % 320;
    q.blend(x, y, mix(NL[5], NL[6], R(6)), (0.2 + layer * 0.4) * 0.5);
  }
}
