// A sky torn open. A ragged crack runs bottom-left to top-right; it is not a neat slit — the tear
// bulges in places, pinches shut in others, wanders off the straight line and bursts wide open where the
// pressure wins. Through it burns a cold nebula, electric violet over near-black indigo, cut by dust
// lanes that go to deep black, with a near-black lip right at the tear so it reads as a hole punched
// into space rather than a painted band.
// The wound is unstable: every second or so the other side detonates. Bolts are born on the spine and
// blow outward through the lip into open space, forks peel off them, sparks and chips are flung out,
// a flattened shock ring races away, then it all collapses back into the dark.
// Every pixel is computed from t; nothing accumulates.
import { clamp, fit, rand, hex, smooth, TAU, mix, Rng } from "../../../src/core/index.js";
import { clip, rows, field, sample, trips, wave, tree } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Spacetime rift",
  desc: "The sky is torn open: a ragged crack runs corner to corner, bulging and pinching like a wound that will not hold. Cold electric-violet gas churns inside it, cut by lanes of deep black, ringed by a near-black lip and a burning rim. Every second or so something detonates: bolts are born on the spine and blow outward through the lip into open space, forks peel away, sparks and chips fly off, a flattened ring of light races out — then everything falls back into the dark.",
  tags: ["weather", "scene", "rift", "nebula", "space", "stars", "violet", "blue", "energy", "discharge", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    nebula: ["#05060f", "#0a0f2e", "#1a1660", "#3322a8", "#5b3fe0", "#9b7bff", "#e6e2ff"],
    density: 1,
    seed: 9,
  },
};

const D = 12;
const W = 320, TOP = -180, BOT = 0;
// the rift's axis: the scene diagonal, half-length
const A = [-80, -45], B = [80, -135];
const AX = B[0] - A[0], AY = B[1] - A[1];
const LEN = Math.hypot(AX, AY);
const UX = AX / LEN, UY = AY / LEN;              // along the crack
const VX = -UY, VY = UX;                         // across it

const F1 = field(101, 256, 128, [4, 8, 16, 32]); // the nebula's body
const F2 = field(113, 256, 128, [6, 12, 24]);    // fine filaments
const F3 = field(127, 128, 64, [3, 6, 12]);      // the torn edges' displacement
const FD = field(139, 128, 64, [3, 6]);          // dark dust lanes inside

const q2 = (p) => clip(p, meta);

// ---- the discharges ----------------------------------------------------------------------------------
// Eleven events per loop at wildly uneven spacing — 0.45s apart at the tightest, 1.55s at the loosest —
// so it never turns into a metronome. Each one is two spikes: the strike, then a smaller after-crackle.
const EV = [0.3, 1.45, 2.55, 3.7, 5.0, 6.2, 7.45, 8.7, 9.95, 11.1];

/** Seconds since event i, wrapped into (-D/2, D/2]. */
function ageOf(t, i) {
  let d = t - EV[i];
  if (d < -D / 2) d += D;
  else if (d > D / 2) d -= D;
  return d;
}
/** One spike: instant strike, hard settle. */
function spike(d, att, dec, amp) {
  if (d < -att || d > dec) return 0;
  if (d < 0) return (1 + d / att) * amp;
  const k = d / dec;
  return amp * Math.pow(1 - k, 2.6) * 0.96;
}
/** Envelope of one discharge: the strike plus a second, weaker crackle just behind it. */
function env(d) {
  return Math.min(1.2, spike(d, 0.07, 0.42, 1) + 0.55 * spike(d - 0.2, 0.05, 0.3, 1));
}
/** The strongest discharge of the moment, 0..1. */
function surge(t) {
  let s = 0;
  for (let i = 0; i < EV.length; i++) s = Math.max(s, env(ageOf(t, i)));
  return Math.min(1, s);
}
/** Fast flicker of the discharge, seamless over the loop: three integer harmonics, ~3/6/9 Hz. */
const flick = (t) => 0.45 + 0.55 * (0.5 * wave(t, D, 37, 0.6) + 0.32 * wave(t, D, 72, 2.1) + 0.18 * wave(t, D, 108, 1.1));

