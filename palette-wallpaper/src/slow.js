// Wrap a scene module so its animation runs k× slower (e.g. slow(blackHole, 0.3) = 70% slower),
// without breaking the loop: the duration stretches by 1/k and the scene's own clock is scaled
// by k, so t still sweeps exactly one of the scene's loops per Player loop — no seam.
export function slow(mod, k) {
  const D = mod.meta.duration || 1;
  return {
    meta: Object.assign({}, mod.meta, { duration: D / k }),
    drawBack: mod.drawBack ? (p, t, o) => mod.drawBack(p, t * k, o) : undefined,
    draw: mod.draw ? (p, t, o) => mod.draw(p, t * k, o) : undefined,
  };
}
