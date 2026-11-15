// A full-scene tornado wallpaper core, adapted from the pixelfx library's own nature/tornado
// (snaking funnel, spinning wind bands, a flared churning crown that flickers with lightning,
// debris spiralling up, dust boiling at the foot) with a bolt or three striking round it. The
// scene around the funnel is pluggable: each wallpaper supplies its sky, its ground and what the
// wind picks up — embers over a burning floor, spray off flooded water, ice shards off an ice
// sheet, leaves off an autumn litter.
import { cycle, rand, rng, smooth, clamp, lerp, TAU, WHITE, mix, hex, tileNoise, wrap } from "../../core/index.js";
import { clip, rows, field, sample, trips, bayer, tree } from "./_lib.js";

const SY = 0.28;

// the funnel at time t: its axis snakes (a wave running up it), its radius flares at the top
function geo(TH, t) {
  const ph = (TAU * t) / TH.D, FH = TH.FH;
  return {
    FH, ph,
    ax: (u) => 8.5 * Math.sin(ph - 2.6 * u) * (0.2 + 0.8 * u) + 3 * Math.sin(2 * ph + 1.3 - 4.5 * u) * u,
    rad: (u) => 3 + 20 * Math.pow(u, 1.5) + 17 * Math.pow(smooth(0.78, 1, u), 2),
  };
}

// the body: a translucent column, thicker through its middle, lit from the left, with streaks of
// dust that shear past each other as rows spin at different speeds
function body(p, TH, g, t, seed) {
  const C = TH.C, Dst = TH.Dst, { FH, ax, rad } = g;
  for (let y = -Math.ceil(FH) + 2; y <= 0; y++) {
    const u = -y / FH, cx = ax(u), r = rad(u), K = 2 + (rand(y, seed) < 0.35 ? 1 : 0), rot = (TAU * K * t) / TH.D;
    const fade = Math.min(1, u * 8 + 0.25) * (1 - smooth(0.9, 1.02, u));
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const c = (x + 0.5 - cx) / r;
      if (Math.abs(c) > 1) continue;
      const n = tileNoise(((Math.acos(c) + rot) * 6) / TAU, y * 0.34, 6, 0, seed), v = -c * 0.55 + 0.15 + n * 0.55;
      let col = v > 0.6 ? C[6] : v > 0.28 ? C[5] : v > -0.05 ? C[4] : v > -0.4 ? C[3] : C[2];
      if (u < 0.3) col = mix(col, Dst[v > 0.3 ? 3 : v > -0.2 ? 2 : 1], 0.7 * (1 - u / 0.3));
      p.blend(x, y, col, (0.14 + 0.36 * Math.sqrt(1 - c * c)) * fade);
    }
  }
}

// wind bands: 1 px streaks wrapped round the funnel, bright at the head, fading along the tail;
// the far half goes behind, dimmer
function bands(p, C, g, t, seed, back) {
  const { FH, ax, rad } = g;
  for (let j = 0; j < 58; j++) {
    const R = rng(seed, j), u = (j + R.range(0.1, 0.9)) / 58, K = R.int(2, 4), span = R.range(0.7, 2.1), lvl = R.next();
    const cx = ax(u), r = rad(u) * R.range(1.0, 1.1), y0 = -u * FH, head = R.range(0, TAU) + (TAU * K * t) / TH_D;
    if (u > 0.97) continue;
    for (let s = 0; s <= span; s += 0.5 / Math.max(2, r)) {
      const th = head - s, sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const k = s / span, x = cx + r * Math.cos(th), y = y0 + r * SY * sn, lit = Math.cos(th) < 0.2;
      let i = lvl < 0.18 ? 2 : k < 0.15 && lvl > 0.55 ? 7 : k < 0.45 ? (lit ? 6 : 5) : lit ? 5 : 4;
      if (back) i = Math.max(1, i - 2);
      if (k < 0.5) p.dot(x, y, C[i]);
      else p.blend(x, y, C[i], 2 * (1 - k));
    }
    if (!back && lvl > 0.6 && Math.sin(head) > 0) {
      const hx = cx + r * Math.cos(head), hy = y0 + r * SY * Math.sin(head);
      p.dot(hx, hy, WHITE);
      p.glow(hx, hy, 5, C[6], 0.3);
    }
  }
}
let TH_D = 10; // the loop length bands() spins against (set per theme)

