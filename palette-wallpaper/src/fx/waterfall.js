// A procedurally generated waterfall valley — no image assets, every pixel computed. The method:
// fBm noise fields shape the land (fractal ridges for the ranges, a threshold on the field deciding
// rock, water or vegetation), the scene is layered back to front with the amplitude growing toward
// the viewer, and the pixel-art look comes from rendering at 320x200 with an ordered ramp.
//
// What moves: the falls are a vertical scroll of noise through a white ramp (the classic pixel
// waterfall), foam and mist live where each fall lands, the pool carries drifting shimmer, the
// foreground tree sways only in its twigs, and the grass rolls like water. All pure functions of t.
import { clamp, mix, rand, hex, tileNoise, smooth, TAU } from "../../../src/core/index.js";
import { clip, rows, pass, field, sample, trips, wave } from "../../../src/fx/weather/_lib.js";
import { draw as sunburstDraw } from "../../../src/fx/holy/sunburst.js";
import { GOLD } from "../../../src/fx/holy/_lib.js";

export const meta = {
  name: "Waterfall valley",
  desc: "A procedurally grown waterfall valley: fractal ridges piling toward the viewer, white falls scrolling down the cliffs, foam and mist at their feet, a shimmering pool and a leaning tree.",
  tags: ["weather", "scene", "waterfall", "river", "forest", "nature", "procedural", "ambient", "loop"],
  size: [320, 200],
  origin: [160, 190],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    density: 1,
    seed: 4,
  },
};

const D = 10;
const W = 320, TOP = -200, BOT = 0;
const HZ = -34;                    // the pool's waterline, where the cliffs meet the water

// the palette: a clear blue morning sky, hazy ranges, dark teal cliffs, white water, deep green
// foreground — plus the sun and its light
const C = {
  sky: [hex("#5a8cc8"), hex("#a8cce8"), hex("#dceef8")],   // deep blue up top → pale blue at the horizon
  far: hex("#a4b8a8"), farDark: hex("#84a08e"),
  far2: hex("#c2d2c4"),                                    // the newest, farthest range, almost haze
  mid: hex("#5e7a70"), midDark: hex("#48605a"),
  rock: hex("#2a4640"), rockDark: hex("#1d332f"), rockLit: hex("#3e5c54"),
  fall: [hex("#9cc4c0"), hex("#c8e0dc"), hex("#eef6f4"), hex("#ffffff")],
  foam: hex("#f4faf8"), mistC: hex("#e8eef0"),
  pool: hex("#24403a"), poolDark: hex("#16302c"), glint: hex("#b8d4cc"),
  sun: hex("#fff4cc"), sunGlow: hex("#ffcf80"), sunPath: hex("#ffdf9a"),
  cloud: hex("#f8f9f4"), cloudShade: hex("#dbe4ee"),
  tree: hex("#14241e"), treeDark: hex("#0c1814"), leaf: hex("#1e362c"),
  grass: hex("#182a22"),
};

// fBm fields: FM shapes the ridges, FR the rock texture, FW the falling water, FG the grass
const FM = field(41, 256, 128, [4, 8, 16, 32]);
const FR = field(53, 256, 128, [5, 10, 20]);
const FW = field(67, 256, 128, [6, 12, 24]);
const FG = field(79, 256, 128, [4, 8, 16]);
const q2 = (p) => clip(p, meta);

// the falls, in scene coordinates: one modest fall on the right face, fed by the winding stream
const FALLS = [
  { x: 70, w: 20, y0: -72, y1: -30 },   // the fall, low on the cliff, a third of its old size
];
const FOAM_Y = HZ - 6;

