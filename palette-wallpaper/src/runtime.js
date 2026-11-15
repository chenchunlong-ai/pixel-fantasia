// The wallpaper page: draws the current scene full screen and owns the auto cycle + pause.
// The native shell only forwards config and the hotkeys.

import { Player, W, H } from "./player.js";
import { initPets } from "./pets.js";
import { normalize, paramsFor, EFFECT_IDS, effectById } from "./params.js";
import { FX } from "./effects.js";
import { PALETTE_IDS } from "./palettes.js";

const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d", { alpha: false });

let cfg = normalize(null);
let player = null;
let currentId = null;
let paused = false;
let raf = 0;
let last = 0;
let acc = 0;
let lastSwitch = 0;
let lastTick = 0;
let ruleKey = "";

const host = globalThis.chrome && globalThis.chrome.webview ? globalThis.chrome.webview : null;
const say = (msg) => host && host.postMessage(msg);

initPets(say);          // the pet layer rides over the scene (user pet files, skill/SKILL.md)

function speedOf(id) {
  const s = paramsFor(cfg, id).speed ?? 1;
  return cfg.speed * s;
}

const state0 = () => ({ fx: currentId, paused, t: player ? player.t : 0, palette: cfg.palette, bg: cfg.bg, mirror: cfg.mirror });

function apply(id, opts) {
  // "ext:*" ids are user-loaded wallpaper files; the shell navigates its webview to the file and
  // this page stands down (no rendering behind the external wallpaper)
  if (typeof id === "string" && id.startsWith("ext:")) {
    currentId = id;
    lastSwitch = Date.now();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    say({ type: "state", fx: id, paused: true });
    return;
  }
  const mod = FX[id] || FX["weather/snow"];
  const real = FX[id] ? id : "weather/snow";
  // the wardrobe look, backdrop, critter switch and per-scene knobs ride together
  player = new Player(mod, Object.assign({ palette: cfg.palette, bg: cfg.bg, critters: cfg.critters }, paramsFor(cfg, real), opts));
  currentId = real;
  lastSwitch = Date.now();
  // scene wallpapers are taller than 320 (e.g. 320x200): match the canvas, CSS keeps stretching it
  const [w, h] = player.meta.size || [W, H];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  document.title = "Pixel Fantasia";
  say({ type: "state", fx: real, paused });
}

function setPaused(p) {
  paused = !!p;
  if (paused) {
    cancelAnimationFrame(raf);
    raf = 0;
    say({ type: "state", fx: currentId, paused });
  } else if (!raf) {
    last = 0;
    acc = 0;
    raf = requestAnimationFrame(loop);
    say({ type: "state", fx: currentId, paused });
  }
}

function nextInCycle() {
  const list = (cfg.cycle.list || []).filter((id) => FX[id]);
  const ids = list.length ? list : EFFECT_IDS;
  const i = ids.indexOf(currentId);
  return ids[(i + 1) % ids.length];
}

// ---- the schedule: manual time-of-day rules, then the auto cycle --------------------------------
const minutesOf = (s) => {
  const [h, m] = String(s || "0:0").split(":").map((v) => parseInt(v, 10) || 0);
  return ((h % 24) * 60 + m) % 1440;
};

/** The rule in force right now: the latest one at or before now (before that, yesterday's last). */
function ruleInForce(now) {
  if (!cfg.rules.length) return null;
  const m = now.getHours() * 60 + now.getMinutes();
  let best = null;
  for (const r of cfg.rules) {
    const at = minutesOf(r.time);
    if (at <= m && (!best || at > best.at)) best = { at, r };
  }
  if (!best) return { key: "pre:" + cfg.rules[0].time, fx: cfg.rules[0].fx };
  return { key: best.r.time + "|" + best.r.fx, fx: best.r.fx };
}

function tickClock() {
  const now = new Date();
  const r = ruleInForce(now);
  if (r && r.key !== ruleKey) {
    ruleKey = r.key;
    if (r.fx !== currentId && FX[r.fx]) {
      apply(r.fx);
      return;
    }
  }
  const cyc = cfg.cycle;
  if (cyc && cyc.enabled && cyc.minutes > 0 && Date.now() - lastSwitch >= cyc.minutes * 60000) {
    apply(nextInCycle());
  }
}

