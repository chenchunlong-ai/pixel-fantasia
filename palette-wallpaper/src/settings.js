// The settings window: pick the scene, pick the palette (or one-click swap it), set the
// backdrop and mirror, with a live preview that uses the same renderer as the wallpaper.

import { Player } from "./player.js";
import { EFFECTS, PARAMS, MAX_RULES, effectById, normalize, paramDefaults, isExt, extId, petPose, BUILTIN_PETS } from "./params.js";
import { createBuiltinDrawer, BUILTIN_MODS } from "./pets.js";
import { FX } from "./effects.js";
import { PALETTES, PALETTE_IDS } from "./palettes.js";
import { LANGS, LANG_NAMES, applyStatic, makeT, resolveLang } from "./i18n.js";

const $ = (s) => document.querySelector(s);
const host = globalThis.chrome && globalThis.chrome.webview ? globalThis.chrome.webview : null;
const say = (msg) => (host ? host.postMessage(msg) : null);

let cfg = normalize(null);
let paused = false;
let dirty = false;
let packaged = false; // Store build: no shortcuts, no self-uninstall, autostart lives in Windows settings
let lang = "en";
let t = makeT("en");

// ---- helpers ---------------------------------------------------------------------------------
const clone = (o) => JSON.parse(JSON.stringify(o));
/** display name of a user wallpaper: never show the file extension (older imports kept it) */
const wallName = (w) => (w && w.name ? w.name.replace(/\.[^.]+$/, "") : "");
const nameOf = (id) => {
  if (isExt(id)) {
    const w = (cfg.wallpapers || []).find((x) => x.id === extId(id));
    return w ? (wallName(w) || id) : id;
  }
  const e = effectById(id);
  return e ? t(e.key) : id;
};
/** The scene dropdown: two groups — the user's wallpaper files first (so imports are easy to
    find), then the built-in scenes. */
const effectOptions = (sel, value) => {
  sel.innerHTML = "";
  const g1 = document.createElement("optgroup");
  g1.label = t("mineTitle");
  sel.append(g1);
  for (const w of cfg.wallpapers || []) {
    if ((cfg.hiddenWallpapers || []).includes(w.id)) continue;
    const o = document.createElement("option");
    o.value = "ext:" + w.id;
    o.textContent = wallName(w);
    g1.append(o);
  }
  const g2 = document.createElement("optgroup");
  g2.label = t("optSystem");
  sel.append(g2);
  for (const e of EFFECTS) {
    if ((cfg.hiddenFx || []).includes(e.id)) continue;
    const o = document.createElement("option");
    o.value = e.id;
    o.textContent = t(e.key);
    g2.append(o);
  }
  const visible = [...sel.options].some((o) => o.value === value);
  sel.value = visible ? value : sel.options[0].value;
};
const touch = () => {
  dirty = true;
  // any change resumes the wallpaper automatically — pause is only ever manual (the 暂停 button)
  if (paused) {
    paused = false;
    cfg.paused = false;
    say({ type: "pause", value: false });
    $("#pause").textContent = t("pauseBtn");
    updateState();
  }
  $("#msg").textContent = t("dirty");
  $("#msg").className = "";
};

// ---- language ---------------------------------------------------------------------------------
function fillLangBox() {
  const sel = $("#lang");
  sel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = t("langAuto");
  sel.append(auto);
  for (const code of LANGS) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = LANG_NAMES[code];
    sel.append(o);
  }
  sel.value = cfg.lang && cfg.lang !== "auto" ? cfg.lang : "auto";
}

function applyLang() {
  lang = resolveLang(cfg.lang);
  t = makeT(lang);
  document.documentElement.lang = lang;
  document.title = t("settingsTitle");
  applyStatic(t);
  fillLangBox();
  fillAll();
}

// ---- the pieces ------------------------------------------------------------------------------
function fillEffects() {
  effectOptions($("#fx"), cfg.fx);
}

/** The palette wardrobe: one swatch per ramp, plus "original colors" first. */
let palOpen = false;   // the palette wardrobe stays folded until asked for

function palName(p) {
  return p.id === "none" ? t("paletteNone") : (lang === "zh" ? p.name : p.en);
}

