// 海底：an undersea scene built from the library's own critters — the fish school (bodies wag
// into swinging tails, caustic light, light shafts), the pulsing jellyfish (bell, frilled arms,
// trailing tentacles, inner glow) and the bubbles, all after Sprite Fusion's open-source pixel
// art VFX (https://www.spritefusion.com/pixel-art-vfx/bubbles), MIT License, Copyright (c) 2026
// Hugo Duprez, plus a sandy floor with rocks and swaying seaweed.
import { fit, mix, clamp, wrap, lerp, seg, ease, rng, cycle, rand, TAU, hex } from "../../core/index.js";
import { clip, rows } from "./_lib.js";
import { Grid, bubble } from "../critters/_lib.js";
import { drawRock, stoneShape } from "../nature/_lib.js";

export const meta = {
  name: "Undersea",
  desc: "The sea floor: light shafts and caustics ripple down from the surface, a school of fish glides past, jellyfish pulse and drift, bubbles wobble up from vents among the seaweed.",
  tags: ["weather", "undersea", "sea", "fish", "jellyfish", "bubbles", "seaweed", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#04101c", "#0a2a42", "#114867", "#1a6f8e", "#2f9db4", "#7cc8d6", "#c8f0ee", "#f4fffa"],
    stripe: ["#5a1e14", "#d8582a", "#ffa04a"],
    density: 1,
    seed: 30,
  },
};

const D = 12;
const FG = new Grid(-20, -12, 40, 26); // one fish, nose at (0,0), facing right
const JG = new Grid(-24, -30, 48, 38); // one jellyfish, rim centre at (0,0)
const AG = new Grid(-44, -44, 88, 104); // a jelly's frilled arms
const W0 = 32, H0 = 18;

// ---- fish, after the library's fish-school --------------------------------------------------------------------------------
// one fish, its nose at (0, 0), facing right, body trailing back to the left
function fish(g, C, Sp, s, t, ph, dart) {
  g.clear();
  const L = 15 * s, H = 8 * s, beats = 12 + (dart > 0 ? 6 : 0), w = (t / D) * TAU * beats + ph * TAU;
  const amp = (1.3 + 1.2 * dart) * s, bend = (u) => amp * u ** 1.8 * Math.sin(w - 4 * u);
  const prof = (u) => (u < 0.3 ? Math.sqrt(u / 0.3) : 1 - ((u - 0.3) / 0.7) ** 1.5 * 0.72);
  const hh = (u) => (H / 2) * prof(u);
  g.shade(-L, -H, 0, H, (x, y, o) => {
    const u = -x / L, dy = y - bend(u), h = hh(u);
    if (u < 0 || u > 1 || Math.abs(dy) > h) return 0;
    const v = dy / h;
    if (v > -0.12 && v < 0.12 && u > 0.22 && u < 0.92) return u < 0.3 ? Sp[1] : Sp[v < 0 ? 2 : 1];
    if (v < -0.6) return u < 0.5 && v < -0.8 ? C[3] : C[2];
    if (v < -0.12) return C[3];
    if (v < 0.5) return C[4];
    return v > 0.86 ? C[4] : C[5];
  });
  const tb = bend(1), ta = Math.atan(amp * 1.8 * 0.9 * Math.cos(w - 4)) * 0.8, TL = 6 * s, hb = hh(1);
  const rot = (dx, dy) => [-(L + dx * Math.cos(ta) - dy * Math.sin(ta)), tb + dx * Math.sin(ta) + dy * Math.cos(ta)];
  g.poly([rot(-0.5, -hb), rot(TL, -hb - 3.4 * s), rot(TL * 0.62, 0), rot(TL, hb + 3.4 * s), rot(-0.5, hb)], (x, y) => (y < tb - 1 ? C[4] : C[3]), 0.88);
  const d0 = 0.34, d1 = 0.66;
  g.poly([[-d0 * L, bend(d0) - hh(d0) + 0.5], [-(d0 + 0.08) * L, bend(d0) - hh(d0) - 3.6 * s], [-d1 * L, bend(d1) - hh(d1) + 0.5]], (x) => (Math.round(x) % 2 ? C[3] : C[4]), 0.85);
  const pf = Math.sin(w * 0.5) * 1.2;
  g.set(-0.34 * L, bend(0.34) + 1.5 * s + pf * 0.3, C[4], 0.85); g.set(-0.34 * L - 1, bend(0.34) + 2 * s + pf * 0.6, C[4], 0.85);
  for (let y = -2; y <= 1; y++) g.set(-0.26 * L, bend(0.26) + y * s, C[2]);
  const ex = -0.13 * L - 1, ey = bend(0.13) - 0.25 * H;
  g.set(ex, ey, C[0]); g.set(ex + 1, ey, C[0]); g.set(ex, ey + 1, C[1]); g.set(ex + 1, ey + 1, C[0]);
  g.set(ex + 1, ey, C[6]);
  g.outline(C[0]);
}

