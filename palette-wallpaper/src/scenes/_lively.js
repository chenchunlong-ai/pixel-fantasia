// Compose a base scene with critters drawn on top: the scene renders exactly as before, then each
// critter is drawn at its own spot on its own clock (same pure-function style, nothing accumulates).
// The wardrobe palette still applies afterwards, so the animals recolor with the whole picture.

import { createFrame, clearFrame, painterFor } from "../../../src/core/index.js";

/** Time inside a critter's own loop, offset by phase and scaled by speed. */
function critterTime(t, c, D) {
  return (((t * (c.speed || 1)) + (c.phase || 0)) % D + D) % D;
}

// scratch frames for scaled critters: one per module, redrawn each use (pure functions of t)
const SCRATCH = new Map();
/** A critter drawn into its own frame and blitted at k×, so any critter can render any size. */
function drawCritterScaled(p, c, t, back) {
  const mod = c.mod;
  const [w, h] = mod.meta.size, k = c.scale || 1;
  let sf = SCRATCH.get(mod);
  if (!sf || sf.w !== w || sf.h !== h) { sf = createFrame(w, h); SCRATCH.set(mod, sf); }
  const D = mod.meta.duration || 1;
  const co = Object.assign({}, mod.meta.options, c.opts, { seed: c.seed ?? 1 });
  const sp = painterFor(clearFrame(sf));
  sp.place(mod.meta.origin[0], mod.meta.origin[1], false, 0);
  sp.fade = 1;
  sp.lightK = 1;
  const ct = critterTime(t, c, D);
  if (mod.drawBack) { sp.layer = "back"; mod.drawBack(sp, ct, co); }
  sp.layer = "front";
  mod.draw(sp, ct, co);
  // nearest-neighbour blit at k×, anchoring the critter's origin at (c.x, c.y)
  const sw = Math.round(w * k), sh = Math.round(h * k);
  const ox = c.x - mod.meta.origin[0] * k, oy = c.y - mod.meta.origin[1] * k;
  for (let dy = 0; dy < sh; dy++)
    for (let dx = 0; dx < sw; dx++) {
      const col = sf.color[Math.floor(dy / k) * w + Math.floor(dx / k)];
      if (col) p.px(ox + dx, oy + dy, col);
    }
}

function drawCritter(p, c, t, back) {
  if (c.scale && c.scale !== 1) return drawCritterScaled(p, c, t, back);
  const mod = c.mod;
  if (back ? !mod.drawBack : !mod.draw) return;
  const D = mod.meta.duration || 1;
  const co = Object.assign({}, mod.meta.options, c.opts, { seed: c.seed ?? 1 });
  p.place(c.x, c.y, false, 0);
  if (back) mod.drawBack(p, critterTime(t, c, D), co);
  else mod.draw(p, critterTime(t, c, D), co);
}

/**
 * Wrap a base scene module with a cast of critters: enrich(snow, [{ mod: bird, x: 250, y: 48, seed: 2 }...]).
 * Each entry: mod (a critter effect), x/y (its origin in the scene's frame), seed, speed, phase, opts.
 * The `critters` option (default on) turns the whole cast off — the scene then renders exactly
 * as its unwrapped self would.
 */
export function enrich(base, critters = []) {
  const meta = Object.assign({}, base.meta);
  // the player always passes x/y/flip; fall back to the scene's own origin when a caller doesn't
  const placeScene = (p, o) => p.place(o.x ?? meta.origin[0], o.y ?? meta.origin[1], !!o.flip, o.angle || 0);
  const cast = (p, t, o, back) => {
    if (o.critters === false) return;
    for (const c of critters) drawCritter(p, c, t, back);
  };
  return {
    meta,
    drawBack(p, t, o) {
      placeScene(p, o);
      if (base.drawBack) base.drawBack(p, t, o);
      p.fade = 1;
      p.lightK = o.light ?? 1;
      cast(p, t, o, true);
    },
    draw(p, t, o) {
      placeScene(p, o);
      base.draw(p, t, o);
      p.fade = 1;
      p.lightK = o.light ?? 1;
      cast(p, t, o, false);
    },
  };
}