function fillSwatches() {
  const box = $("#swatches");
  box.innerHTML = "";
  box.style.display = palOpen ? "flex" : "none";
  for (const p of PALETTES) {
    const chip = document.createElement("button");
    chip.className = "chip" + (cfg.palette === p.id ? " on" : "");
    chip.textContent = palName(p);
    chip.onclick = () => {
      cfg.palette = p.id;
      applyNow();
      fillSwatches();
      if (player) player.look = cfg.palette;
    };
    box.append(chip);
  }
  const cur = PALETTES.find((p) => p.id === cfg.palette);
  $("#palCur").textContent = cur ? palName(cur) : "";
  $("#palToggle").textContent = palOpen ? t("palHide") : t("palShow") + " (" + PALETTES.length + ")";
}

$("#palToggle").onclick = () => { palOpen = !palOpen; fillSwatches(); };

/** One-click swap: jump to the next palette in the wardrobe (skipping "original"). */
function swapPalette() {
  const ids = PALETTE_IDS.filter((id) => id !== "none");
  const i = ids.indexOf(cfg.palette);
  cfg.palette = ids[(i + 1) % ids.length];
  applyNow();
  fillSwatches();
  if (player) player.look = cfg.palette;
}

function fillParams() {
  const box = $("#params");
  const id = $("#fx").value;
  const e = effectById(id);
  box.innerHTML = "";
  const title = document.createElement("div");
  title.className = "hint";
  title.style.margin = "0 0 4px";
  // ext wallpapers declare their own parameters (window.wallParams, relayed by the shell):
  // they get a collapsed "此壁纸的参数" panel instead of the built-in knob set
  const declared = isExt(id) ? (extParams[extId(id)] || null) : null;
  title.textContent = e ? t("paramsOf", { name: t(e.key) }) : (declared ? t("extParams") : nameOf(id));
  box.append(title);
  if (declared) {
    const vals0 = (cfg.params && cfg.params[id]) || {};
    const btn = document.createElement("button");
    btn.textContent = "▸ " + t("extParams");
    const panel = document.createElement("div");
    panel.style.display = "none";
    btn.onclick = () => {
      const open = panel.style.display === "none";
      panel.style.display = open ? "" : "none";
      btn.textContent = (open ? "▾ " : "▸ ") + t("extParams");
    };
    box.append(btn);
    box.append(panel);
    if (!declared.length) {
      panel.append(Object.assign(document.createElement("div"), { className: "hint", textContent: t("paramsNone") }));
      return;
    }
    for (const p of declared) {
      const row = document.createElement("div");
      row.className = "slider";
      const v0 = vals0[p.key] != null ? vals0[p.key] : p.def;
      row.innerHTML = `<label>${p.label || p.key}</label><input type="range" min="${p.min}" max="${p.max}" step="${p.step || 0.01}" value="${v0}"><output>${v0}</output>`;
      const input = row.querySelector("input");
      const out = row.querySelector("output");
      input.oninput = () => {
        const v = +input.value;
        out.textContent = v;
        cfg.params[id] = Object.assign({}, cfg.params[id] || {}, { [p.key]: v });
        touch();
        restartPreview();
      };
      panel.append(row);
    }
    return;
  }
  const vals = Object.assign(paramDefaults(id), (cfg.params && cfg.params[id]) || {});
  for (const key of e ? e.params : []) {
    const def = PARAMS[key];
    const row = document.createElement("div");
    row.className = "slider";
    row.innerHTML = `<label>${t(def.key)}</label><input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${vals[key]}"><output>${(+vals[key]).toFixed(1)}${def.unit || ""}</output>`;
    const input = row.querySelector("input");
    const out = row.querySelector("output");
    input.oninput = () => {
      const v = +input.value;
      out.textContent = v.toFixed(1) + (def.unit || "");
      cfg.params[id] = Object.assign(paramDefaults(id), cfg.params[id], { [key]: v });
      touch();
      restartPreview();
    };
    box.append(row);
  }
  if (!e || !e.params.length)
    box.append(Object.assign(document.createElement("div"), { className: "hint", textContent: t("paramsNone") }));
}

/** parameter declarations reported by ext wallpapers (window.wallParams → shell → here) */
let extParams = {};

function fillCycle() {
  $("#cycOn").checked = !!cfg.cycle.enabled;
  $("#cycMin").value = cfg.cycle.minutes;
}

