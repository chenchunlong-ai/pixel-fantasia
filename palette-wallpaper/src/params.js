// Shared bits between the wallpaper page and the settings page: the scene catalog and the knobs.
// Names are i18n keys, not text: src/i18n.json holds every string for every language.

// knobs every scene understands (the runtime applies `speed` by scaling time; effects read `density`)
export const PARAMS = {
  density: { key: "pDensity", min: 0.2, max: 3, step: 0.1, def: 1, unit: "×" },
  speed: { key: "pSpeed", min: 0.2, max: 3, step: 0.1, def: 1, unit: "×" },
};

// the scenes, in the order the settings UI lists them: the twelve core weather, then ours
export const EFFECTS = [
  { id: "weather/snow", key: "fxSnow", params: ["density", "speed"] },
  { id: "weather/rain", key: "fxRain", params: ["density", "speed"] },
  { id: "weather/storm", key: "fxStorm", params: ["density", "speed"] },
  { id: "weather/blizzard", key: "fxBlizzard", params: ["density", "speed"] },
  { id: "weather/sandstorm", key: "fxSandstorm", params: ["density", "speed"] },
  { id: "weather/undersea", key: "fxUndersea", params: ["density", "speed"] },
  { id: "weather/hail", key: "fxHail", params: ["density", "speed"] },
  { id: "weather/clouds", key: "fxClouds", params: ["density", "speed"] },
  { id: "weather/fog", key: "fxFog", params: ["speed"] },
  { id: "weather/aurora", key: "fxAurora", params: ["speed"] },
  { id: "weather/fireflies", key: "fxFireflies", params: ["density", "speed"] },
  { id: "weather/shooting-stars", key: "fxShootingStars", params: ["density", "speed"] },
  { id: "weather/black-hole", key: "fxBlackHole", params: ["density", "speed"] },
  { id: "weather/gargantua", key: "fxGargantua", params: ["density", "speed"] },
  { id: "weather/rift", key: "fxRift", params: ["density", "speed"] },
  { id: "weather/otherworld-rift", key: "fxOtherworldRift", params: ["density", "speed"] },
  { id: "palette/gorgefall", key: "fxGorgefall", params: ["density", "speed"] },
  { id: "palette/heaven", key: "fxHeaven", params: ["density", "speed"] },
  { id: "palette/daisypond", key: "fxDaisyPond", params: ["density", "speed"] },
  { id: "weather/savanna-night", key: "fxSavanna", params: ["density", "speed"] },
  { id: "palette/waterfall", key: "fxWaterfall", params: ["density", "speed"] },
  { id: "palette/fire-tornado", key: "fxFireTornado", params: ["density", "speed"] },
  { id: "palette/blizzard-vortex", key: "fxBlizzardVortex", params: ["density", "speed"] },
  { id: "palette/tornado", key: "fxTornadoScene", params: ["density", "speed"] },
  { id: "scifi/data-stream", key: "fxDataStream", params: ["density", "speed"] },
];

export const EFFECT_IDS = EFFECTS.map((e) => e.id);
export const effectById = (id) => EFFECTS.find((e) => e.id === id);

/** The knobs of one scene with their defaults filled in. */
export function paramDefaults(id) {
  const e = effectById(id), out = {};
  for (const k of e ? e.params : []) out[k] = PARAMS[k].def;
  return out;
}

/** One scene's knobs: its defaults, the user's saved values, then anything ad hoc on top. */
export function paramsFor(cfg, id, extra) {
  const saved = (cfg.params && cfg.params[id]) || {};
  return Object.assign({}, paramDefaults(id), saved, extra);
}

export const MAX_RULES = 12; // the manual schedule holds at most 12 time-of-day entries

export const isExt = (id) => typeof id === "string" && id.startsWith("ext:");
// the engine's own critters, offered as pets to everyone (rendered page-side, no files needed)
export const BUILTIN_PETS = [
  "critter-butterfly", "critter-bird", "critter-bat", "critter-ghost", "critter-frog",
  "critter-snake", "critter-slime", "critter-jellyfish", "critter-wisp", "critter-eyeball", "critter-skull",
];
export const extId = (id) => (isExt(id) ? id.slice(4) : id);