// ---- land: fBm ridges piling toward the viewer, amplitude growing with proximity --------------------
// broad strokes (low frequency) so the silhouettes read as real mountain ranges, not static
function ridgeRow(x, i, base, amp) {
  // ridged fBm: 1 - |2n-1| folds the noise into sharp alpine crests, a second octave roughens them
  const n1 = sample(FM, x * 0.14 + i * 33, i * 17);
  const n2 = sample(FM, x * 0.32 + i * 57, i * 23 + 9);
  const crest = 1 - Math.abs(2 * n1 - 1);
  return base - (0.08 + 0.92 * (crest * 0.78 + n2 * 0.22)) * amp;
}
const RIDGES = [
  { base: -128, amp: 44, c: hex("#c8d6cc"), cDark: hex("#b8cac2") },  // farthest, almost haze
  { base: -112, amp: 54, c: hex("#96b0a4"), cDark: hex("#84a094") },
  { base: -96, amp: 62, c: hex("#5e7c72"), cDark: hex("#4c665e") },
  { base: -80, amp: 68, c: hex("#33504a"), cDark: hex("#283f3a") },
];
// the sun: low over the ranges, mid-right; the Sunburst sits in the sky strip above the crests,
// its rays running down behind the mountains
const SUN = { x: 66, y: -165 };
// per-column ridge tops, baked once (static)
const RTOP = [];
for (let i = 0; i < W; i++) {
  const x = i - 160 + 0.5;
  RTOP.push(RIDGES.map((R) => ridgeRow(x, RIDGES.indexOf(R), R.base, R.amp)));
}
// the cliff band: a dark wall the falls hang on, its top edge eaten by noise
const CLIFF = new Float32Array(W);
for (let i = 0; i < W; i++) {
  const x = i - 160 + 0.5;
  CLIFF[i] = -96 - sample(FM, x * 0.015 + 70, 9) * 30 - 8 * Math.sin(x * 0.02 + 1);
}

// ---- the painted layers ------------------------------------------------------------------------------
// the sky alone: the sunrise gradient, nothing else — the Sunburst and the ranges stack on top
function skyRows(p) {
  rows(p, meta, TOP, HZ, (y, R) => {
    const k = clamp((y - TOP) / (HZ - TOP), 0, 1);
    const base = mix3(C.sky[0], C.sky[1], C.sky[2], Math.pow(k, 1.6));
    for (let i = 0; i < W; i++) R.c[i] = base;
  });
}

// the land: ridge silhouettes over the sky, then the cliff band the falls hang on
function land(p) {
  rows(p, meta, TOP, HZ, (y, R) => {
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      // four ridge silhouettes: pick the NEAREST one covering this pixel, each fading into the
      // haze behind it
      let c = 0;
      for (let r = RIDGES.length - 1; r >= 0; r--) {
        if (y > RTOP[i][r]) {
          const d = y - RTOP[i][r];
          c = d < 3 ? mix(RIDGES[r].c, C.sky[1], 0.35) : RIDGES[r].cDark;
          break;
        }
      }
      // the cliff wall takes over below its crest
      if (y > CLIFF[i]) c = y < CLIFF[i] + 3 ? C.rockLit : C.rock;
      R.c[i] = c;
    }
  });
}