// ---- the shape of the wound -------------------------------------------------------------------------
// Places where the tear blows wide open: [position along it, width of the bulge, gain].
const BURST = [[0.22, 0.038, 0.34], [0.55, 0.05, 0.56], [0.87, 0.032, 0.3]];

/** How wide the burst at u multiplies the tear. */
function burstAt(u) {
  let g = 1;
  for (let k = 0; k < BURST.length; k++) {
    const t2 = (u - BURST[k][0]) / BURST[k][1];
    const dd = t2 * t2;
    if (dd < 6) g = Math.max(g, 1 + BURST[k][2] * (1 / (1 + 1.6 * dd)));
  }
  return g;
}
// the centre line wanders: a slow S-curve, a broad hook, and a long uneven drift — no straight axis
function centre(u) {
  return (sample(F3, u * 3, 7) - 0.5) * 30 + Math.sin(Math.PI * u * 2.15 + 1.1) * 8 + (sample(F3, u * 1.3, 41) - 0.5) * 26;
}
// half-width: asymmetric taper (thin at the tips, fattest past the middle), two lobes of different scale
// fighting each other, then the bursts. Reads as a pressure-wound, not an ellipse.
function halfw(u) {
  const taper = Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.62);
  const lobeA = 0.5 + 0.5 * Math.sin(Math.PI * u * 1.85 + 0.5);
  const lobeB = 0.55 + 0.45 * sample(F3, u * 5.6 + 21, 19);
  return (5 + 8 * lobeA + 4 * lobeB) * taper * burstAt(u);
}
// the tear itself: high-frequency raggedness on top of the slow wander, so the lip reads as paper torn
// by hand — a random bite every ~2px of the tear's length, sharper where the burst is.
function jag(u) {
  const s = u * 82, n = Math.floor(s), f = s - n;
  const amp = 4.5 + 3 * (burstAt(u) - 1);
  const bite = (n2) => (rand(177, n2, 1) - 0.5) * amp;
  return bite(n) + (bite(n + 1) - bite(n)) * f + (sample(F3, u * 160, 71) - 0.5) * 3 + (sample(F3, u * 320, 73) - 0.5) * 1.2;
}
function edge(u) {
  return halfw(u) + jag(u);
}
/** World point of a tear-local coordinate: u along the crack, v across it (v = 0 the centre line). */
function at(u, v) {
  return [A[0] + UX * u * LEN + VX * (centre(u) + v), A[1] + UY * u * LEN + VY * (centre(u) + v)];
}

