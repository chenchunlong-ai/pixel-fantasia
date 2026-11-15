// The big brother of black-hole.js: the same particle accretion disk, but the hole is huge — two and a
// half times across, pushed up and right so most of it leaves the frame, the way Gargantua fills the
// shot in the reference (R-C.jpg). You never see the whole thing; that's the point. A small moon hangs
// silhouetted at mid-left, rim-lit by the disk. All particles on seamless Keplerian orbits, same as
// the small one: nothing here is drawn as an object except the moon's silhouette.
import { fit, clamp, rand, mix, hex, TAU } from "../../core/index.js";
import { clip, field, sample, wave } from "./_lib.js";

export const meta = {
  name: "Gargantua",
  desc: "A huge black hole off the edge of the frame: an ember disk streaming around a shadow too big to see whole, a white photon ring arcing past, and a small moon silhouetted at mid-left.",
  tags: ["weather", "scene", "black hole", "gargantua", "space", "accretion", "moon", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    fire: ["#2a120a", "#6e2c12", "#c85a1e", "#f28c34", "#ffc46a", "#fff2dc", "#ffffff"],
    density: 1,
    seed: 7,
  },
};

const D = 12;
const C = [92, -98];          // the hole's center: high and right
const SHADOW = 66;            // the horizon's radius
const RING = 72;              // the photon ring
const INNER = 75, OUTER = 420;// the disk sweeps wide past both frame edges
const TILT = 0.17;            // how flattened the disk looks
const SKEW = -0.2;            // the whole system tips a little, lower left to upper right
const MOON = [-66, -136];     // the little moon, well above the disk's traffic
const MOON_R = 7;

const FN = field(23, 256, 128, [6, 12, 24]);   // the turbulence clumping the disk

const q2 = (p) => clip(p, meta);

// q.glow with the horizon cut out: the light buffer is additive, so a black disc can't erase glow —
// big soft glows near the ring must simply never write inside the shadow
function glowOut(p, x, y, r, c, k) {
  if (r < 1 || k <= 0.004) return;
  const q = q2(p);
  const x0 = Math.max(-162, Math.floor(x - r)), x1 = Math.min(162, Math.ceil(x + r));
  const y0 = Math.max(-172, Math.floor(y - r)), y1 = Math.min(10, Math.ceil(y + r));
  for (let py = y0; py <= y1; py++) {
    const dy = (py + 0.5 - y) / r;
    for (let px = x0; px <= x1; px++) {
      const dx = (px + 0.5 - x) / r, d = dx * dx + dy * dy;
      if (d >= 1) continue;
      if (Math.hypot(px + 0.5 - C[0], py + 0.5 - C[1]) < SHADOW - 1) continue;
      const f = 1 - Math.sqrt(d);
      q.light(px, py, c, f * f * k);
    }
  }
}

// project disk-plane polar coords to the screen: ellipse flatten + system skew, around C
function project(r, a) {
  const ex = Math.cos(a) * r, ey = Math.sin(a) * r * TILT;
  const cs = Math.cos(SKEW), sn = Math.sin(SKEW);
  return [C[0] + ex * cs - ey * sn, C[1] + ex * sn + ey * cs];
}

// the heat ramp: white at the inner edge, deep ember at the rim
function heatColor(k, BL) {
  return k > 0.82 ? BL[6] : k > 0.6 ? BL[5] : k > 0.42 ? BL[4] : k > 0.26 ? BL[3] : k > 0.13 ? BL[2] : BL[1];
}

// ---- the starfield ---------------------------------------------------------------------------------
function stars(p, t, dn) {
  const q = q2(p);
  const n = Math.round(110 * Math.min(1.4, dn));
  for (let i = 0; i < n; i++) {
    const x = -158 + rand(91, i, 1) * 316, y = -168 + rand(91, i, 2) * 176;
    if (Math.hypot(x - C[0], y - C[1]) < SHADOW + 2) continue;
    const tw = 0.5 + 0.5 * wave(t, D, 1 + Math.floor(rand(91, i, 3) * 3), rand(91, i, 4) * TAU);
    const k = rand(91, i, 5);
    if (k < 0.72) q.dot(x, y, hex("#8a8a9a"), 0.25 + 0.3 * tw);
    else if (k < 0.95) (q.px(x, y, hex("#c8c8d8")), q.dot(x, y, hex("#9a9ab0"), 0.4 * tw));
    else q.dot(x, y, hex("#ffffff"), 0.5 + 0.5 * tw);
  }
}