function scene(p, t) {
  skyRows(p);
  // the rising sun: the engine's own Sunburst, half-hidden behind the ranges
  // (place() anchors in frame space, so the scene-space sun y needs the origin added)
  const q = q2(p);
  q.place(SUN.x, meta.origin[1] + SUN.y, false, 0);
  sunburstDraw(q, t, { palette: GOLD, rays: 6, seed: 3 });
  land(p);

  // rock texture over the cliff band; the wall darkens right beside each fall, so the white water
  // pops off it
  pass(p, meta, -130, HZ, (x, y, o) => {
    if (y < CLIFF[Math.max(0, Math.min(W - 1, Math.floor(x) + 160))]) return;
    for (const f of FALLS) if (x > f.x - 2 && x < f.x + f.w + 2 && y > f.y0 - 2 && y < f.y1) return;
    const n = sample(FR, x * 0.09, y * 0.09);
    let c = n > 0.62 ? C.rockLit : n < 0.34 ? C.rockDark : C.rock;
    for (const f of FALLS) {
      const d = x < f.x ? f.x - x : x > f.x + f.w ? x - (f.x + f.w) : 0;
      if (d > 0 && d < 5 && y > f.y0) { c = C.rockDark; break; }   // contact shadow
    }
    o.c = c;
  });

  // the pool: the falls' reflections wobble in it, ripple bands slide, foam rings the landings
  rows(p, meta, HZ, BOT, (y, R) => {
    const k = (y - HZ) / (BOT - HZ);
    const drift = (t / D) * (2 + k * 3);
    const ripple = 0.5 + 0.5 * Math.sin(y * 0.55 - t * 2.6);
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5;
      let c = k < 0.25 ? mix(C.rockDark, C.pool, k * 3) : mix(C.pool, C.poolDark, (k - 0.25) * 1.2);
      // drifting shimmer: long faint dashes, faster nearer the viewer
      const n = sample(FW, x * 0.05 - drift, y * 0.5 + 8);
      if (n > 0.6) c = mix(c, C.glint, (n - 0.6) * 1.8 * (1 - k * 0.4));
      // the reflection of each fall: a wobbling bright smear below it, fading with distance
      for (const f of FALLS) {
        const cx = f.x + f.w / 2 + Math.sin(y * 0.35 + t * 2.2 + f.x) * 2.5;
        const halfw = f.w * 0.42 * (1 - k * 0.35);
        const dx = Math.abs(x - cx);
        if (dx < halfw) {
          const rn = sample(FW, (x + Math.sin(y * 0.2) * 4) * 0.35, (y - t * 5) * 0.12);
          const a = (1 - dx / halfw) * (0.75 - k * 0.4) * (0.4 + 0.6 * rn);
          if (a > 0.05) c = mix(c, C.fall[a > 0.5 ? 2 : 1], Math.min(0.85, a));
        }
      }
      // ripple bands catch a little light
      if (ripple > 0.72) c = mix(c, C.glint, 0.12 * (1 - k * 0.5));
      // the sun path: a warm glitter column running down the pool from the sun
      const spx = SUN.x + Math.sin(y * 0.3 + t * 1.7) * 3.5 + Math.sin(y * 0.11 - t) * 2;
      const sdx = Math.abs(x - spx);
      if (sdx < 9) {
        const g2 = (1 - sdx / 9) * (0.35 + 0.4 * sample(FW, x * 0.3 - drift, y * 0.6 + 3)) * (1 - k * 0.45);
        if (g2 > 0.06) c = mix(c, C.sunPath, Math.min(0.8, g2));
      }
      R.c[i] = c;
    }
  });
}

const mix3 = (a, b, c, k) => (k < 0.5 ? mix(a, b, k * 2) : mix(b, c, (k - 0.5) * 2));

// ---- morning clouds ---------------------------------------------------------------------------------
// four clouds parked high along the top: no drifting — each morphs in place, puffs swelling and
// sinking clearly on their own clocks, looping seamlessly. They pass behind the far range.
const CLOUDS = [
  { x: -120, y: -192, puffs: [[0, 0, 9], [8, 2, 7], [-8, 1, 6], [3, -3, 5]], off: 0.1 },
  { x: -20, y: -186, puffs: [[0, 0, 11], [10, 2, 8], [-9, 2, 7], [4, -3, 6], [-4, -2, 5]], off: 0.45 },
  { x: 96, y: -190, puffs: [[0, 0, 8], [7, 1, 6], [-7, 2, 5]], off: 0.72 },
  { x: 152, y: -180, puffs: [[0, 0, 7], [6, 1, 5], [-6, 1, 4], [1, -2, 4]], off: 0.9 },
];
function clouds(p, t) {
  const q = q2(p);
  for (const cl of CLOUDS) {
    const cx = cl.x, cy = cl.y;
    for (const [ox, oy, r] of cl.puffs) {
      // each puff morphs clearly: its radius swings ~±25% and it bobs up and down, on a slow loop
      const ph2 = rand(cl.off * 100 | 0, ox * 7 + oy, 9) * TAU;
      const breathe = 0.75 + 0.25 * Math.sin((TAU * t) / D * (1.6 + (r % 3)) + ph2);
      const sink = Math.sin((TAU * t) / D * 1.3 + ph2 * 1.7) * 2.2;
      const rx = r * 1.3 * breathe, ry = r * 0.72 * (2 - breathe);
      for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++)
        for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) {
          const d2 = (xx / rx) * (xx / rx) + (yy / ry) * (yy / ry);
          if (d2 > 1) continue;
          const px = cx + ox + xx, py = cy + oy + yy + sink;
          const col = Math.floor(px) + 160;
          if (col < 0 || col >= W) continue;
          if (py > RTOP[col][0]) continue;                       // behind the far range
          const n = sample(FR, (cx + ox + xx) * 0.35, (cy + oy + yy) * 0.35);
          if (n < 0.24) continue;                                // ragged edges
          q.px(px, py, yy > ry * 0.25 ? C.cloudShade : C.cloud);
        }
      // a bright rim on the sun-facing side (the sun sits right of centre)
      if (cx + ox < SUN.x + 30)
        for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++)
          for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) {
            const d2 = (xx / rx) * (xx / rx) + (yy / ry) * (yy / ry);
            if (d2 > 0.92 || d2 < 0.55) continue;
            const px = cx + ox + xx, py = cy + oy + yy + sink;
            if (xx < 0) continue;
            const col = Math.floor(px) + 160;
            if (col < 0 || col >= W || py > RTOP[col][0]) continue;
            q.px(px, py, C.sun, 0.5);
          }
    }
  }
}