// the school: [x, y, size, row (0 near, 1 mid, 2 far), phase]
const SCHOOL = [
  [-130, -92, 0.62, 2, 0.1], [-40, -110, 0.58, 2, 0.55], [60, -84, 0.6, 2, 0.3], [130, -100, 0.56, 2, 0.8],
  [-100, -50, 0.85, 1, 0.2], [10, -66, 0.9, 1, 0.65], [96, -44, 0.82, 1, 0.45],
  [-132, -14, 1.15, 0, 0.3], [-30, -22, 1.2, 0, 0.75], [70, -10, 1.1, 0, 0.5], [140, -26, 1.05, 0, 0.9],
];

// ---- jellyfish, after the library's jellyfish, re-centred so several can drift the scene ------------------------------------------------
function bellAt(tt, cx, cy, s) {
  tt = wrap(tt, D);
  const BEAT = D / 2, u = (tt % BEAT) / BEAT;
  const c = u < 0.16 ? ease.outCubic(u / 0.16) : u < 0.22 ? 1 : u < 0.72 ? lerp(1, -0.14, ease.inOutSine((u - 0.22) / 0.5)) : lerp(-0.14, 0, ease.inOutSine((u - 0.72) / 0.28));
  const lift = u < 0.42 ? -6 * s * ease.outCubic(seg(u, 0.04, 0.42)) : -6 * s + 6 * s * ease.inOutSine((u - 0.42) / 0.58);
  return { x: cx + 2 * s * Math.sin((tt / D) * TAU), y: cy + lift, c, W: W0 * s * (1 - 0.3 * c), H: H0 * s * (1 + 0.24 * c), s };
}
const halfW = (h, B) => {
  if (h > B.H) return -1;
  let hw = (B.W / 2) * Math.sqrt(Math.max(0, 1 - (Math.max(0, h) / B.H) ** 2));
  if (h < B.H * 0.3) hw -= B.c * 2.4 * B.s * (1 - h / (B.H * 0.3));
  return hw;
};
const scallop = (dx, B) => 1.1 * Math.max(0, Math.sin((dx / (B.W / 2)) * Math.PI * 4 + Math.PI / 2));

function drawBell(p, g, C, G, B, t) {
  g.clear();
  const bx = Math.round(B.x), by = Math.round(B.y);
  const inside = (x, y) => {
    const dx = x - B.x, h = B.y - y;
    if (h < -scallop(dx, B)) return false;
    const hw = halfW(Math.max(0, h), B);
    return hw >= 0 && Math.abs(dx) <= hw;
  };
  g.shade(-24, -30, 24, 4, (x, y, o) => {
    if (!inside(x + bx, y + by)) return 0;
    o.t = 1;
    return C[3];
  });
  g.depths(4);
  g.recolor((x, y, c, a, tag) => {
    if (tag !== 1) return c;
    const X = x + bx + 0.5, Y = y + by + 0.5, d = g.depth(x, y), dx = X - B.x, h = B.y - Y, v = h / B.H;
    const i = g.idx(x, y);
    let col = C[3], al = 0.26 + 0.2 * clamp(v);
    const iw = B.W * 0.36, ih = B.H * 0.66;
    const ie = (dx / iw) ** 2 + (Math.max(0, h) / ih) ** 2;
    if (ie > 0.8 && ie < 1.12 && h > 0.5) (col = C[4]), (al = 0.55);
    if (h < 1) (col = C[5]), (al = 0.85);
    if (d === 2) (col = v > 0.5 && dx < 0 ? C[5] : C[4]), (al = 0.75);
    if (d === 1) (col = dx < 0 && v > 0.25 ? C[6] : C[5]), (al = 0.92);
    const lx = B.x - B.W * 0.22, ly = B.y - B.H * 0.78, gx = X - lx, gy = Y - ly;
    if (d === 2 && dx < -1 && v > 0.45 && gx * gx + gy * gy < 26 * B.s) (col = C[7]), (al = 1);
    g.a[i] = al;
    return col;
  });
  for (const s of [-0.62, 0.62])
    for (let h = 2; h < B.H - 2; h++) {
      const hw = halfW(h, B), x = B.x + s * hw * 0.9 - bx, y = B.y - h - by;
      if (g.depth(x, y) >= 3) g.set(x, y, C[4], 0.5);
    }
  const pulse = 0.5 + 0.5 * B.c, cy = B.y - B.H * 0.42, rx = B.W * 0.2, ry = B.H * 0.2;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(B.x - rx); x <= B.x + rx; x++) {
      const d = ((x + 0.5 - B.x) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1 || g.depth(x - bx, y - by) < 2) continue;
      g.set(x - bx, y - by, d < 0.3 ? C[6] : d < 0.65 ? C[5] : C[4], d < 0.3 ? 0.9 : 0.6);
    }
  g.outline((x, y, nx, ny) => (ny > 0 ? 0 : C[1]), 0.9);
  g.draw(p, 1, bx, by);
  p.glow(B.x, B.y - B.H * 0.45, (30 + 6 * B.c) * B.s, C[4], 0.22 + 0.12 * pulse);
  p.glow(B.x, B.y - B.H * 0.45, 11 * B.s, C[6], 0.14 + 0.16 * pulse);
  for (const s of [-1, 1])
    for (const q of [0.14, 0.42, 0.78]) {
      const x = B.x + s * halfW(0.5, B) * q, y = B.y + 1, tw = 0.6 + 0.4 * Math.sin((t / D) * TAU * 3 + q * 9 + s);
      p.px(x, y, tw > 0.85 ? G[3] : G[2]);
      p.glow(x, y, 4, G[2], 0.4 * tw);
    }
}

