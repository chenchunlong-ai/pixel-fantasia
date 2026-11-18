// DRAFT — not shipped. Deregistered 2026-11-19 (user: the hell scene did not make the bar); kept for the
// water/silhouette techniques that are still worth reusing. Add it back to effects.js + params.js + i18n to ship.
// 地狱 · 黑水湖（3D） / Hell · The Black Lake, in perspective.
//
// The camera is real: it hangs above the water, drifts, and everything is projected into this 320x180 buffer.
// The drawing stays pixel art, because that is the medium and because a trunk at 90 m would otherwise collapse
// into 1 px hatching.
//
//   * water is a plane: each row below the horizon is one distance d = F*CH/(y-HOR), so the rows compress
//     towards the horizon like real water, and a ripple is a circle in world space that projects into the
//     perspective ellipse you see.
//   * trees are placed by the angle we look at and their depth (x = tan(a) * z). Their base sits on the water
//     row of that depth and their height is F*h/z, so they slide at different speeds when the camera drifts —
//     that parallax is the whole point of doing it in 3D.
//   * the thing under the water is a body in world space: it shortens as it turns away, and the rings it leaves
//     spread from where it really is.
//
// The mist is a few bands at fixed depths rather than per-pixel volumetrics: at this resolution a real volume
// reads as a wash, a banded one reads as fog with layers.
import { clamp, fit, rand, hex, TAU, mix } from "../../../src/core/index.js";
import { clip, rows, field, sample } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Hell 3D",
  desc: "The black lake in perspective: the camera hangs above the water and drifts, dead trees stand at their own depths and slide at their own speeds, rings from something moving under the surface spread in true perspective, and red mist closes the distance down.",
  tags: ["lake", "dead", "fog", "trees", "3d", "perspective", "parallax", "underwater", "dread", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 90],
  duration: 16,
  loop: true,
  fps: 30,
  bg: "night",
  options: {
    other: ["#040205", "#12060a", "#25090f", "#3d0f16", "#5c1620", "#8a2a2a", "#c66b64"],
    density: 1,
  },
};

const D = 16;
const HALF_W = 160;
const BLACK = hex("#020103");

// ---- camera ------------------------------------------------------------------------------------
const HOR = -30;      // horizon row: high enough to see the far bank, low enough to keep sky overhead
const FOC = 340;
const CH = 2.3;       // camera height above the water, world units
const groundY = (d, cam) => HOR + (FOC * (CH + cam.bob)) / (d + cam.z);
const dOfY = (y, cam) => (FOC * (CH + cam.bob)) / (y - HOR) - cam.z;

/** Camera drift: a slow lateral sway plus a small push-in, whole cycles per loop so the loop seams. */
function camAt(t) {
  const u = t / D;
  return {
    x: Math.sin(TAU * u) * 0.65 + Math.sin(TAU * u * 2 + 1.1) * 0.16,
    z: Math.cos(TAU * u) * 0.22,
    bob: Math.sin(TAU * u * 2 + 0.4) * 0.03,
  };
}
const projX = (wx, d, cam) => (FOC * (wx - cam.x)) / (d + cam.z);

const SIN = new Float32Array(256);
for (let i = 0; i < 256; i++) SIN[i] = Math.sin((i / 256) * TAU);
const fs = (phase) => SIN[((phase % 1) * 256) & 255];
const MIST = field(9137, 256, 128, [4, 8, 16, 32]);
const STRIP = field(4421, 256, 128, [8, 16, 32]);