// ---- the upstream stream ------------------------------------------------------------------------------
// a winding little river comes down from the high valley and feeds the fall: it meanders across
// the cliff face, thickening as it nears the lip — and it FADES IN from its source, so you feel
// where the water comes from without a hard cut
const STREAM_FROM = { x: 128, y: -109 };   // where it emerges (fades in from nothing) — half its old length
function stream(p, t) {
  const q = q2(p), f = FALLS[0];
  const lipY = f.y0 + 2, lipX = f.x + f.w / 2;
  for (let y = STREAM_FROM.y; y <= lipY; y++) {
    const k = (y - STREAM_FROM.y) / (lipY - STREAM_FROM.y);          // 0 at the source, 1 at the lip
    const fade = Math.min(1, k * 4);                                  // it fades in from its source
    // meander: a lazy sine sweep that lands exactly on the lip's centre
    const x = STREAM_FROM.x + (lipX - STREAM_FROM.x) * k + Math.sin(y * 0.11 + 1.2) * (1 - k) * 26;
    // thin upstream, flaring wide only as it nears the lip, so it feeds the fall's full width
    const w2 = 0.7 + 1.2 * k + 7.5 * k * k * k;
    const flow = Math.sin(y * 0.8 - t * 5) * 0.5 + 0.5;               // the flow shimmer
    for (let dx = -Math.ceil(w2); dx <= Math.ceil(w2); dx++) {
      const a = fade * (1 - Math.abs(dx) / (w2 + 0.5)) * (0.5 + 0.4 * flow);
      if (a < 0.1) continue;
      q.dot(x + dx, y, dx === 0 && flow > 0.55 ? C.fall[3] : C.fall[1], a);
    }
    // a bright bead runs down it now and then, the current you can follow
    if (k > 0.25) {
      const bead = ((t / D) * 2 + y * 0.02) % 1;
      if (bead < 0.12) q.dot(x + Math.sin(y + t * 3), y, C.fall[3], 0.8 * fade);
    }
  }
  // the lip: where the stream tips over, water glows brightest
  for (let dx = -f.w / 2 + 1; dx < f.w / 2 - 1; dx++) {
    q.dot(lipX + dx, lipY, C.fall[3], 0.85);
    q.dot(lipX + dx, lipY + 1, C.fall[2], 0.6);
  }
}

// ---- light through the tree -----------------------------------------------------------------------
// shafts of sunlight fall from the canopy onto the pool: soft warm beams angled down-right, and
// bright patches where they land on the water
function lightShafts(p, t) {
  const q = q2(p);
  const WARM = hex("#ffe8b0");
  for (let s = 0; s < 3; s++) {
    const x0 = -104 + s * 16, slant = 10 + s * 5, w0 = 4 + (s % 2) * 3;
    const flick = 0.75 + 0.25 * Math.sin((TAU * t) / D * (0.8 + s * 0.35) + s * 2.2);
    for (let i = 0; i <= 30; i++) {
      const y = -28 + i, u = i / 30;
      const cx = x0 + slant * u, w2 = w0 * (1 + u * 0.8);
      for (let dx = -Math.ceil(w2); dx <= Math.ceil(w2); dx++) {
        const a = (1 - Math.abs(dx) / (w2 + 0.5)) * 0.16 * flick * Math.sin(Math.PI * Math.min(1, u * 1.2));
        if (a > 0.02) q.blend(cx + dx, y, WARM, a);
      }
    }
    // the patch of light where the shaft lands on the pool
    const lx = x0 + slant, ly = -6 + s * 3;
    for (let j = 0; j < 26; j++) {
      const px = lx + (rand(59, s * 31 + j, 1) - 0.5) * 26, py = ly + (rand(59, s * 31 + j, 2) - 0.5) * 8;
      const g = 0.25 + 0.55 * Math.abs(Math.sin((TAU * t) / D * (1 + (j % 3)) + j));
      q.dot(px, py, j % 3 ? C.sunPath : C.sun, g * flick);
    }
    q.glow(lx, ly, 26, C.sunGlow, 0.2 * flick);
  }
}

