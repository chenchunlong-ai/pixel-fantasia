// A sky torn open: a spacetime rift runs corner to corner, bottom left to top right, and through it
// burns a nebula of violet and rose gas — bright filaments along its spine, dark molecular clouds
// drifting inside, the edges of the tear glowing where the light spills out. Outside it, deep space
// and a field of twinkling stars; the gas churns slowly along the crack, whole drifts per loop.
// Every pixel is computed from t; nothing accumulates.
import { clamp, fit, rand, hex, smooth, TAU, mix } from "../../../src/core/index.js";
import { clip, rows, field, sample, trips, wave } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Spacetime rift",
  desc: "The sky is torn open corner to corner like a sheet of paper: a nebula of violet and rose churns inside the ragged tear, dark dust drifting through it, its torn edges glowing, over deep space and twinkling stars.",
  tags: ["weather", "scene", "rift", "nebula", "space", "stars", "purple", "galaxy", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    nebula: ["#170a2c", "#331254", "#5c1c74", "#93308e", "#c65aa8", "#ec96cc", "#ffd8ee"],
    density: 1,
    seed: 9,
  },
};

const D = 12;
const W = 320, TOP = -180, BOT = 0;
// the rift's axis: centred on the scene diagonal, half the old length
// (old: A=[-160,0] B=[160,-180]; same direction, same midpoint, 0.5×)
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

// where the crack is at u (0..1 along it): a wandering centre line and a half-width that breathes.
// The width is a third of the old tear, and an eye-line envelope tapers it: wide at the middle,
// drawn to needle points at both ends — a slit into elsewhere, not a hole.
function centre(u) {
  return (sample(F3, u * 3, 7) - 0.5) * 22;
}
function halfw(u) {
  const env = 0.22 + 0.78 * Math.pow(Math.sin(Math.PI * u), 0.7);
  return (9 + sample(F3, u * 2.4 + 11, 13) * 12) * env;
}
// the tear itself: high-frequency raggedness on top of the slow wander, so the lip reads as paper
// torn by hand — a piecewise-linear zigzag (a random bite every ~3px of the tear's length) plus a
// small noise nick octave, static in time like a real tear. Scaled to the slimmer tear.
function jag(u) {
  const s = u * 55, n = Math.floor(s), f = s - n;   // bites stay ~3px apart on the shorter tear
  const bite = (n2) => (rand(177, n2, 1) - 0.5) * 6;
  return bite(n) + (bite(n + 1) - bite(n)) * f + (sample(F3, u * 160, 71) - 0.5) * 3;
}
function edge(u) {
  return halfw(u) + jag(u);
}

// ---- the sky ---------------------------------------------------------------------------------------
function space(p, t, dn) {
  rows(p, meta, TOP, BOT, (y, R) => {
    const k = (y - TOP) / (BOT - TOP);
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      // deep space, a breath of purple haze so it isn't flat black
      const n = sample(F1, x * 0.02 - 8 * (t / D), y * 0.02 + 20);
      let a = Math.max(0, n - 0.6) * 0.4;
      R.c[i] = a > 0.02 ? mix(hex("#06040c"), hex("#1c0c34"), Math.min(1, a * 2)) : hex("#06040c");
      R.a[i] = 1;
      void k;
    }
  });
  // the stars: most outside the rift, a burst of them along its torn lips
  const q = q2(p);
  const n = Math.round(240 * Math.min(1.5, dn));
  for (let i = 0; i < n; i++) {
    const x = -158 + rand(19, i, 1) * 316, y = TOP + 2 + rand(19, i, 2) * (BOT - TOP - 4);
    const du = ((x - A[0]) * UX + (y - A[1]) * UY) / LEN;
    const dv = (x - A[0]) * VX + (y - A[1]) * VY;
    const inRift = Math.abs(dv - centre(clamp(du / LEN, 0, 1))) < edge(clamp(du / LEN, 0, 1)) - 4;
    if (inRift && rand(19, i, 6) < 0.75) continue;        // the nebula outshines them inside
    const c = 1 + Math.floor(rand(19, i, 3) * 4), tw = wave(t, D, c, rand(19, i, 4) * TAU);
    const k = rand(19, i, 5);
    if (k < 0.6) q.dot(x, y, hex("#9a94b8"), 0.18 + 0.3 * Math.max(0, tw));
    else if (k < 0.88) q.dot(x, y, hex("#ccc8e4"), 0.3 + 0.45 * Math.max(0, tw));
    else if (k < 0.97) (q.px(x, y, hex("#f0ecfc")), q.glow(x, y, 2.5, hex("#b8aee0"), 0.3 * Math.max(0, tw)));
    else {
      q.px(x, y, hex("#cfd8ff"));
      q.glow(x, y, 3, hex("#8a9aff"), 0.35 + 0.3 * tw);
    }
  }
}

