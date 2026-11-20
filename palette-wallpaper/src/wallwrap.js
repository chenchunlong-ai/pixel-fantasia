// The wrapper page for user wallpaper files: shows the user's single-file wallpaper in an iframe
// (from the shell's wp.local folder mapping) with the pet layer riding above it. The shell
// navigates here whenever the current fx is "ext:<id>".
import { initPets } from "./pets.js";

const host = globalThis.chrome && globalThis.chrome.webview ? globalThis.chrome.webview : null;
const say = (msg) => (host ? host.postMessage(msg) : null);

const wall = document.getElementById("wall");
let shownFile = null;

initPets(say);

globalThis.pixelFX = {
  /** The shell pushes the full config; when fx is an ext id, load that wallpaper file. */
  apply(json) {
    try {
      const cfg = typeof json === "string" ? JSON.parse(json) : json;
      if (cfg.fx && cfg.fx.startsWith("ext:")) {
        const w = (cfg.wallpapers || []).find((x) => x.id === cfg.fx.slice(4));
        if (shownFile !== cfg.fx) {
          shownFile = cfg.fx;
          if (w) {
            const html = (cfg.wallHtmls || {})[w.id] || cfg.wallHtml;
            if (w.type !== "video" && html) {
              // html wallpapers ride inline (srcdoc, no sandbox — the proven file-pet path;
              // the wp.local virtual host intermittently fails to render in WebView2)
              wall.removeAttribute("sandbox");
              wall.onload = () => { say({ type: "wallFrame", ok: true, doc: "html" }); fwdSpeed(cfg); };
              wall.srcdoc = html;
            } else {
              // video wrappers keep the folder mapping (their <video src> is relative)
              wall.setAttribute("sandbox", "allow-scripts");
              wall.onload = () => { say({ type: "wallFrame", ok: true, doc: "video" }); fwdSpeed(cfg); };
              wall.src = "http://wp.local/" + w.file.split(/[\/]/).pop()
                + "?v=" + Date.now();        // cache-bust: WebView2 caches wp.local aggressively
            }
          }
        } else fwdSpeed(cfg);                  // same wallpaper: just forward the speed knob
      }
      globalThis.pixelFXPets.apply(json);
    } catch (e) {
      say({ type: "wallwrapErr", msg: String((e && e.stack) || e) });
    }
  },
  command(name) { /* videos/gif need no commands; pause lives with the page itself */ },
};

/** forward cursor moves: the shell polls GetCursorPos and calls window.wallMouse on THIS page,
    but the wallpaper lives in a srcdoc iframe — same-origin, so relay the call into it.
    (Without this, interactive user wallpapers never see the mouse on the desktop.) */
globalThis.wallMouse = (nx, ny) => {
  try {
    const w = wall.contentWindow;
    if (w && typeof w.wallMouse === "function") w.wallMouse(nx, ny);
  } catch (e) { /* frame not ready */ }
};

/** forward clicks: the shell detects the left button over the wallpaper and calls window.wallClick
    here; relay into the iframe just like wallMouse. */
globalThis.wallClick = (nx, ny) => {
  try {
    const w = wall.contentWindow;
    if (w && typeof w.wallClick === "function") w.wallClick(nx, ny);
  } catch (e) { /* frame not ready */ }
};

/** forward the global speed knob into the wallpaper page: srcdoc pages are same-origin so we
    call their optional wallSpeed() hook directly; cross-origin video wrappers get a message. */
function fwdSpeed(cfg) {
  try {
    const w = wall.contentWindow;
    if (!w) return;
    if (wall.srcdoc) { if (typeof w.wallSpeed === "function") w.wallSpeed(cfg.speed || 1); }
    else w.postMessage({ type: "wallSpeed", v: cfg.speed || 1 }, "*");
  } catch (e) { /* cross-origin frame not ready — next push retries */ }
}

if (!host) {
  // plain-browser dev preview: point at a sibling example
  window.pixelFX.apply({ fx: "ext:demo", wallpapers: [{ id: "demo", file: location.href.replace("wallwrap.html", "aurora-cabin.html") }], pets: [], petCfg: {}, petOn: true });
} else {
  say({ type: "ready" });
}