// ---- the sky -------------------------------------------------------------------------------------------
const SKY0 = hex("#04050c"), SKY1 = hex("#0d0f2a"), BLACK = hex("#000000");
function space(p, t, dn) {
  rows(p, meta, TOP, BOT, (y, R) => {
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      // deep space: near-black, a breath of cold indigo, and a vignette so the eye goes to the tear
      const n = sample(F1, x * 0.02 - 8 * (t / D), y * 0.02 + 20);
      const a = Math.max(0, n - 0.64) * 0.4;
      const vgx = (i - 160) / 170, vgy = (y + 90) / 110;
      const vg = 1 - 0.38 * Math.min(1, vgx * vgx + vgy * vgy);
      const base = a > 0.02 ? mix(SKY0, SKY1, Math.min(1, a * 2)) : SKY0;
      R.c[i] = mix(BLACK, base, vg);
      R.a[i] = 1;
    }
  });
  // the stars: most outside the rift, none inside the nebula's bright body
  const q = q2(p);
  const n = Math.round(240 * Math.min(1.5, dn));
  for (let i = 0; i < n; i++) {
    const x = -158 + rand(19, i, 1) * 316, y = TOP + 2 + rand(19, i, 2) * (BOT - TOP - 4);
    const du = ((x - A[0]) * UX + (y - A[1]) * UY) / LEN;
    const dv = (x - A[0]) * VX + (y - A[1]) * VY;
    const inRift = Math.abs(dv - centre(clamp(du / LEN, 0, 1))) < edge(clamp(du / LEN, 0, 1)) + 2;
    if (inRift && rand(19, i, 6) < 0.85) continue;
    const c = 1 + Math.floor(rand(19, i, 3) * 4), tw = wave(t, D, c, rand(19, i, 4) * TAU);
    const k = rand(19, i, 5);
    if (k < 0.6) q.dot(x, y, hex("#8f97c0"), 0.16 + 0.3 * Math.max(0, tw));
    else if (k < 0.88) q.dot(x, y, hex("#ccd2f4"), 0.28 + 0.45 * Math.max(0, tw));
    else if (k < 0.97) (q.px(x, y, hex("#eef2ff")), q.glow(x, y, 2.5, hex("#9fb0ee"), 0.3 * Math.max(0, tw)));
    else {
      q.px(x, y, hex("#cfd8ff"));
      q.glow(x, y, 3, hex("#7f95ff"), 0.35 + 0.3 * tw);
    }
  }
}