/** One row of the manual schedule: a time and the scene it switches to. */
function ruleRow(rule, i) {
  const row = document.createElement("div");
  row.className = "rule";
  const time = document.createElement("input");
  time.type = "time";
  time.value = rule.time;
  time.onchange = () => {
    cfg.rules[i].time = time.value || "08:00";
    touch();
  };
  const fx = document.createElement("select");
  effectOptions(fx, rule.fx);
  fx.onchange = () => {
    cfg.rules[i].fx = fx.value;
    touch();
  };
  const x = document.createElement("button");
  x.className = "x";
  x.textContent = "×";
  x.title = t("delete");
  x.onclick = () => {
    cfg.rules.splice(i, 1);
    touch();
    fillRules();
  };
  row.append(time, fx, x);
  return row;
}

function fillRules() {
  const box = $("#rules");
  box.innerHTML = "";
  cfg.rules.forEach((r, i) => box.append(ruleRow(r, i)));
}

function fillAll() {
  fillEffects();
  $("#speed").value = cfg.speed;
  $("#speedV").textContent = (+cfg.speed).toFixed(1) + "×";
  $("#fps").value = cfg.fps;
  $("#fpsV").textContent = t("fpsValue", { n: cfg.fps });
  $("#bg").value = cfg.bg || "sky";
  for (const o of $("#bg").options) o.textContent = t({ sky: "bgSky", black: "bgBlack", ground: "bgGround" }[o.value]);
  $("#mirror").checked = !!cfg.mirror;
  $("#critters").checked = cfg.critters !== false;
  $("#pv").className = cfg.mirror ? "mirrored" : "";
  $("#hotkey").value = cfg.hotkey;
  $("#autoStart").checked = !!cfg.autoStart;
  $("#reloadHours").value = cfg.reloadHours;
  const d = cfg.display || { mode: "fill", align: "center" };
  const modeText = { fill: "dispFill", contain: "dispFit", cover: "dispCover" };
  const alignText = { center: "alignCenter", left: "alignLeft", right: "alignRight", top: "alignTop", bottom: "alignBottom" };
  for (const o of $("#dispMode").options) o.textContent = t(modeText[o.value] || o.value);
  for (const o of $("#dispAlign").options) o.textContent = t(alignText[o.value] || o.value);
  $("#dispMode").value = d.mode;
  $("#dispAlign").value = d.align;
  $("#dispAlignRow").style.opacity = d.mode === "cover" ? "1" : "0.45";
  fillSwatches();
  fillCycle();
  fillRules();
  updateMineRow();
  fillPets();
  fillParams();
  $("#pvName").textContent = nameOf(cfg.fx);
  $("#pause").textContent = paused ? t("resumeBtn") : t("pauseBtn");
  $("#uninstallRow").className = "row" + (packaged ? " hidden" : "");
  $("#storeRow").className = "row" + (packaged ? "" : " hidden");
  updateState();
}

function updateState() {
  if (!cfg) return;
  const st = $("#st");
  if (st) st.textContent = paused ? t("pausedState") : t("running") + " · " + nameOf(cfg.fx);
}

// ---- live preview ----------------------------------------------------------------------------
const canvas = $("#pv");
const ctx = canvas.getContext("2d", { alpha: false });
let player = null;
let raf = 0;
let last = 0;