// ---- the accretion disk ------------------------------------------------------------------------------
// dust grains on Keplerian orbits, whole turns a loop, clumped by a baked turbulence field,
// Doppler-bright on the approaching (left) side. The band is fat near the hole, thin far out.
function disk(p, t, dn, BL, near) {
  const q = q2(p);
  const n = Math.round(4200 * dn);
  for (let i = 0; i < n; i++) {
    const rr = INNER + Math.pow(rand(5, i, 1), 2.4) * (OUTER - INNER);
    const a0 = rand(5, i, 2) * TAU;
    const turns = Math.max(1, Math.round(30 * Math.pow(RING / rr, 1.5)));
    const a = a0 + (TAU * turns * t) / D;
    const [x, y0] = project(rr, a);
    const thick = 3 + 11 * Math.pow(clamp(1 - (rr - INNER) / (OUTER - INNER), 0, 1), 0.5);
    const y = y0 + (rand(5, i, 6) - 0.5) * thick;
    if (x < -162 || x > 162 || y < -172 || y > 10) continue;
    const behind = Math.sin(a) < 0;
    if (behind !== !near) continue;                        // this layer's half only
    if (behind && Math.hypot(x - C[0], y - C[1]) < SHADOW + 1) continue; // hidden by the horizon
    const heat = Math.pow(clamp(1 - (rr - INNER) / (OUTER - INNER), 0, 1), 1.8);
    const turb = 0.45 + 0.55 * sample(FN, ((a / TAU) * 48) % 256, rr * 0.22);
    const dopp = 0.3 + 0.7 * Math.max(0, -Math.sin(a)) + 0.25;
    let br = Math.pow(heat, 0.45) * turb * dopp * 2.1;
    if (br < 0.12) continue;
    const c = heatColor(clamp(heat * (0.6 + 0.4 * dopp) * (0.7 + 0.3 * turb), 0, 1), BL);
    q.dot(x, y, c, Math.min(1, br));
    if (heat > 0.4 && br > 0.8 && rand(5, i, 3) < 0.45) q.light(x, y, BL[5], 0.32 * br);
  }
  // hot knots throwing real glow, so the inner disk looks molten
  const knots = Math.round(46 * dn);
  for (let i = 0; i < knots; i++) {
    const rr = INNER + Math.pow(rand(9, i, 1), 2) * 46;
    const a0 = rand(9, i, 2) * TAU;
    const turns = Math.max(1, Math.round(30 * Math.pow(RING / rr, 1.5)));
    const a = a0 + (TAU * turns * t) / D;
    const [x, y] = project(rr, a);
    const behind = Math.sin(a) < 0;
    if (behind !== !near) continue;
    if (behind && Math.hypot(x - C[0], y - C[1]) < SHADOW + 1) continue;
    const dopp = 0.3 + 0.7 * Math.max(0, -Math.sin(a));
    q.dot(x, y, BL[5], 0.95 * dopp);
    q.light(x, y, BL[4], 0.7 * dopp);
    q.light(x, y, BL[6], 0.35 * dopp);
  }
}

// ---- the shadow and the photon ring --------------------------------------------------------------------
// the horizon as an opaque black disc (it must erase light bleed), the photon ring streaming around
// what's visible of it, and the lensed arc of the far disk glowing where the ring leaves the frame.
function shadow(p) {
  const q = q2(p), blk = hex("#000000");
  for (let dy = -SHADOW; dy <= SHADOW; dy++)
    for (let dx = -SHADOW; dx <= SHADOW; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= SHADOW - 0.5) q.dot(C[0] + dx, C[1] + dy, blk);
      else if (d <= SHADOW + 0.5) q.dot(C[0] + dx, C[1] + dy, blk, 0.6);
    }
}