// ---- the falls: the material waterfall's sheet, adapted to the cliff ---------------------------------
// 1px lanes: the far side of the sheet is dark and see-through (sky shows between strands), the
// front lanes carry white dashes sliding down and stretching as the water speeds up (√depth); the
// top is glassy, the lower third splits into strands fanning apart with gaps, each lit down its
// left edge. Texture runs in fall time, so the loop never seams.
function falls(p, t) {
  const ph = t / D;
  for (const f of FALLS) {
    const HW = f.w / 2, H0 = f.y1 - 2 - f.y0;
    rows(p, meta, f.y0, f.y1 - 2, (y, R) => {
      for (let X = -HW - 8; X <= HW + 8; X++) {
        const x = f.x + HW + X + 0.5;
        const i = Math.max(0, Math.min(W - 1, Math.floor(x) + 160));
        const top = CLIFF[i] + 1;
        if (y < top) continue;
        const d = y - top + 0.5, H = f.y1 - 2 - top, v = clamp(d / H, 0, 1), s = Math.sqrt(d + 3);
        const hw0 = HW + 3.2 * Math.pow(v, 1.6), split = smooth(0.56, 0.95, v), glass = 1 - smooth(4, 24, d);
        const wl = tileNoise(2, s * 1.4 - ph * 12, 0, 12, 31) * (0.4 + 1.8 * v);
        const wr = tileNoise(11, s * 1.4 - ph * 12, 0, 12, 31) * (0.4 + 1.8 * v);
        const fan = split > 0 ? tileNoise(3, s * 0.8 - ph * 4, 0, 4, 92) * 1.6 : 0;
        const sd = s * 1.5 - ph * 20, sb = s * 0.45 - ph * 6;
        const x0 = X + 0.5, hw = hw0 + (x0 < 0 ? wl : wr), ax = Math.abs(x0);
        if (ax > hw) continue;
        const e = ax / hw;
        let edge = false;
        if (split > 0) {
          const fr = ((((x0 / (1 + 0.22 * split) + fan + 64) / 5.4) % 1) + 1) % 1;
          if (fr > 1 - 0.46 * split) continue;
          edge = fr < 0.2;
        }
        const dash = tileNoise(X * 1.618 + 0.31, sd, 0, 20, 40);
        const ii = Math.max(0, Math.min(W - 1, Math.floor(x) + 160));
        if (rand(X, 100) < 0.48 && e < 0.86 && !edge) {
          R.c[ii] = dash > 0.45 ? C.fall[3] : glass > 0.5 ? C.fall[2] : C.fall[1];
          R.a[ii] = dash > 0.45 ? 0.7 : 0.42 + 0.15 * v;
          R.b[ii] = 1;
          continue;
        }
        const broad = tileNoise(Math.floor((x0 + 40) / 3) * 2.7, sb, 0, 6, 47);
        let b = -0.34 + 0.46 * v + 0.3 * broad - glass * 0.5 + 0.35 * smooth(0.7, 1, e) * (x0 < 0 ? 1 : 0.3) - (x0 > 0 ? 0.12 * e : 0) + (edge ? 0.3 : 0);
        if (dash > 0.2 - 0.22 * v) b += 0.36 + 0.7 * (dash - 0.2);
        if (b > -0.2) {
          R.c[ii] = b > 0.62 ? C.fall[3] : b > 0.34 ? C.fall[2] : b > 0.08 ? C.fall[1] : C.fall[0];
          R.a[ii] = 1;
          R.b[ii] = 0;
          if (b > 0.55) { R.l[ii] = C.fall[2]; R.k[ii] = 0.06; }
        } else {
          R.c[ii] = C.fall[1];
          R.a[ii] = 0.8;
          R.b[ii] = 1;
        }
      }
    });
    // strands peel off the edges and fall free
    const q = q2(p);
    for (let i = 0; i < 16; i++) {
      const R0 = rand(77, i, 1), R1 = rand(77, i, 2), R2 = rand(77, i, 3);
      const life = 0.4, age = ((t / D) + R0 * life) % life, k = age / life;
      const side = R1 < 0.5 ? -1 : 1, d0 = 14 + R2 * H0 * 0.7;
      const d = d0 + 50 * age + 260 * age * age;
      if (d > H0 - 6) continue;
      const hw = HW + 3.2 * Math.pow(d / H0, 1.6);
      const x = f.x + HW + side * (hw + 1.5 + age * (6 + R0 * 10)), y = f.y0 + d, len = 2 + 6 * k;
      q.line(x, y - len, x, y, (u) => (u > 0.7 ? C.fall[3] : C.fall[1]), 1 - k * 0.5);
    }
  }
}

