// Banknotes fluttering down like petals or leaves — the falling style after Sprite Fusion's
// open-source falling leaves (https://www.spritefusion.com/pixel-art-vfx/falling-leaves), MIT
// License, Copyright (c) 2026 Hugo Duprez. Shared by the RMB and USD rain effects: the flight is
// identical (a slow pendulum flip, a ride on the gust, a rest in the ground pile), only the
// palette differs, and the bill's face is a stylised pixel motif — a border, a portrait plate,
// an emblem disc — never a reproduction of any real note.
import { rand, wrap, TAU } from "../../core/index.js";
import { trips } from "./_lib.js";

const D = 10, FLOOR = 1;
const gust = (t) => 18 * Math.sin((TAU * t) / D - 0.8) + 6 * Math.sin((TAU * 2 * t) / D + 0.5);

// one bill's flight, shared by both currencies. C = 6 palette entries, draw(q,...) paints it
export function billRain(q, t, S, C, front, dn, draw) {
  const sd = S * 13;
  trips(t, D, Math.round((front ? 9 : 16) * dn), sd, 1, 2, (u, k, m, i) => {
    const j = wrap(k, m), R = (c) => rand(sd, i, j, c), dur = D / m, tf = dur * 0.8, a = Math.min(u * dur, tf), rest = u * dur - tf;
    const born = t - u * dur, x0 = -190 + R(1) * 340, y0 = -188;
    // the gentle sink of paper: it lands just as its time in the air runs out
    const vy = (FLOOR + (front ? 2 : 0) - y0) / tf, vx = 6 + R(2) * 8;
    const at = (aa) => x0 + vx * aa + (gust(born + aa) - gust(born)) * (front ? 1 : 0.65) + Math.sin((R(3) + aa * (0.5 + R(4))) * TAU) * (front ? 7 : 4);
    const len = (front ? 7.5 : 5.5) + R(5) * 1.8;
    if (rest > 0) {
      // settled in the ground pile, fading away
      const fade = 1 - rest / (dur - tf);
      return void (fade > 0.2 && draw(q, at(tf), FLOOR - 1, (R(6) - 0.5) * 0.6, 0.45 + fade * 0.3, len * (0.4 + 0.6 * fade), C, 1));
    }
    const x = at(a), y = y0 + vy * a;
    const flip = Math.cos(R(7) * TAU + a * (R(8) < 0.35 ? 3.2 : 1.1)); // paper flips slowly, sometimes tumbling
    const ang = Math.cos(R(9) * TAU + a * 0.9) * 0.55;                 // tilt swings with the flutter
    draw(q, x, y, ang, flip, len, C, 1);
  });
}

// a stylised note: a rectangle with a dark border, a portrait plate, an emblem disc and a value
// band — squashed across as it flips, the back plain and deeper. Readable at ~7px half-length.
export function bill(q, x, y, ang, flip, len, C, a) {
  const fs = 0.35 + 0.65 * Math.abs(flip), back = flip < -0.25, c = Math.cos(ang), s = Math.sin(ang), e = len + 1;
  const W = len * 0.46;
  const face = back ? [C[2], C[2], C[3]] : [C[3], C[4], C[5]];
  q.shade(x - e, y - e, x + e, y + e, (px, py, out) => {
    const dx = px - x, dy = py - y;
    const u = (dx * c + dy * s) / len, v = (-dx * s + dy * c) / (W * fs);
    const d = Math.max(Math.abs(u), Math.abs(v));
    if (d > 1.06) return;
    out.a = a;
    if (d > 0.86) { out.c = C[0]; return; }                       // the dark border
    if (back) { out.c = Math.abs(u) < 0.55 && Math.abs(v) < 0.3 ? C[1] : C[2]; return; } // the back: plain with a band
    // the face: light paper, a darker plate left of centre, an emblem disc, corner value blocks
    const du = u + 0.42, dv = v * 1.25;
    if (du * du + dv * dv < 0.14) { out.c = C[1]; return; }       // portrait plate
    if ((u - 0.52) * (u - 0.52) + v * v * 1.6 < 0.05) { out.c = C[4]; return; } // emblem disc
    if (Math.abs(u) > 0.62 && Math.abs(v) > 0.34) { out.c = C[1]; return; }     // corner blocks
    if (Math.abs(v) < 0.09 && u > 0.1) { out.c = C[1]; return; }  // the value band
    out.c = v < -0.1 ? face[2] : face[0];                          // paper, shaded along the top edge
  });
}

// bills already landed, lying in a band along the floor; shaded once per seed and replayed
const PILES = new Map();
export function pile(q, S, C, dn, draw) {
  const key = S + C.join() + dn;
  let px = PILES.get(key);
  if (!px) {
    px = [];
    const rec = {
      shade(x0, y0, x1, y1, fn) {
        const o = { c: 0, a: 1 };
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
          for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
            o.c = 0; o.a = 1;
            const c = fn(x + 0.5, y + 0.5, o) || o.c;
            if (c) px.push(x + 0.5, y + 0.5, c, o.a);
          }
      },
    };
    for (let i = 0; i < Math.round(14 * dn); i++)
      draw(rec, -160 + rand(S, i, 81) * 320, FLOOR - 2 + Math.floor(rand(S, i, 82) * 3) * 2, (rand(S, i, 83) - 0.5) * 0.8, 0.5 + rand(S, i, 84) * 0.3, 4.5 + rand(S, i, 85) * 1.6, C, 1);
    PILES.set(key, px);
  }
  for (let i = 0; i < px.length; i += 4) q.dot(px[i], px[i + 1], px[i + 2], px[i + 3]);
}
