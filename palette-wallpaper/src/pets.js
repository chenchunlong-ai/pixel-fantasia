// The pet layer, shared by both host pages: the runtime page (internal scenes) and the wallwrap
// page (user wallpaper files). Two kinds of pets ride over the wallpaper:
//   · builtin pets — the engine's own critters (butterfly, ghost, ...), drawn onto canvases
//   · file pets — the user's single-file HTML pages (skill/SKILL.md), mounted DIRECTLY into this
//     page: the html's <style> and <script> are extracted, the canvas gets a unique id and the
//     script runs once in an isolated function scope sized to the pet's slot. (iframes are unusable
//     here: WebView2 never composites an iframe's canvas onto the screen in wallpaper pages.)
// Each pet's pose — position, scale, rotation, flip — is remembered PER WALLPAPER. Poses are
// edited in the settings window's live preview; this layer only renders what the config says.
import { petPose, BUILTIN_PETS } from "./params.js";
import { createFrame, clearFrame, createFx, composite } from "../../src/core/index.js";
import * as butterfly from "../../src/fx/critters/butterfly.js";
import * as bird from "../../src/fx/critters/bird.js";
import * as bat from "../../src/fx/critters/bat.js";
import * as ghost from "../../src/fx/critters/ghost.js";
import * as frog from "../../src/fx/critters/frog.js";
import * as snake from "../../src/fx/critters/snake.js";
import * as slime from "../../src/fx/critters/slime.js";
import * as jellyfish from "../../src/fx/critters/jellyfish.js";
import * as wisp from "../../src/fx/critters/wisp.js";
import * as eyeball from "../../src/fx/critters/eyeball.js";
import * as skull from "../../src/fx/critters/flying-skull.js";

export const BUILTIN_MODS = {
  "critter-butterfly": butterfly, "critter-bird": bird, "critter-bat": bat,
  "critter-ghost": ghost, "critter-frog": frog, "critter-snake": snake,
  "critter-slime": slime, "critter-jellyfish": jellyfish, "critter-wisp": wisp,
  "critter-eyeball": eyeball, "critter-skull": skull,
};

/** Shared drawing engine: keeps one animated canvas per enabled builtin critter. */
export function createBuiltinDrawer() {
  const insts = new Map();           // id -> { frame, img, ctx, fx, w, h, cvs, mod }
  let ticker = 0;
  let last = 0;

  function tickRaf(now) {
    ticker = requestAnimationFrame(tickRaf);
    if (!last) last = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const it of insts.values()) {
      it.fx.update(dt);
      clearFrame(it.frame);
      it.fx.draw(it.frame, "back");
      it.fx.draw(it.frame, "front");
      composite(it.frame, it.img.data, null);
      it.ctx.clearRect(0, 0, it.w, it.h);
      it.ctx.putImageData(it.img, 0, 0);
    }
  }

  return {
    insts,
    /** enable exactly this set of builtin pet ids (canvas elements reused across calls) */
    sync(ids) {
      for (const id of ids) {
        if (insts.has(id)) continue;
        const mod = BUILTIN_MODS[id];
        const [w, h] = mod.meta.size;
        const cvs = document.createElement("canvas");
        cvs.width = w; cvs.height = h;
        const frame = createFrame(w, h);
        const [ox, oy] = mod.meta.origin;
        insts.set(id, { frame, img: new ImageData(w, h), ctx: cvs.getContext("2d"), fx: createFx(mod, { x: ox, y: oy }), w, h, cvs, mod });
      }
      for (const id of [...insts.keys()]) if (!ids.includes(id)) insts.delete(id);
      if (insts.size && !ticker) ticker = requestAnimationFrame(tickRaf);
    },
  };
}

/** Mount a user pet file's html DIRECTLY into the host page (no iframe — WebView2 does not
    composite an iframe's canvas onto the screen in wallpaper pages). The pet's canvas gets a
    unique id, its script runs once in an isolated function scope with innerWidth/innerHeight set
    to the slot size. */
