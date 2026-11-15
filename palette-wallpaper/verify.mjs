// Node-side verification for the palette wallpaper: every scene loads and draws, the palette
// remap actually recolors, the backdrops build. No browser needed — mirrors player.js's pipeline.
import { createFrame, clearFrame, painterFor, composite, backdrop } from "../src/core/index.js";
import { paletteById } from "./src/palettes.js";
import { FX } from "./src/effects.js";

let fails = 0;
const lumaOf = (r, g, b) => (77 * r + 150 * g + 29 * b) >> 8;

function render(id, paletteId, bg) {
  const mod = FX[id], meta = mod.meta;
  const [w, h] = meta.size || [320, 180];
  const f = createFrame(w, h), img = new Uint8ClampedArray(w * h * 4);
  const t = (meta.duration || 1) * 0.5;
  const p = painterFor(f);
  const opts = Object.assign({ x: meta.origin[0], y: meta.origin[1] }, meta.options);
  p.place(opts.x, opts.y, false, 0);
  p.fade = 1;
  p.lightK = 1;
  if (mod.drawBack) { p.layer = "back"; mod.drawBack(p, t, opts); }
  p.layer = "front";
  mod.draw(p, t, opts);
  const groundY = Math.min(h, Math.max(1, meta.origin ? meta.origin[1] : Math.round(h * 0.8)));
  composite(f, img, backdrop(bg, w, h, groundY));
  if (paletteId !== "none") {
    const ramp = paletteById(paletteId).ramp, n = ramp.length;
    for (let i = 0; i < w * h; i++) {
      const l = lumaOf(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
      const c = ramp[Math.min(n - 1, Math.max(0, Math.round((l / 255) * (n - 1))))];
      img[i * 4] = c & 255; img[i * 4 + 1] = (c >>> 8) & 255; img[i * 4 + 2] = (c >>> 16) & 255;
    }
  }
  return img;
}

function differs(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  return n / (a.length / 4);
}

for (const id of Object.keys(FX)) {
  try {
    const own = render(id, "none", "sky");
    const icy = render(id, "ice", "sky");
    const gold = render(id, "gold", "sky");
    const black = render(id, "none", "black");
    const ground = render(id, "none", "ground");
    const dp = differs(own, icy), dg = differs(own, gold);
    let bgok = true;
    for (let i = 0; i < black.length; i++) if (black[i] !== ground[i]) { bgok = true; break; }
    const status = dp > 0.3 && dg > 0.3 && bgok ? "ok" : "SUSPECT";
    if (status !== "ok") fails++;
    console.log(`${status}  ${id}  paletteΔ ${(dp * 100).toFixed(0)}% / ${(dg * 100).toFixed(0)}%`);
  } catch (e) {
    fails++;
    console.log(`FAIL  ${id}: ${e.message}`);
  }
}
console.log(fails ? fails + " failure(s)" : "all scenes ok");
process.exit(fails ? 1 : 0);