// ---- the trees we actually see: few and big, placed by angle and depth ------------------------------
const HERO = [
  // the far bank: small but readable, dissolving into the horizon fog
  { a: -0.62, z: 86, h: 11.0, w: 0.75, limbs: 3, seed: 311 },
  { a: -0.34, z: 82, h: 11.5, w: 0.78, limbs: 3, seed: 317 },
  { a: -0.06, z: 90, h: 10.5, w: 0.7, limbs: 3, seed: 331 },
  { a: 0.28, z: 84, h: 11.2, w: 0.78, limbs: 3, seed: 337 },
  { a: 0.58, z: 88, h: 10.8, w: 0.72, limbs: 3, seed: 347 },
  { a: 0.74, z: 80, h: 11.0, w: 0.75, limbs: 3, seed: 351 },
  // the middle of the lake: full silhouettes with drooping boughs
  { a: -0.48, z: 58, h: 10.5, w: 0.8, limbs: 4, seed: 401 },
  { a: -0.18, z: 52, h: 10.0, w: 0.8, limbs: 4, seed: 409 },
  { a: 0.16, z: 62, h: 10.5, w: 0.75, limbs: 4, seed: 419 },
  { a: 0.44, z: 50, h: 9.5, w: 0.8, limbs: 4, seed: 431 },
  // close, at the edge of the mist: two big trunks we almost stand beside
  { a: -0.46, z: 16, h: 4.2, w: 0.32, limbs: 3, seed: 439 },
  { a: 0.50, z: 17, h: 3.8, w: 0.28, limbs: 3, seed: 443 },
];
const TREES = HERO.map((T) => ({ ...T, x: Math.tan(T.a) * T.z, lean: (rand(T.seed, 9, 1) - 0.5) * 1.0 }));
/** A limb in tree-local units (trunk 0..1 high), so one table serves any depth. */
const LIMB = TREES.map((T) => {
  const out = [];
  for (let i = 0; i < T.limbs; i++) {
    const up = 0.42 + rand(T.seed, i, 1) * 0.46;
    out.push({
      up,
      ang: (i % 2 ? 1 : -1) * (0.45 + rand(T.seed, i, 2) * 0.85),
      len: (0.28 + rand(T.seed, i, 3) * 0.3) * (1.15 - up * 0.5),
      twig: 1 + Math.floor(rand(T.seed, i, 4) * 2),
      droop: 0.25 + rand(T.seed, i, 5) * 0.45,
    });
  }
  return out;
});

// ---- the thing under the water ---------------------------------------------------------------
const BODY = 9;
function bodyAt(t) {
  const u = t / D;
  return {
    x: Math.sin(TAU * u) * 4.6 - 1.2,
    z: 15.0 + Math.sin(TAU * u + 0.6) * 3.2,
    yaw: Math.sin(TAU * u + 2.0) * 0.5,
  };
}

export function drawBack(p, t, o) {
  const q = clip(p, meta);
  const NL = fit(o.other, 7);
  const cam = camAt(t);
  const dn = o.density || 1;

  sky(q, t, cam, NL);
  water(q, t, cam, NL);
  reflections(q, t, cam, NL);
  trees(q, t, cam, NL);
  rings(q, t, cam, NL, dn);
  beneath(q, t, cam, NL);
  mistBands(q, t, cam, NL, dn);
}

export function draw(p, t, o) {
  const q = clip(p, meta);
  const NL = fit(o.other, 7);
  const cam = camAt(t);
  clumps(q, t, cam, NL, o.density || 1);
  motes(q, t, NL, (o.density || 1) * 12);
}

// ---- sky: black overhead, a sourceless red glow standing over the horizon --------------------
function sky(q, t, cam, NL) {
  const S0 = hex("#030206"), S1 = hex("#07040a"), S2 = hex("#0d050c"), S3 = hex("#16080f"), S4 = hex("#260b11"), S5 = hex("#3a1214");
  rows(q, meta, -90, Math.floor(HOR) + 1, (y, R) => {
    const k = clamp((y - (HOR - 18)) / 18, 0, 1);                 // 0 far above, 1 at the horizon
    const far = clamp((HOR - y) / 75, 0, 1);
    const row = k > 0.92 ? S5 : k > 0.75 ? S4 : k > 0.5 ? S3 : far > 0.6 ? S1 : S0;
    const n0 = sample(MIST, (y + 90) * 0.05 + t * 0.05, t * 0.3);
    for (let i = 0; i < R.w; i++) {
      const wx = (i + 0.5) * 0.5 - 80 + cam.x * 6;
      const n = n0 * 0.6 + 0.4 * sample(MIST, wx * 0.14 + t * 0.4, (y + 90) * 0.1);
      R.c[i] = n > 0.5 ? mix(row, S4, (n - 0.5) * 1.1 * k) : mix(row, S0, (0.5 - n) * 0.5 * k);
    }
  });
}

