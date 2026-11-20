// 雏菊水塘 / Daisy Pond — clear sunlit water, seen from above.
//
// The water is a baked gradient of teal depth with murky patches up top (static, painted once and copied
// like Heaven's sky). The caustics are three families of slanted sine stripes, bent by a static noise warp
// and phased so they drift and sway against each other — their moving intersections read as the light net.
// Pre-mixing those stripes into the base colour per palette (8 intensity steps, a LUT) keeps a frame down
// to copy + lookup: an earlier blend-per-pixel version measured 66 ms/frame, this one ~7.
//
// Loop discipline: every stripe phase is an integer number of cycles per 16 s loop, flower drift and ripple
// phases run on (t / D), and the noise warp is static — so t=0 and t=16 are pixel-identical.
import { clamp, fit, rand, hex, TAU, mix } from "../../../src/core/index.js";
import { clip, rows, field, sample } from "../../../src/fx/weather/_lib.js";

export const meta = {
  name: "Daisy Pond",
  desc: "Sunlit water seen from above: a teal depth gradient with murky patches up top, a caustic light net drifting and reshaping over the clear lower water, a grain of sparkles, slow ripple rings, and six white daisies drifting and bobbing on the swell.",
  tags: ["water", "caustics", "daisy", "flowers", "pond", "sunlight", "ambient", "loop"],
  size: [320, 180],
  origin: [0, 0],
  duration: 16,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    other: ["#16404f", "#235c6f", "#36798c", "#5a9dab", "#8ac2c9", "#bfe2e2", "#f2fbf6"],
    density: 1,
  },
};

const W = 320, H = 180, D = 16;

// ---- the base water: depth gradient + murky patches, static, cached ------------------------------
// The reference light falls from the lower half: deep teal up top, clear light at the bottom, with murky
// stirred patches in the upper water. The noise scale matters: field() octaves run 10.7..85 lattice units,
// so sampling at ~0.16/px puts the fine features at ~60 px — anything smaller makes plateaus with hard edges.
let BASE = null, WARP = null, PATCH = null, BASEKEY = "";
function base(NL) {
  const key = NL.join();
  if (!BASE || BASEKEY !== key) {
    const F = field(611, 256, 128, [5, 10, 20, 40]);
    const FW = field(929, 256, 128, [6, 12, 24, 48]);
    const FP = field(1201, 256, 128, [4, 8, 16, 32]);
    const out = new Float64Array(W * H);
    const warp = new Float32Array(W * H);
    const patch = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const f = Math.pow(clamp(y / (H - 1), 0, 1), 1.25);
      const g = f * 5.6;                                   // 0..5.6, indexes the 7-colour ramp
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        warp[i] = sample(FW, x * 0.05, y * 0.05);          // bends the caustic stripes, static
        // where the light net shows: big soft patches, caustics strong in some, calm water in others
        patch[i] = clamp((sample(FP, x * 0.022, y * 0.022) - 0.42) * 2.6, 0.45, 1);
        const n = sample(F, x * 0.16, y * 0.16);
        const murk = clamp((n - 0.47) * 5, 0, 1) * clamp(1 - y / 130, 0, 1);
        const gi = clamp(g * (1 - murk * 0.62) - murk * 1.6, 0, 5.6);
        const i0 = Math.min(5, Math.floor(gi));
        out[i] = mix(NL[i0], NL[i0 + 1], gi - i0);
      }
    }
    BASE = out;
    WARP = warp;
    PATCH = patch;
    BASEKEY = key;
  }
  return BASE;
}