function restartPreview() {
  const id = $("#fx").value;
  // user html wallpapers: a live srcdoc preview (the shell ships every wallpaper's CSP'd html in
  // cfg.wallHtmls); videos and anything missing ride the static card as before
  if (isExt(id)) {
    player = null;
    const w = (cfg.wallpapers || []).find((x) => x.id === extId(id));
    const html = (cfg.wallHtmls || {})[extId(id)] || null;
    let f = $("#pvWall");
    if (w && w.type !== "video" && html) {
      canvas.width = 320; canvas.height = 180;
      ctx.fillStyle = "#15131f"; ctx.fillRect(0, 0, 320, 180);
      if (!f) {
        f = document.createElement("iframe");
        f.id = "pvWall";
        f.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;";
        pvBox.insertBefore(f, $("#pvPets"));          // above the canvas, under the pet overlay
      }
      f.style.transform = cfg.mirror ? "scaleX(-1)" : "";
      if (f.getAttribute("srcdoc") !== html) f.setAttribute("srcdoc", html);
      // forward the wallpaper's own parameter values into the preview (same hooks as the desktop)
      const fwd = () => {
        try {
          const w = f.contentWindow;
          const vals = (cfg.params[id]) || {};
          if (w && typeof w.wallParam === "function") for (const k in vals) w.wallParam(k, vals[k]);
        } catch (e) { /* frame not ready */ }
      };
      f.onload = fwd;
      setTimeout(fwd, 400);
    } else {
      if (f) f.remove();
      canvas.width = 320; canvas.height = 180;
      ctx.fillStyle = "#15131f"; ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#9a93b5"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(t("extPreview"), 160, 84);
      ctx.fillText(nameOf(id).slice(0, 30), 160, 104);
    }
    $("#pvName").textContent = nameOf(id);
    layoutPreviewPets();                                  // (re)build the pet overlay above the iframe
    updateState();                                        // "running · <name>" must follow the new fx
    return;
  }
  if ($("#pvWall")) $("#pvWall").remove();
  // the ext preview parked its pets on an overlay canvas (#pvPetCv) that is only repainted while
  // an external wallpaper is showing — switching back to a scene must clear it, or the last
  // external wallpaper's pets keep sitting on top of the new 2D preview (seen with 3D wallpapers)
  const petOverlay = $("#pvPets");
  if (petOverlay) petOverlay.innerHTML = "";
  const p = Object.assign(paramDefaults(id), cfg.params[id] || {}, { palette: cfg.palette, bg: cfg.bg, critters: cfg.critters });
  player = new Player(FX[id], p);
  // scene wallpapers are taller than 320 (e.g. 320x200): match the preview canvas to them
  const [w, h] = player.meta.size || [320, 180];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  $("#pvName").textContent = nameOf(id);
  updateState();                                          // same here: internal scenes
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - (last || now)) / 1000);
  last = now;
  if (!player) { drawExtPreviewPets(); return; }      // ext preview: keep the pet overlay alive
  player.update(dt, cfg.speed * ((cfg.params[$("#fx").value] || {}).speed || 1));
  ctx.putImageData(player.render(), 0, 0);
  if (typeof drawPreviewPets === "function") drawPreviewPets();
}

// ---- wiring ----------------------------------------------------------------------------------
$("#fx").onchange = () => {
  cfg.fx = $("#fx").value;
  touch();
  fillParams();
  updateMineRow();
  restartPreview();
  updateFxControls();
};
$("#pause").onclick = () => {
  paused = !paused;
  $("#pause").textContent = paused ? t("resumeBtn") : t("pauseBtn");
  updateState();
  say({ type: "pause", value: paused });
};
$("#swap").onclick = swapPalette;
let speedTimer = 0;
$("#speed").oninput = () => {
  cfg.speed = +$("#speed").value;
  $("#speedV").textContent = cfg.speed.toFixed(1) + "×";
  touch();
  // html/video wallpapers get the speed live (wallwrap forwards it on the next push)
  clearTimeout(speedTimer);
  speedTimer = setTimeout(applyNow, 250);
};
$("#fps").oninput = () => {
  cfg.fps = +$("#fps").value;
  $("#fpsV").textContent = t("fpsValue", { n: cfg.fps });
  touch();
};
/** fps only throttles the internal engine — html wallpapers throttle themselves */
function updateFxControls() {
  $("#fps").disabled = isExt($("#fx").value);
  $("#fps").style.opacity = $("#fps").disabled ? "0.4" : "1";
}
$("#bg").onchange = () => {
  cfg.bg = $("#bg").value;
  touch();
  restartPreview();
};
$("#mirror").onchange = () => {
  cfg.mirror = $("#mirror").checked;
  $("#pv").className = cfg.mirror ? "mirrored" : "";
  if ($("#pvWall")) $("#pvWall").style.transform = cfg.mirror ? "scaleX(-1)" : "";
  touch();
};
$("#critters").onchange = () => {
  cfg.critters = $("#critters").checked;
  touch();
  restartPreview();
};
$("#cycOn").onchange = () => {
  cfg.cycle.enabled = $("#cycOn").checked;
  touch();
};
$("#cycMin").onchange = () => {
  cfg.cycle.minutes = Math.max(1, +$("#cycMin").value || 30);
  touch();
};
$("#addRule").onclick = () => {
  if (cfg.rules.length >= MAX_RULES) {
    $("#msg").textContent = t("ruleMax");
    $("#msg").className = "";
    return;
  }
  const now = new Date();
  cfg.rules.push({ time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, fx: $("#fx").value });
  touch();
  fillRules();
};
$("#hotkey").onchange = () => {
  cfg.hotkey = $("#hotkey").value.trim() || "Ctrl+Alt+P";
  touch();
};
$("#autoStart").onchange = () => {
  cfg.autoStart = $("#autoStart").checked;
  touch();
};
$("#reloadHours").onchange = () => {
  cfg.reloadHours = Math.max(0, +$("#reloadHours").value || 0);
  touch();
};
$("#lang").onchange = () => {
  cfg.lang = $("#lang").value;
  applyLang();
  restartPreview();
  touch();
};
$("#dispMode").onchange = () => {
  cfg.display = Object.assign({ align: "center" }, cfg.display, { mode: $("#dispMode").value });
  fillAll();
  touch();
};
$("#dispAlign").onchange = () => {
  cfg.display = Object.assign({ mode: "fill" }, cfg.display, { align: $("#dispAlign").value });
  touch();
};
$("#save").onclick = () => {
  dirty = false;
  $("#msg").textContent = t("saved");
  $("#msg").className = "saved";
  say({ type: "save", config: cfg });
};
$("#close").onclick = () => say({ type: "close" });
$("#setLock").onclick = () => {
  $("#msg").textContent = t("dirty");
  $("#msg").className = "";
  say({ type: "setLockScreen" });
};
$("#uninstall").onclick = () => {
  if (confirm(t("uninstallConfirm"))) say({ type: "uninstall" });
};

