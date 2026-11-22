// meteors.js — the upgraded meteor system, shared by heaven / rift / otherworld-rift.
// The craft is the shooting-stars scene's (head that burns out, trail cooling down the ramp,
// flare + fragments for the big ones, glowing twisting train), ported onto a schedule in loop
// fractions so it fits any duration. Eight meteors a loop, and every one of them differs —
// its own start, angle, speed, length, size, colours and moment (user's spec).
import { rand, TAU, WHITE, sparkle, at, hex } from "../../../src/core/index.js";

const TRAIN = 1.6;
// every meteor carries a FULL 6-colour ramp like the shooting-stars original (dark sheath, mid,
// bright, warm accent, pale highlight, white core): the craft reads C[1..4] everywhere, and a
// short palette left C[4] undefined — which the painter drew BLACK (the "crash smoke" bug).
// the ORIGINAL shooting-stars schedule and palette, verbatim (t0 converted from the
// original /10 loop to a loop fraction): user asked for a straight copy
const C0 = ["#3a1e5a", "#7a3a8a", "#e0607a", "#ffa86a", "#ffe6a8", "#ffffff"];
const LIST = [
  { t0: 0.05, x: 60, y: -170, a: 2.45, v: 260, life: 0.55, s: 0.6, C: C0 },
  { t0: 0.19, x: -40, y: -176, a: 2.2, v: 220, life: 0.7, s: 0.8, C: C0 },
  { t0: 0.34, x: 150, y: -150, a: 2.62, v: 300, life: 0.45, s: 0.5, C: C0 },
  { t0: 0.46, x: 130, y: -178, a: 2.35, v: 240, life: 1.05, s: 1.4, flare: true, C: C0 },
  { t0: 0.67, x: -90, y: -168, a: 2.05, v: 200, life: 0.6, s: 0.7, C: C0 },
  { t0: 0.79, x: 20, y: -160, a: 2.5, v: 280, life: 0.5, s: 0.6, C: C0 },
  { t0: 0.92, x: -10, y: -176, a: 2.28, v: 230, life: 0.8, s: 1.0, flare: true, C: C0 },
];
// the painter only accepts PACKED colours (hex()); the raw "#rrggbb" strings would render
// as black — that was the "black smoke" trail
for (const m of LIST) m.C = m.C.map(hex);


/** draw all meteors onto q; t is the scene clock, D the scene's loop duration, seed varies per scene */
export function drawMeteors(q, t, D, seed) {
    for (let i = 0; i < LIST.length; i++) {
    const m = LIST[i];
    const age = (((t / D - m.t0) % 1) + 1) % 1 * D;   // seconds since this meteor lit (once a loop)
    if (age > m.life + (m.flare ? 0.5 : 0) + TRAIN) continue;
    meteor(q, age, m, i, seed);
  }
}