// a soft flattened puff: rx wide, ry tall, blended
function blob(p, cx, cy, rx, ry, c, a) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) p.blend(x, y, c, a);
    }
}

// the flared top: a lid of cloud sheared into flat bands that ride round with the funnel, each
// thick in the middle and drawn out to a thin tail behind, lit along its upper rim, dark beneath
function crown(p, C, g, t, seed, back, flash) {
  const { FH, ax, rad } = g, cx = ax(1), r = rad(1), L = (c) => mix(c, C[7], flash * 0.6), y0 = -FH - 3;
  if (back) {
    blob(p, cx, y0 + 1, r * 0.85, 6, C[1], 0.6);
    blob(p, cx - 4, y0 - 3, r * 0.6, 3.5, L(C[3]), 0.45);
  }
  for (let j = 0; j < 16; j++) {
    const R = rng(seed, j), rr = r * R.range(0.4, 1.15), K = R.int(1, 2), span = R.range(1.4, 2.8), head = R.range(0, TAU) + (TAU * K * t) / TH_D;
    const th0 = R.range(3.2, 6), lift = R.range(-4, 3) - (1 - rr / (r * 1.15)) * 5;
    for (let s2 = 0; s2 <= span; s2 += 0.6 / rr) {
      const th = head - s2, sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const k = s2 / span, th2 = th0 * Math.sin(Math.PI * Math.pow(1 - k, 0.7)), x = cx + rr * Math.cos(th), y = y0 + lift + rr * SY * sn;
      const T = Math.max(1, Math.round(th2)), d = back ? 1 : 0, lit = Math.cos(th) < 0.3;
      for (let i = 0; i < T; i++) {
        const c = i === 0 ? L(C[(lit ? 6 : 5) - d]) : i === T - 1 && T > 2 ? C[1] : L(C[(i === 1 ? 4 : 3) - d]);
        p.blend(x, Math.max(-169, y - T / 2 + i), c, (0.55 + 0.35 * (1 - k)) * (back ? 0.75 : 1));
      }
    }
  }
}

// the dust skirt at the foot, boiling round and out
function skirt(p, Dst, g, t, seed, back) {
  const cx0 = g.ax(0);
  cycle(t, TH_D, 40, seed, (q) => q.range(0.07, 0.13), (age, life, R) => {
    const k = age / life, th = R.range(0, TAU) + R.range(5, 9) * age, sn = Math.sin(th);
    if (sn > 0 === back) return;
    const rr = 4 + k * R.range(14, 28), x = cx0 + rr * Math.cos(th), y = -1.5 - k * R.range(4, 16) + rr * 0.3 * sn, s = R.range(3, 6) * (0.6 + 0.8 * k);
    const a = Math.min(1, k * 6) * (1 - k) * 0.6;
    p.disc(x, y + s * 0.2, s, Dst[back ? 1 : 2], a);
    p.disc(x - s * 0.2, y - s * 0.3, s * 0.55, Dst[back ? 2 : 3], a * 0.8);
  });
  if (back) return;
  // grit hopping off the floor
  cycle(t, TH_D, 16, seed + 7, (q) => q.range(0.035, 0.06), (age, life, R) => {
    const th = R.range(0, TAU), v = R.range(25, 55), x = cx0 + Math.cos(th) * (4 + v * age), y = Math.sin(th) * 2 - R.range(40, 80) * age + 260 * age * age;
    if (y < 0.5) p.dot(x, Math.min(0, y), R.next() < 0.5 ? Dst[3] : Dst[4], 1 - age / life);
  });
  for (let j = 0; j < 7; j++) {
    const R = rng(seed + 3, j), rr = R.range(12, 28), th0 = R.range(0, TAU) + (TAU * 3 * t) / TH_D, span = R.range(0.5, 1.1);
    for (let s = 0; s < span; s += 0.6 / rr) {
      const th = th0 - s;
      p.dot(cx0 + rr * Math.cos(th), 0.5 + rr * 0.18 * Math.sin(th), Dst[s < span * 0.4 ? 3 : 2], 1 - s / span);
    }
  }
}