// a strand hanging from the bell: each point follows where its root was a moment ago, so it trails
// every thrust and billows as the bell sinks
function strand(bellFn, t, off, len, step, lag, sway, ph, pull) {
  const pts = [], B1 = bellFn(t), o1 = off(B1);
  for (let s = 0; s <= len; s += step) {
    const B = bellFn(t - s * lag), relax = 1 - clamp(B.c), ox = lerp(o1[0], off(B)[0], 0.4);
    const w = (0.3 + s * sway) * (0.55 + 0.65 * relax) * Math.sin((t / D) * TAU * 2 - s * 0.11 + ph);
    pts.push([B.x + ox + w + ox * s * (0.009 * relax - 0.005 * pull * B.c), B.y + o1[1] + s * (0.88 * B.s + 0.05 * B.c)]);
  }
  return pts;
}

function drawTentacle(p, C, G, pts, back, t, i) {
  const n = pts.length;
  for (let k = 1; k < n; k++) {
    const u = k / (n - 1), [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    const c = back ? (u < 0.3 ? C[3] : u < 0.7 ? C[2] : C[1]) : u < 0.2 ? C[5] : u < 0.45 ? C[4] : u < 0.78 ? C[3] : C[2];
    p.line(x0, y0, x1, y1, c);
  }
  if (back) return;
  for (let k = 3; k < n; k += 4) {
    const tw = Math.sin((t / D) * TAU * 2 - k * 0.5 + i * 1.7);
    if (tw < 0.3) continue;
    const [x, y] = pts[k];
    p.px(x, y, tw > 0.8 ? G[3] : G[2]);
    p.glow(x, y, 3.5, G[2], 0.35 * tw);
  }
}

function drawArms(p, C, list, back) {
  AG.clear();
  const a = back ? 0.6 : 0.88;
  for (const arm of list) {
    if (arm.back !== back) continue;
    const pts = arm.pts, n = pts.length;
    let lastRow = -1e9;
    for (let k = 1; k < n; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], m = Math.max(1, Math.ceil(Math.abs(y1 - y0) * 2));
      for (let j = 0; j < m; j++) {
        const q = j / m, x = lerp(x0, x1, q), y = lerp(y0, y1, q), u = (k - 1 + q) / (n - 1), wd = lerp(2.2, 0.6, u);
        for (let i = -Math.ceil(wd); i <= Math.ceil(wd); i++) {
          if (Math.abs(i) > wd + 0.2) continue;
          AG.set(x + i, y, i < 0 ? C[back ? 4 : 6] : i > 0 ? C[back ? 2 : 4] : C[back ? 3 : 5], a);
        }
        const row = Math.floor(y);
        if (row !== lastRow && row % 3 === 0 && u < 0.85) AG.set(x + ((row / 3) % 2 ? -wd - 1.2 : wd + 1.2), y, C[back ? 4 : 6], a);
        lastRow = row;
      }
    }
  }
  AG.draw(p);
}