// one meteor, age seconds after it lights — faithful port of the shooting-stars original
function meteor(q, age, m, i, S) {
  const ca = Math.cos(m.a), sa = Math.sin(m.a), C = m.C, end = m.life + (m.flare ? 0.5 : 0) + TRAIN;
  const pos = (tt) => [m.x + ca * m.v * tt, m.y + sa * m.v * tt], burn = Math.min(age, m.life), [hx, hy] = pos(burn);
  // the train: the whole path it has burned, lingering, widening, drifting and twisting
  const trainK = age < m.life ? 1 : 1 - (age - m.life) / (TRAIN + (m.flare ? 0.5 : 0));
  if (trainK > 0) {
    const len = m.v * burn, nx = -sa, ny = ca;
    for (let d = 0; d < len; d += 1) {
      const passed = age - d / m.v;
      if (passed < 0.08) continue;
      const g = trainK * Math.min(1, (passed - 0.08) * 4) * (0.35 + 0.65 * Math.sin((Math.PI * d) / len)) * m.s, tw = Math.sin(d * 0.09 + passed * 1.7) * Math.min(4, passed * 3);
      const x = m.x + ca * d + nx * tw + passed * 4, y = m.y + sa * d + ny * tw;
      // the trail must stay BRIGHT on a dark sky (user saw the old purple tail as black smoke):
      // pale gold near the head, orange mid, rose at the far end — a bright-to-warm gradient
      const tc = passed < 0.4 ? C[4] : passed < 0.75 ? C[3] : C[2];
      q.dot(x, y, tc, Math.min(1, g * 0.9));
      if (d % 4 === 0) q.glow(x, y, 6 + passed * 4, C[2], 0.16 * g);
    }
  }
  if (age > m.life + (m.flare ? 0.5 : 0)) return;
  // the head brightens fast, holds, and burns out; the big ones flare as they go
  const u = age / m.life, k = age < m.life ? Math.min(1, u * 6) * (u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1) : 0;
  if (k > 0) {
    const L = (24 + 40 * m.s) * Math.min(1, u * 3);
    for (let d = 0; d <= L; d += 0.5) {
      const v = d / L, x = hx - ca * d, y = hy - sa * d;
      q.dot(x, y, v < 0.08 ? WHITE : at(C.slice(1).reverse(), v * 0.95), k * (v < 0.6 ? 1 : (1 - v) / 0.4));
      if (m.s > 0.9 && v < 0.4) q.dot(x - sa * 0.9, y + ca * 0.9, v < 0.15 ? C[4] : C[3], k * (1 - v / 0.4));
    }
    q.px(hx, hy, WHITE);
    try { document.title = "hx=" + hx.toFixed(1) + " hy=" + hy.toFixed(1) + " probe=(" + (Math.round(hx)+2) + "," + Math.round(hy) + ")"; } catch (e) {}
    if (m.s > 0.9) (q.px(hx + 1, hy, WHITE), q.px(hx, hy + 1, C[4]));
    q.glow(hx, hy, 8 + 10 * m.s, C[4], 0.45 * k);
    q.glow(hx - ca * L * 0.3, hy - sa * L * 0.3, 10 + 8 * m.s, C[3], 0.2 * k);
  }
  if (!m.flare || age < m.life * 0.82) return;
  // the flare: a burst of light and rays, fragments carrying on and fading
  const f = (age - m.life * 0.82) / (m.life * 0.18 + 0.5), [fx, fy] = pos(m.life * 0.86);
  if (f < 0.35) {
    sparkle(q, fx, fy, 9 * Math.sin((Math.PI * f) / 0.35) + 2, C[4], C[3], 0.6);
    q.glow(fx, fy, 40, C[3], 0.5 * (1 - f / 0.35));
  }
  // little stars scattered round the burst, each twinkling once and gone
  for (let j = 0; j < 7; j++) {
    const ang = rand(S, i, j, 5) * TAU, r = 5 + rand(S, i, j, 6) * 16, d0 = rand(S, i, j, 7) * 0.3, g = (f - d0) / 0.45;
    if (g <= 0 || g >= 1) continue;
    const sx = fx + Math.cos(ang) * r * (0.6 + g * 0.5), sy = fy + Math.sin(ang) * r * (0.6 + g * 0.5) - g * 3, arm = Math.round(2.5 * Math.sin(Math.PI * g));
    if (arm >= 1) sparkle(q, sx, sy, arm, j % 3 ? C[4] : WHITE, C[3], 0.3 * (1 - g));
    else q.px(sx, sy, C[4]);
  }
  for (let j = 0; j < 4; j++) {
    const da = (rand(S, i, j, 1) - 0.5) * 0.5, sp = m.v * (0.5 + rand(S, i, j, 2) * 0.4), tt = f * (m.life * 0.18 + 0.5), g = 1 - f;
    const x = fx + Math.cos(m.a + da) * sp * tt, y = fy + Math.sin(m.a + da) * sp * tt;
    if (g <= 0) continue;
    q.line(x - Math.cos(m.a + da) * 5 * g, y - Math.sin(m.a + da) * 5 * g, x, y, C[3], g);
    q.px(x, y, g > 0.5 ? WHITE : C[4]);
    q.glow(x, y, 5, C[3], 0.35 * g);
  }
}