// the storm decks, after the thunderstorm's churning cloud ceiling: TWO layers, one behind the
// funnel and one in front of it. Each layer is rows of cloud ROLLS — ellipses that swell, drift
// on the wind and dissolve on their own clock (each born once a loop, so the underside churns
// with no seam) — hanging from wavy curtain bases, their lower edge catching a lit rim. The two
// layers drift at different speeds, and the funnel runs up BETWEEN them: its top vanishes into
// the back deck while the front deck's translucent rolls drift across it. Lightning inside the
// clouds (the crown flash, the strikes' roots and the sheet flashes) lights the undersides.
const RBACK = (FH) => [
  { base: -FH - 8, wob: 3, n: 16, rx: [14, 26], ry: 0.8, drift: 14, life: [4, 7], tone: [1, 2, 3, 4] },
  { base: -FH + 1, wob: 3, n: 20, rx: [9, 17], ry: 0.85, drift: 9, life: [3.5, 6.5], tone: [1, 2, 3, 5] },
];
const RFRONT = (FH) => [
  { base: -FH + 8, wob: 3, n: 18, rx: [8, 15], ry: 0.9, drift: 12, life: [3, 6], tone: [2, 2, 3, 5] },
  { base: -FH + 18, wob: 2, n: 14, rx: [6, 11], ry: 0.95, drift: 7, life: [2.5, 5], tone: [2, 3, 4, 6] },
];
// each roll pushes down out of its row, drifts and draws back up, on its own clock (born once a loop)
function rolls(S, t, TH, ROWS) {
  return ROWS.map((Rw, j) => {
    const out = [];
    for (let i = 0; i < Rw.n; i++) {
      const L = Rw.life[0] + rand(S, j, i, 1) * (Rw.life[1] - Rw.life[0]), age = wrap(t - rand(S, j, i, 2) * TH.D, TH.D);
      if (age >= L) continue;
      const u = age / L, g = Math.sin(Math.PI * u) ** 0.6;
      const rx = Rw.rx[0] + rand(S, j, i, 3) * (Rw.rx[1] - Rw.rx[0]), ry = rx * Rw.ry, x = -200 + rand(S, j, i, 4) * 400 + Rw.drift * (age - L / 2);
      out.push({ x, h: ry * g * (0.6 + 0.4 * rand(S, j, i, 5)), rx: rx * (0.8 + 0.2 * g) });
    }
    return out;
  });
}
// sheet lightning: light that swells inside the clouds with no bolt to see, twice a loop
function sheetAt(t, D) {
  const q = t / D;
  const ev = (t0) => {
    const a = ((q - t0 + 1) % 1) * D;
    if (a < 0 || a > 0.9) return 0;
    const p1 = Math.exp(-(((a - 0.08) / 0.05) ** 2)), p2 = Math.exp(-(((a - 0.3) / 0.09) ** 2)), tail = a > 0.3 ? Math.exp(-(a - 0.3) * 6) * 0.5 : 0;
    return Math.min(1, 0.7 * p1 + p2 + tail) * (Math.floor(a * 30) % 3 === 1 ? 0.75 : 1);
  };
  return { a: ev(0.42), b: ev(0.9) };
}
function deck(p, TH, t, S, front, srcs) {
  const C = TH.C, FH = TH.FH, ROWS = front ? RFRONT(FH) : RBACK(FH), ROLLS = rolls(front ? S * 4 + 2 : S * 3 + 1, t, TH, ROWS);
  const F = field(S * 3 + 1 + (front ? 1 : 0), 256, 128), drift = (256 * (front ? 3 : 2) * t) / TH.D, mo = Math.cos((Math.PI * t) / TH.D) ** 2;
  const litAt = (x, y) => {
    let L = 0;
    for (const [sx, sy, rad, k] of srcs) {
      const d = Math.hypot(x - sx, (y - sy) * 1.5) / rad;
      if (d < 1) L += k * (1 - d) * (1 - d);
    }
    return Math.min(1, L);
  };
  const yLo = front ? -118 : -108;
  rows(p, metaOf(), -170, yLo, (y, R) => {
    for (let i = 0; i < 320; i++) {
      const cx = i - 160 + 0.5;
      let low = -170, hit = -1, dBest = 0, bBest = 0;
      // the column's place in the rows: which curtain it's inside, how far above that curtain's base
      for (let j = 0; j < ROWS.length; j++) {
        const Rw = ROWS[j];
        const und = (sample(F, cx * 0.55 + j * 91, 3) * mo + sample(F, cx * 0.55 + j * 91, 60) * (1 - mo) - 0.5) * 2;
        const c = Rw.base + 7 * und + Rw.wob * 2 * (sample(F, cx * 1.8 + j * 61 - drift * 0.5, 20 + j * 17) - 0.5);
        let bump = 0;
        for (const b of ROLLS[j]) {
          const dx = (cx - b.x) / b.rx;
          if (dx * dx < 1) bump = Math.max(bump, b.h * Math.sqrt(1 - dx * dx));
        }
        const y1 = c + bump;
        if (y < y1 && y >= Rw.base - 26) { hit = j; dBest = y1 - y; bBest = bump; break; }
        if (y1 > low) low = y1;
      }
      if (hit < 0) continue;
      const Rw = ROWS[hit], tone = Rw.tone, th = bayer(cx, y);
      const Lv = litAt(cx, y);
      let ti;
      if (dBest < 1) ti = tone[3];
      else if (dBest < 2 + bBest * 0.25 + th * 2) ti = tone[2];
      else if (dBest < 6 + bBest * 0.4 + th * 3) ti = tone[1];
      else ti = tone[0] + (sample(F, cx * 0.9 + hit * 77 - drift * (0.6 - hit * 0.12), y * 1.7 + hit * 31) > 0.6 ? 1 : 0);
      let c = C[Math.max(0, Math.min(7, Lv > 0.02 ? ti + Math.round(Lv * (dBest < 1 ? 3.4 : 2.6)) : ti))];
      let a = front ? 0.82 : 0.95;
      R.c[i] = c; R.a[i] = a; R.b[i] = 1;
      if (dBest < 1.2) { R.l[i] = C[5]; R.k[i] = 0.07 + Lv * 0.1; }
      else if (Lv > 0.05) { R.l[i] = C[6]; R.k[i] = Lv * 0.16; }
    }
  });
}