export function mountHtmlPet(mountEl, petId, html, slotPx) {
  if (!html) return;
  const pid = petId.replace(/[^a-z0-9]/gi, "");
  if (mountEl.dataset.mounted === petId) return;         // already live; just keep the canvas
  mountEl.dataset.mounted = petId;
  mountEl.innerHTML = "";

  const doc = new DOMParser().parseFromString(html, "text/html");
  // user styles, with `canvas` selectors rewritten to the unique canvas id
  const styles = [...doc.querySelectorAll("style")].map((st) =>
    st.textContent.replace(/\bcanvas\b/g, `#petcv-${pid}`)).join("\n");
  // user scripts, with document.getElementById("c") rewritten to the unique canvas id
  const scripts = [...doc.querySelectorAll("script")].map((sc) => sc.textContent).join("\n;\n");
  const script2 = scripts.replace(/getElementById\((['"])c\1\)/g, `getElementById($1petcv-${pid}$1)`);

  const userCanvas = doc.querySelector("canvas");
  const cvs = document.createElement("canvas");
  cvs.id = "petcv-" + pid;
  cvs.width = userCanvas ? parseInt(userCanvas.getAttribute("width")) || 64 : 64;
  cvs.height = userCanvas ? parseInt(userCanvas.getAttribute("height")) || 64 : 64;

  if (styles) {
    const st = document.createElement("style");
    st.textContent = styles + `\n#petcv-${pid}{image-rendering:pixelated;pointer-events:none;}`;
    document.head.append(st);
  }

  // the slot is a 20vw square; the pet script sizes its canvas from innerWidth/innerHeight —
  // pass the slot size so the pet renders at ~55% of the slot (per the skill's sizing rule)
  const fn = new Function("innerWidth", "innerHeight", "document", script2 + `\n//# sourceURL=pet-${pid}`);
  try { fn(slotPx, slotPx, document); } catch (e) { console.warn("pet script failed:", petId, e); }

  mountEl.append(cvs);
}

/** The wallpaper-side pet layer: renders slots from the pushed config. */
export function initPets(say) {
  const slots = document.getElementById("petSlots");
  const drawer = createBuiltinDrawer();
  const mounts = new Map();          // petId -> { wrap, c, pid } (file pets)
  let cfg = null;
  let builtinTicker = 0;             // shared rAF handle for the builtin canvases
  let last = 0;

  function tickBuiltins(now) {
    builtinTicker = requestAnimationFrame(tickBuiltins);
    if (!last) last = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const it of drawer.insts.values()) {
      it.fx.update(dt);
      clearFrame(it.frame);
      it.fx.draw(it.frame, "back");
      it.fx.draw(it.frame, "front");
      composite(it.frame, it.img.data, null);
      it.ctx.clearRect(0, 0, it.w, it.h);
      it.ctx.putImageData(it.img, 0, 0);
    }
  }

  function render() {
    if (!cfg) return;
    const fxId = cfg.fx || "";
    const all = [...BUILTIN_PETS.map((id) => ({ id, builtin: true })), ...(cfg.pets || [])];
    let enabledIdx = 0;                                   // pets without a saved pose fan out across the screen
    const enabled = [];                                   // [{ pet, pose }] — poses normalised first
    for (const pet of all) {
      const saved = (cfg.petCfg[fxId] || {})[pet.id];
      const pose = saved || petPose(cfg, fxId, pet.id, !pet.builtin);   // builtins stay off until enabled
      if (!saved && !pose.on) continue;
      if (!saved) { pose.x = 34 + (enabledIdx % 3) * 16; pose.y = 30 + Math.floor(enabledIdx / 3) * 18; }
      enabledIdx += pose.on ? 1 : 0;
      if (!pose.on) continue;
      enabled.push({ pet, pose });
    }
    // builtins must be registered in the drawer BEFORE their canvases are mounted
    drawer.sync(enabled.filter((e) => e.pet.builtin).map((e) => e.pet.id));

    // full rebuild is cheap for builtin canvases; file pets keep their mounted canvas+script alive
    slots.innerHTML = "";
    const mountFns = [];
    for (const { pet, pose } of enabled) {
      const slot = document.createElement("div");
      slot.className = "petSlot";
      slot.style.cssText = `left: ${pose.x}%; top: ${pose.y}%;`;
      const wrap = document.createElement("div");
      wrap.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;" +
        `transform: rotate(${pose.rot}deg) scale(${pose.flip ? -pose.scale : pose.scale}, ${pose.scale});`;
      if (BUILTIN_MODS[pet.id]) wrap.append(slotCanvas(pet.id));
      else { const fm = fileMount(pet); wrap.append(fm.holder); if (fm.mount) mountFns.push(fm.mount); }
      slot.append(wrap);
      slots.append(slot);
    }
    // debug: report what the desktop pet layer actually rendered (the shell logs "dbg" messages)
    say({ type: "dbg", fx: fxId, n: enabled.length,
      pets: enabled.map((e) => ({ id: e.pet.id, x: Math.round(e.pose.x * 10) / 10, y: Math.round(e.pose.y * 10) / 10, s: e.pose.scale })) });
  }

  /** file pets keep their mounted canvas+script; the slot just re-parents the canvas */
  function fileMount(pet) {
    const pid = pet.id.replace(/[^a-z0-9]/gi, "");
    let entry = mounts.get(pet.id);
    if (!entry) {
      const holder = document.createElement("div");
      holder.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;";
      const c = document.createElement("canvas");
      c.id = "petcv-" + pid;
      c.width = 64; c.height = 64;
      holder.append(c);
      mounts.set(pet.id, { holder, c, pid, mounted: false });
      return { holder, mount: () => mountHtmlPet(c, pet.id, (cfg.petHtml || {})[pet.id] || "", Math.round(innerWidth * 0.2)) };
    }
    return { holder: entry.holder, mount: null };
  }

  /** the live canvas the drawer paints into — rebound to the slot on every render */
  function slotCanvas(petId) {
    const it = drawer.insts.get(petId);
    const mod = BUILTIN_MODS[petId];
    const [w, h] = mod.meta.size;
    const K = 3;                                           // pixel-art critters scale up nicely
    const cvs = it ? it.cvs : document.createElement("canvas");
    cvs.width = w; cvs.height = h;
    cvs.style.cssText = `width:${w * K}px;height:${h * K}px;image-rendering:pixelated;pointer-events:none;`;
    if (it) { it.cvs = cvs; it.ctx = cvs.getContext("2d"); }   // drawer keeps painting into the live slot
    return cvs;
  }

  globalThis.pixelFXPets = {
    /** The shell pushes the whole config here on every apply. */
    apply(json) {
      cfg = typeof json === "string" ? JSON.parse(json) : json;
      render();
    },
  };
}