function jelly(p, t, cx, cy, s, C, G, seed) {
  const B = bellAt(t, cx, cy, s);
  const bells = (tt) => bellAt(tt, cx, cy, s);
  const tents = [], arms = [];
  for (let i = 0; i < 9; i++) {
    const r = rng(seed, i, 4), q = -0.88 + (1.76 * i) / 8 + r.range(-0.05, 0.05), back = i % 2 === 1;
    tents.push({ back, i, pts: strand(bells, t, (b) => [q * halfW(0.5, b), 0.5], r.range(36, 50) * s, 1.5 * s, 0.022, 0.065, r.range(0, TAU), 1) });
  }
  for (let i = 0; i < 4; i++) {
    const r = rng(seed, i, 9), q = [-0.32, -0.1, 0.12, 0.3][i], back = i === 1 || i === 2;
    arms.push({ back, pts: strand(bells, t, (b) => [q * b.W * 0.5, -1], r.range(20, 27) * s, 1 * s, 0.03, 0.06, r.range(0, TAU) + i, 0.4) });
  }
  for (const a of tents) if (a.back) drawTentacle(p, C, G, a.pts, true, t, a.i);
  drawArms(p, C, arms, true);
  drawBell(p, JG, C, G, B, t);
  drawArms(p, C, arms, false);
  for (const a of tents) if (!a.back) drawTentacle(p, C, G, a.pts, false, t, a.i);
}

// ---- the scene ------------------------------------------------------------------------------------------------------------
// the seaweed: stalks of chained segments swaying, a leaf blade every so often, on whole wave
// cycles so the sway never seams
const WEEDS = [-146, -118, -92, -52, -18, 24, 58, 96, 128].map((x, i) => ({
  x: x + rand(30, i, 71) * 10, h: 16 + rand(30, i, 72) * 22, ph: rand(30, i, 73) * TAU, w: rand(30, i, 74) < 0.5 ? 1 : 1.6,
}));
const WEEDC = [hex("#0c2418"), hex("#14482a"), hex("#227a3a"), hex("#46ae52")];

// bubbles rise from vents on the floor
const VENTS = [-110, -20, 88];

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8), Sp = fit(o.stripe, 3), G = [hex("#0b3550"), hex("#1f7fa8"), hex("#4fd2e8"), hex("#b8fbff")];
  // the deep: dark toward the floor, teal toward the surface
  rows(p, meta, -170, 9, (y, R) => {
    const k = clamp((y + 170) / 180);
    R.c.fill(mix(hex("#03101e"), hex("#0d3c58"), k * k));
    R.a.fill(1);
    R.b.fill(0);
  });
  // shafts of light slanting down through the water, swaying
  for (const [x0, w, ph] of [[-110, 22, 0], [-20, 15, 2.1], [80, 26, 4], [150, 12, 1.2]]) {
    const sw = Math.sin((t / D) * TAU + ph) * 9;
    q.glowLine(x0 + sw - 16, -170, x0 + sw + 22, 0, w, C[3], 0.05);
  }
  // caustics: crossing ripples of light near the surface
  for (let y = -170; y < -108; y++)
    for (let x = -160; x < 160; x++) {
      const fall = clamp(1 - Math.abs(y + 140) / 62) * 0.9;
      if (fall <= 0) continue;
      const a = (t / D) * TAU;
      const u = x * 0.15 + 2.2 * Math.sin(y * 0.12 + a), v = y * 0.19 + 2.2 * Math.sin(x * 0.09 - a);
      const n1 = Math.sin(u) + Math.sin(v), sh = 0.75 + 0.25 * Math.sin(x * 0.05 - y * 0.04 + 2 * a);
      const f = Math.max(0, 1 - Math.abs(n1) * 4.6) * fall * sh;
      if (f > 0.5) q.light(x, y, C[4], 0.22);
      else if (f > 0.2) q.light(x, y, C[3], 0.1);
    }
  // the sea floor: sand, lit at its lip, with rocks half sunk in it
  rows(p, meta, 0, 9.5, (y, R) => {
    R.c.fill(y < 1 ? hex("#1c4258") : y < 3 ? hex("#102838") : hex("#0a1c2a"));
    R.a.fill(1);
    R.b.fill(0);
  });
  for (let i = 0; i < 9; i++) {
    const r = rng(S, i, 81), x = -150 + i * 34 + r.range(0, 16), s = 2.4 + r.range(0, 2.6);
    drawRock(q, x, 1, s, r.range(-0.4, 0.4), stoneShape(r, 5), [hex("#0e2030"), hex("#17344a"), hex("#21506c"), hex("#2f7290"), hex("#4b96b0"), hex("#7cc0d0"), hex("#c8ecf0")], 1, false);
  }
  // the far fish row, dimmed into the water
  for (const f of SCHOOL) {
    if (f[3] !== 2) continue;
    const a = (t / D) * TAU;
    fish(FG, C, Sp, f[2], t, f[4], 0);
    FG.recolor((x, y, c) => mix(c, C[1], 0.55));
    FG.draw(p, 1, f[0] + 3 * Math.sin(a + f[4] * TAU), f[1] + 2 * Math.sin(2 * a + f[4] * 5));
  }
  // the far jellyfish, dimmed into the water
  const CD = C.map((c) => mix(c, C[1], 0.45)), GD = G.map((c) => mix(c, C[1], 0.5));
  jelly(q, t, 118 + 6 * Math.sin((t / D) * TAU), -96 + 10 * Math.sin((t / D) * TAU * 0.5 + 1), 0.62, CD, GD, S * 7 + 2);
  // seaweed behind the near life
  weeds(q, t);
  // bubble vents on the floor
  for (let v = 0; v < VENTS.length; v++) {
    const vx = VENTS[v];
    cycle(t, D, 5, S * 11 + v, (r) => r.range(0.5, 0.9), (age, L, R, i) => {
      const rad = R.range(0.7, 2.2), x = vx + R.range(-3, 3) + Math.sin(age * (4 + 2 / rad) + i) * (0.6 + rad * 0.8);
      const y = 1 - (14 + 13 * rad) * age;
      if (y < -150) return;
      bubble(q, x, y, rad, [C[6], C[5], C[4], C[2]], Math.min(1, age * 4, (L - age) * 3));
    });
  }
}