// Ctrl+S saves, Esc closes: the two things people try first
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    $("#save").click();
  } else if (e.key === "Escape") {
    say({ type: "close" });
  }
});

// ---- the container: my wallpapers, my pets ----------------------------------------------------

/** 本地壁纸的三件事，就在"当前壁纸"旁边：加载 / 删除（当前选中的） / 恢复（取消隐藏全部） */
function updateMineRow() {
  const ext = isExt($("#fx").value);
  const w = ext ? (cfg.wallpapers || []).find((x) => x.id === extId($("#fx").value)) : null;
  const del = $("#delWallpaper");
  del.disabled = !w;
  del.style.opacity = w ? "1" : "0.4";
  const ren = $("#renameWallpaper");
  ren.disabled = !w;
  ren.style.opacity = w ? "1" : "0.4";
}

$("#delWallpaper").onclick = () => {
  const id = $("#fx").value;
  const w = isExt(id) ? (cfg.wallpapers || []).find((x) => x.id === extId(id)) : null;
  if (!w) return;
  if (!confirm(t("deleteWallpaperConfirm", { name: w.name }))) return;
  say({ type: "removeWallpaper", id: w.id });
};

$("#renameWallpaper").onclick = () => {
  const id = $("#fx").value;
  const w = isExt(id) ? (cfg.wallpapers || []).find((x) => x.id === extId(id)) : null;
  if (!w) return;
  const cur = wallName(w);
  const nm = prompt(t("renamePrompt", { name: cur }), cur);
  if (nm && nm.trim() && nm.trim() !== cur) say({ type: "renameWallpaper", id: w.id, name: nm.trim() });
};

function fillPets() {
  // compact: enabled pets as chips, the full catalogue hidden behind a toggle
  const all = [
    ...BUILTIN_PETS.map((id) => ({ id, name: t("pet_" + id.slice(8)), builtin: true })),
    ...(cfg.pets || []).map((p) => ({ ...p, builtin: false })),
  ];
  const enabled = [];
  const boxE = $("#petEnabled"), boxA = $("#petAll");
  boxE.innerHTML = ""; boxA.innerHTML = "";
  for (const pet of all) {
    const pose = petPose(cfg, cfg.fx, pet.id, false);
    const chip = document.createElement("button");
    chip.className = "chip" + (pose.on ? " on" : "");
    chip.textContent = pet.name;
    chip.onclick = () => {
      pose.on = !pose.on;
      cfg.petCfg[cfg.fx] = cfg.petCfg[cfg.fx] || {};
      cfg.petCfg[cfg.fx][pet.id] = pose;
      applyNow();                                        // the pet appears on the wallpaper right away
      fillPets();
    };
    if (pose.on) { boxE.append(chip); enabled.push(pet.name); }
    boxA.append(chip);
  }
  boxA.style.display = allOpen ? "flex" : "none";
  $("#petToggleAll").textContent = allOpen ? t("petAllHide") : t("petAllShow") + " (" + all.length + ")";
  $("#petEnabledNote").textContent = enabled.length ? "" : t("petEnabledNone");
}

