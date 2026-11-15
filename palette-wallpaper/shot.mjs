// Render a scene frame to PNG from node — for eyeballing without a browser.
//   node shot.mjs <fxId> <seconds> <out.png> [bg]
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createFrame, clearFrame, painterFor, composite, backdrop } from "../src/core/index.js";
import { FX } from "./src/effects.js";

const [id, secs, out, bgArg] = process.argv.slice(2);
const mod = FX[id];
if (!mod) { console.log("unknown id: " + id); process.exit(1); }
const meta = mod.meta;
const [w, h] = meta.size || [320, 180];
const f = createFrame(w, h);
const D = meta.duration || 1;
const t = ((parseFloat(secs) || 0) % D + D) % D;
const bg = backdrop(["sky", "black", "ground"].includes(bgArg) ? bgArg : (meta.bg === "sky" ? "sky" : "dark"), w, h, meta.origin[1]);
const p = painterFor(clearFrame(f));
const o = Object.assign({ x: meta.origin[0], y: meta.origin[1], density: 1, seed: meta.options?.seed ?? 1 }, meta.options);
p.place(o.x, o.y, false, 0);
p.fade = 1;
p.lightK = 1;
if (mod.drawBack) { p.layer = "back"; mod.drawBack(p, t, o); }
p.layer = "front";
mod.draw(p, t, o);
const img = new Uint8ClampedArray(w * h * 4);
composite(f, img, bg);

// PNG encode (no deps)
const CRC_TABLE = (() => {
  const t2 = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = n & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t2[n] = c >>> 0; }
  return t2;
})();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
const raw = Buffer.alloc((w * 4 + 1) * h);
for (let y = 0; y < h; y++) {
  raw[y * (w * 4 + 1)] = 0;
  for (let x = 0; x < w; x++) {
    const si = (y * w + x) * 4, di = y * (w * 4 + 1) + 1 + x * 4;
    raw[di] = img[si]; raw[di + 1] = img[si + 1]; raw[di + 2] = img[si + 2]; raw[di + 3] = 255;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(out, png);
console.log("saved " + out + "  t=" + t.toFixed(2));