function ring(p, t, dn, BL) {
  const q = q2(p);
  const n = Math.round(2300 * dn);
  for (let i = 0; i < n; i++) {
    const rr = RING - 1 + rand(31, i, 1) * 2.2;
    const a0 = rand(31, i, 2) * TAU;
    const a = a0 + (TAU * 24 * t) / D;
    const x = C[0] + Math.cos(a) * rr, y = C[1] + Math.sin(a) * rr;
    if (x < -162 || x > 162 || y < -172 || y > 10) continue;
    const dopp = 0.3 + 0.7 * Math.max(0, -Math.sin(a));
    const br = (0.5 + 0.5 * rand(31, i, 3)) * (0.18 + 0.82 * dopp) * 2.4;
    if (br < 0.15) continue;
    q.dot(x, y, mix(BL[5], BL[6], dopp * 0.7), Math.min(1, br));
    if (dopp > 0.4 && rand(31, i, 3) < 0.5) q.light(x, y, BL[6], 0.4 * br);
  }
  // the lensed arc: the far disk bent around the ring, drawn as a screen-space circle hugging it —
  // never a projected ellipse, which would cut straight across the shadow as a dotted line
  const breathe = 0.8 + 0.2 * wave(t, D, 2);
  for (let i = 0; i < 340; i++) {
    const a = Math.PI * 0.75 + (i / 340) * Math.PI * 1.5;  // from lower left, over the top
    const rr = RING + 2 + rand(41, i, 1) * 5;
    const x = C[0] + Math.cos(a) * rr, y = C[1] + Math.sin(a) * rr;
    if (x < -162 || x > 162 || y < -172 || y > 10) continue;
    const dop = 0.3 + 0.7 * Math.max(0, Math.cos(a - SKEW));
    q.dot(x, y, BL[4], (0.35 + 0.5 * dop) * breathe);
    if (i % 2 === 0) q.light(x, y, BL[5], 0.16 * dop * breathe);
  }
  // the overexposed hotspot where the disk swings toward us, on the ring's left
  const hs = [C[0] - RING - 3, C[1] - 8];
  glowOut(p, hs[0], hs[1], 30 + 6 * wave(t, D, 2), BL[6], 0.55 * breathe);
  glowOut(p, hs[0], hs[1], 70, BL[4], 0.16 * breathe);
}

// ---- the little moon ------------------------------------------------------------------------------------
// a silhouette: black disc, a thin warm rim on the side facing the disk's blaze, a faint halo. It
// hangs still — at this scale it would take years to cross a thumb-width of sky.
function moon(p, t) {
  const q = q2(p), BL = fit(oNow.fire, 7);
  const breathe = 0.85 + 0.15 * wave(t, D, 2);
  // disk haze behind it first, so the silhouette reads against something
  glowOut(p, MOON[0] - 3, MOON[1] + 2, MOON_R * 4.2, BL[3], 0.2 * breathe);
  const body = hex("#120e16");
  for (let dy = -MOON_R - 1; dy <= MOON_R + 1; dy++)
    for (let dx = -MOON_R - 1; dx <= MOON_R + 1; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > MOON_R + 0.5) continue;
      if (d <= MOON_R - 0.6) {
        // the night side: barely there, a hint of the disk's light on the surface
        q.dot(MOON[0] + dx, MOON[1] + dy, body);
        continue;
      }
      // the lit rim: a crescent on the lower-left, toward the disk's blaze
      const an = Math.atan2(dy, dx);
      const lit = Math.max(0, Math.cos(an - Math.PI * 0.85));
      if (lit > 0.05) q.dot(MOON[0] + dx, MOON[1] + dy, lit > 0.55 ? BL[4] : BL[3], Math.min(1, (0.5 + 0.5 * lit) * breathe));
      else q.dot(MOON[0] + dx, MOON[1] + dy, body);
    }
}

// ---- entry ----------------------------------------------------------------------------------------------
let oNow = null;
export function drawBack(p, t, o) {
  oNow = o;
  const BL = fit(o.fire, 7);
  stars(p, t, o.density);
  disk(p, t, o.density, BL, false);   // the far half
  shadow(p);                          // the horizon, opaque black
  ring(p, t, o.density, BL);          // the photon ring and the lensed arc
  moon(p, t);                         // the little silhouette, in front of the far haze
}
export function draw(p, t, o) {
  const BL = fit(o.fire, 7);
  disk(p, t, o.density, BL, true);    // the near half, crossing in front of the shadow
}