// ---- the rift ------------------------------------------------------------------------------------------
// Distance to the wandering centre line decides what a pixel is: the nebula inside, a near-black lip right
// at the tear, a burning rim just inside it, then light spilling onto space. Inside, the body is pushed
// dark — a hard floor and a steep gain, so most of the volume stays near-black and only the gas cores,
// the spine and the filaments carry colour. That is what makes the discharge read as a flash in the dark
// instead of a wash of pink.
function rift(p, t, dn, NL) {
  const drift = 8 * (t / D), drift2 = -12 * (t / D);
  const S = surge(t), F = flick(t);
  const TOPM = NL[NL.length - 1], NEAR = NL[NL.length - 2] || TOPM, MID = NL[4] || NEAR;
  const VOID = hex("#04040b");
  rows(p, meta, TOP, BOT, (y, R) => {
    const ry = y + 0.5 - A[1];
    for (let i = 0; i < W; i += 2) {
      const rx = i - 160 + 0.5 - A[0];
      const raw = (rx * UX + ry * UY) / LEN;
      if (raw < 0 || raw > 1) continue;              // beyond the tips: nothing
      const u = clamp(raw, 0, 1);
      const v = rx * VX + ry * VY - centre(u);
      const hw = Math.max(1.5, edge(u));   // 宽度必须为正：两端撕裂口可能算出负值，会让远处像素被误判为内部
      const span = Math.min(2, W - i);
      for (let s = 0; s < span; s++) {
        const vv = v + (s ? VX : 0); // the fields are smooth; sharing the reads is fine
        const d = Math.abs(vv) / hw;
        if (d >= 1.55) continue;
        const ii = i + s;
        if (d < 1) {
          const uu = u * 26 + 5;
          const n1 = sample(F1, uu * 2.2 - drift, vv * 0.085 + 40);
          const n2 = sample(F2, uu * 5.4 - drift2, vv * 0.19 + 90);
          const dust = sample(FD, uu * 6.4 - drift * 0.6, vv * 0.06 + 30);
          const spine = Math.pow(1 - clamp(Math.abs(vv) / (hw * 0.95), 0, 1), 1.4);  // broad falloff
          const thread = Math.pow(1 - clamp(Math.abs(vv) / (hw * 0.28), 0, 1), 1.6); // the thin bright core
          const core = Math.max(0, 1 - (u - 0.5) * (u - 0.5) * 18);
          // body: dark volume with gas cores, then a thin white-hot thread down the axis
          const body = clamp((n1 - 0.4) * 2.1, 0, 1);
          const wisp = clamp((n2 - 0.34) * 1.8, 0, 1);          // 亮丝密度：把亮芯打碎成一段一段
          let h = clamp(0.03 + 0.45 * body, 0, 1);
          h = clamp(h * (0.3 + 0.7 * spine), 0, 1);
          if (thread > 0) h = Math.max(h, (0.12 + 0.64 * wisp * thread) * (0.7 + 0.3 * core));
          // dark molecular lanes: hard bites of nothing that run along the crack
          if (dust > 0.3) h = Math.min(h, 0.02 + 0.04 * spine);
          // hot energy veins: thin, crisp, and they only catch fire when the wound discharges
          const vein = sample(F2, uu * 9.8 - drift * 2.4, vv * 0.4 + 62);
          const vk = Math.max(0, vein - 0.5) * 2.8;
          if (vk > 0) h = Math.max(h, 0.76 + 0.2 * vk + 0.45 * S * F * vk);
          // standing filaments: a few bright threads so a calm frame is never a smooth gradient
          if (n2 > 0.72) h = Math.max(h, 0.34 + 0.28 * spine + 0.55 * S);
          // the discharge lifts the spine and the dense gas only — the voids stay black
          h = clamp(h + S * F * (0.16 + 0.34 * spine + 0.44 * thread * (0.4 + 0.6 * wisp)), 0, 1);
          // the rim: just inside the lip the gas is heated white
          const rim = smooth(0.9, 1, d);
          if (rim > 0) h = Math.max(h, (0.76 + 0.24 * rim * (0.5 + 0.5 * sample(F2, uu * 7 + 77, vv * 0.16))) * (1 + 0.55 * S));
          const li = Math.min(NL.length - 1.001, h * (NL.length - 1));
          R.c[ii] = NL[li | 0];
          R.a[ii] = 1;
          R.b[ii] = 1;
          if (h > 0.8) (R.l[ii] = S > 0.4 ? TOPM : NEAR), (R.k[ii] = 0.16 * (h - 0.8) * 3 * (1 + 1.8 * S));
          continue;
        }
        // the lip itself: a near-black bite, thinnest at the tips, so the tear is a hole in the sky
        const lip = 1 - Math.abs(d - 1.05) / 0.055;
        if (lip > 0) {
          R.c[ii] = VOID;
          R.a[ii] = Math.min(1, lip * 0.94);
          R.b[ii] = 1;
          continue;
        }
        // light spilling out of the tear onto space
        const g = 1 - (d - 1.105) / 0.42;
        if (g > 0) {
          const n3 = sample(F2, u * 34 + 55, vv * 0.09);
          const a = g * g * (0.14 + 0.5 * n3) * (1 + 2.2 * S);
          R.c[ii] = S > 0.4 ? TOPM : MID;
          R.a[ii] = Math.min(0.92, a);
          R.b[ii] = 1;
          if (a > 0.1) (R.l[ii] = NEAR), (R.k[ii] = Math.min(0.3, a * 0.12 * (1 + 2.4 * S)));
        }
      }
    }
  });
  // edge glints: sparks that ride the torn lips and fade
  const q = q2(p);
  trips(t, D, Math.round(26 * dn), 151, 2, 3, (u2, k, m, i) => {
    const u = rand(151, i, 1);
    const side = rand(151, i, 2) < 0.5 ? -1 : 1;
    const v = side * (edge(u) + 1.5 + rand(151, i, 3) * 4);
    const [x, y] = at(u, v);
    const a = Math.sin(Math.PI * u2) * 0.8;
    if (a < 0.15) return;
    q.dot(x, y, hex("#dcecff"), a);
    if (a > 0.5) q.light(x, y, hex("#8f7bff"), 0.12 * a);
  });
}