function applyNow() {
  dirty = false;
  $("#msg").textContent = t("saved");
  $("#msg").className = "saved";
  say({ type: "save", config: cfg });
}

let allOpen = false;

$("#petToggleAll").onclick = () => { allOpen = !allOpen; fillPets(); };

// ---- top-bar menus: click to open, click elsewhere / again to close ---------------------------
for (const menu of document.querySelectorAll(".menu")) {
  menu.querySelector(".menuBtn").onclick = (e) => {
    e.stopPropagation();
    const was = menu.classList.contains("open");
    for (const m of document.querySelectorAll(".menu")) m.classList.remove("open");
    if (!was) menu.classList.add("open");
  };
}
addEventListener("click", () => { for (const m of document.querySelectorAll(".menu")) m.classList.remove("open"); });
// keep the menu open while clicking inside its panel
document.querySelectorAll(".menuPanel").forEach((p) => p.addEventListener("click", (e) => e.stopPropagation()));

// the authoring skill ships inside the app — save it to the user's documents folder on click
$("#skillSave").onclick = () => say({ type: "saveSkill" });

// "one sentence -> a wallpaper": copy a ready-to-paste prompt (the full authoring spec
// plus two fill-in templates). The spec ships inside the shell, so we ask for it first.
$("#skillPrompt").onclick = () => {
  $("#promptHint").textContent = "";
  say({ type: "getSkillText" });
};

async function copySkillPrompt(spec) {
  const body = [
    t("skillPromptIntro"),
    "",
    t("skillPromptTplWall"),
    t("skillPromptTplPet"),
    "",
    t("skillPromptSpecHead"),
    "",
    String(spec || "").trim(),
    "",
    t("skillPromptSpecTail"),
  ].join("\n");
  try {
    await navigator.clipboard.writeText(body);
    $("#promptHint").textContent = t("skillPromptCopied");
  } catch (e) {
    $("#promptHint").textContent = t("skillPromptFail");     // clipboard denied: say so
  }
}

// the renderer profile grows with 3D wallpapers — show the real size and let the user reclaim it
$("#cacheClear").onclick = () => {
  $("#cacheHint").textContent = "";
  say({ type: "clearCache" });
};
// ---- about panel: version + contact links (click to copy — WACK forbids opening browsers) ----
const REPO_URLS = {
  gh: "https://github.com/chenchunlong-ai/pixel-fantasia",
  gitee: "",                             // 建 Gitee 镜像后填入，空则隐藏入口
};
async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    $("#copyHint").textContent = t("linkCopied");
  } catch (e) {
    $("#copyHint").textContent = url;      // clipboard denied: just show the raw link
  }
}
$("#ghLink").onclick = () => copyLink(REPO_URLS.gh);
if (REPO_URLS.gitee) $("#giteeLink").onclick = () => copyLink(REPO_URLS.gitee);
else $("#giteeLink").style.display = "none";
$("#ver").textContent = /^\d/.test(globalThis.__APP_VERSION__ || "") ? globalThis.__APP_VERSION__ : "";
$("#importWallpaper").onclick = () => $("#fileWallpaper").click();
$("#fileWallpaper").onchange = () => {
  const f = $("#fileWallpaper").files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const bytes = new Uint8Array(rd.result);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    say({ type: "importWallpaperData", name: f.name.replace(/\.[^.]+$/, ""), dataB64: btoa(bin) });
    $("#fileWallpaper").value = "";
  };
  rd.readAsArrayBuffer(f);
};
$("#importPet").onclick = () => $("#filePet").click();
$("#filePet").onchange = () => {
  const f = $("#filePet").files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const bytes = new Uint8Array(rd.result);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    say({ type: "importPetData", name: f.name.replace(/\.[^.]+$/, ""), dataB64: btoa(bin) });
    $("#filePet").value = "";
  };
  rd.readAsArrayBuffer(f);
};
$("#restoreAll").onclick = () => say({ type: "restoreHidden", wallpapers: true });


