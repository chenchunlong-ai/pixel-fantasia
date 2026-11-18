// App icon pipeline: decode the logo (app-icon.png preferred, app-icon.jpg as fallback), resize to
// every size the shell and the Store need, and write the Windows .ico (32-bit PNG entries that keep
// the alpha channel, so the rounded corners stay transparent) and the MSIX asset PNGs.
//   build.mjs imports writeIco(); msix.mjs imports writeMsixAssets().
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const jpeg = require("jpeg-js"); // jpeg-js is in the repo's node_modules

let BASE = null; // the decoded logo, RGBA

// ---- PNG reader (8-bit, non-interlaced: that is what any exporter writes) -------------------------
// Hand-rolled so the icon stays transparent without adding a dependency: a flattened JPEG logo
// paints dark corners onto the taskbar, which is exactly what a logo must not do.
function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, bd = 8, ct = 6, interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bd = data[8]; ct = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bd !== 8 || interlace !== 0) throw new Error("PNG: only 8-bit non-interlaced is supported");
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : ct === 0 ? 1 : 0;
  if (!ch) throw new Error("PNG: unsupported colour type " + ct);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const si = x * ch, o = (y * w + x) * 4;
      if (ch >= 3) { out[o] = line[si]; out[o + 1] = line[si + 1]; out[o + 2] = line[si + 2]; }
      else { out[o] = out[o + 1] = out[o + 2] = line[si]; }
      out[o + 3] = ch === 4 ? line[si + 3] : ch === 2 ? line[si + 1] : 255;
    }
    prev = line;
  }
  return { width: w, height: h, data: out };
}

function baseOf() {
  if (BASE) return BASE;
  const png = join(HERE, "app-icon.png");
  if (existsSync(png)) BASE = decodePNG(readFileSync(png));          // keeps transparency
  else BASE = jpeg.decode(readFileSync(join(HERE, "app-icon.jpg")), { useTArray: true, formatAsRGBA: true });
  return BASE;
}

/** Box-average downscale of the RGBA buffer to S×S. */
export function resized(S) {
  const b = baseOf();
  const SW = b.width, SH = b.height, out = Buffer.alloc(S * S * 4);
  // center-crop to square first, then box sample
  const side = Math.min(SW, SH), sx = (SW - side) / 2, sy = (SH - side) / 2;
  for (let y = 0; y < S; y++) {
    const y0 = Math.floor(sy + (y * side) / S), y1 = Math.max(y0 + 1, Math.floor(sy + ((y + 1) * side) / S));
    for (let x = 0; x < S; x++) {
      const x0 = Math.floor(sx + (x * side) / S), x1 = Math.max(x0 + 1, Math.floor(sx + ((x + 1) * side) / S));
      let r = 0, g = 0, bl = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * SW + xx) * 4;
          const av = b.data[i + 3];
          // alpha-weighted: a transparent neighbour contributes its colour only in proportion to
          // its opacity, otherwise the cut-out edges fringe dark against the tile behind them
          r += b.data[i] * av; g += b.data[i + 1] * av; bl += b.data[i + 2] * av; a += av; n++;
        }
      const o = (y * S + x) * 4;
      const aa = a / n;
      if (aa > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a; }
      out[o + 3] = aa;
    }
  }
  return out;
}