// ---- the discharge: born on the spine, blown outward through the lip ------------------------------------
// Every event picks a spot along the spine and fires 2–4 bolts from the inside out: each is born near the
// centre line, jags its way outward, crosses the lip and dies in open space, leaving forks behind. Around
// it: a radial burst of rays, sparks and chips flung outward, a flare on the lip, and a flattened ring.
function energy(p, t, o, NL) {
  const q = q2(p);
  const hot = NL[NL.length - 1], mid = NL[NL.length - 2] || hot, cold = NL[4] || mid;
  const ARC = hex("#f6ffff"), ICE = hex("#b8dcff"), HALO = hex("#6a56ff");
  const S = surge(t);
  for (let i = 0; i < EV.length; i++) {
    const age = ageOf(t, i), s = env(age);
    if (s <= 0.03) continue;
    const a = Math.min(1, s * 1.3) * (0.6 + 0.4 * flick(t));
    const age2 = Math.max(0, age);
    const u = 0.16 + rand(313, i, 1) * 0.66;                 // this discharge's place on the tear
    const hw = edge(u);
    const [cx, cy] = at(u, 0);

    // 1) the bolts: a strike is born on the spine and blown outward, zig-zagging as it crosses the lip and
    // dies in open space; short forks peel off the trunk on the way out and fade faster
    const nb = 2 + Math.floor(rand(313, i, 8) * 2);          // 2..3
    const [ox, oy] = at(u, (rand(313, i, 7) - 0.5) * hw * 0.35);
    const strike = (paths, thick) => {
      for (const path of paths) {
        const pts = path.pts, trunk = path.w >= 1;
        for (let k = 0; k < pts.length - 1; k++) {
          const [bx0, by0] = pts[k], [bx1, by1] = pts[k + 1];
          const n = Math.max(1, Math.ceil(Math.hypot(bx1 - bx0, by1 - by0) * 1.8));
          for (let m = 0; m <= n; m++) {
            const f = m / n, X = bx0 + (bx1 - bx0) * f, Y = by0 + (by1 - by0) * f;
            const along = (k + f) / (pts.length - 1);
            const heat = 1 - 0.55 * along * along;                 // the tip cools as it leaves the wound
            if (trunk) {
              q.px(X, Y, a * heat > 0.4 ? ARC : ICE);
              q.px(X, Y + 1, a * heat > 0.55 ? ARC : ICE);
              if (thick && a * heat > 0.3) q.px(X + 1, Y, HALO);
              if (a * heat > 0.32 && m % 3 === 0) q.light(X, Y, HALO, 0.36 * a * heat);
            } else q.px(X, Y, a * heat > 0.5 ? ICE : HALO);
          }
        }
      }
    };
    for (let b = 0; b < nb; b++) {
      const side = rand(317, i, b, 1) < 0.5 ? -1 : 1;
      const du = (rand(317, i, b, 5) - 0.5) * 0.08;
      const reach = (b ? hw * 1.2 + 6 : hw * 1.7 + 12) + rand(317, i, b, 3) * 26;
      const s1 = at(u + du, side * reach);
      strike(tree(new Rng(321 + i * 23 + b * 7), ox, oy, s1[0], s1[1], 0.3, 0.18), true);
      // one or two forks, shorter and dimmer
      const nf = 1 + Math.floor(rand(323, i, b, 1) * 2);
      for (let g = 0; g < nf; g++) {
        const pf = 0.25 + rand(323, i, b, g + 2) * 0.45;
        const [fx, fy] = at(u + du * pf, side * (reach * pf + (rand(323, i, b, g + 4) - 0.3) * 14));
        const tilt = (rand(327, i, b, g + 1) - 0.5) * 0.9;
        strike(tree(new Rng(329 + i * 11 + b * 5 + g * 3), ox + (fx - ox) * 0.8, oy + (fy - oy) * 0.8, fx + tilt * VX * 6, fy + tilt * VY * 6, 0.26, 0.1), false);
      }
      q.glow(s1[0], s1[1], 3.5, ICE, 0.3 * a);
    }
    q.glow(ox, oy, 8, HALO, 0.5 * a);
    q.glow(ox, oy, 3, ARC, 0.42 * a);
    // 2) internal crackle: a short jagged bolt that never escapes the body
    if (nb < 4) {
      const ua = u + (rand(341, i, 1) - 0.5) * 0.2, ub = ua + (rand(341, i, 2) - 0.5) * 0.12;
      const run = tree(new Rng(351 + i * 13), ...at(ua, (rand(341, i, 3) - 0.5) * hw * 0.5), ...at(ub, (rand(341, i, 4) - 0.5) * hw * 0.5), 0.42, 0.24);
      for (const path of run)
        for (let k = 0; k < path.pts.length - 1; k++) {
          const [bx0, by0] = path.pts[k], [bx1, by1] = path.pts[k + 1];
          const n = Math.max(1, Math.ceil(Math.hypot(bx1 - bx0, by1 - by0) * 1.3));
          for (let m = 0; m <= n; m++) {
            const f = m / n;
            q.dot(bx0 + (bx1 - bx0) * f, by0 + (by1 - by0) * f, a > 0.55 ? ICE : cold, a * 0.85);
          }
        }
    }

    // 3) rays: the core blows straight out, uneven spokes, short and sharp
    if (age2 < 0.42) {
      const n = 22;
      for (let k = 0; k < n; k++) {
        const th = rand(371, i, k, 1) * TAU;
        const len = (18 + rand(371, i, k, 2) * 44) * Math.min(1, age2 * 3.2);
        const spread = 0.85 + rand(371, i, k, 3) * 0.6;
        for (let m = 1; m <= 8; m++) {
          const f = m / 8, r = len * f;
          const X = cx + Math.cos(th) * r * 1.2, Y = cy + Math.sin(th) * r * 0.66 * spread;
          q.dot(X, Y, f < 0.35 ? ARC : ICE, a * (1 - f) * (1 - f) * 0.8);
        }
      }
    }

    // 4) sparks: thrown outward, white at birth, ramping through ice blue as they fly
    for (let k = 0; k < 26; k++) {
      if (rand(361, i, k, 1) > 0.62) continue;
      const uk = u + (rand(361, i, k, 2) - 0.5) * 0.24;
      const dir = rand(361, i, k, 3) < 0.5 ? -1 : 1;
      const sp = 30 + rand(361, i, k, 4) * 80;
      const v0 = (rand(361, i, k, 5) - 0.5) * 6;
      const vv = v0 + dir * (sp * age2 + 2);
      const [sx, sy] = at(uk, vv);
      const fade = s * (1 - Math.min(1, age2 * 2.6));
      if (fade < 0.12) continue;
      q.dot(sx, sy, age2 < 0.1 ? ARC : ICE, fade);
      if (fade > 0.45 && age2 < 0.28) q.light(sx, sy, HALO, 0.12 * fade);
      const [tx2, ty2] = at(uk, vv - dir * Math.min(8, 2 + age2 * 9));
      q.dot(tx2, ty2, cold, fade * 0.55);
    }

    // 5) chips knocked off the lip, tumbling away and dimming
    for (let k = 0; k < 6; k++) {
      if (rand(381, i, k, 1) > 0.5) continue;
      const uk = u + (rand(381, i, k, 2) - 0.5) * 0.3;
      const dir = rand(381, i, k, 3) < 0.5 ? -1 : 1;
      const vv = dir * (edge(uk) + 2 + age2 * (12 + rand(381, i, k, 4) * 18));
      const [sx, sy] = at(uk, vv);
      const fade = 1 - Math.min(1, age2 * 1.7);
      if (fade < 0.2) continue;
      q.dot(sx, sy, mid, fade * 0.7);
      q.dot(sx + dir * VX, sy + dir * VY, cold, fade * 0.45);
    }

    // 6) the lip flares where the bolt leaves the wound
    for (let k = 0; k < 2; k++) {
      const uk = u + (rand(391, i, k, 1) - 0.5) * 0.22, dir = k ? 1 : -1;
      const [fx, fy] = at(uk, dir * edge(uk));
      q.glow(fx, fy, 4, ICE, 0.34 * a);
    }

    // 7) the ring: light racing away, flattened by the same axis, dashed so it reads as a shock front
    const ring = age2 * 96;
    if (ring > 4 && ring < 104) {
      const al = s * 0.3 * (1 - clamp(ring / 104, 0, 1));
      if (al > 0.05) {
        for (let deg = 0; deg < 360; deg += 9) {
          if ((deg / 9) % 3 !== 0) continue;              // dashes with gaps
          const th = (deg * Math.PI) / 180;
          const rr = ring * (0.7 + 0.3 * Math.abs(Math.cos(th)));
          const X = cx + Math.cos(th) * rr * 1.35, Y = cy + Math.sin(th) * rr * 0.85;
          q.dot(X, Y, cold, al);
          if (al > 0.26) q.light(X, Y, mid, 0.07 * al);
        }
      }
    }
  }
  // the wound's heart: a standing hot core, breathing with the discharges
  if (S > 0.02) {
    const [hx, hy] = at(0.5, 0);
    q.glow(hx, hy, 10 + 9 * S, hot, 0.26 * S * flick(t));
  }
}