// ---- the far bank: an uneven dark shore that dissolves into the horizon fog -------------------
function farBank(q, t, cam, NL) {
  const DARK = mix(NL[0], BLACK, 0.6);
  rows(q, meta, Math.floor(HOR) - 3, Math.floor(HOR) + 1, (y, R) => {
    for (let i = 0; i < R.w; i++) {
      const wx = (i + 0.5) * 0.5 - 80 + cam.x * 4;
      const n = sample(STRIP, wx * 0.7 + t * 0.6, y * 0.3);
      const top = HOR - 2.6 + n * 4.2;                  // an uneven crest of land
      const a = clamp((y - top + 1.4) / 2.0, 0, 1);
      if (a <= 0.04) continue;
      R.c[i] = a > 0.55 ? DARK : mix(NL[1], NL[3], 0.35);
      R.b[i] = 1;
      R.a[i] = a * 0.55;
    }
  });
}

// ---- water: a plane, one distance per row ----------------------------------------------------
function water(q, t, cam, NL) {
  const BASE = mix(NL[1], BLACK, 0.6);
  const FARW = mix(NL[2], BLACK, 0.45);
  const SHEEN = mix(NL[3], NL[4], 0.22);
  const GLOW = mix(NL[4], NL[5], 0.35);
  rows(q, meta, Math.floor(HOR) + 3, 90, (y, R) => {
    const d = dOfY(y, cam);
    const fog = 1 - Math.exp(-d / 30);
    const scale = FOC / (d + cam.z);
    const n0 = sample(STRIP, t * 0.6, d * 1.15 - t * 0.3);
    const gl = clamp((d - 8) / 26, 0, 1) * 0.55;
    let wx = (-HALF_W - cam.x) * scale;
    for (let i = 0; i < R.w; i++, wx += scale) {
      // long thin streaks: the plane seen at a slant
      const n = n0 * 0.65 + 0.35 * (0.5 + 0.5 * fs(wx * 0.13 + d * 0.1 + t * 0.07));
      let c = mix(mix(BASE, FARW, fog), SHEEN, clamp((n - 0.52) * 0.5, 0, 1) * 0.42);
      c = mix(c, GLOW, gl);
      if (n > 0.82 && d < 18) c = mix(c, mix(NL[4], NL[5], 0.2), 0.3);
      R.c[i] = c;
    }
  });
}

// ---- reflections: each tree keeps a squashed, fading ghost below its waterline -------------------
function reflections(q, t, cam, NL) {
  const INK = mix(NL[0], BLACK, 0.75);
  for (const T of TREES) {
    const cx = projX(T.x, T.z, cam), baseY = groundY(T.z, cam);
    if (cx < -40 || cx > 360) continue;
    const s = FOC / T.z, wpx = Math.max(1.2, s * T.w), hpx = s * T.h * 0.45;
    for (let j = 1; j < hpx && baseY + j < 90; j++) {
      const fade = 1 - j / hpx;
      const wob = fs(j * 0.02 + t * 0.9) * Math.min(2.4, j * 0.06);
      const half = wpx * (0.5 + fade * 0.9);
      for (let i = -half; i <= half; i += 0.8) {
        const a = fade * 0.8 * (1 - Math.abs(i) / (half + 0.3));
        if (a > 0.02) q.blend(cx + i + wob, baseY + j, INK, a);
      }
    }
  }
}