// ---- foam and mist where the falls land ----------------------------------------------------------------
function foamMist(p, t, dn) {
  const q = q2(p);
  for (const f of FALLS) {
    // foam: a jittering bright band on the pool right under the fall
    const nf = Math.round(f.w * 1.7 * dn);
    for (let i = 0; i < nf; i++) {
      const x = f.x - 4 + rand(31, i, 1) * (f.w + 8);
      const y = FOAM_Y + 2 + rand(31, i, 2) * 5;
      const j = wave(t, D, 3 + Math.floor(rand(31, i, 3) * 2), rand(31, i, 4) * TAU);
      if (j < -0.3) continue;
      q.dot(x, y + j, C.foam, 0.55 + 0.45 * j);
    }
    // mist: puffs that rise off the splash and fade, drifting sideways
    const np = Math.round(f.w * 0.6 * dn);
    for (let i = 0; i < np; i++) {
      const s = (t / D) * (1 + Math.floor(rand(37, i, 1) * 2)) + rand(37, i, 2);
      const u = s % 1;
      const x = f.x - 5 + rand(37, i, 3) * (f.w + 10) + Math.sin(u * TAU + i) * 4;
      const y = FOAM_Y - u * 26;
      const r = 1.5 + u * 3.5;
      const a = Math.sin(Math.PI * u) * 0.3;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          q.dot(x + dx, y + dy, C.mistC, a);
        }
      if (u < 0.3) q.light(x, y, C.mistC, 0.07 * (1 - u / 0.3));
    }
  }
}

// ---- the pool's foreground glitter ---------------------------------------------------------------------
function poolGlitter(p, t, dn) {
  const q = q2(p);
  const n = Math.round(60 * dn);
  for (let i = 0; i < n; i++) {
    const x = -180 + 380 * (((t / D) * (1 + Math.floor(rand(43, i, 1) * 2)) + rand(43, i, 2)) % 1);
    const y = HZ + 4 + rand(43, i, 3) * (BOT - HZ - 6);
    const L = 4 + rand(43, i, 4) * 10;
    const a = 0.25 + 0.5 * Math.pow(0.5 + 0.5 * wave(t, D, 1 + Math.floor(rand(43, i, 5) * 2), rand(43, i, 6) * TAU), 2);
    q.line(x, y, x + L, y, C.glint, a);
  }
}

// ---- birds ---------------------------------------------------------------------------------------------
// a small flock crossing the sky once a loop: two flapping wing strokes each, bobbing on the wind
function birds(p, t) {
  const q = q2(p), BIRD = C.treeDark;
  for (let i = 0; i < 5; i++) {
    const speed = 1 + Math.floor(rand(101, i, 1) * 2);         // whole crossings a loop
    const x = -170 + 340 * (((t / D) * speed + rand(101, i, 2)) % 1);
    const y = -158 + rand(101, i, 3) * 46 + Math.sin(t * TAU * (1 + (i % 2)) / D + i) * 3;
    const flap = Math.sin((TAU * (6 + i) * t) / D + rand(101, i, 4) * TAU);
    const w = 2.2 + rand(101, i, 5) * 1.4;
    // two wings: strokes that fold down as the flap swings
    const dy = flap * 1.6;
    q.line(x - w, y - dy * 0.5, x, y + dy * 0.4, BIRD);
    q.line(x, y + dy * 0.4, x + w, y - dy * 0.5, BIRD);
  }
}