// ---- PNG writer (no deps, same recipe as msix.mjs) -----------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = n & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
export function encodePNG(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 256-colour palette PNG (for the .ico): icons are tiny, 16.7M colours are wasted there ------
// popularity quantization in RGB555 space + Floyd–Steinberg dithering, so smooth neon gradients
// survive without banding; roughly halves each icon entry's size versus true-colour PNG.
function palettePNG(rgba, w, h) {
  // histogram the RGB555 buckets, keep the 256 most-popular as the palette
  const hist = new Map();
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256);
  const pal = new Uint8Array(256 * 3), palCount = top.length;
  const lut = new Map();
  for (let i = 0; i < palCount; i++) {
    const k = top[i][0];
    pal[i * 3] = ((k >> 10) << 3) + 4; pal[i * 3 + 1] = (((k >> 5) & 31) << 3) + 4; pal[i * 3 + 2] = ((k & 31) << 3) + 4;
    lut.set(k, i);
  }
  const nearest = (r, g, b) => {
    const k = ((Math.min(255, Math.max(0, r)) >> 3) << 10) | ((Math.min(255, Math.max(0, g)) >> 3) << 5) | (Math.min(255, Math.max(0, b)) >> 3);
    if (lut.has(k)) return lut.get(k);
    let best = 0, bd = 1e9;
    for (let i = 0; i < palCount; i++) {
      const dr = r - pal[i * 3], dg = g - pal[i * 3 + 1], db = b - pal[i * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = i; }
    }
    lut.set(k, best);
    return best;
  };
  // FS dithering into indices
  const f = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { f[i * 3] = rgba[i * 4]; f[i * 3 + 1] = rgba[i * 4 + 1]; f[i * 3 + 2] = rgba[i * 4 + 2]; }
  const idx = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const r = f[i], g = f[i + 1], b = f[i + 2];
      const p = nearest(r, g, b);
      idx[y * w + x] = p;
      const er = r - pal[p * 3], eg = g - pal[p * 3 + 1], eb = b - pal[p * 3 + 2];
      const push = (xx, yy, k2) => {
        if (xx < 0 || xx >= w || yy >= h) return;
        const j = (yy * w + xx) * 3;
        f[j] += er * k2; f[j + 1] += eg * k2; f[j + 2] += eb * k2;
      };
      push(x + 1, y, 7 / 16); push(x - 1, y + 1, 3 / 16); push(x, y + 1, 5 / 16); push(x + 1, y + 1, 1 / 16);
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;   // 8-bit indexed
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    Buffer.from(idx.buffer, y * w, w).copy(raw, y * (w + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("PLTE", pal.slice(0, palCount * 3)),
    chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 5-bit colour quantization -------------------------------------------------------------------
// The neon logo is noisy, so a true-colour 256px PNG costs ~100 KB and a single ico would then be
// 157 KB — and every byte of it rides inside the .exe and the installer. Snapping each channel to
// 32 levels costs no visible quality at icon sizes and halves that. The alpha channel is untouched,
// so the transparent corners stay transparent.
function quantize(rgba, levels = 32) {
  const step = 256 / levels;
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const v = Math.round(out[i + k] / step) * step;
      out[i + k] = v > 255 ? 255 : v;
    }
  }
  return out;
}

// ---- the Windows .ico: 32-bit PNG-compressed entries, one per size ---------------------------------
// True-colour + alpha (colour type 6). The old 256-colour path threw the alpha channel away, which
// is what put square dark corners around a round logo in Explorer, the taskbar and the title bar.
export function writeIco(path) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => encodePNG(quantize(resized(s)), s, s));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  const entries = []; let offset = 6 + 16 * sizes.length;
  sizes.forEach((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; // 256 is stored as 0
    e[2] = 0; e[3] = 0;                                  // no palette
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);       // planes, bpp
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
  });
  writeFileSync(path, Buffer.concat([head, ...entries, ...pngs]));
}

// ---- the MSIX asset set ---------------------------------------------------------------------------
export function writeMsixAssets(assetsDir) {
  const specs = [
    ["Square44x44Logo.scale-100.png", 44],
    ["Square150x150Logo.scale-100.png", 150],
    ["StoreLogo.scale-100.png", 50],
    ["Square44x44Logo.targetsize-256.png", 256],
  ];
  for (const [name, s] of specs) writeFileSync(join(assetsDir, name), encodePNG(quantize(resized(s)), s, s));
  // wide tile: the logo centred on a transparent canvas — Windows paints the tile behind it
  const W = 310, H = 150, logo = quantize(resized(150));
  const px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < 150; y++)
    for (let x = 0; x < 150; x++) {
      const si = (y * 150 + x) * 4, di = (y * W + (x + 80)) * 4;
      px[di] = logo[si]; px[di + 1] = logo[si + 1]; px[di + 2] = logo[si + 2]; px[di + 3] = logo[si + 3];
    }
  writeFileSync(join(assetsDir, "Wide310x150Logo.scale-100.png"), encodePNG(px, W, H));
}