// ---- the trees: projected, painted with the width their depth earns ----------------------------
function trees(q, t, cam, NL) {
  const INK = mix(NL[0], BLACK, 0.8);
  for (const T of TREES.slice().sort((a, b) => b.z - a.z)) {
    const baseX = projX(T.x, T.z, cam), baseY = groundY(T.z, cam);
    if (baseX < -80 || baseX > 400) continue;
    const s = FOC / T.z, hpx = s * T.h, wpx = Math.max(1.1, s * T.w);
    const sway = fs(t * 0.06 + T.seed * 0.01) * 0.05 + fs(t * 0.02 + T.seed * 0.007) * 0.02;
    const lean = T.lean * 0.4 + sway;
    const fog = clamp((T.z - 50) / 40, 0, 1);                 // only the far bank washes out
    const col = mix(INK, mix(NL[1], NL[3], 0.6), fog * 0.6);
    const bendAt = (u) => baseX + u * u * lean * hpx * 0.45;
    const n = Math.round(hpx);
    for (let i = 0; i <= n; i++) {
      const u = i / n, y = baseY - u * hpx, x = bendAt(u);
      const half = Math.max(0.5, (wpx * (1 - u * 0.65)) / 2);
      for (let k = -half; k <= half; k += 0.8) q.px(x + k, y, col);
    }
    for (const L of LIMB[TREES.indexOf(T)]) {
      const ox = bendAt(L.up), oy = baseY - L.up * hpx;
      const lx = Math.cos(L.ang) * L.len * hpx * 0.72;
      const ly = -Math.abs(Math.sin(L.ang)) * L.len * hpx * 0.34;
      const steps = Math.round((Math.abs(lx) + Math.abs(ly)) * 2.2) + 4;
      for (let i = 0; i <= steps; i++) {
        const v = i / steps;
        const x = ox + lx * v, y = oy + ly * v + v * v * L.droop * hpx * 0.22;
        const th = Math.max(0.9, wpx * (0.55 - v * 0.42));
        for (let k = -th; k <= th; k += 0.8) q.px(x + k, y, col);
      }
      // twigs at the end of the limb: short lines dropping off it, never single dots
      for (let w = 0; w < L.twig; w++) {
        const v = 0.5 + w * 0.22;
        const x0 = ox + lx * v, y0 = oy + ly * v + v * v * L.droop * hpx * 0.22;
        const tl = Math.max(3, hpx * 0.07);
        for (let z = 1; z <= tl; z++) q.px(x0 + z * 0.32, y0 + z * 1.15, col);
      }
    }
  }
}

// ---- rings: circles in world space, so they are perspective ellipses without extra maths --------
function rings(q, t, cam, NL, dn) {
  const HOT = mix(NL[4], NL[5], 0.25), COOL = mix(NL[2], NL[3], 0.4);
  const count = Math.round(4 + dn * 5);
  for (let i = 0; i < count; i++) {
    const period = 3.5 + (i % 3) * 1.5;
    const age = ((t / period + rand(77, i, 1) * 2.3) % 1) * period;
    const life = 5.0 + rand(77, i, 2) * 3.0;
    if (age > life) continue;
    const cx = -14 + rand(77, i, 3) * 28, cz = 10 + rand(77, i, 4) * 26;
    const r = 0.06 + age * (0.22 + rand(77, i, 5) * 0.14);
    const a0 = 1 - age / life;
    if (a0 <= 0.1) continue;
    const spanPx = (FOC * r) / cz;
    if (spanPx > 42) continue;
    const n = Math.max(36, Math.round(spanPx * 5));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU;
      const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r * 0.66;
      if (pz < 8) continue;
      const sy = groundY(pz, cam);
      if (sy > 88) continue;
      const sx = projX(px, pz, cam);
      const lit = Math.sin(a) > 0;
      const al = a0 * (lit ? 0.34 : 0.14) * clamp(1 - spanPx / 60, 0.4, 1);
      q.blend(sx, sy, lit ? HOT : COOL, al);
      if (spanPx > 8 && lit && j % 2 === 0) q.blend(sx, sy + 0.9, COOL, al * 0.5);
    }
  }
}

// ---- the body under the water ------------------------------------------------------------------
function beneath(q, t, cam, NL) {
  const B = bodyAt(t);
  const INK = mix(NL[0], BLACK, 0.2);
  const RIM = mix(NL[4], NL[5], 0.4);
  for (let i = 0; i < BODY; i++) {
    const u = i / (BODY - 1) - 0.5;
    const along = u * 4.0;
    const wx = B.x + Math.cos(B.yaw) * along, wz = B.z + Math.sin(B.yaw) * along * 0.45;
    const sx = projX(wx, wz, cam), sy = groundY(wz, cam);
    if (sy > 88) continue;
    const s = FOC / wz, half = Math.max(1, (1 - Math.abs(u) * 0.75) * s * 0.2);
    const drop = Math.abs(u) * s * 0.05;
    for (let k = -half; k <= half; k += 0.8) {
      const a = 0.55 * (1 - Math.abs(u) * 0.3);
      q.blend(sx + k, sy + drop, INK, a);
      q.blend(sx + k, sy + drop + 1, mix(INK, NL[1], 0.3), a * 0.7);
    }
    if (i < BODY - 2 && i % 2) q.blend(sx, sy + drop - 0.8, RIM, 0.2 * (1 - Math.abs(u)));
  }
}

