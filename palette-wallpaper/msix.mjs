// MSIX packaging for the Microsoft Store, shared pipeline with the first wallpaper app:
// makeappx.exe comes from the Windows SDK already in desktop/.sdk, the PNG assets and the
// AppxManifest are generated here in pure Node.
//
//   node palette-wallpaper/msix.mjs          (build.mjs calls this too)
//
// Store notes:
// - runFullTrust is the one capability a desktop-bridge wallpaper needs (WorkerW behind the
//   icons). picturesLibrary / backgroundMediaPlayback are NOT declared: the app never reads
//   the user's pictures and WebView2 audio is not used — declaring capabilities you don't use
//   is a common cause of review rejection.
// - Identity Name / Publisher are placeholders. After reserving the app name in Partner
//   Center, replace them with the exact values Partner Center shows (Identity page), or
//   validation fails. The Store signs the package on submission; the local .msix here is
//   unsigned (installable only after signing or via the Store).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
import { VERSION } from "./version.mjs";
const DESKTOP = join(HERE, "..", "desktop");
const OUT = join(HERE, "out");
const APP_DIR = join(OUT, "app");
const PKG_DIR = join(OUT, "msix");
const ASSETS = join(PKG_DIR, "assets");

const IDENTITY_NAME = "4A5AB34E.62945D70D0F14";
const PUBLISHER = "CN=190194D9-6D06-4DDF-B9EE-AFCB01412655"; // Partner Center assigned
const PUBLISHER_DISPLAY = "迷游兔工作室";
const DISPLAY_NAME = "像素幻境";
const DESCRIPTION =
  "A living pixel wallpaper with a one-click palette wardrobe: snow, rain, fireflies, nebulae, black holes and tornadoes, each scene recolored in an instant. 320x180 pure-function rendering, auto-rotation, mirror, adjustable density and speed, pause hotkey.";

// ---------------------------------------------------------------- PNG writer (no deps)
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = n & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = (c ^ -1) >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- icon: a palette swap, as pixels
// the same 32x32 scene drawn twice: a night mountain under stars, then the SAME picture
// recolored — the app's one trick, on the tile
const SCENE = [
  "....s....s...s..",
  "..s.....s....s..",
  "......s....s....",
  "....m......m..m.",
  "..m..m..m.....m.",
  ".mm.mm.mm.m.mm.m",
  "dddddddddddddddd",
  "dddddddddddddddd",
];
// two palettes, dark to bright: A = night (blue), B = fire
const PAL_A = { s: [220, 220, 245], m: [42, 58, 96], d: [14, 18, 34] };
const PAL_B = { s: [255, 240, 170], m: [122, 44, 26], d: [26, 12, 10] };
const BG_A = [16, 14, 30], BG_B = [24, 10, 14];

/** RGBA buffer of the tile at S×S: dark rounded tile, two mini scenes side by side. */
function tile(S) {
  const px = Buffer.alloc(S * S * 4);
  const k = S / 32;
  const put = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const fill = (x0, y0, x1, y1, c, a) => {
    for (let y = Math.max(0, y0); y <= Math.min(S - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x++) put(x, y, c, a);
  };
  // rounded dark tile
  fill(Math.round(1 * k), 1 * k, Math.round(31 * k), Math.round(31 * k), [26, 20, 34]);
  fill(Math.round(2 * k), Math.round(1 * k), Math.round(30 * k), Math.round(2 * k), [12, 10, 16]);
  fill(Math.round(1 * k), Math.round(2 * k), Math.round(2 * k), Math.round(30 * k), [12, 10, 16]);
  fill(Math.round(29 * k), Math.round(2 * k), Math.round(30 * k), Math.round(30 * k), [12, 10, 16]);
  fill(Math.round(2 * k), Math.round(29 * k), Math.round(30 * k), Math.round(30 * k), [12, 10, 16]);
  // two mini scenes (16x8 each), left in the night palette, right in the fire palette
  SCENE.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === ".") continue;
      const x0 = Math.round((rx + 1.5) * k), y0 = Math.round((ry + 12) * k);
      const x1 = Math.round((rx + 2.4) * k) - 1, y1 = Math.round((ry + 12.9) * k) - 1;
      fill(x0, y0, x1, y1, PAL_A[ch]);
      fill(x0 + Math.round(15 * k), y0, x1 + Math.round(15 * k), y1, PAL_B[ch]);
    }
  });
  // the sky behind each mini scene
  fill(Math.round(1.5 * k), Math.round(11.5 * k), Math.round(17.4 * k), Math.round(19 * k), BG_A);
  fill(Math.round(16.5 * k), Math.round(11.5 * k), Math.round(32.4 * k), Math.round(19 * k), BG_B);
  // redraw the scenes over their skies
  SCENE.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === ".") continue;
      const x0 = Math.round((rx + 1.5) * k), y0 = Math.round((ry + 12) * k);
      const x1 = Math.round((rx + 2.4) * k) - 1, y1 = Math.round((ry + 12.9) * k) - 1;
      fill(x0, y0, x1, y1, PAL_A[ch]);
      fill(x0 + Math.round(15 * k), y0, x1 + Math.round(15 * k), y1, PAL_B[ch]);
    }
  });
  // the swap arrow between them
  for (let i = 0; i < 3; i++) {
    fill(Math.round(15.2 * k), Math.round((15 + i) * k), Math.round(16.2 * k), Math.round((15 + i) * k), [245, 60, 209]);
  }
  return px;
}