// ---- caustic tiles: Voronoi cell borders on a wrapping torus --------------------------------------
// Real caustics read as a connected polygonal net — which is exactly what the edges of a jittered
// Voronoi diagram look like. Each tile is baked once (brute force over ~30 jittered feature points,
// wrap-around distance), then a frame just slides two tiles against each other and lights where their
// edges coincide — the relative slide keeps the net merging and dissolving. λ≈45 px cells.
const TW = 320, TH = 180;
let TILES = null;
function tiles() {
  if (TILES) return TILES;
  const make = (seed, n, jitter) => {
    const px = [], py = [];
    for (let i = 0; i < n; i++) {
      px.push(rand(seed, i, 1) * TW);
      py.push(rand(seed, i, 2) * TH);
    }
    const t = new Uint8Array(TW * TH);
    for (let y = 0; y < TH; y++)
      for (let x = 0; x < TW; x++) {
        let f1 = 1e9, f2 = 1e9;
        for (let i = 0; i < n; i++) {
          let dx = Math.abs(x + 0.5 - px[i]); if (dx > TW / 2) dx = TW - dx;
          let dy = Math.abs(y + 0.5 - py[i]); if (dy > TH / 2) dy = TH - dy;
          const d = dx * dx + dy * dy * jitter;
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
        // brightness along the border between cells: F2 - F1 small there
        const e = Math.sqrt(f2) - Math.sqrt(f1);
        const v = Math.max(0, 1 - e / 2.6);
        t[y * TW + x] = Math.round(255 * v * v * v);
      }
    return t;
  };
  TILES = [make(173, 52, 1.15), make(449, 40, 0.85)];
  return TILES;
}

// ---- the caustic LUT: 8 pre-mixed intensity steps of web-over-base, per palette -------------------
let LUTD = null, LUTKEY = "";
const LV = 8, MAXMIX = 1;
function lut(NL) {
  const key = NL.join();
  if (LUTD && LUTKEY === key) return LUTD;
  const B = base(NL), CAUS = NL[6];
  const out = new Float64Array(LV * W * H);
  for (let l = 1; l < LV; l++) {
    const m = (l / LV) * MAXMIX, dst = l * W * H;
    for (let i = 0; i < W * H; i++) out[dst + i] = mix(B[i], CAUS, m);
  }
  LUTD = out;
  LUTKEY = key;
  return LUTD;
}

export function drawBack(p, t, o) {
  const NL = fit(o.other, 7);
  const B = base(NL), L = lut(NL), PT = PATCH, WP = WARP;
  const u = (TAU * t) / D;
  // two tiles slid against each other: a linear slide must advance a whole tile per loop to stay
  // seamless, so A flows at exactly 320 px per loop (20 px/s) and B only sways on loop frequencies
  const [A, Bt] = tiles();
  const oxA = Math.round((20 * t) % TW), oyA = Math.round(3 * Math.sin(u * 2));
  const oxB = Math.round(6 * Math.sin(u + 2.1)), oyB = Math.round(5 * Math.sin(u * 2 + 1.3));
  rows(p, meta, 0, H - 1, (y, R) => {
    const off = Math.round(y) * W;
    // caustics read strongest in the clear lower water, faint in the murky top, and only where
    // the patch mask says the light is focusing
    const depth = 0.25 + 0.75 * clamp((y - 26) / 120, 0, 1);
    const yw = Math.round(y + WP[off] * 9);
    const ya = (((yw + oyA) % TH) + TH) % TH, yb = (((yw + oyB) % TH) + TH) % TH;
    const ra = ya * TW, rb = yb * TW;
    for (let x = 0; x < W; x++) {
      const gain = depth * PT[off + x];
      // sample the tiles through the static warp, so the straight Voronoi edges bend like light ribs
      const xw = Math.round(x + WP[off + x] * 9);
      const xa = (((xw + oxA) % TW) + TW) % TW, xb = (((xw + oxB) % TW) + TW) % TW;
      const w = Math.max(A[ra + xa], Bt[rb + xb]) / 255; // the brighter of the two nets, slid apart
      const k = w * gain;
      // LUT levels 1..7; round instead of floor so faint lines keep at least level 1
      const lv = k >= 0.05 ? Math.max(1, Math.min(7, Math.round(k * 8))) : 0;
      R.c[x] = lv ? L[lv * W * H + off + x] : B[off + x];
    }
    R.a.fill(1, 0, W); R.b.fill(0, 0, W); R.k.fill(0, 0, W); R.l.fill(0, 0, W);
  });
  sparkles(p, t, NL);
  ripples(p, t, NL);
}

// ---- sparkles: a fixed grain of glitter that twinkles, mostly in the clear water ------------------
const SPARKS = [];
{
  for (let i = 0; i < 110; i++) {
    const x = rand(517, i, 1) * W;
    const y = 40 + rand(517, i, 2) * 136;
    if (y < 50 && rand(517, i, 3) < 0.55) continue;
    // integer twinkle frequencies keep the loop seamless
    SPARKS.push({ x: Math.round(x), y: Math.round(y), w: 1 + Math.round(rand(517, i, 4) * 3), p: rand(517, i, 5) * TAU, s: 0.35 + rand(517, i, 6) * 0.65 });
  }
}
function sparkles(p, t, NL) {
  const q = clip(p, meta);
  const ph = (TAU * t) / D;
  for (let i = 0; i < SPARKS.length; i++) {
    const S = SPARKS[i];
    const tw = Math.max(0, Math.sin(ph * S.w + S.p));
    const a = tw * tw * tw * S.s;
    if (a < 0.08) continue;
    q.px(S.x, S.y, NL[6]);
    if (a > 0.5) q.light(S.x, S.y, hex("#ffffff"), 0.14 * a);
  }
}

// ---- ripples: slow expanding rings that fade as they grow ----------------------------------------
const RIPPLES = [
  { x: 78, y: 138, r0: 5, r1: 34, ph: 0.0 },
  { x: 236, y: 96, r0: 4, r1: 26, ph: 0.45 },
  { x: 160, y: 160, r0: 6, r1: 40, ph: 0.7 },
  { x: 290, y: 150, r0: 3, r1: 20, ph: 0.2 },
];
function ripples(p, t, NL) {
  const q = clip(p, meta);
  for (const R of RIPPLES) {
    const u = (t / D + R.ph) % 1;
    const r = R.r0 + u * (R.r1 - R.r0);
    const a = Math.sin(Math.PI * u) * 0.5;
    // a thin pale ring — a filled ellipse would alpha-dither into a dotted disc
    q.ring(R.x, R.y, r, 1.3, NL[6], a);
  }
}

// ---- the daisies: front layer, drifting and bobbing ----------------------------------------------
const FLOWERS = [
  { x: 52, y: 42, s: 1.3, seed: 71 },
  { x: 148, y: 78, s: 1.0, seed: 72 },
  { x: 262, y: 62, s: 1.15, seed: 73 },
  { x: 92, y: 132, s: 1.4, seed: 74 },
  { x: 214, y: 142, s: 1.1, seed: 75 },
  { x: 292, y: 108, s: 0.9, seed: 76 },
];
const PETAL = hex("#ffffff"), PETAL_SH = hex("#dcebe9"), YOLK = hex("#f4c34a"), YOLK_D = hex("#d89a2b");

export function draw(p, t, o) {
  const q = clip(p, meta);
  const u = (TAU * t) / D;
  for (let i = 0; i < FLOWERS.length; i++) {
    const F = FLOWERS[i];
    const R = (j) => rand(F.seed, i, j);
    // each flower wanders its own small circuit and bobs on the swell; frequencies are integers,
    // phases from the seed, so the loop stays seamless
    const f1 = 1 + Math.round(R(1)), f2 = 2 + Math.round(R(2));
    const cx = F.x + Math.sin(u * f1 + R(3) * TAU) * 3.2 + Math.sin(u * f2 + R(4) * TAU) * 1.6;
    const cy = F.y + Math.cos(u * (f1 + 1) + R(5) * TAU) * 1.8 + Math.sin(u * f2 + 1.2) * 0.9;
    daisy(q, cx, cy, F.s * (1 + 0.05 * Math.sin(u * f2 + i)));
  }
}

function daisy(q, cx, cy, s) {
  // a soft shadow under the flower, offset down-right, ties it to the water
  // a soft shadow under the flower, offset down-right, ties it to the water (kept faint: the
  // alpha-dither that fills it shows as dots if pushed harder)
  q.ellipse(cx + 1.5, cy + 2, 5 * s, 3.4 * s, hex("#0c2830"), 0.13);
  const petals = 8;
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * TAU;
    const dx = Math.cos(a), dy = Math.sin(a);
    // each petal: a pale base brightening to a white tip, two px across, drawn densely so the
    // petal is a continuous short stroke, not scattered dots
    for (let r = 1.8; r <= 4.8; r += 0.55) {
      const px = cx + dx * r * s, py = cy + dy * r * s;
      const shade = r > 3.4 ? PETAL : PETAL_SH;
      q.px(px, py, shade);
      q.px(px + dy, py - dx, shade);
      q.px(px - dy, py + dx, shade);
    }
  }
  // the yolk, a fat two-tone dome
  q.px(cx, cy, YOLK);
  q.px(cx - 1, cy, YOLK);
  q.px(cx, cy - 1, YOLK);
  q.px(cx - 1, cy - 1, YOLK);
  q.px(cx + 1, cy, YOLK_D);
  q.px(cx, cy + 1, YOLK_D);
  q.light(cx, cy, hex("#ffe9a8"), 0.10);
}