// ---- mist: three bands at three depths, so the fog has layers instead of a wash -----------------
function mistBands(q, t, cam, NL, dn) {
  const C0 = mix(NL[3], NL[4], 0.55), C1 = mix(NL[2], NL[3], 0.6);
  const BANDS = [
    { y0: HOR - 12, y1: HOR + 18, a: 0.55, drift: 0.55 },   // the horizon fog: heaviest
    { y0: HOR + 10, y1: HOR + 44, a: 0.26, drift: 0.9 },    // a veil standing on the far water
    { y0: HOR + 36, y1: 88, a: 0.12, drift: 1.35 },         // thin mist over the near water
  ];
  for (const B of BANDS) {
    const y0 = Math.floor(B.y0), y1 = Math.min(88, Math.floor(B.y1));
    rows(q, meta, y0, y1, (y, R) => {
      const env = Math.sin(Math.PI * clamp((y - B.y0) / (B.y1 - B.y0), 0, 1));   // fades at both edges
      const d = y > HOR ? dOfY(y, cam) : 60;
      const n0 = sample(MIST, t * B.drift * 0.4, d * 0.4 + t * 0.12);
      for (let i = 0; i < R.w; i++) {
        const wx = (i + 0.5) * 0.6 - 96 + cam.x * 8 * B.drift;
        const n = n0 * 0.55 + 0.45 * sample(STRIP, wx * 0.1 + t * B.drift * 0.5, y * 0.08);
        const a = clamp((n - 0.46) * 2.4, 0, 1) * env * B.a * dn;
        if (a <= 0.02) continue;
        R.c[i] = a > 0.42 ? C0 : C1;
        R.b[i] = 1;
        R.a[i] = a;
      }
    });
  }
}

// ---- a few low clumps of fog racing across the water, so the surface is not perfectly still -------
function clumps(q, t, cam, NL, dn) {
  const n = Math.round(2 + dn * 2);
  for (let i = 0; i < n; i++) {
    const period = 9 + rand(881, i, 1) * 5;
    const u = (t / period + rand(881, i, 2)) % 1;
    const cz = 12 + rand(881, i, 3) * 18;
    const dir = i % 2 ? 1 : -1;
    const cx = (-1 + 2 * u) * 22 * dir;
    const sx = projX(cx, cz, cam), sy = groundY(cz, cam) - 2;
    const s = FOC / cz;
    const half = s * (0.5 + rand(881, i, 4) * 0.7), up = Math.max(2, s * 0.1);
    const a = 0.22 * Math.sin(Math.PI * u);
    if (a <= 0.02) continue;
    for (let j = -up; j <= up; j++) {
      const hw = half * (1 - Math.abs(j) / (up + 1));
      for (let k = -hw; k <= hw; k += 1.2) q.blend(sx + k, sy + j * 0.7, mix(NL[2], NL[3], 0.4), a * (1 - Math.abs(j) / (up + 2)));
    }
  }
}

// ---- a few specks in the air, drifting with the same wind as the mist ---------------------------
function motes(q, t, NL, n) {
  for (let i = 0; i < n; i++) {
    const speed = 0.5 + rand(31, i, 1) * 0.6;
    const x = -160 + ((rand(31, i, 2) * 320 + t * speed * 9) % 320);
    const y = -88 + rand(31, i, 3) * 176 + fs(t * 0.04 + i) * 2;
    q.blend(x, y, mix(NL[3], NL[5], 0.45), 0.22 + rand(31, i, 4) * 0.4);
  }
}
