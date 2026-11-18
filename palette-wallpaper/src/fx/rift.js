// A sky torn open: a spacetime rift runs corner to corner, bottom left to top right, and through it
// burns a nebula of violet and rose gas — bright filaments along its spine, dark molecular clouds
// drifting inside, the edges of the tear glowing where the light spills out. Outside it, deep space
// and a field of twinkling stars; the gas churns slowly along the crack, whole drifts per loop.
// It is not a still wound either: every couple of seconds the other side pushes through — a surge that
// heats the gas toward white, ignites crisp energy veins, throws forked arcs across the tear, flings
// sparks and debris out into space and sends a ring of light racing away, then settles back.
// Every pixel is computed from t; nothing accumulates.
import { clamp, fit, rand, hex, smooth, TAU, mix, Rng } from "../../../src/core/index.js";
import { clip, rows, field, sample, trips, wave, tree } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Spacetime rift",
  desc: "The sky is torn open corner to corner like a sheet of paper: a nebula of violet and rose churns inside the ragged tear, dark dust and bright filaments inside it, a dark lip and a burning rim where the light spills out, over deep space and twinkling stars — and every few seconds energy surges through the wound, arcs jump the crack, sparks fly and a ring of light races off across space.",
  tags: ["weather", "scene", "rift", "nebula", "space", "stars", "purple", "galaxy", "energy", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    nebula: ["#0d0518", "#22093f", "#451058", "#7a1780", "#b2319c", "#e768bb", "#ffc0e8"],
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

// ---- the surges --------------------------------------------------------------------------------------
// Where the wound discharges: unevenly spaced, so it never feels like a metronome. Each event is a sharp
// attack and a fast exponential settle; the loop wraps, so an event at either edge still opens and closes.
const EV = [0.9, 2.5, 4.1, 5.9, 7.3, 8.8, 10.4];
const ATT = 0.12, DEC = 0.9;

/** Seconds since event i, wrapped into (-D/2, D/2]. */
function ageOf(t, i) {
  let d = t - EV[i];
  if (d < -D / 2) d += D;
  else if (d > D / 2) d -= D;
  return d;
}
/** Envelope of one surge: 0 before it, a short rise, then a crisp settle. */
function env(d) {
  if (d < -ATT || d > DEC) return 0;
  if (d < 0) return 1 + d / ATT;
  const k = d / DEC;
  return Math.pow(1 - k, 2.3) * (k < 0.06 ? 1 : 0.82);
}
/** The strongest surge of the moment, 0..1. */
function surge(t) {
  let s = 0;
  for (let i = 0; i < EV.length; i++) s = Math.max(s, env(ageOf(t, i)));
  return s;
}
/** Fast flicker of the discharge, seamless over the loop: two harmonics, ~4 and ~8 Hz. */
const flick = (t) => 0.62 + 0.38 * (0.62 * wave(t, D, 48) + 0.38 * wave(t, D, 96, 1.7));

// where the crack is at u (0..1 along it): a wandering centre line and a half-width that breathes.
// The width is a third of the old tear, and an eye-line envelope tapers it: wide at the middle,
// drawn to needle points at both ends — a slit into elsewhere, not a hole.
function centre(u) {
  return (sample(F3, u * 3, 7) - 0.5) * 24;
}
function halfw(u) {
  const env2 = 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * u), 0.65);
  return (11 + sample(F3, u * 2.4 + 11, 13) * 13) * env2;
}
// the tear itself: high-frequency raggedness on top of the slow wander, so the lip reads as paper
// torn by hand — a piecewise-linear zigzag (a random bite every ~2px of the tear's length) plus two
// noise nick octaves, static in time like a real tear.
function jag(u) {
  const s = u * 78, n = Math.floor(s), f = s - n;
  const bite = (n2) => (rand(177, n2, 1) - 0.5) * 9;
  return bite(n) + (bite(n + 1) - bite(n)) * f + (sample(F3, u * 160, 71) - 0.5) * 4 + (sample(F3, u * 320, 73) - 0.5) * 1.6;
}
function edge(u) {
  return halfw(u) + jag(u);
}
/** World point of a tear-local coordinate: u along the crack, v across it (v = 0 the centre line). */
function at(u, v) {
  return [A[0] + UX * u * LEN + VX * (centre(u) + v), A[1] + UY * u * LEN + VY * (centre(u) + v)];
}