export function defaultConfig() {
  return {
    version: 1,
    fx: "weather/snow", // the scene on now; "ext:<id>" = a user-loaded wallpaper file
    palette: "none", // "none" = the scene's own colors; otherwise a palettes.js id
    bg: "sky", // "sky" | "black" | "ground"
    mirror: false, // flip the whole canvas left-right
    critters: true, // the little animals some scenes carry; off = plain scene
    pets: [], // user-loaded pet files: [{ id, name, file }]
    petOn: true, // the pet layer master switch
    petCfg: {}, // { [fxId]: { [petId]: { x, y, scale, rot, flip, on } } } — per-wallpaper placement
    wallpapers: [], // user-loaded wallpaper files: [{ id, name, file, type }] ("html" | "video")
    hiddenFx: [], // internal scene ids the user deleted from the list (files stay, restorable)
    hiddenWallpapers: [], // same, for user-loaded wallpaper ids
    paused: false,
    fps: 30,
    speed: 1,
    params: {}, // { "weather/snow": { density: 1.4, speed: 0.9 } }
    rules: [], // [{ time: "08:00", fx: "weather/cherry-blossoms" }] — at each time, switch to fx
    cycle: { enabled: false, minutes: 30, list: [] }, // rotate every N minutes; list empty = every scene
    hotkey: "Ctrl+Alt+P",
    lang: "auto",
    autoStart: false,
    reloadHours: 6,
    display: { mode: "fill", align: "center" },
  };
}

/** Fill a possibly old/partial config out to a full one. */
export function normalize(cfg) {
  const d = defaultConfig(), c = Object.assign({}, d, cfg || {});
  c.params = Object.assign({}, cfg && cfg.params);
  c.rules = Array.isArray(cfg && cfg.rules)
    ? cfg.rules.filter((r) => r && r.time && r.fx).slice(0, MAX_RULES)
    : [];
  c.cycle = Object.assign({}, d.cycle, cfg && cfg.cycle);
  if (!Array.isArray(c.cycle.list)) c.cycle.list = [];
  c.fps = [15, 24, 30, 60].includes(+c.fps) ? +c.fps : 30;
  c.speed = Math.min(3, Math.max(0.2, +c.speed || 1));
  c.reloadHours = Math.min(48, Math.max(0, +c.reloadHours || 0));
  if (!c.lang) c.lang = "auto";
  if (typeof c.mirror !== "boolean") c.mirror = false;
  if (typeof c.critters !== "boolean") c.critters = true;
  if (typeof c.petOn !== "boolean") c.petOn = true;
  c.wallpapers = Array.isArray(cfg && cfg.wallpapers) ? cfg.wallpapers.filter((w) => w && w.id && w.file) : [];
  c.pets = Array.isArray(cfg && cfg.pets) ? cfg.pets.filter((p) => p && p.id && p.file) : [];
  c.hiddenFx = Array.isArray(cfg && cfg.hiddenFx) ? cfg.hiddenFx.filter((x) => typeof x === "string") : [];
  c.hiddenWallpapers = Array.isArray(cfg && cfg.hiddenWallpapers) ? cfg.hiddenWallpapers.filter((x) => typeof x === "string") : [];
  c.petCfg = (cfg && cfg.petCfg && typeof cfg.petCfg === "object") ? cfg.petCfg : {};
  // a scene that no longer ships must not leave the app pointing at nothing: fall back to the default and
  // drop it from the rules and the rotation list
  const known = (id) => EFFECT_IDS.includes(id) || isExt(id);
  if (!known(c.fx)) c.fx = d.fx;
  c.rules = c.rules.filter((r) => known(r.fx));
  c.cycle.list = c.cycle.list.filter(known);
  if (!["sky", "black", "ground"].includes(c.bg)) c.bg = "sky";
  c.display = Object.assign({ mode: "fill", align: "center" }, cfg && cfg.display);
  if (!["fill", "contain", "cover"].includes(c.display.mode)) c.display.mode = "fill";
  if (!["left", "center", "right", "top", "bottom"].includes(c.display.align)) c.display.align = "center";
  return c;
}

/** The pose of one pet on one wallpaper, with sane defaults. */
export function petPose(cfg, fxId, petId, defOn = true) {
  const slot = (cfg.petCfg[fxId] || {})[petId];
  return Object.assign({ x: 62, y: 45, scale: 1, rot: 0, flip: false, on: defOn }, slot);
}
