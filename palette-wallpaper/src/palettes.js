// The palette wardrobe: "none" keeps the scene's own colors; every other entry is one of the
// engine's dark-to-bright ramps. Swapping one of these on reindexes every pixel in the scene,
// which is what turns one scene into another in a single click.

import { PAL, hex } from "../../src/core/color.js";

const NAMES = {
  fire: "火焰", ember: "余烬", lava: "熔岩", smoke: "烟", dust: "尘",
  ice: "寒冰", water: "水", electric: "电光", volt: "闪电", poison: "剧毒",
  holy: "圣光", heal: "治愈", arcane: "奥术", shadow: "暗影", blood: "血",
  earth: "土", stone: "石", gold: "黄金", leaf: "叶", wood: "木",
  metal: "金属", bone: "骨", neon: "霓虹", cyber: "赛博", matrix: "矩阵",
  candy: "糖果", night: "夜",
};

const EN = {
  fire: "Fire", ember: "Ember", lava: "Lava", smoke: "Smoke", dust: "Dust",
  ice: "Ice", water: "Water", electric: "Electric", volt: "Volt", poison: "Poison",
  holy: "Holy", heal: "Heal", arcane: "Arcane", shadow: "Shadow", blood: "Blood",
  earth: "Earth", stone: "Stone", gold: "Gold", leaf: "Leaf", wood: "Wood",
  metal: "Metal", bone: "Bone", neon: "Neon", cyber: "Cyber", matrix: "Matrix",
  candy: "Candy", night: "Night",
};

export const PALETTES = [
  { id: "none", ramp: null },
  ...Object.keys(PAL).map((id) => ({ id, ramp: PAL[id].map(hex), key: id })),
].map((p) => Object.assign(p, { name: NAMES[p.id] || p.id, en: EN[p.id] || p.id }));

export const PALETTE_IDS = PALETTES.map((p) => p.id);
export const paletteById = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];
