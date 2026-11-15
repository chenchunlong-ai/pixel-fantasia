// A wallpaper-sized player for one scene: 320x180 pixels (or larger for scene wallpapers),
// color + light composited into one ImageData, then — if a palette is on — every pixel is
// re-indexed by brightness into the chosen ramp. Pure functions of time, nothing accumulates.

import { createFrame, clearFrame, painterFor, composite, backdrop } from "../../src/core/index.js";
import { paletteById } from "./palettes.js";

export const W = 320;
export const H = 180;

// which backdrops the user can pick from — the engine's own three, nothing else
export const BGS = ["sky", "black", "ground"];

export class Player {
  constructor(mod, opts) {
    this.frame = createFrame(W, H);
    this.img = new ImageData(W, H);
    this._lut = null;
    this._lutId = null;
    this.set(mod, opts);
  }

  set(mod, opts) {
    // `palette` is OUR wardrobe knob, not the effect's own color-ramp option: pull it out before
    // merging, so the effect still sees its own default ramp (many scenes call fit(o.palette))
    const look = opts && opts.palette != null ? String(opts.palette) : "none";
    if (opts && "palette" in opts) {
      opts = Object.assign({}, opts);
      delete opts.palette;
    }
    const meta = mod.meta;
    this.mod = mod;
    this.meta = meta;
    this.t = 0;
    this.look = look;
    this.opts = Object.assign({}, meta.options || {}, opts || {});
    this.opts.x = this.opts.x ?? meta.origin[0];
    this.opts.y = this.opts.y ?? meta.origin[1];
    // effects may be larger than 320x180 (scene wallpapers); rebuild the buffers to fit
    const [w, h] = meta.size || [W, H];
    if (this.frame.w !== w || this.frame.h !== h) {
      this.frame = createFrame(w, h);
      this.img = new ImageData(w, h);
    }
    this.setBg(this.opts.bg || "sky");
  }

  /** Rebuild the backdrop when the user switches between sky / black / ground. */
  setBg(kind) {
    if (!BGS.includes(kind)) kind = "sky";
    const [w, h] = this.meta.size || [W, H];
    const groundY = Math.min(h, Math.max(1, this.meta.origin ? this.meta.origin[1] : Math.round(h * 0.8)));
    this.bg = backdrop(kind, w, h, groundY);
  }

  /** Brightness LUT for the chosen look: a byte of perceived brightness picks a ramp step. */
  lut() {
    const pal = this.look || "none";
    if (this._lutId === pal && this._lut) return this._lut;
    this._lutId = pal;
    const p = paletteById(pal);
    if (!p.ramp) { this._lut = null; return null; }
    const n = p.ramp.length;
    this._lut = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const k = Math.min(n - 1, Math.max(0, Math.round((i / 255) * (n - 1))));
      this._lut[i] = p.ramp[k];
    }
    return this._lut;
  }

  /** Advance by dt seconds; `speed` scales the effect's own clock. */
  update(dt, speed) {
    this.t += dt * speed;
  }

  /** Draw the current instant, composite it over the backdrop, apply the palette. */
  render() {
    const f = this.frame, m = this.meta, D = m.duration || 1;
    const t = m.loop ? this.t % D : Math.min(this.t, D);
    clearFrame(f);
    const p = painterFor(f);
    p.place(this.opts.x, this.opts.y, !!this.opts.flip, this.opts.angle || 0);
    p.fade = 1;
    p.lightK = this.opts.light ?? 1;
    if (this.mod.drawBack) {
      p.layer = "back";
      this.mod.drawBack(p, t, this.opts);
    }
    p.layer = "front";
    this.mod.draw(p, t, this.opts);
    composite(f, this.img.data, this.bg);
    // the palette swap: every pixel keeps its brightness, takes the ramp's color for it
    const lut = this.lut();
    if (lut) {
      const d = this.img.data, n = f.w * f.h;
      for (let i = 0; i < n; i++) {
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        const l = (77 * r + 150 * g + 29 * b) >> 8;
        const c = lut[l];
        d[i * 4] = c & 255;
        d[i * 4 + 1] = (c >>> 8) & 255;
        d[i * 4 + 2] = (c >>> 16) & 255;
      }
    }
    return this.img;
  }
}