// ---- the render loop ----------------------------------------------------------------------------
function loop(now) {
  raf = requestAnimationFrame(loop);
  if (!last) last = now;
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const step = 1 / cfg.fps;
  acc += dt;
  if (acc < step) return;
  const d = Math.min(0.25, acc);
  acc = 0;
  if (now - lastTick > 2000) {
    lastTick = now;
    tickClock();
  }
  player.update(d, speedOf(currentId));
  ctx.putImageData(player.render(), 0, 0);
}

// ---- how the canvas meets the screen ------------------------------------------------------------
function applyDisplay() {
  const d = cfg.display || {};
  canvas.style.objectFit = ["fill", "contain", "cover"].includes(d.mode) ? d.mode : "fill";
  const map = { left: "left center", right: "right center", top: "center top", bottom: "center bottom", center: "center center" };
  canvas.style.objectPosition = map[d.align] || "center center";
  canvas.style.transform = cfg.mirror ? "scaleX(-1)" : "none";
}

function applyConfig(raw) {
  const before = currentId;
  const wasPaused = paused;
  cfg = normalize(raw);
  ruleKey = ""; // new rules take force right away
  applyDisplay();
  if (!currentId || !before || cfg.fx !== before) apply(cfg.fx);
  else {
    // same scene, but its knobs / palette / backdrop may have changed: rebuild without
    // restarting the clock, with the new look and backdrop
    const t = player.t;
    player = new Player(FX[before], Object.assign({ palette: cfg.palette, bg: cfg.bg, critters: cfg.critters }, paramsFor(cfg, before)));
    player.t = t;
    const [w, h] = player.meta.size || [W, H];
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  if (wasPaused !== !!cfg.paused) setPaused(cfg.paused);
}

globalThis.pixelFX = {
  // the shell calls this with JSON
  apply(json) {
    try {
      applyConfig(typeof json === "string" ? JSON.parse(json) : json);
      if (globalThis.pixelFXPets) globalThis.pixelFXPets.apply(typeof json === "string" ? JSON.parse(json) : json);
      globalThis.pixelFXLastError = "";
    } catch (e) {
      globalThis.pixelFXLastError = String((e && e.stack) || e);
      say({ type: "error", message: String((e && e.message) || e), stack: String((e && e.stack) || "").slice(0, 1500) });
    }
  },
  command(name) {
    if (name === "pause") setPaused(true);
    else if (name === "resume") setPaused(false);
    else if (name === "toggle") setPaused(!paused);
    else if (name === "next") apply(nextInCycle());
    else if (name === "reload") location.reload();
    return { fx: currentId, paused, palette: cfg.palette };
  },
  state() {
    return { fx: currentId, paused, t: player ? player.t : 0, palette: cfg.palette, bg: cfg.bg, mirror: cfg.mirror };
  },
  // used when the page is opened in a plain browser (dev preview)
  browser(json) {
    applyConfig(json);
  },
  // paint exactly one frame right now (headless checks, and a nudge when the tab was hidden)
  paint() {
    if (player) {
      player.update(1 / cfg.fps, speedOf(currentId));
      ctx.putImageData(player.render(), 0, 0);
    }
    return state0();
  },
};

apply(cfg.fx);
applyDisplay();
setPaused(false);

// the browser fallback: ?fx=... ?palette=... ?bg=... or a config saved by the settings page
if (!host) {
  const q = new URLSearchParams(location.search);
  const saved = localStorage.getItem("pixelfx-palette.config");
  let c;
  try {
    c = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(cfg));
  } catch (e) {
    c = JSON.parse(JSON.stringify(cfg));
  }
  if (q.get("fx")) c.fx = q.get("fx");
  if (q.get("palette")) c.palette = q.get("palette");
  if (q.get("bg")) c.bg = q.get("bg");
  if (q.get("mirror")) c.mirror = q.get("mirror") === "1";
  applyConfig(c);
} else {
  say({ type: "ready" });
}