// ---- pets in the preview: live placement ------------------------------------------------
const petDrawer = createBuiltinDrawer();
const pvBox = document.querySelector(".preview");
let dragPet = null;        // { id, pose, offX, offY }
let dragPushTimer = 0;

function enabledPets() {
  const all = [
    ...BUILTIN_PETS.map((id) => ({ id, name: t("pet_" + id.slice(8)), builtin: true })),
    ...(cfg.pets || []).map((p) => ({ ...p, builtin: false })),
  ];
  return all.filter((p) => petPose(cfg, cfg.fx, p.id, false).on);
}

/** keep the file-pet iframes over the preview aligned with their poses */
function layoutPreviewPets() {
  const box = $("#pvPets");
  box.innerHTML = "";
  const r = pvBox.getBoundingClientRect();
  if (!player) {
    // ext preview: the wallpaper is an iframe, so builtin pets ride an overlay canvas above it
    const c = document.createElement("canvas");
    c.id = "pvPetCv";
    c.width = r.width; c.height = r.height;
    c.style.cssText = "position:absolute;inset:0;pointer-events:none;";
    box.append(c);
  }
  for (const pet of enabledPets()) {
    if (pet.builtin) continue;                          // builtins are drawn on the canvas
    const pose = petPose(cfg, cfg.fx, pet.id, false);
    const size = r.width * 0.2;
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:absolute;pointer-events:none;" +
      `left:${pose.x / 100 * r.width - size / 2}px;top:${pose.y / 100 * r.height - size / 2}px;` +
      `width:${size}px;height:${size}px;transform:rotate(${pose.rot}deg) scale(${pose.flip ? -pose.scale : pose.scale}, ${pose.scale});`;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.srcdoc = (cfg.petHtml || {})[pet.id] || "";
    frame.style.cssText = "width:100%;height:100%;border:0;background:transparent;pointer-events:none;";
    wrap.append(frame);
    box.append(wrap);
  }
}

/** draw enabled builtin pets onto the ext-preview overlay canvas (iframe previews only) */
function drawExtPreviewPets() {
  const c = document.getElementById("pvPetCv");
  if (!c) return;
  petDrawer.sync(enabledPets().filter((p) => p.builtin).map((p) => p.id));
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, c.width, c.height);
  for (const [id, it] of petDrawer.insts) {
    const pose = petPose(cfg, cfg.fx, id, false);
    if (!pose.on) continue;
    const sc = (c.height * 0.2 / it.h) * pose.scale;
    cx.save();
    cx.translate(pose.x / 100 * c.width, pose.y / 100 * c.height);
    cx.rotate(pose.rot * Math.PI / 180);
    cx.scale(pose.flip ? -sc : sc, sc);
    cx.drawImage(it.cvs, -it.w / 2, -it.h / 2);
    cx.restore();
  }
}

/** draw enabled builtin pets onto the preview canvas */
function drawPreviewPets() {
  const ids = enabledPets().filter((p) => p.builtin).map((p) => p.id);
  petDrawer.sync(ids);
  for (const [id, it] of petDrawer.insts) {
    const pose = petPose(cfg, cfg.fx, id, false);
    const sc = (canvas.height * 0.2 / it.h) * pose.scale;
    ctx.save();
    ctx.translate(pose.x / 100 * canvas.width, pose.y / 100 * canvas.height);
    ctx.rotate(pose.rot * Math.PI / 180);
    ctx.scale(pose.flip ? -sc : sc, sc);
    ctx.drawImage(it.cvs, -it.w / 2, -it.h / 2);
    ctx.restore();
  }
}

/** persist a pose + push it to the wallpaper right away (throttled during drags) */
function savePetPose(fxId, petId, pose, live) {
  cfg.petCfg[fxId] = cfg.petCfg[fxId] || {};
  cfg.petCfg[fxId][petId] = pose;
  touch();
  if (live) {
    clearTimeout(dragPushTimer);
    dragPushTimer = setTimeout(() => say({ type: "petPose", fx: fxId, pet: petId, pose }), 200);
  }
}

