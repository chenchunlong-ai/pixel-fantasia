// A black hole after the "Gargantua" look (R-C.jpg): a flattened accretion disk of orbiting embers
// streaming around a pure-black shadow, a white photon ring hugging the horizon, and the far side of
// the disk lensed into an arc over the top. Nothing is drawn as an object — every bit of it is
// particles: dust grains on Keplerian orbits (inner rings lap outer ones), clumped by a baked
// turbulence field, brighter on the approaching side. Every orbit takes a whole number of turns a
// loop, so the loop has no seam.
import { fit, clamp, rand, mix, hex, TAU } from "../../core/index.js";
import { clip, pass, field, sample, wave } from "./_lib.js";

export const meta = {
  name: "Black hole",
  desc: "An accretion disk of embers around a black shadow: the photon ring, the lensed arc over the top, Doppler-bright on the approaching side, all particles on seamless orbits.",
  tags: ["weather", "scene", "black hole", "space", "stars", "accretion", "gravity", "ambient", "loop"],
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

const D = 16;
const C = [62, -36];          // the hole's center, right of the frame like the reference
const SHADOW = 32;            // the horizon's radius
const RING = 36;              // the photon ring, just outside it
const INNER = 38, OUTER = 122;// where the disk lives
const TILT = 0.17;            // how flattened the disk looks
const SKEW = -0.22;           // the whole system tips a little, lower left to upper right

const FN = field(23, 256, 128, [6, 12, 24]);   // the turbulence clumping the disk

const q2 = (p) => clip(p, meta);

// project disk-plane polar coords to the screen: ellipse flatten + system skew, around C
function project(r, a) {
  const ex = Math.cos(a) * r, ey = Math.sin(a) * r * TILT;
  const cs = Math.cos(SKEW), sn = Math.sin(SKEW);
  return [C[0] + ex * cs - ey * sn, C[1] + ex * sn + ey * cs];
}

// the heat ramp: white at the inner edge, deep ember at the rim
function heatColor(k, BL) {
  // k 0..1, hot to cold
  return k > 0.82 ? BL[6] : k > 0.6 ? BL[5] : k > 0.42 ? BL[4] : k > 0.26 ? BL[3] : k > 0.13 ? BL[2] : BL[1];
}

// ---- the starfield ---------------------------------------------------------------------------------
// sparse, mostly still, a few that twinkle; a whole number of twinkle cycles a loop
function stars(p, t, dn) {
  const q = q2(p);
  const n = Math.round(90 * Math.min(1.4, dn));
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

// ---- the accretion disk -----------------------------------------------------------------------------
// dust grains on Keplerian orbits. Each grain's turns per loop is a whole number derived from its
// radius (fast inside, slow outside), so grains lap each other and the loop closes. Brightness =
// heat (radius) * Doppler (approaching side) * turbulence (a baked field the grains stream through).
function disk(p, t, dn, BL, near) {
  const q = q2(p);
  const n = Math.round(3200 * dn);
  for (let i = 0; i < n; i++) {
    const rr = INNER + Math.pow(rand(5, i, 1), 2.8) * (OUTER - INNER);
    const a0 = rand(5, i, 2) * TAU;
    const turns = Math.max(1, Math.round(30 * Math.pow(RING / rr, 1.5)));
    const a = a0 + (TAU * turns * t) / D;
    const [x, y0] = project(rr, a);
    // the band is fat near the hole and thin far out, and it's motion-blurred along the orbit
    const thick = 1.2 + 3.4 * Math.pow(clamp(1 - (rr - INNER) / (OUTER - INNER), 0, 1), 0.5);
    const y = y0 + (rand(5, i, 6) - 0.5) * thick;
    if (x < -162 || x > 162 || y < -172 || y > 10) continue;
    const behind = Math.sin(a) < 0;
    if (behind !== !near) continue;                        // this layer's half only
    if (behind && Math.hypot(x - C[0], y - C[1]) < SHADOW + 1) continue; // hidden by the horizon
    const heat = Math.pow(clamp(1 - (rr - INNER) / (OUTER - INNER), 0, 1), 1.8);
    // turbulence: clumps the grains stream through, static in space so the flow reads
    const turb = 0.45 + 0.55 * sample(FN, ((a / TAU) * 48) % 256, rr * 0.22);
    // Doppler: the side swinging toward us burns brighter (left, by convention of the orbit)
    const dopp = 0.3 + 0.7 * Math.max(0, -Math.sin(a)) + 0.25;
    let br = Math.pow(heat, 0.45) * turb * dopp * 2.1;
    if (br < 0.12) continue;
    // approaching-side grains shift whiter, receding ones deeper orange
    const c = heatColor(clamp(heat * (0.6 + 0.4 * dopp) * (0.7 + 0.3 * turb), 0, 1), BL);
    q.dot(x, y, c, Math.min(1, br));
    if (heat > 0.4 && br > 0.8 && rand(5, i, 3) < 0.45) q.light(x, y, BL[5], 0.32 * br);
  }
  // a few hot knots throwing real glow, so the inner disk looks molten
  const knots = Math.round(34 * dn);
  for (let i = 0; i < knots; i++) {
    const rr = INNER + Math.pow(rand(9, i, 1), 2) * 30;
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

// ---- the shadow and the photon ring -------------------------------------------------------------------
// lensing makes both read as true circles on screen, whatever the disk's inclination. The shadow is
// painted as an opaque black disc (it must also erase any light bleed), then the photon ring runs
// all the way around it as a dense white stream — bright where the disk approaches.
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
  const n = Math.round(950 * dn);
  for (let i = 0; i < n; i++) {
    const rr = RING - 0.5 + rand(31, i, 1) * 1.8;
    const a0 = rand(31, i, 2) * TAU;
    const a = a0 + (TAU * 21 * t) / D;
    const x = C[0] + Math.cos(a) * rr, y = C[1] + Math.sin(a) * rr;   // a true circle on screen
    const dopp = 0.3 + 0.7 * Math.max(0, -Math.sin(a));
    const br = (0.5 + 0.5 * rand(31, i, 3)) * (0.18 + 0.82 * dopp) * 1.9;
    if (br < 0.15) continue;
    q.dot(x, y, mix(BL[5], BL[6], dopp * 0.7), Math.min(1, br));
    if (dopp > 0.5 && rand(31, i, 3) < 0.4) q.light(x, y, BL[6], 0.35 * br);
  }
  // the lensed arc over the top: the far side of the disk bent above the ring, a warm band that
  // fades with height, brighter to the left, breathing slowly.
  const breathe = 0.8 + 0.2 * wave(t, D, 2);
  for (let i = 0; i < 260; i++) {
    const a = Math.PI + (i / 260) * Math.PI;               // upper half
    const rr = RING + 1.5 + rand(41, i, 1) * 4.5;
    const [x, y] = project(rr, a);
    const dop = 0.3 + 0.7 * Math.max(0, Math.cos(a - SKEW));
    q.dot(x, y, BL[4], (0.35 + 0.5 * dop) * breathe);
    if (i % 2 === 0) q.light(x, y, BL[5], 0.16 * dop * breathe);
  }
  // the overexposed hotspot where the disk swings toward us, just left of the ring's top
  const hs = project(RING, -Math.PI / 2);
  q.glow(hs[0], hs[1], 20 + 4 * wave(t, D, 2), BL[6], 0.55 * breathe);
  q.glow(hs[0], hs[1], 44, BL[4], 0.2 * breathe);
}

// ---- entry -------------------------------------------------------------------------------------------
export function drawBack(p, t, o) {
  const BL = fit(o.fire, 7);
  stars(p, t, o.density);
  disk(p, t, o.density, BL, false);   // the far half
  shadow(p);                          // the horizon, opaque black
  ring(p, t, o.density, BL);          // the photon ring and the lensed arc
}
export function draw(p, t, o) {
  const BL = fit(o.fire, 7);
  disk(p, t, o.density, BL, true);    // the near half, crossing in front of the shadow
}