function weeds(q, t) {
  for (const wd of WEEDS) {
    const n = Math.floor(wd.h);
    for (let i = 0; i < n; i++) {
      const sway = Math.sin((t / D) * TAU * 2 + wd.ph - i * 0.32) * (i / n) * 4;
      const x = wd.x + sway, y = -i * 0.9;
      if (i > 0) q.line(wd.x + Math.sin((t / D) * TAU * 2 + wd.ph - (i - 1) * 0.32) * ((i - 1) / n) * 4, -(i - 1) * 0.9, x, y, WEEDC[Math.min(3, Math.floor((i / n) * 4))]);
      if (i % 3 === 2 && i < n - 2) {
        const dir = (i / 3) % 2 ? 1 : -1, lx = x + dir * (2 + (i / n) * 3), ly = y - 1.5;
        q.line(x, y, lx, ly, WEEDC[2]);
        q.line(lx, ly, lx + dir * 1.5, ly - 1, WEEDC[3], 0.85);
      }
    }
  }
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8), Sp = fit(o.stripe, 3), G = [hex("#0b3550"), hex("#1f7fa8"), hex("#4fd2e8"), hex("#b8fbff")];
  // the near and mid fish rows
  for (const row of [1, 0]) {
    for (const f of SCHOOL) {
      if (f[3] !== row) continue;
      const a = (t / D) * TAU, i = SCHOOL.indexOf(f);
      const dt = wrap(t - (i * 0.71 * D) % D, D), dart = i === 9 ? (dt < 0.5 ? ease.outCubic(dt / 0.5) : dt < 2 ? 1 - ease.inOutSine((dt - 0.5) / 1.5) : 0) : 0;
      fish(FG, C, Sp, f[2], t, f[4], dart);
      if (row === 1) FG.recolor((x, y, c) => mix(c, C[1], 0.25));
      FG.draw(p, 1, f[0] + 3 * Math.sin(a + f[4] * TAU) + 10 * dart, f[1] + 2 * Math.sin(2 * a + f[4] * 5));
      // a bubble let go from its mouth now and then
      if (i % 3 === row) {
        const rad = 0.6 + f[2] * 0.8, bx = f[0] + 1, by = f[1] - 2 - ((t / D) * (16 + 12 * rad) * 3) % 40;
        bubble(q, bx, by, rad, [C[6], C[5], C[4], C[2]], 0.85);
      }
    }
  }
  // the near jellyfish, big, drifting up the frame
  jelly(q, t, -84 + 8 * Math.sin((t / D) * TAU + 0.6), -70 - 14 * Math.sin((t / D) * TAU * 0.5), 1.05, C, G, S * 5 + 1, 0);
  // plankton specks drifting
  cycle(t, D, 22, S * 3 + 5, D, (age, L, r) => {
    const x = r.range(-158, 158) + Math.sin(age * 0.8 + r.next() * 6) * 3, y = r.range(-168, 8) + age * r.range(1, 4);
    const tw = Math.sin(age * 2.2 + r.next() * 6), a = Math.min(1, age * 2, (L - age) * 2) * (0.3 + 0.3 * tw);
    q.dot(x, y, tw > 0.8 ? G[2] : C[3], a);
  });
  q.glow(0, -60, 120, C[2], 0.12);
}