// ---- the leaning tree -----------------------------------------------------------------------------------
// grown once per seed (the same recipe the reference photo wallpaper uses): a leaning trunk, forked
// limbs, twig lace and leaf clumps; only the twigs and clumps sway
function growTree(R, x, y, ang, len, w, depth, segs, clumps, twigs) {
  const n = depth === 0 ? 4 : 3;
  let cx = x, cy = y, a = ang;
  const pts = [[cx, cy]];
  for (let i = 1; i <= n; i++) {
    a += R.range(-0.18, 0.1);
    cx += Math.cos(a) * (len / n);
    cy += Math.sin(a) * (len / n);
    pts.push([cx, cy]);
  }
  const ph = R.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const u = (i + 1) / n;
    segs.push({ x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], w: Math.max(1, w * (1 - 0.55 * u)), sw: 0.2 + 0.8 * u, ph });
  }
  if (depth >= 3) {
    for (let j = 0; j < 3; j++) twigs.push({ x: cx, y: cy, a: a + R.range(-0.9, 0.9), l: 3 + R.range(0, 4), ph });
    if (depth >= 4) {
      for (let j = 0; j < 5; j++)
        clumps.push({ x: cx + R.range(-2.5, 2.5), y: cy + R.range(-2, 2), r: 2.5 + R.range(0, 3.5), ph: R.range(0, TAU), cyc: 1 + Math.floor(R.range(0, 2)), amp: 0.5 + R.range(0, 0.8) });
      return;
    }
  }
  for (let i = 0; i < 2; i++)
    growTree(R, cx, cy, a + (i ? 1 : -1) * R.range(0.45, 0.95), len * R.range(0.55, 0.72), w * 0.6, depth + 1, segs, clumps, twigs);
  if (depth === 0 && R.chance(0.5)) growTree(R, cx, cy, a + R.range(-0.3, 0.3), len * 0.55, w * 0.5, depth + 1, segs, clumps, twigs);
}

let TREE = null, TREE_SEED = -1;
function treeOf(seed) {
  if (TREE && TREE_SEED === seed) return TREE;
  const R = { range: (a, b) => a + rand(seed, Math.floor(a * 100 + b * 37), 3) * (b - a), chance: (p) => rand(seed, 1, 4) < p };
  const segs = [], clumps = [], twigs = [];
  // trunk: leans right out of the left edge, into the frame
  for (let i = 0; i < 4; i++)
    segs.push({ x0: -162 + i * 14, y0: 2 - i * 12, x1: -162 + (i + 1) * 14, y1: 2 - (i + 1) * 12, w: 16 - i * 3, sw: 0, ph: 0 });
  const limbs = [[-2.6, 30, 7], [-2.1, 34, 6], [-1.55, 36, 5.5], [-1.0, 32, 5], [-0.35, 28, 4.5]];
  for (const [a, l, w] of limbs)
    growTree(R, -118, -36, a + R.range(-0.1, 0.1), l, w, 0, segs, clumps, twigs);
  TREE = { segs, clumps, twigs };
  TREE_SEED = seed;
  return TREE;
}

function tree(p, t, seed) {
  const q = q2(p);
  const T = treeOf(seed);
  for (const s of T.segs) {
    const off = s.sw === 0 ? 0 : (wave(t, D, 2, s.ph) * 1.05 + wave(t, D, 3, s.ph * 1.4) * 0.3) * s.sw;
    if (s.w < 2.2) q.line(s.x0 + off, s.y0, s.x1 + off, s.y1, C.tree);
    else if (s.w < 4) {
      q.line(s.x0 + off, s.y0 - 0.7, s.x1 + off, s.y1 - 0.7, C.tree);
      q.line(s.x0 + off, s.y0 + 0.7, s.x1 + off, s.y1 + 0.7, C.tree);
    } else q.beam(s.x0 + off, s.y0, s.x1 + off, s.y1, s.w, C.tree);
  }
  for (const w of T.twigs) {
    const off = wave(t, D, 3, w.ph) * 1.3;
    q.line(w.x + off * 0.4, w.y, w.x + Math.cos(w.a) * w.l + off, w.y + Math.sin(w.a) * w.l, C.tree);
  }
  // leaf clumps: ragged stipples of dark green with a faint shimmer on top
  for (const c of T.clumps) {
    const dx = wave(t, D, c.cyc, c.ph) * c.amp;
    const cx = c.x + dx, cy = c.y;
    const rx = c.r * 1.25, ry = c.r * 0.8;
    for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++)
      for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) {
        const d2 = (xx / rx) * (xx / rx) + (yy / ry) * (yy / ry);
        if (d2 > 1) continue;
        if (sample(FR, (cx + xx) * 0.3, (cy + yy) * 0.3) < 0.3) continue;
        q.px(cx + xx, cy + yy, C.leaf);
      }
    for (let j = 0; j < 4; j++) {
      const a = rand(seed, Math.floor(c.x + 40 + j), 7) * TAU, r = c.r * (1.05 + rand(seed, j, 8) * 0.5);
      q.px(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 0.8, C.leaf);
    }
  }
}