// the wind itself: long streaks crossing the whole scene, fast, sparse — far ones dim, near ones
// with a bright head, so the air visibly rushes past the funnel
function wind(q, t, S, TH, near) {
  const C = TH.C, sd = S * 27 + near;
  trips(t, TH.D, Math.round((near ? 14 : 22)), sd, 3, 5, (u, k, m, i) => {
    const j = wrap(k, m), R = (n) => rand(sd, i, j, n);
    const y = -172 + R(1) * 176;
    const x = -190 + 380 * u, L = (8 + R(2) * 16) * (near ? 1.3 : 1);
    if (y > 4) return;
    const c = near ? C[5] : C[3];
    q.line(x - L, y, x, y, c, near ? 0.75 : 0.4);
    if (near) q.px(x, y, C[6]);
  });
}

// the crown lights up from inside twice a loop, and once or twice a loop a bolt strikes round the
// funnel: a jagged tree from the cloud base to the ground beside it
function flashAt(t, D) {
  const q = t / D;
  return Math.max(0, 1 - Math.abs(q - 0.3) / 0.025) + 0.6 * Math.max(0, 1 - Math.abs(q - 0.36) / 0.015);
}
const STRIKE_T = [0.55, 0.8];
function strikeAt(t, D) {
  for (const t0 of STRIKE_T) {
    const a = (t / D - t0 + 1) % 1;
    if (a < 0.03) return 1 - a / 0.03;
    if (a >= 0.05 && a < 0.075) return (1 - (a - 0.05) / 0.025) * 0.7;
  }
  return 0;
}
// a stroke, after the thunderstorm's: a violet sheath, a pale body, a white-hot core two pixels
// wide at the peak, light all along the channel — far heftier than a 1 px polyline
function stroke(q, paths, k, V) {
  for (const pass of [0, 1, 2])
    for (const p of paths) {
      const trunk = p.w >= 1;
      if (!trunk && (k < 0.4 || (pass === 0 && p.w < 0.5))) continue;
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, ay] = p.pts[i], [bx, by] = p.pts[i + 1], l = Math.max(1, Math.hypot(bx - ax, by - ay));
        for (let d = 0; d <= l; d += 0.5) {
          const x = ax + ((bx - ax) * d) / l, y = Math.max(-169, ay + ((by - ay) * d) / l);
          if (pass === 0) q.circle(x, y, trunk ? (k > 0.6 ? 2.3 : 1.7) : 1.2, k > 0.6 ? V[2] : V[1]);
          else if (pass === 1) q.circle(x, y, trunk ? (k > 0.6 ? 1.4 : 0.9) : 0.6, trunk ? V[4] : V[3]);
          else if (trunk) {
            q.px(x, y, k > 0.3 ? WHITE : V[4]);
            if (k > 0.85) q.px(x + 1, y, WHITE);
          } else if (p.w > 0.4 && k > 0.6) q.px(x, y, V[4]);
        }
        if (pass === 0 && i % 3 === 0) q.glow(ax, ay, trunk ? 18 : 8, V[3], (trunk ? 0.5 : 0.3) * k * p.w);
      }
    }
}
// once or twice a loop a forked bolt strikes down beside the funnel, its root disappearing up
// into the cloud deck
function strikes(q, t, S, TH, g) {
  for (let b = 0; b < STRIKE_T.length; b++) {
    const a = (t / TH.D - STRIKE_T[b] + 1) % 1;
    const f = a < 0.03 ? 1 - a / 0.03 : a >= 0.05 && a < 0.075 ? (1 - (a - 0.05) / 0.025) * 0.7 : 0;
    if (f <= 0) continue;
    const R = rng(S * 31 + 3 + b, Math.floor((t / TH.D) * 7)), side = b % 2 ? 1 : -1;
    const x0 = g.ax(0.9) + side * (30 + R.range(0, 26)), x1 = x0 + R.range(-16, 16);
    const paths = tree(R, x0, -TH.FH + 6, x1, 0, 0.26, 0.2);
    stroke(q, paths, f, TH.V);
    q.glow(x0, -TH.FH + 4, 60, TH.V[2], 0.5 * f);
    q.glow(x1, -2, 46, TH.V[3], 0.45 * f);
  }
}

