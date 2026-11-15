// 美元大钞像花瓣一样从天空飘落。The flight is the falling-leaf style after Sprite Fusion's
// open-source VFX (https://www.spritefusion.com/pixel-art-vfx/falling-leaves), MIT License,
// Copyright (c) 2026 Hugo Duprez; the note itself is a stylised pixel motif (see _bills.js).
import { fit, mix, hex } from "../../core/index.js";
import { clip, rows } from "./_lib.js";
import { billRain, bill, pile } from "./_bills.js";

export const meta = {
  name: "Dollar rain",
  desc: "Green dollar bills flutter down like petals, flipping slowly on the breeze and settling into a little pile on the ground.",
  tags: ["weather", "money", "usd", "dollar", "banknote", "rain", "wind", "falling", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#0e3a20", "#1e5c34", "#3a7a4a", "#88b088", "#c8d8c0", "#f0f4e8"],
    density: 1,
    seed: 22,
  },
};

const drawUsd = (q, x, y, ang, flip, len, C, a) => bill(q, x, y, ang, flip, len, C, a);

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 6);
  // a dusk with a green cast, so the sky's stars don't read as notes
  const top = hex("#0a0e0c"), low = mix(hex("#0e1610"), C[1], 0.3);
  rows(p, meta, -170, 9, (y, R) => {
    const k = (y + 170) / 180;
    R.c.fill(mix(top, low, k * k));
    R.a.fill(0.3 + 0.12 * k);
    R.b.fill(1);
  });
  pile(q, S, C, o.density, drawUsd);
  billRain(q, t, S, C, 0, o.density, drawUsd);
}

export function draw(p, t, o) {
  billRain(clip(p, meta), t, o.seed, fit(o.palette, 6), 1, o.density, drawUsd);
}