// ---- the foreground --------------------------------------------------------------------------------------
// a dark grass strip the whole width, blades swaying; a few tall ones catch the sky
function foreground(p, t, dn) {
  const q = q2(p);
  rows(p, meta, BOT - 10, BOT, (y, R) => {
    for (let i = 0; i < W; i++) {
      const n = sample(FG, (i - 160) * 0.2, y * 0.5);
      R.c[i] = n > 0.5 ? C.tree : C.grass;
    }
  });
  const n = Math.round(900 * dn);
  for (let i = 0; i < n; i++) {
    const x = -158 + rand(91, i, 1) * 316, y = BOT - 1 - rand(91, i, 2) * 8;
    const h = 2 + Math.floor(rand(91, i, 3) * 4);
    const sw = wave(t, D, 2 + Math.floor(rand(91, i, 4) * 2), rand(91, i, 5) * TAU) * (0.3 + (y - (BOT - 9)) * 0.12);
    const c = rand(91, i, 6) < 0.3 ? C.leaf : C.grass;
    for (let k2 = 0; k2 < h; k2++) q.px(x + sw * (k2 / h), y - k2, c);
  }
  // a few tall blades in silhouette against the pool
  for (let i = 0; i < 60; i++) {
    const x = -158 + rand(93, i, 1) * 316, y = BOT - rand(93, i, 2) * 3;
    const len = 5 + rand(93, i, 3) * 9;
    const sw = wave(t, D, 2 + Math.floor(rand(93, i, 4) * 2), rand(93, i, 5) * TAU) * 0.7;
    q.line(x, y, x + sw, y - len, C.treeDark);
  }
}

// ---- fireflies --------------------------------------------------------------------------------------------
function fireflies(p, t, dn) {
  const q = q2(p);
  const GLOWC = hex("#c8e090");
  const n = Math.round(10 * dn);
  for (let i = 0; i < n; i++) {
    const bx = -150 + rand(97, i, 1) * 160, by = -70 + rand(97, i, 2) * 60;
    const x = bx + Math.sin((TAU * (1 + Math.floor(rand(97, i, 3) * 2)) * t) / D + rand(97, i, 4) * TAU) * (2 + rand(97, i, 5) * 5);
    const y = by - Math.abs(Math.cos((TAU * (1 + Math.floor(rand(97, i, 6) * 2)) * t) / D + rand(97, i, 7) * TAU)) * (1 + rand(97, i, 8) * 3);
    const blink = 0.5 + 0.5 * wave(t, D, 1 + Math.floor(rand(97, i, 9) * 3), rand(97, i, 10) * TAU);
    if (blink < 0.3) continue;
    q.dot(x, y, blink > 0.7 ? hex("#f0ffd0") : GLOWC, 0.5 + blink * 0.5);
    if (blink > 0.55) q.glow(x, y, 2 + blink * 2, GLOWC, blink * 0.35);
  }
}

// ---- entry ------------------------------------------------------------------------------------------------
export function drawBack(p, t, o) {
  scene(p, t);
  clouds(p, t);
  stream(p, t);
  birds(p, t);
  falls(p, t);
  foamMist(p, t, o.density);
  tree(p, t, o.seed);
  foreground(p, t, o.density);
}
export function draw(p, t, o) {
  poolGlitter(p, t, o.density);
  lightShafts(p, t);
  fireflies(p, t, o.density);
}