/**
 * Build a tornado wallpaper's drawBack/draw from a theme:
 *   D, FH          loop seconds; funnel height (px up from the floor at y 0)
 *   sky(p, t, S)   paints the whole sky (behind everything)
 *   C, Dst         funnel wind-band colours (8) and dust/spray colours (5)
 *   ground(q, t, S)   the floor and what's on it (drawn once per frame in drawBack)
 *   groundFront(q, t, S)  optional bright foreground sparkle, drawn in draw
 *   debris(q, g, t, S, back)  what the wind picks up, back and front passes
 *   bolt, boltHot  lightning colours; footGlow the pool of light at the foot
 */
export function makeTornado(TH) {
  TH_D = TH.D;
  TH.C = TH.C.map(hex);       // themes may pass hex strings; the painter wants packed colours
  TH.Dst = TH.Dst.map(hex);
  const W = hex("#ffffff"), K = hex("#000000"), B0 = hex(TH.bolt);
  // the bolt palette, storm-style: a dark violet sheath up to a white-hot core, tinted per theme
  TH.V = [mix(B0, K, 0.55), mix(B0, K, 0.28), B0, mix(B0, W, 0.45), mix(B0, W, 0.72), TH.boltHot];
  TH.footGlow = hex(TH.footGlow);
  const api = {
    drawBack(p, t, o) {
      const q = clip(p, metaOf()), S = o.seed, C = TH.C, g = geo(TH, t), f = flashAt(t, TH.D);
      const sh = sheetAt(t, TH.D);
      // what lights the clouds from inside: the crown flash, the strike roots, the sheet flashes
      const srcs = [[g.ax(1), -TH.FH + 2, 150, f]];
      for (let b = 0; b < STRIKE_T.length; b++) {
        const a = (t / TH.D - STRIKE_T[b] + 1) % 1;
        if (a < 0.09) srcs.push([g.ax(0.9) + (b % 2 ? 1 : -1) * 42, -TH.FH + 4, 120, strikeAt(t, TH.D)]);
      }
      if (sh.a > 0) srcs.push([-96, -TH.FH + 10, 110, sh.a]);
      if (sh.b > 0) srcs.push([128, -TH.FH - 2, 90, sh.b]);
      TH.sky(p, t, S);
      skirt(p, TH.Dst, g, t, S * 5 + 1, true);
      crown(p, C, g, t, S * 7 + 2, true, f);
      bands(p, C, g, t, S * 3 + 5, true);
      TH.debris(p, q, g, t, S, true);
      body(p, TH, g, t, S);
      deck(p, TH, t, S, false, srcs); // the BACK cloud layer: the funnel's top vanishes into it
      wind(q, t, S, TH, 0);
      TH.fall && TH.fall(p, q, t, S, 0);
      TH.ground(p, q, t, S);
      strikes(q, t, S, TH, g);
      p.glow(g.ax(0), -2, 30, TH.footGlow, 0.12);
    },
    draw(p, t, o) {
      const q = clip(p, metaOf()), S = o.seed, C = TH.C, g = geo(TH, t), f = flashAt(t, TH.D);
      const sh = sheetAt(t, TH.D);
      const srcs = [[g.ax(1), -TH.FH + 2, 150, f]];
      if (sh.a > 0) srcs.push([-96, -TH.FH + 10, 110, sh.a]);
      if (sh.b > 0) srcs.push([128, -TH.FH - 2, 90, sh.b]);
      bands(p, C, g, t, S * 3 + 5, false);
      crown(p, C, g, t, S * 7 + 2, false, f);
      deck(p, TH, t, S, true, srcs); // the FRONT cloud layer, translucent, drifting across the funnel
      wind(q, t, S, TH, 1);
      TH.fall && TH.fall(p, q, t, S, 1);
      skirt(p, TH.Dst, g, t, S * 5 + 1, false);
      TH.debris(p, q, g, t, S, false);
      TH.groundFront && TH.groundFront(p, q, t, S);
      // the pale column of light, and the crown's own lightning at the cloud base
      p.glowLine(g.ax(0.1), -TH.FH * 0.1, g.ax(1), -TH.FH * 0.9, 26, C[5], 0.08);
      if (f > 0.05) {
        const R = rng(S, 99, Math.floor((t / TH.D) * 7)), paths = tree(R, g.ax(1) - 18, -TH.FH - 2, g.ax(1) + 16, -TH.FH + 8, 0.3, 0.4);
        stroke(q, paths, f, TH.V);
        p.glow(g.ax(1), -TH.FH + 6, 60, TH.V[2], 0.5 * f);
      }
    },
  };
  return api;
}

// each wallpaper file sets its own meta; the shared code needs it for clip()
let _meta = null;
export function setMeta(m) { _meta = m; }
function metaOf() { return _meta; }