// ---------------------------------------------------------------- manifest
function manifestXml() {
  const langs = ["zh-CN", "en-US", "ja-JP", "ko-KR", "ru-RU", "es-ES", "pt-BR", "de-DE", "fr-FR"];
  return `<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10">
  <Identity Name="${IDENTITY_NAME}" Publisher="${PUBLISHER}" Version="${VERSION}" ProcessorArchitecture="x64"/>
  <Properties>
    <DisplayName>${DISPLAY_NAME}</DisplayName>
    <PublisherDisplayName>${PUBLISHER_DISPLAY}</PublisherDisplayName>
    <Logo>assets\\StoreLogo.scale-100.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0"/>
  </Dependencies>
  <Resources>
${langs.map((l) => `    <Resource Language="${l}"/>`).join("\n")}
  </Resources>
  <Applications>
    <Application Id="PixelPalette" Executable="PixelPalette.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="${DISPLAY_NAME}"
        Description="${DESCRIPTION}"
        BackgroundColor="#12141c"
        Square150x150Logo="assets\\Square150x150Logo.scale-100.png"
        Square44x44Logo="assets\\Square44x44Logo.scale-100.png">
        <uap:DefaultTile Wide310x150Logo="assets\\Wide310x150Logo.scale-100.png"/>
      </uap:VisualElements>
      <Extensions>
        <!-- autostart: the MSIX way. Enabled state is requested at runtime via the
             Windows.ApplicationModel.StartupTask API (see shell/WinRt.cs). -->
        <desktop:Extension Category="windows.startupTask" Executable="PixelPalette.exe" EntryPoint="Windows.FullTrustStartupTask">
          <desktop:StartupTask TaskId="PixelPalette" Enabled="false" DisplayName="${DISPLAY_NAME}"/>
        </desktop:Extension>
      </Extensions>
    </Application>
  </Applications>
  <Capabilities>
    <!-- the desktop-bridge capability the wallpaper needs to sit behind the icons -->
    <rescap:Capability Name="runFullTrust"/>
  </Capabilities>
</Package>
`;
}

// ---------------------------------------------------------------- pack
function ensureAssets() {
  mkdirSync(ASSETS, { recursive: true });
  // the logo pipeline decodes app-icon.jpg (the user's logo) and writes every size the Store needs
  return import("./icon-assets.mjs").then(({ writeMsixAssets }) => writeMsixAssets(ASSETS));
}

export async function buildMsix() {
  if (!existsSync(APP_DIR)) throw new Error("palette-wallpaper/out/app 不存在，先跑 node palette-wallpaper/build.mjs");
  // the Store refuses any package whose revision (4th section) is non-zero:
  // "应用程序不得拥有版本，其版本号在应用清单中指定的非零" — it means revision, not the version.
  const parts = VERSION.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p)) || Number(parts[3]) !== 0)
    throw new Error(`商店要求版本形如 x.y.z.0（第四段必须是 0），当前 version.mjs 是 "${VERSION}"`);
  const makeappx = join(DESKTOP, ".sdk", "bin", "10.0.28000.0", "x64", "makeappx.exe");
  if (!existsSync(makeappx)) throw new Error("找不到 makeappx.exe（desktop/.sdk）");

  rmSync(PKG_DIR, { recursive: true, force: true });
  mkdirSync(PKG_DIR, { recursive: true });
  // the payload: the app folder verbatim (robocopy exits 1-7 on success)
  try {
    execFileSync("robocopy", [APP_DIR, PKG_DIR, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], { stdio: "ignore" });
  } catch (e) {
    if ((e.status ?? 16) >= 8) throw new Error("robocopy 复制失败: " + e.status);
  }
  await ensureAssets();
  writeFileSync(join(PKG_DIR, "AppxManifest.xml"), manifestXml(), "utf8");

  const outMsix = join(OUT, `${IDENTITY_NAME}_${VERSION}_x64.msix`);   // store-standard package name
  if (existsSync(outMsix)) rmSync(outMsix);
  // makeappx wants /p <output> /d <dir>; /o overwrites, /nv skips validation nitpicks
  execFileSync(makeappx, ["pack", "/o", "/d", PKG_DIR, "/p", outMsix, "/nv"], { stdio: "inherit" });
  console.log(`· MSIX ${(statSync(outMsix).size / 1024 / 1024).toFixed(1)} MB → palette-wallpaper/out/${outMsix.split("\\").pop()}`);
  console.log("· MSIX 就绪：身份已用 Partner Center 正式值（4A5AB34E.62945D70D0F14 / 迷游兔工作室）");
}

if (process.argv[1] && process.argv[1].endsWith("msix.mjs")) {
  buildMsix();
}