// ---- the sky ---------------------------------------------------------------------------------------
const SKY0 = hex("#050409"), SKY1 = hex("#180a2e"), BLACK = hex("#000000");
function space(p, t, dn) {
  rows(p, meta, TOP, BOT, (y, R) => {
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      // deep space: near-black, a breath of purple haze, and a vignette so the eye goes to the tear
      const n = sample(F1, x * 0.02 - 8 * (t / D), y * 0.02 + 20);
      const a = Math.max(0, n - 0.62) * 0.45;
      const vgx = (i - 160) / 170, vgy = (y + 90) / 110;
      const vg = 1 - 0.35 * Math.min(1, vgx * vgx + vgy * vgy);
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
// One pass. The distance to the wandering centre line decides what a pixel is: the nebula inside, a
// near-black lip right at the tear (so it reads as a hole punched in the sky, not a painted band), a
// glowing rim just inside, then light spilling out. Inside, two counter-scrolling fBm fields are pushed
// hard for contrast — dark voids, filaments, dust lanes — and the spine is the bright slit down the
// middle. Late in a surge, crisp energy veins ignite and the body heats toward the top of the ramp.
function rift(p, t, dn, NL) {
  const drift = 8 * (t / D), drift2 = -12 * (t / D);
  const S = surge(t), F = flick(t);
  const TOPM = NL[NL.length - 1], NEAR = NL[NL.length - 2] || TOPM, MID = NL[4] || NEAR;
  const VOID = hex("#050409");
  rows(p, meta, TOP, BOT, (y, R) => {
    const ry = y + 0.5 - A[1];
    for (let i = 0; i < W; i += 2) {
      const rx = i - 160 + 0.5 - A[0];
      const raw = (rx * UX + ry * UY) / LEN;
      if (raw < 0 || raw > 1) continue;              // beyond the tips: nothing
      const u = clamp(raw, 0, 1);
      const v = rx * VX + ry * VY - centre(u);
      const hw = edge(u);
      const span = Math.min(2, W - i);
      for (let s = 0; s < span; s++) {
        const vv = v + (s ? VX : 0); // the fields are smooth; sharing the reads is fine
        const d = Math.abs(vv) / hw;
        if (d >= 1.55) continue;
        const ii = i + s;
        if (d < 1) {
          const uu = u * 26 + 5;
          const n1 = sample(F1, uu * 2.2 - drift, vv * 0.045 + 40);
          const n2 = sample(F2, uu * 5.4 - drift2, vv * 0.11 + 90);
          const dust = sample(FD, uu * 6.4 - drift * 0.6, vv * 0.03 + 30);
          const spine = Math.pow(1 - clamp(Math.abs(vv) / (hw * 0.92), 0, 1), 1.2);
          const core = Math.max(0, 1 - (u - 0.5) * (u - 0.5) * 18);
          // body: a hard floor kills the flat haze, then the gas is lifted into the mid ramp so the
          // nebula reads as violet gas between black voids instead of one mud-coloured strip
          const body = clamp((n1 - 0.3) * 2.2, 0, 1);
          let h = clamp(0.2 + 0.52 * body, 0, 1);
          h = clamp(h * (0.85 + 0.4 * spine) + spine * (0.3 + 0.2 * core), 0, 1);
          // dark molecular lanes: deep bites of nothing that run along the crack
          if (dust > 0.45) h = Math.min(h, 0.12 + 0.1 * spine);
          // hot energy veins: thin, crisp, and they only catch fire when the wound discharges
          const vein = sample(F2, uu * 9.8 - drift * 2.4, vv * 0.4 + 62);
          const vk = Math.max(0, vein - 0.5) * 2.6;
          if (vk > 0) h = Math.max(h, 0.74 + 0.18 * vk + 0.4 * S * F * vk);
          // a handful of standing filaments along the spine, so even a calm frame is broken up
          if (n2 > 0.66) h = Math.max(h, 0.52 + 0.34 * spine + 0.4 * S);
          // the surge: the other side pours through — the spine and the rim heat first, the body lifts a
          // little so the contrast survives the flash
          h = clamp(h + S * F * (0.06 + 0.24 * spine), 0, 1);
          // the rim: just inside the lip the gas is heated white
          const rim = smooth(0.8, 1, d);
          if (rim > 0) h = Math.max(h, (0.7 + 0.3 * rim * (0.5 + 0.5 * sample(F2, uu * 7 + 77, vv * 0.16))) * (1 + 0.25 * S));
          const li = Math.min(NL.length - 1.001, h * (NL.length - 1));
          R.c[ii] = NL[li | 0];
          R.a[ii] = 1;
          R.b[ii] = 1;
          if (h > 0.8) (R.l[ii] = S > 0.4 ? TOPM : NEAR), (R.k[ii] = 0.12 * (h - 0.8) * 3 * (1 + 1.4 * S));
          continue;
        }
        // the lip itself: a near-black bite, thinnest at the tips, so the tear is a hole in the sky
        const lip = 1 - Math.abs(d - 1.05) / 0.055;
        if (lip > 0) {
          R.c[ii] = VOID;
          R.a[ii] = Math.min(1, lip * 0.92);
          R.b[ii] = 1;
          continue;
        }
        // light spilling out of the tear onto space
        const g = 1 - (d - 1.105) / 0.42;
        if (g > 0) {
          const n3 = sample(F2, u * 34 + 55, vv * 0.09);
          const a = g * g * (0.2 + 0.5 * n3) * (1 + 1.1 * S);
          R.c[ii] = S > 0.4 ? TOPM : MID;
          R.a[ii] = Math.min(0.9, a);
          R.b[ii] = 1;
          if (a > 0.1) (R.l[ii] = NEAR), (R.k[ii] = Math.min(0.26, a * 0.1 * (1 + 2 * S)));
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
    q.dot(x, y, hex("#ffd0ee"), a);
    if (a > 0.5) q.light(x, y, hex("#d88ac0"), 0.12 * a);
  });
}

// ---- the discharge: arcs, rays, sparks, debris and a ring of light ------------------------------------
// Each surge fires forked bolts across the tear at its own place along it, a runner that walks the spine
// while the charge lasts, a burst of rays out of the tear, a fan of sparks flung into space, a ring that
// rushes outward, and a handful of debris knocked off the lips.
function energy(p, t, o, NL) {
  const q = q2(p);
  const hot = NL[NL.length - 1], mid = NL[NL.length - 2] || hot, cold = NL[4] || mid;
  const white = hex("#ffffff");
  for (let i = 0; i < EV.length; i++) {
    const age = ageOf(t, i), s = env(age);
    if (s <= 0.03) continue;
    const a = Math.min(1, s * 1.25) * (0.72 + 0.28 * flick(t));
    const age2 = Math.max(0, age);
    const u = 0.24 + rand(313, i, 1) * 0.62;                 // this surge's place on the tear
    const hw = edge(u) * (0.9 + rand(313, i, 2) * 0.3);
    const [cx, cy] = at(u, 0);

    // 1) the arcs: one bolt jumping the tear, forks peeling off it, then a second one raking along it
    const draw = (paths, thick) => {
      for (const path of paths) {
        const trunk = path.w >= 1;
        for (let k = 0; k < path.pts.length - 1; k++) {
          const [bx0, by0] = path.pts[k], [bx1, by1] = path.pts[k + 1];
          const n = Math.max(1, Math.ceil(Math.hypot(bx1 - bx0, by1 - by0) * 1.6));
          for (let m = 0; m <= n; m++) {
            const f = m / n, X = bx0 + (bx1 - bx0) * f, Y = by0 + (by1 - by0) * f;
            if (trunk) {
              q.px(X, Y, a > 0.55 ? white : hot);
              if (thick && a > 0.4) q.light(X, Y, hot, 0.16);
            } else q.dot(X, Y, mid, a * 0.75 * path.w);
          }
        }
      }
    };
    const [ax0, ay0] = at(u, -hw), [ax1, ay1] = at(u, hw);
    draw(tree(new Rng(331 + i * 17), ax0, ay0, ax1, ay1, 0.55, 0.3), true);
    const ua = u + (rand(333, i, 1) - 0.5) * 0.18, ub = ua + 0.1 + rand(333, i, 2) * 0.16;
    draw(tree(new Rng(337 + i * 19), ...at(ua, (rand(333, i, 3) - 0.5) * hw), ...at(ub, (rand(333, i, 4) - 0.5) * hw), 0.45, 0.2), false);
    q.glow(ax0, ay0, 5, hot, 0.45 * a);
    q.glow(ax1, ay1, 5, hot, 0.45 * a);

    // 2) the runner: a short bolt walking the spine while the charge lasts
    if (age > 0.02) {
      const u0 = u + (rand(341, i, 1) - 0.5) * 0.34, u1 = u0 + (rand(341, i, 2) - 0.5) * 0.2;
      const run = tree(new Rng(351 + i * 13), ...at(u0, (rand(341, i, 3) - 0.5) * 4), ...at(u1, (rand(341, i, 4) - 0.5) * 4), 0.4, 0.22);
      for (const path of run)
        for (let k = 0; k < path.pts.length - 1; k++) {
          const [bx0, by0] = path.pts[k], [bx1, by1] = path.pts[k + 1];
          const n = Math.max(1, Math.ceil(Math.hypot(bx1 - bx0, by1 - by0) * 1.2));
          for (let m = 0; m <= n; m++) {
            const f = m / n;
            q.dot(bx0 + (bx1 - bx0) * f, by0 + (by1 - by0) * f, a > 0.5 ? hot : cold, a * 0.85);
          }
        }
    }

    // 3) rays: energy flung straight out of the tear, one for each spoke, thinning as it travels
    if (age2 < 0.55) {
      const n = 11;
      for (let k = 0; k < n; k++) {
        const th = rand(371, i, k, 1) * TAU, len = (26 + rand(371, i, k, 2) * 54) * Math.min(1, age2 * 2.2);
        for (let m = 1; m <= 4; m++) {
          const f = m / 4, r = len * f;
          const X = cx + Math.cos(th) * r * 1.25, Y = cy + Math.sin(th) * r * 0.72;
          if (f > 1.02) break;
          q.dot(X, Y, hot, a * (1 - f) * 0.8);
        }
      }
    }

    // 4) sparks: thrown out across the tear, white at birth, ramping down as they fly
    for (let k = 0; k < 22; k++) {
      if (rand(361, i, k, 1) > 0.6) continue;
      const uk = u + (rand(361, i, k, 2) - 0.5) * 0.2;
      const dir = rand(361, i, k, 3) < 0.5 ? -1 : 1;
      const sp = 26 + rand(361, i, k, 4) * 66;
      const v0 = (rand(361, i, k, 5) - 0.5) * 7;
      const vv = v0 + dir * (sp * age2 + 2);
      const [sx, sy] = at(uk, vv);
      const fade = s * (1 - Math.min(1, age2 * 2.4));
      if (fade < 0.12) continue;
      q.dot(sx, sy, age2 < 0.12 ? white : hot, fade);
      if (fade > 0.45 && age2 < 0.3) q.light(sx, sy, mid, 0.1 * fade);
      const [tx2, ty2] = at(uk, vv - dir * Math.min(7, 2 + age2 * 8));
      q.dot(tx2, ty2, mid, fade * 0.6);
    }

    // 5) debris: chips knocked off the lip, tumbling away and dimming
    for (let k = 0; k < 5; k++) {
      if (rand(381, i, k, 1) > 0.5) continue;
      const uk = u + (rand(381, i, k, 2) - 0.5) * 0.3;
      const dir = rand(381, i, k, 3) < 0.5 ? -1 : 1;
      const vv = dir * (edge(uk) + 2 + age2 * (10 + rand(381, i, k, 4) * 16));
      const [sx, sy] = at(uk, vv);
      const fade = 1 - Math.min(1, age2 * 1.6);
      if (fade < 0.2) continue;
      q.dot(sx, sy, mid, fade * 0.7);
      q.dot(sx + dir * VX, sy + dir * VY, cold, fade * 0.45);
    }

    // 6) the ring: light racing away from the tear, flattened by the same axis, dashed so it reads as a
    // shock front rather than a halo
    const ring = age2 * 150;
    if (ring > 5 && ring < 210) {
      const al = s * 0.4 * (1 - clamp(ring / 210, 0, 1));
      if (al > 0.05) {
        for (let deg = 0; deg < 360; deg += 9) {
          if ((deg / 9) % 3 !== 0) continue;              // dashes with gaps
          const th = (deg * Math.PI) / 180;
          const rr = ring * (0.6 + 0.4 * Math.abs(Math.cos(th)));
          const X = cx + Math.cos(th) * rr * 1.5, Y = cy + Math.sin(th) * rr * 0.62;
          q.dot(X, Y, cold, al);
          if (al > 0.26) q.light(X, Y, mid, 0.07 * al);
        }
      }
    }
  }
  // the wound's heart: a standing hot core at its widest point, breathing with the surges
  const S = surge(t);
  if (S > 0.02) {
    const [hx, hy] = at(0.5, 0);
    q.glow(hx, hy, 9 + 6 * S, hot, 0.2 * S * flick(t));
  }
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
  const NL = fit(o.nebula, 7);
  bigStars(p, t);
  wanderer(p, t);
  energy(p, t, o, NL);
}