// ---- bright stars with diffraction spikes --------------------------------------------------------------
function bigStars(p, t) {
  const q = q2(p);
  const spots = [[-128, -44], [-56, -148], [24, -96], [98, -156], [142, -40], [-8, -20]];
  for (let i = 0; i < spots.length; i++) {
    const [x, y] = spots[i];
    const L = 9 + (i % 3) * 4;
    const pulse = 0.7 + 0.3 * wave(t, D, 2, i * 1.3);
    q.px(x, y, hex("#ffffff"));
    q.glow(x, y, L * 0.4, i % 2 ? hex("#b8a6ff") : hex("#9fc0ff"), 0.5 * pulse);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let s = 1; s <= L; s++) {
        const a = (1 - s / L) * (s % 2 ? 1 : 0.75) * pulse;
        if (s <= 2) q.px(x + dx * s, y + dy * s, hex("#e8eeff"));
        else q.dot(x + dx * s, y + dy * s, hex("#c2cdf0"), a * 0.8);
      }
    }
  }
}

// ---- a wanderer: one slow shooting star streaking across, once a loop -----------------------------------
function wanderer(p, t) {
  trips(t, D, 1, 161, 1, 1, (u) => {
    if (u > 0.18) return;
    const s = u / 0.18;
    const x0 = -60 + rand(161, 1, 1) * 120, y0 = TOP + 16 + rand(161, 1, 2) * 40;
    const dx = 60 + rand(161, 1, 3) * 50, dy = 24 + rand(161, 1, 4) * 16;
    const fade = Math.sin(Math.PI * s);
    for (let j = 0; j < 16; j++) {
      const f = j / 16;
      if (fade * (1 - f) < 0.2) break;
      q2(p).px(x0 + dx * s - dx * 0.55 * f, y0 + dy * s - dy * 0.55 * f, j === 0 ? hex("#ffffff") : hex("#bfc8f0"));
    }
    q2(p).glow(x0 + dx * s, y0 + dy * s, 3.4, hex("#bfc8f0"), fade * 0.5);
  });
}

// ---- entry ------------------------------------------------------------------------------------------------
export function drawBack(p, t, o) {
  const NL = fit(o.nebula, 7);
  space(p, t, o.density);
  rift(p, t, o.density, NL);
}
export function draw(p, t, o) {
  const NL = fit(o.nebula, 7);
  bigStars(p, t);
  energy(p, t, o, NL);
}
