// Build the palette wallpaper app: bundle the two pages, compile the shell with the .NET Framework
// compiler, then pack the installer. No SDK, no NuGet restore, no admin rights.
//
//   node palette-wallpaper/build.mjs
//
// The WebView2 SDK / winmd caches live in the sibling desktop/ project — first build reuses them.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { VERSION } from "./version.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DESKTOP = join(ROOT, "desktop"); // the first app: its build caches are reusable
const OUT = join(HERE, "out");
const DEPS = join(OUT, "deps");
const CSC = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
const WV2_VER = "1.0.3351.48";
const WV2_DIR = join(DESKTOP, ".wv2");

mkdirSync(OUT, { recursive: true });
mkdirSync(DEPS, { recursive: true });

// ---- 1. the WebView2 SDK ----------------------------------------------------------------------
function ensureWebView2() {
  const core = join(DEPS, "Microsoft.Web.WebView2.Core.dll");
  if (existsSync(core)) return;
  if (existsSync(join(DESKTOP, "out", "deps", "Microsoft.Web.WebView2.Core.dll"))) {
    for (const f of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll"])
      writeFileSync(join(DEPS, f), readFileSync(join(DESKTOP, "out", "deps", f)));
    return;
  }
  const nupkg = join(WV2_DIR, "wv2.nupkg");
  const ext = join(WV2_DIR, "ext");
  if (!existsSync(ext)) {
    mkdirSync(WV2_DIR, { recursive: true });
    if (!existsSync(nupkg)) {
      console.log("· 下载 WebView2 SDK " + WV2_VER);
      execFileSync("powershell", ["-NoProfile", "-Command",
        `Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${WV2_VER}/microsoft.web.webview2.${WV2_VER}.nupkg" -OutFile "${nupkg}" -UseBasicParsing`]);
    }
    execFileSync("tar", ["-xf", nupkg, "-C", WV2_DIR]);
    const inner = join(WV2_DIR, "lib");
    if (!existsSync(inner)) throw new Error("WebView2 包解压失败");
  }
  for (const f of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll"])
    writeFileSync(join(DEPS, f), readFileSync(join(WV2_DIR, "lib", "net462", f)));
  writeFileSync(join(DEPS, "WebView2Loader.dll"), readFileSync(join(WV2_DIR, "build", "native", "x64", "WebView2Loader.dll")));
}

// ---- 2. the two pages -------------------------------------------------------------------------
async function bundle(entry) {
  const r = await build({ entryPoints: [join(HERE, "src", entry)], bundle: true, format: "esm", minify: true, write: false, target: "es2020" });
  return r.outputFiles[0].text;
}

function page(template, script, js) {
  const html = readFileSync(join(HERE, "src", template), "utf8");
  const tag = new RegExp(`<script type="module" src="${script}"></script>`);
  if (!tag.test(html)) throw new Error(`${template} has no ${script} tag`);
  // the replacement MUST be a function: the minified bundle contains `$&`-style sequences
  return html.replace(tag, () => `<script type="module">\n${js}</script>`);
}

// ---- 2b. the WinRT metadata (autostart StartupTask + lock screen) ------------------------------
const CONTRACTS_VER = "10.0.22621.2";
const WINMD_DIR = join(OUT, "deps", "winmd");
const WMERGE_DIR = join(OUT, "deps", "wmerge");
const GAC = "C:\\Windows\\Microsoft.NET\\assembly\\GAC_MSIL";

function ensureWinmd() {
  if (existsSync(join(WMERGE_DIR, "Windows.winmd"))) return;
  // the first app already merged it — reuse instead of re-merging
  if (existsSync(join(DESKTOP, "out", "deps", "wmerge", "Windows.winmd"))) {
    mkdirSync(WMERGE_DIR, { recursive: true });
    for (const f of readdirSync(join(DESKTOP, "out", "deps", "wmerge")))
      copyFileSync(join(DESKTOP, "out", "deps", "wmerge", f), join(WMERGE_DIR, f));
    return;
  }
  const nupkg = join(DESKTOP, ".contracts", "c.nupkg");
  const ext = join(DESKTOP, ".contracts", "ext");
  if (!existsSync(join(ext, "ref"))) {
    mkdirSync(join(DESKTOP, ".contracts"), { recursive: true });
    if (!existsSync(nupkg)) {
      console.log("· 下载 Windows SDK Contracts " + CONTRACTS_VER);
      execFileSync("powershell", ["-NoProfile", "-Command",
        `Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.contracts/${CONTRACTS_VER}/microsoft.windows.sdk.contracts.${CONTRACTS_VER}.nupkg" -OutFile "${nupkg}" -UseBasicParsing`]);
    }
    mkdirSync(ext, { recursive: true });
    execFileSync("tar", ["-xf", nupkg, "-C", ext]);
  }
  mkdirSync(WINMD_DIR, { recursive: true });
  for (const f of readdirSync(join(ext, "ref", "netstandard2.0")))
    if (f.endsWith(".winmd")) copyFileSync(join(ext, "ref", "netstandard2.0", f), join(WINMD_DIR, f));
  const mdmerge = join(DESKTOP, ".sdk", "bin", "10.0.28000.0", "x64", "mdmerge.exe");
  if (!existsSync(mdmerge)) throw new Error("找不到 mdmerge.exe（desktop/.sdk）");
  execFileSync(mdmerge, ["-o", WMERGE_DIR, "-i", WINMD_DIR, "-n:1"], { stdio: "pipe" });
  if (!existsSync(join(WMERGE_DIR, "Windows.winmd"))) throw new Error("mdmerge 未产出 Windows.winmd");
}

function gacRef(name, token) {
  const dir = join(GAC, name, "v4.0_4.0.0.0__" + token);
  return existsSync(dir) ? `/r:${join(dir, name + ".dll")}` : null;
}

// ---- 2c. the C# side of the strings ------------------------------------------------------------
function generateLang() {
  const table = JSON.parse(readFileSync(join(HERE, "src", "i18n.json"), "utf8"));
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
  const codes = Object.keys(table);
  const langs = codes.map((code) => {
    const pairs = Object.keys(table[code]).map((k) => `                { "${k}", "${esc(table[code][k])}" }`).join(",\n");
    return `            { "${code}", new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)\n            {\n${pairs}\n            } }`;
  }).join(",\n");
  const cs = `// Generated by build.mjs from src/i18n.json. Edit the JSON, not this file.
using System;
using System.Collections.Generic;
using System.Globalization;

namespace PixelFX
{
    internal static class Lang
    {
        public static string Code = "en";

        public static readonly string[] Codes = { ${codes.map((c) => `"${c}"`).join(", ")} };

        private static readonly Dictionary<string, Dictionary<string, string>> Table =
            new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
            {
${langs}
            };

        public static bool Has(string code) { return !string.IsNullOrEmpty(code) && Table.ContainsKey(code); }

        /// <summary>"auto" follows Windows; unknown languages fall back to English.</summary>
        public static void Use(string setting)
        {
            if (Has(setting)) { Code = setting.ToLowerInvariant(); return; }
            string two = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
            Code = Has(two) ? two : "en";
        }

        public static string T(string key)
        {
            Dictionary<string, string> t;
            string s;
            if (Table.TryGetValue(Code, out t) && t.TryGetValue(key, out s)) return s;
            if (Table["en"].TryGetValue(key, out s)) return s;
            return key;
        }
    }
}
`;
  writeFileSync(join(HERE, "shell", "Lang.Generated.cs"), cs);
  return codes;
}
const LANG_CODES = generateLang();
console.log("· 语言表 " + LANG_CODES.length + " 种: " + LANG_CODES.join(" "));

// the app icon: generated from app-icon.jpg (the user's logo), replacing the checked-in flame icon
{
  const { writeIco } = await import("./icon-assets.mjs");
  writeIco(join(HERE, "app.ico"));
  console.log("· 图标 app.ico 已从 app-icon.jpg 生成");
}

// ---- 3. compile ------------------------------------------------------------------------------
const CS = ["Entry.cs", "Program.cs", "Wallpaper.cs", "SettingsWindow.cs", "Config.cs", "Native.cs", "WinRt.cs", "Lang.Generated.cs"].map((f) => join(HERE, "shell", f));
const REFS = ["System.dll", "System.Core.dll", "System.Drawing.dll", "System.Windows.Forms.dll", "System.Web.Extensions.dll", "System.IO.Compression.dll", "System.IO.Compression.FileSystem.dll"]
  .map((r) => `/r:${r}`)
  .concat([`/r:${join(DEPS, "Microsoft.Web.WebView2.Core.dll")}`, `/r:${join(DEPS, "Microsoft.Web.WebView2.WinForms.dll")}`]);
const COMMON = ["/nologo", "/target:winexe", "/platform:anycpu", "/optimize+", `/win32manifest:${join(HERE, "app.manifest")}`, `/win32icon:${join(HERE, "app.ico")}`];

function compile(args) {
  execFileSync(CSC, args, { stdio: "inherit" });
}

ensureWebView2();

const runtimeJs = await bundle("runtime.js");
const settingsJs = await bundle("settings.js");
const wallwrapJs = await bundle("wallwrap.js");
writeFileSync(join(OUT, "runtime.html"), page("runtime.html", "runtime.js", runtimeJs));
writeFileSync(join(OUT, "settings.html"), page("settings.html", "settings.js", settingsJs).replaceAll("__VER_TOKEN__", VERSION));
writeFileSync(join(OUT, "wallwrap.html"), page("wallwrap.html", "wallwrap.js", wallwrapJs));
// the pages go into the exe gzipped — HTML with minified JS shrinks ~4x, and the shell
// decompresses with .NET's own GZipStream, so nothing extra ships with the installer
const gz = (html) => gzipSync(Buffer.from(html, "utf8"), { level: 9 });
writeFileSync(join(OUT, "runtime.html.gz"), gz(page("runtime.html", "runtime.js", runtimeJs)));
writeFileSync(join(OUT, "settings.html.gz"), gz(page("settings.html", "settings.js", settingsJs)));
writeFileSync(join(OUT, "wallwrap.html.gz"), gz(page("wallwrap.html", "wallwrap.js", wallwrapJs)));
// the wallpaper-authoring skill ships inside the app (About menu → download)
writeFileSync(join(OUT, "SKILL.md.gz"), gz(readFileSync(join(HERE, "skill", "SKILL.md"))));
// the 3D daisy-pond wallpaper ships preinstalled (exe resource -> written into the user's
// wallpaper list on start, see App.EnsureBundledWallpaper)
writeFileSync(join(OUT, "daisypond1080.html.gz"), gz(readFileSync(join(HERE, "skill", "examples", "daisy-pond-1080p.html"))));
console.log(`· 页面打包完成 runtime ${(runtimeJs.length / 1024).toFixed(0)} KB, settings ${(settingsJs.length / 1024).toFixed(0)} KB (gz 内嵌)`);

const appExe = join(OUT, "PixelPalette.exe");
ensureWinmd();
const WINRT_REFS = [
  gacRef("System.Runtime.WindowsRuntime", "b77a5c561934e089"),
  gacRef("System.Runtime", "b03f5f7f11d50a3a"),
  gacRef("System.IO", "b03f5f7f11d50a3a"),
  "/r:" + join(WMERGE_DIR, "Windows.winmd"),
].filter(Boolean);
compile([
  ...COMMON, ...REFS, ...WINRT_REFS,
  "/out:" + appExe,
  "/resource:" + join(OUT, "runtime.html.gz") + ",PixelPalette.runtime.html.gz",
  "/resource:" + join(OUT, "settings.html.gz") + ",PixelPalette.settings.html.gz",
  "/resource:" + join(OUT, "wallwrap.html.gz") + ",PixelPalette.wallwrap.html.gz",
            "/resource:" + join(OUT, "SKILL.md.gz") + ",PixelPalette.SKILL.md.gz",
  "/resource:" + join(OUT, "daisypond1080.html.gz") + ",PixelPalette.daisypond1080.html.gz",
  ...CS,
]);
console.log(`· 主程序 ${(statSync(appExe).size / 1024).toFixed(0)} KB → palette-wallpaper/out/PixelPalette.exe`);

// the app ships as a plain folder: exe + the two WebView2 managed DLLs + the native loader.
const APP_DIR = join(OUT, "app");
mkdirSync(APP_DIR, { recursive: true });
for (const f of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll"])
  writeFileSync(join(APP_DIR, f), readFileSync(join(DEPS, f)));
writeFileSync(join(APP_DIR, "PixelPalette.exe"), readFileSync(appExe));
// MIT obligations: the upstream licenses ride with every distribution (installer zip and MSIX
// both pack this folder). The Patch Pixel font is NOT used by this app, so no font notice needed.
writeFileSync(join(APP_DIR, "LICENSE"), readFileSync(join(ROOT, "LICENSE")));
writeFileSync(join(APP_DIR, "NOTICE.md"), readFileSync(join(ROOT, "NOTICE.md")));
writeFileSync(join(APP_DIR, "OPEN-SOURCE-NOTICES.txt"), `像素幻境 / Pixel Fantasia — open-source notices
========================================================

This application embeds code from the pixelfx project.

  pixelfx — code-driven pixel art effects
  https://github.com/patch-gg/pixelfx
  Copyright (c) 2026 Patch
  Licensed under the MIT License (see LICENSE)

  Portions of the effect code adapt Sprite Fusion's open-source pixel art VFX,
  Copyright (c) 2026 Hugo Duprez, MIT License (see NOTICE.md).

  The full MIT license text and upstream notices are in LICENSE and NOTICE.md
  next to this file. The Patch Pixel typeface is NOT used by this application.
`);

// ---- 4. the installer -------------------------------------------------------------------------
const zip = join(OUT, "app.zip");
try { execFileSync("powershell", ["-NoProfile", "-Command", `if (Test-Path '${zip}') { Remove-Item '${zip}' -Force }; Compress-Archive -Path '${APP_DIR}\\*' -DestinationPath '${zip}' -CompressionLevel Optimal`]); } catch (e) { throw new Error("打包 app.zip 失败: " + e.message); }
const setupExe = join(OUT, "PixelPalette-Setup.exe");
compile([
  "/nologo", "/target:winexe", "/optimize+", `/win32manifest:${join(HERE, "app.manifest")}`, `/win32icon:${join(HERE, "app.ico")}`,
  "/r:System.dll", "/r:System.Core.dll", "/r:System.Drawing.dll", "/r:System.Windows.Forms.dll",
  "/r:System.IO.Compression.dll", "/r:System.IO.Compression.FileSystem.dll",
  "/out:" + setupExe,
  "/resource:" + zip + ",app.zip",
  join(HERE, "shell", "Installer.cs"),
  join(HERE, "shell", "Lang.Generated.cs"),
]);
console.log(`· 安装包 ${(statSync(setupExe).size / 1024).toFixed(0)} KB → palette-wallpaper/out/PixelPalette-Setup.exe`);

// ---- 5. MSIX for the Microsoft Store ---------------------------------------------------------
const { buildMsix } = await import("./msix.mjs");
await buildMsix();