// drag on the preview: pick the nearest enabled pet, move / wheel / dblclick it
pvBox.addEventListener("mousedown", (e) => {
  const r = pvBox.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100;
  let best = null, bd = 14;
  for (const pet of enabledPets()) {
    const pose = petPose(cfg, cfg.fx, pet.id, false);
    const d = Math.hypot(px - pose.x, (py - pose.y) * (r.height / r.width));
    if (d < bd) { bd = d; best = { pet, pose }; }
  }
  if (!best) return;
  dragPet = { id: best.pet.id, fx: cfg.fx, pose: best.pose, offX: px - best.pose.x, offY: py - best.pose.y };
  e.preventDefault();
});
addEventListener("mousemove", (e) => {
  if (!dragPet) return;
  const r = pvBox.getBoundingClientRect();
  const pose = dragPet.pose;
  pose.x = Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100 - dragPet.offX));
  pose.y = Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100 - dragPet.offY));
  savePetPose(dragPet.fx, dragPet.id, pose, true);
  layoutPreviewPets();
});
addEventListener("mouseup", () => { dragPet = null; });
pvBox.addEventListener("wheel", (e) => {
  if (!dragPet && !pickPetAt(e)) return;
  const pet = dragPet || pickPetAt(e);
  const pose = petPose(cfg, cfg.fx, pet.id, false);
  e.preventDefault();
  if (e.altKey) pose.rot = (pose.rot + (e.deltaY > 0 ? 5 : -5) + 360) % 360;
  else pose.scale = Math.min(3, Math.max(0.2, pose.scale * (e.deltaY > 0 ? 0.95 : 1.05)));
  savePetPose(cfg.fx, pet.id, pose, true);
  layoutPreviewPets();
}, { passive: false });
pvBox.addEventListener("dblclick", (e) => {
  const hit = pickPetAt(e);
  if (!hit) return;
  const pose = petPose(cfg, cfg.fx, hit.id, false);
  pose.flip = !pose.flip;
  savePetPose(cfg.fx, hit.id, pose, true);
  layoutPreviewPets();
});
function pickPetAt(e) {
  const r = pvBox.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100;
  let best = null, bd = 14;
  for (const pet of enabledPets()) {
    const pose = petPose(cfg, cfg.fx, pet.id, false);
    const d = Math.hypot(px - pose.x, (py - pose.y) * (r.height / r.width));
    if (d < bd) { bd = d; best = pet; }
  }
  return best;
}

// ---- talk to the shell -----------------------------------------------------------------------
globalThis.pixelFXSettings = {
  load(json) {
    const raw = typeof json === "string" ? JSON.parse(json) : json;
    cfg = normalize(raw);
    if (raw && raw.packaged != null) packaged = !!raw.packaged;
    dirty = false;
    $("#msg").textContent = "";
    $("#msg").className = "";
    applyLang();
    restartPreview();
    updateFxControls();
    if (!raf) raf = requestAnimationFrame(loop);
  },
  extParams(json) {
    const d = typeof json === "string" ? JSON.parse(json) : json;
    if (d && d.id) {
      extParams[d.id] = d.params || [];
      fillParams();                              // refresh the panel for the current fx
    }
  },
  state(json) {
    const s = typeof json === "string" ? JSON.parse(json) : json;
    paused = !!s.paused;
    if (s.packaged != null) packaged = !!s.packaged;
    if (s.fx) cfg.fx = s.fx;
    if (s.lockScreen != null) {
      $("#msg").textContent = t(s.lockScreen ? "lockDone" : "lockFail");
      $("#msg").className = s.lockScreen ? "saved" : "";
    }
    if (s.skillSaved != null) {
      $("#msg").textContent = t("skillSaved", { path: s.skillSaved });
      $("#msg").className = "saved";
    }
    if (s.skillSaveFail != null) {
      $("#msg").textContent = t("skillSaveFail", { err: s.skillSaveFail });
      $("#msg").className = "";
    }
        if (s.skillText != null) copySkillPrompt(s.skillText);
    if (s.cacheCleared) $("#cacheHint").textContent = t("cacheDone");
    else if (s.cacheMb != null) $("#cacheHint").textContent = t("cacheHint", { mb: s.cacheMb });
    $("#pause").textContent = paused ? t("resumeBtn") : t("pauseBtn");
    updateState();
  },
};

if (!host) {
  const saved = localStorage.getItem("pixelfx-palette.config");
  pixelFXSettings.load(saved || JSON.stringify(normalize(null)));
} else {
    say({ type: "ready" });
  say({ type: "getCacheInfo" });
}