// ---- the rift ---------------------------------------------------------------------------------------
// one pass: distance to the wandering centre line decides in or out; inside, two counter-scrolling
// fBm fields mix through the violet ramp, dust lanes knock holes, the spine burns brightest; the
// torn lip glows where the light spills onto space.
function rift(p, t, dn, NL) {
  const drift = 8 * (t / D), drift2 = -12 * (t / D);
  rows(p, meta, TOP, BOT, (y, R) => {
    const ry = y + 0.5 - A[1];
    for (let i = 0; i < W; i += 2) {
      const rx = i - 160 + 0.5 - A[0];
      const raw = (rx * UX + ry * UY) / LEN;
      if (raw < 0 || raw > 1) continue;              // beyond the tips: nothing, no needle line
      const u = clamp(raw, 0, 1);
      const v = rx * VX + ry * VY - centre(u);
      const hw = edge(u);
      // two-pixel span: the next column shares these field reads (the fields are smooth)
      const span = Math.min(2, W - i);
      for (let s = 0; s < span; s++) {
        const x = i - 160 + 0.5 + s;
        const vv = v + (s ? VX : 0); // the fields are smooth; sharing reads is fine
        const d = Math.abs(vv) / hw;
        if (d >= 1.3) continue;
        const ii = i + s;
        // inside: the nebula
        if (d < 1) {
          const uu = u * 26 + 5;
          const n1 = sample(F1, uu * 2.6 - drift, vv * 0.05 + 40);
          const n2 = sample(F2, uu * 5.2 - drift2, vv * 0.1 + 90);
          const dust = sample(FD, uu * 5.5 - drift * 0.5, vv * 0.022 + 30);
          const spine = 1 - clamp(Math.abs(vv) / (hw * 0.6), 0, 1);   // the burning spine
          let h = clamp(n1 * 0.72 + n2 * 0.28, 0, 1);
          h = clamp(0.1 + h * (0.55 + 0.6 * spine) + spine * 0.32, 0, 1);
          // molecular dust: dark lanes that run ALONG the crack, knifing deep into the bright gas
          if (dust > 0.5 && spine < 0.8) h *= Math.max(0.06, 1 - (dust - 0.5) * 3.2);
          // the opening's rim: just inside the lip the gas heats to near-white, as if the skin of
          // this spacetime were peeling back and the light of the other side were pouring in
          const rim = smooth(0.78, 1, d);
          if (rim > 0) h = Math.max(h, 0.55 + 0.45 * rim * (0.6 + 0.4 * sample(F2, uu * 6 + 77, vv * 0.15)));
          const li = Math.min(NL.length - 1.001, h * (NL.length - 1));
          R.c[ii] = NL[li | 0];
          R.a[ii] = d > 0.96 ? (1 - (d - 0.96) / 0.04) * 0.9 + 0.1 : 1;   // a crisp torn lip
          R.b[ii] = 1;
          if (h > 0.82) (R.l[ii] = NL[NL.length - 2]), (R.k[ii] = 0.1 * (h - 0.82) * 3);
          continue;
        }
        // the torn lip: glow spilling onto space, torn by the same displacement as the edge
        const e = 1 - (d - 1) / 0.3;
        if (e > 0) {
          const g = sample(F2, u * 30 + 55, (vv) * 0.08);
          const a = e * e * (0.28 + 0.55 * g);
          R.c[ii] = NL[4];
          R.a[ii] = a;
          R.b[ii] = 1;
          if (a > 0.22) (R.l[ii] = NL[5] || NL[4]), (R.k[ii] = a * 0.09);
        }
      }
    }
  });
  // edge glints: sparks that ride the torn lips and fade
  const q = q2(p);
  trips(t, D, Math.round(26 * dn), 151, 2, 3, (u2, k, m, i) => {
    const u = rand(151, i, 1);
    const disp = centre(u);
    const side = rand(151, i, 2) < 0.5 ? -1 : 1;
    const v = disp + side * (edge(u) + 2 + rand(151, i, 3) * 6);
    const x = A[0] + UX * u * LEN + VX * v;
    const y = A[1] + UY * u * LEN + VY * v;
    const a = Math.sin(Math.PI * u2) * 0.8;
    if (a < 0.15) return;
    q.dot(x, y, hex("#f0c8e8"), a);
    if (a > 0.5) q.light(x, y, hex("#d88ac0"), 0.12 * a);
  });
}

// ---- bright stars with diffraction spikes ------------------------------------------------------------
function bigStars(p, t) {
  const q = q2(p);
  const spots = [[-128, -44], [-56, -148], [24, -96], [98, -156], [142, -40], [-8, -20]];
  for (let i = 0; i < spots.length; i++) {
    const [x, y] = spots[i];
    const L = 9 + (i % 3) * 4;
    const pulse = 0.7 + 0.3 * wave(t, D, 2, i * 1.3);
    q.px(x, y, hex("#ffffff"));
    q.glow(x, y, L * 0.4, i % 2 ? hex("#c8a8f0") : hex("#a8c4f0"), 0.5 * pulse);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let s = 1; s <= L; s++) {
        const a = (1 - s / L) * (s % 2 ? 1 : 0.75) * pulse;
        if (s <= 2) q.px(x + dx * s, y + dy * s, hex("#f0e8fc"));
        else q.dot(x + dx * s, y + dy * s, hex("#d0c4f0"), a * 0.8);
      }
    }
  }
}

// ---- a wanderer: one slow shooting star streaking across, once a loop ---------------------------------
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
      q2(p).px(x0 + dx * s - dx * 0.55 * f, y0 + dy * s - dy * 0.55 * f, j === 0 ? hex("#ffffff") : hex("#c8b8e8"));
    }
    q2(p).glow(x0 + dx * s, y0 + dy * s, 3.4, hex("#c8b8e8"), fade * 0.5);
  });
}

// ---- entry ----------------------------------------------------------------------------------------------
export function drawBack(p, t, o) {
  const NL = fit(o.nebula, 7);
  space(p, t, o.density);
  rift(p, t, o.density, NL);
}
export function draw(p, t, o) {
  bigStars(p, t);
  wanderer(p, t);
}
