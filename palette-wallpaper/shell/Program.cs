// The app: one hidden shell that owns the desktop window, the settings window, the tray icon and the hotkeys.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace PixelFX
{
    internal static class App
    {
        public static readonly string RuntimeHtml = Resource("runtime.html.gz");
        public static readonly string SettingsHtml = Resource("settings.html.gz");
        public static readonly string WallWrapHtml = Resource("wallwrap.html.gz");
        public static readonly string SkillMd = Resource("SKILL.md.gz");
        public static readonly string DaisyPondHtml = Resource("daisypond1080.html.gz");

        public static Settings Cfg = Store.Load();
        public static WallpaperWindow Wallpaper;
        public static SettingsWindow Settings;
        public static CoreWebView2Environment Env;
        public static NotifyIcon Tray;
        public static HotkeyWindow Keys;
        public static Timer ReloadTimer;
        public static Form Dispatcher;
        public static bool ShowPending;
        private static ShellListener shell;

        private static string Resource(string name)
        {
            Assembly a = Assembly.GetExecutingAssembly();
            foreach (string n in a.GetManifestResourceNames())
                if (n.EndsWith("." + name, StringComparison.OrdinalIgnoreCase))
                {
                    using (Stream s = a.GetManifestResourceStream(n))
                    {
                        // build gzips the pages; a 1f 8b magic means decompress first
                        int b1 = s.ReadByte(), b2 = s.ReadByte();
                        s.Position = 0;
                        Stream input = b1 == 0x1f && b2 == 0x8b
                            ? (Stream)new System.IO.Compression.GZipStream(s, System.IO.Compression.CompressionMode.Decompress)
                            : s;
                        using (input)
                        using (StreamReader r = new StreamReader(input, System.Text.Encoding.UTF8))
                            return r.ReadToEnd();
                    }
                }
            return "<html><body>missing resource: " + name + "</body></html>";
        }

        /// <summary>The 3D daisy-pond wallpaper ships inside the exe: refresh its file and make
        /// sure it is in the user's wallpaper list. If the user deleted it on purpose, respect
        /// that (daisyPondGone) and never bring it back.</summary>
        private static void EnsureBundledWallpaper()
        {
            try
            {
                const string bid = "daisypond1080";
                if (Cfg.daisyPondGone) return;
                Directory.CreateDirectory(Store.WallpaperDir);
                string file = Path.Combine(Store.WallpaperDir, bid + ".html");
                File.WriteAllText(file, App.DaisyPondHtml);          // every start: updates ride along
                if (Cfg.wallpapers.Find((w) => w.id == bid) == null)
                {
                    Cfg.wallpapers.Add(new WallpaperFile { id = bid, name = "雏菊水塘 · 1080P", file = file, type = "html" });
                    Store.Save(Cfg);
                    Log("preinstalled bundled wallpaper " + bid);
                }
            }
            catch (Exception ex) { Log("preinstall daisypond failed: " + ex.Message); }
        }

        public static void Start()
        {
            Lang.Use(Cfg.lang);
            Log("start, fx=" + Cfg.fx + " packaged=" + Store.Packaged);
            EnsureBundledWallpaper();
            if (Cfg.autoStart)
            {
                Store.SetAutoStart(true);
                if (Store.Packaged) WinRt.ApplyStartupTask(true); // MSIX: the manifest's startupTask
            }

            Wallpaper = new WallpaperWindow(Screen.PrimaryScreen.Bounds);
            Wallpaper.Message += OnWallpaperMessage;
            Wallpaper.Show();
            if (Wallpaper != null) { /* the env completes async; Start() pushes config via Apply */ }

            CreateTray();
            shell = new ShellListener();
            shell.Restarted += delegate { RebuildWallpaperSoon(); };
            Keys = new HotkeyWindow();
            Keys.Pause += delegate { TogglePause(); };
            Keys.Next += delegate { Wallpaper.Command("next"); };
            RegisterHotkeys();

            StartReloadTimer();
            ListenForSecondLaunch();
            SystemEvents.SessionSwitch += delegate (object s, SessionSwitchEventArgs e)
            {
                if (e.Reason == SessionSwitchReason.SessionLock) Wallpaper.SessionLock(true);
                else if (e.Reason == SessionSwitchReason.SessionUnlock) Wallpaper.SessionLock(false);
            };

                        // a "clean cache" click only writes a flag: the kernel keeps its cache files open,
            // so the real wipe happens here, on start, before the browser comes up.
            WipeCacheIfFlagged();
            // create the renderer once the message loop is pumping
            CoreWebView2Environment.CreateAsync(null, Path.Combine(Store.DataDir, "webview"), EnvOptions()).ContinueWith(delegate (System.Threading.Tasks.Task<CoreWebView2Environment> t)
            {
                if (t.IsFaulted)
                {
                    App.Log("webview env failed: " + t.Exception.GetBaseException());
                    MessageBox.Show(Lang.T("webviewFail") + "\n" + t.Exception.GetBaseException().Message + "\n\n" + Lang.T("webviewMissing"),
                        Lang.T("appName"), MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
                Env = t.Result;
                if (Wallpaper.IsHandleCreated) Wallpaper.BeginInvoke(new Action(delegate
                {
                    Wallpaper.Start(Env);
                    Apply(Cfg);   // Apply decides internal vs external (ShowFx) and pushes config
                    if (ShowPending) { ShowPending = false; ShowSettings(); }
                }));
            });
        }

        // ---- config --------------------------------------------------------------------------
        /// <summary>Append wallHtml / petHtml (the file contents) to a config json string.</summary>
        internal static string Augment(string json)
        {
            try
            {
            var ser = new System.Web.Script.Serialization.JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var petHtml = new System.Collections.Generic.Dictionary<string, string>();
            foreach (PetFile p in App.Cfg.pets)
                try { petHtml[p.id] = WithCsp(File.ReadAllText(p.file)); } catch { }
            string wallHtml = null;
            WallpaperFile wf = App.FindWallpaper(App.Cfg.fx);
            if (wf != null) try { wallHtml = WithCsp(File.ReadAllText(wf.file)); } catch { }
            // every user html wallpaper inline (CSP'd): the settings page previews any of them,
            // wallwrap srcdoc-loads the current one (wp.local iframes render unreliably)
            var wallHtmls = new System.Collections.Generic.Dictionary<string, string>();
            foreach (WallpaperFile wp in App.Cfg.wallpapers)
                if (wp.type != "video")
                    try { wallHtmls[wp.id] = WithCsp(File.ReadAllText(wp.file)); } catch { }
            var extra = ser.Serialize(new System.Collections.Generic.Dictionary<string, object> { { "wallHtml", wallHtml }, { "wallHtmls", wallHtmls }, { "petHtml", petHtml } });
                return json.Substring(0, json.Length - 1) + "," + extra.Substring(1);   // merge two objects
            }
            catch (Exception ex) { App.Log("Augment FAILED: " + ex.Message); return json; }
        }
        /// <summary>The CSP we inject into every user file: the page may run its own inline
        /// script and draw, but nothing may load from the network — the browser kernel itself
        /// enforces this, so it works even where our request interceptor does not fire.</summary>
        private static string WithCsp(string html)
        {
            string csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'\">";
            if (html == null) return html;
            int i = html.IndexOf("<head", StringComparison.OrdinalIgnoreCase);
            if (i < 0) return csp + html;
            int gt = html.IndexOf('>', i);
            if (gt < 0) return csp + html;
            return html.Insert(gt + 1, csp);
        }
        public static void Apply(Settings c)
        {
            string langBefore = Lang.Code;
            Lang.Use(c.lang);
            Cfg = c;
            Log("apply fx=" + c.fx + " fps=" + c.fps + " rules=" + c.rules.Count + " lang=" + Lang.Code);
            Store.Save(c);
            Store.SetAutoStart(c.autoStart);
            if (Store.Packaged) WinRt.ApplyStartupTask(c.autoStart); // MSIX: the manifest's startupTask
            string json = Store.Json(c);
            // "ext:*" fx are user wallpaper files: the shell navigates its webview to the file;
            // internal scenes go through the bundled runtime page as always
            if (Wallpaper != null)
            {
                WallpaperFile wf = FindWallpaper(c.fx);
                Wallpaper.ShowFx(c.fx, wf != null ? wf.file : null);
                Wallpaper.Push(json);
            }
            if (Settings != null) Settings.Push(Augment(json));   // preview needs petHtml/wallHtml too
            if (Lang.Code != langBefore) RebuildTray();
            RegisterHotkeys();
            StartReloadTimer();
        }

        /// <summary>The user wallpaper record for an "ext:<id>" fx id (null for internal scenes).</summary>
        public static WallpaperFile FindWallpaper(string fx)
        {
            if (fx == null || !fx.StartsWith("ext:")) return null;
            string id = fx.Substring(4);
            return Cfg.wallpapers.Find((w) => w.id == id);
        }

        public static void SetPaused(bool paused)
        {
            Cfg.paused = paused;
            Store.Save(Cfg);
            Wallpaper.Command(paused ? "pause" : "resume");
            SyncState();
        }

        public static void TogglePause()
        {
            SetPaused(!Cfg.paused);
        }

        /// <summary>Snap the live wallpaper and make it the lock screen (a still image by nature).</summary>
        private static void SetLockScreen()
        {
            if (Wallpaper == null || !Wallpaper.IsHandleCreated) return;
            string png = Path.Combine(Store.DataDir, "lockscreen.png");
            Wallpaper.BeginInvoke(new Action(delegate
            {
                Wallpaper.CaptureSnapshot(png, delegate (bool ok)
                {
                    if (ok) WinRt.SetLockScreen(png);
                    if (Settings != null && !Settings.IsDisposed)
                        Settings.PushState("{\"paused\":" + (Cfg.paused ? "true" : "false")
                            + ",\"fx\":\"" + Cfg.fx + "\",\"lockScreen\":" + (ok ? "true" : "false") + "}");
                });
            }));
        }

        public static void SyncState()
        {
            if (Tray != null)
            {
                foreach (ToolStripItem i in Tray.ContextMenuStrip.Items)
                    if (i.Tag as string == "pause") i.Text = Cfg.paused ? Lang.T("resumeBtn") : Lang.T("pauseBtn");
            }
            if (Settings != null) Settings.PushState("{\"paused\":" + (Cfg.paused ? "true" : "false") + ",\"fx\":\"" + Cfg.fx + "\",\"packaged\":" + (Store.Packaged ? "true" : "false") + "}");
        }

        private static void OnWallpaperMessage(string json)
        {
            if (json.Contains("dbg") || json.Contains("placing")) App.Log("page: " + json.Substring(0, Math.Min(120, json.Length)));
            // {"type":"state","fx":"weather/snow","paused":false} — from the wallpaper page, or
            // {"type":"petPose",...} / {"type":"placing",...} — from the pet layer
            try
            {
                if (json.Contains("\"petPose\""))
                {
                    var ser = new System.Web.Script.Serialization.JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                    var d = ser.Deserialize<Dictionary<string, object>>(json);
                    string fx = d.ContainsKey("fx") ? d["fx"] as string : null;
                    string pet = d.ContainsKey("pet") ? d["pet"] as string : null;
                    if (fx != null && pet != null && d.ContainsKey("pose"))
                    {
                        var pose = ser.Deserialize<PetPose>(ser.Serialize(d["pose"]));
                        if (!Cfg.petCfg.ContainsKey(fx)) Cfg.petCfg[fx] = new Dictionary<string, PetPose>();
                        Cfg.petCfg[fx][pet] = pose;
                        Store.Save(Cfg);                    // quiet: the layer throttles its own sends
                        if (Wallpaper != null) Wallpaper.Push(Store.Json(Cfg));   // pets move live on the desktop
                    }
                    return;
                }
                if (json.Contains("\"wallParams\""))
                {
                    // an ext wallpaper declared its own parameters (window.wallParams, relayed by
                    // wallwrap) — hand them to the settings page so it can render the panel
                    if (Settings != null && Settings.IsHandleCreated) Settings.PushExtParams(json);
                    return;
                }
                if (json.Contains("\"state\""))
                {
                    int i = json.IndexOf("\"fx\":\"");
                    if (i > 0)
                    {
                        int j = json.IndexOf('"', i + 6);
                        Cfg.fx = json.Substring(i + 6, j - i - 6);
                    }
                    Cfg.paused = json.Contains("\"paused\":true");
                    SyncState();
                }
            }
            catch { }
        }

        private static void OnSettingsMessage(string json)
        {
            try
            {
                var ser = new System.Web.Script.Serialization.JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                var d = ser.Deserialize<Dictionary<string, object>>(json);
                object type;
                if (!d.TryGetValue("type", out type)) return;
                string t = (string)type;
                App.Log("settings msg: " + t);
                if (t == "save")
                {
                    object raw;
                    if (!d.TryGetValue("config", out raw)) return;
                    var cfg = ser.Deserialize<Settings>(ser.Serialize(raw));
                    Apply(cfg);
                }
                else if (t == "close") Settings.Hide();
                else if (t == "pause")
                {
                    object v;
                    d.TryGetValue("value", out v);
                    SetPaused(v is bool && (bool)v);
                }
                else if (t == "uninstall") Uninstall(true);
                else if (t == "setLockScreen") SetLockScreen();
                else if (t == "petPose")
                {
                    // pet poses are dragged in the settings preview — save + push to the wallpaper live
                    string fx = d.ContainsKey("fx") ? d["fx"] as string : null;
                    string pet = d.ContainsKey("pet") ? d["pet"] as string : null;
                    if (fx != null && pet != null && d.ContainsKey("pose"))
                    {
                        var pose = ser.Deserialize<PetPose>(ser.Serialize(d["pose"]));
                        if (!Cfg.petCfg.ContainsKey(fx)) Cfg.petCfg[fx] = new Dictionary<string, PetPose>();
                        Cfg.petCfg[fx][pet] = pose;
                        Store.Save(Cfg);
                        if (Wallpaper != null) Wallpaper.Push(Store.Json(Cfg));   // pets move live on the desktop
                    }
                }
                else if (t == "importWallpaperData") ImportWallpaper(d);
                else if (t == "importPetData") ImportPet(d);
                else if (t == "saveSkill") SaveSkill();
                                else if (t == "getSkillText") PushSkillText();
                else if (t == "getCacheInfo") PushCacheInfo();
                else if (t == "clearCache") ClearCache();
                else if (t == "removeWallpaper") RemoveWallpaper(d);
                else if (t == "renameWallpaper") RenameWallpaper(d);
                else if (t == "removePet") RemovePet(d);
                else if (t == "restoreHidden") RestoreHidden(d);
            }
            catch { }
        }

        // ---- user-loaded wallpapers and pets --------------------------------------------------
        // The container: anyone can drop in a single-file HTML wallpaper (or mp4/gif) or a
        // transparent pet page made with the skill (docs live in the app's About page). Files are
        // copied into our data folder; loading runs them in the sandbox (no network, no windows).
        private static byte[] DecodeB64(string b64) { return Convert.FromBase64String(b64); }

        private static void ImportWallpaper(Dictionary<string, object> d)
        {
            try
            {
                string name = d.ContainsKey("name") ? d["name"] as string : "wallpaper";
                byte[] bytes = DecodeB64(d.ContainsKey("dataB64") ? d["dataB64"] as string : "");
                if (bytes.Length == 0) return;
                string src = Path.GetTempPath() + "pixelfx-import-" + Guid.NewGuid().ToString("N").Substring(0, 6) + Path.GetExtension(name);
                File.WriteAllBytes(src, bytes);
                Directory.CreateDirectory(Store.WallpaperDir);
                string ext = Path.GetExtension(src).ToLowerInvariant();
                bool video = ext == ".mp4" || ext == ".gif" || ext == ".webm";
                string id = Guid.NewGuid().ToString("N").Substring(0, 10);
                string file;
                if (video)
                {
                    // videos get a tiny wrapper page (fullscreen, looping, muted) so they obey the
                    // same single-file html contract as everything else
                    string media = Path.Combine(Store.WallpaperDir, id + ext);
                    File.Copy(src, media, true);
                    string wrapper = "<!doctype html><html><head><meta charset='utf-8'><title>" + name
                        + "</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}"
                        + "video,img{width:100%;height:100%;object-fit:cover;display:block}</style></head><body>"
                        + (ext == ".gif" ? "<img src='" + Path.GetFileName(media) + "'>"
                                          : "<video src='" + Path.GetFileName(media) + "' autoplay loop muted playsinline></video>")
                        + "<script>addEventListener('message',function(e){var d=e.data||{};"
                        + "if(d.type==='wallSpeed'){var v=document.querySelector('video');"
                        + "if(v)v.playbackRate=Math.max(0.1,Math.min(16,+d.v||1));}});</"
                        + "script></body></html>";
                    file = Path.Combine(Store.WallpaperDir, id + ".wrap.html");
                    File.WriteAllText(file, wrapper);
                }
                else
                {
                    file = Path.Combine(Store.WallpaperDir, id + ".html");
                    File.Copy(src, file, true);
                }
                Cfg.wallpapers.Add(new WallpaperFile { id = id, name = name, file = file, type = video ? "video" : "html" });
                Apply(Cfg);                                       // persists and re-pushes everything
                Log("imported wallpaper " + name);
            }
            catch (Exception ex) { Log("import wallpaper failed: " + ex.Message); }
        }

        private static void ImportPet(Dictionary<string, object> d)
        {
            try
            {
                string name = d.ContainsKey("name") ? d["name"] as string : "pet";
                byte[] bytes = DecodeB64(d.ContainsKey("dataB64") ? d["dataB64"] as string : "");
                if (bytes.Length == 0) return;
                string src = Path.GetTempPath() + "pixelfx-pet-" + Guid.NewGuid().ToString("N").Substring(0, 6) + Path.GetExtension(name);
                File.WriteAllBytes(src, bytes);
                Directory.CreateDirectory(Store.PetDir);
                string id = Guid.NewGuid().ToString("N").Substring(0, 10);
                string file = Path.Combine(Store.PetDir, id + ".html");
                File.Copy(src, file, true);
                Cfg.pets.Add(new PetFile { id = id, name = name, file = file });
                // a freshly imported pet is turned ON for the wallpaper it was dropped on: pets are
                // enabled per wallpaper now, so "no record" means off everywhere else
                if (Cfg.petCfg == null) Cfg.petCfg = new Dictionary<string, Dictionary<string, PetPose>>();
                string fxKey = Cfg.fx ?? "";
                if (!Cfg.petCfg.ContainsKey(fxKey)) Cfg.petCfg[fxKey] = new Dictionary<string, PetPose>();
                Cfg.petCfg[fxKey][id] = new PetPose { on = true };
                Apply(Cfg);
                Log("imported pet " + src);
            }
            catch (Exception ex) { Log("import pet failed: " + ex.Message); }
        }

        // ship the wallpaper-authoring skill (embedded SKILL.md) into the user's documents folder
        private static void SaveSkill()
        {
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "像素幻境");
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, "SKILL.md");
                File.WriteAllText(path, App.SkillMd);
                Log("skill saved: " + path);
                if (Settings != null && !Settings.IsDisposed)
                    Settings.PushState("{\"skillSaved\":" + new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(path) + "}");
            }
            catch (Exception ex)
            {
                Log("skill save failed: " + ex.Message);
                if (Settings != null && !Settings.IsDisposed)
                    Settings.PushState("{\"skillSaveFail\":" + new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(ex.Message) + "}");
            }
        }

        // hand the embedded SKILL.md to the settings page, which copies it into a one-shot
        // AI prompt (the store listing promises "one sentence -> a wallpaper", so the button
        // must deliver the real spec, not a link).
        private static void PushSkillText()
        {
            try
            {
                if (Settings == null || Settings.IsDisposed) return;
                Settings.PushState("{\"skillText\":" + new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(App.SkillMd) + "}");
            }
            catch (Exception ex) { Log("skill text failed: " + ex.Message); }
        }

                // ---- webview cache: cap it, report it, let the user wipe it --------------------------
        // A 3D wallpaper makes Chromium write shader and GPU caches. Unbounded, the profile
        // grows by tens of MB, which would make the "under 1 MB" claim look false in
        // Settings > Apps. Both caches are capped at 8 MB below; the button in the about
        // panel reports the real size and lets the user reclaim it.
        private static CoreWebView2EnvironmentOptions EnvOptions()
        {
            return new CoreWebView2EnvironmentOptions("--disk-cache-size=8388608 --gpu-disk-cache-size-kb=8192 --disable-component-update --disable-features=OptimizationHints,OptimizationGuideModelDownloading,Translate,MediaRouter,MSOfficeLinkHandler");
        }

        private static string CacheDir() { return Path.Combine(Store.DataDir, "webview"); }

        private static long DirSize(string dir)
        {
            long n = 0;
            try
            {
                foreach (string f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
                    try { n += new FileInfo(f).Length; } catch { }
            }
            catch { }
            return n;
        }

        private static string Mb(long bytes)
        {
            return (bytes / 1048576.0).ToString("0.0", System.Globalization.CultureInfo.InvariantCulture);
        }

        private static void WipeCacheIfFlagged()
        {
            string flag = Path.Combine(Store.DataDir, "cache-clear.flag");
            if (!File.Exists(flag)) return;
            try
            {
                long before = DirSize(CacheDir());
                if (Directory.Exists(CacheDir())) Directory.Delete(CacheDir(), true);
                File.Delete(flag);
                Log("cache wiped on start, freed " + Mb(before) + " MB");
            }
            catch (Exception ex) { Log("cache wipe on start failed: " + ex.Message); }
        }

        private static void PushCacheInfo()
        {
            try
            {
                if (Settings == null || Settings.IsDisposed) return;
                Settings.PushState("{\"cacheMb\":" + Mb(DirSize(CacheDir())) + "}");
            }
            catch (Exception ex) { Log("cache info failed: " + ex.Message); }
        }

        private static void ClearCache()
        {
            try
            {
                // the kernel keeps these files open, so the full wipe waits for the next start;
                // try now too, so a small cache disappears immediately.
                File.WriteAllText(Path.Combine(Store.DataDir, "cache-clear.flag"), "1");
                foreach (string name in new string[] { "Cache", "Code Cache", "GPUCache", "ShaderCache", "GrShaderCache" })
                {
                    try
                    {
                        foreach (string p in Directory.GetDirectories(CacheDir(), name, SearchOption.AllDirectories))
                            try { Directory.Delete(p, true); } catch { }
                    }
                    catch { }
                }
                long left = DirSize(CacheDir());
                Log("cache clear requested, " + Mb(left) + " MB still on disk");
                if (Settings != null && !Settings.IsDisposed)
                    Settings.PushState("{\"cacheCleared\":true,\"cacheMb\":" + Mb(left) + "}");
            }
            catch (Exception ex) { Log("cache clear failed: " + ex.Message); }
        }
        private static void RemoveWallpaper(Dictionary<string, object> d)
        {
            try
            {
                string id = d.ContainsKey("id") ? d["id"] as string : null;
                WallpaperFile wf = Cfg.wallpapers.Find((w) => w.id == id);
                if (wf == null) return;
                Cfg.wallpapers.Remove(wf);
                Cfg.petCfg.Remove("ext:" + id);
                if (id == "daisypond1080") { Cfg.daisyPondGone = true; Store.Save(Cfg); }   // deleted on purpose: never re-add
                try { File.Delete(wf.file); } catch { }
                // a video sits next to its wrapper page; sweep this wallpaper's leftovers only
                foreach (string f in Directory.GetFiles(Store.WallpaperDir, wf.id + ".*"))
                    try { File.Delete(f); } catch { }
                if (Cfg.fx == "ext:" + id) Cfg.fx = "weather/snow";
                Apply(Cfg);
                Log("removed wallpaper " + id);
            }
            catch (Exception ex) { Log("remove wallpaper failed: " + ex.Message); }
        }

        private static void RenameWallpaper(Dictionary<string, object> d)
        {
            try
            {
                string id = d.ContainsKey("id") ? d["id"] as string : null;
                string name = d.ContainsKey("name") ? d["name"] as string : null;
                if (string.IsNullOrWhiteSpace(name)) return;
                WallpaperFile wf = Cfg.wallpapers.Find((w) => w.id == id);
                if (wf == null) return;
                wf.name = name.Trim();
                Apply(Cfg);                                       // persists and re-pushes (dropdown label updates)
                Log("renamed wallpaper " + id);
            }
            catch (Exception ex) { Log("rename wallpaper failed: " + ex.Message); }
        }

        private static void RemovePet(Dictionary<string, object> d)
        {
            try
            {
                string id = d.ContainsKey("id") ? d["id"] as string : null;
                PetFile pf = Cfg.pets.Find((p) => p.id == id);
                if (pf == null) return;
                Cfg.pets.Remove(pf);
                foreach (var slot in Cfg.petCfg.Values) slot.Remove(id);
                try { File.Delete(pf.file); } catch { }
                Apply(Cfg);
                Log("removed pet " + id);
            }
            catch (Exception ex) { Log("remove pet failed: " + ex.Message); }
        }

        /// <summary>Hidden things come back: ids in "fx" rejoin the scene list, "wallpapers" the
        /// user list. "all" restores everything at once (the 出厂恢复 button).</summary>
        private static void RestoreHidden(Dictionary<string, object> d)
        {
            try
            {
                bool all = d.ContainsKey("all") && (d["all"] is bool && (bool)d["all"]);
                if (all || (d.ContainsKey("fx") && (d["fx"] is bool && (bool)d["fx"]))) Cfg.hiddenFx.Clear();
                if (all || (d.ContainsKey("wallpapers") && (d["wallpapers"] is bool && (bool)d["wallpapers"]))) Cfg.hiddenWallpapers.Clear();
                Apply(Cfg);
            }
            catch (Exception ex) { Log("restore failed: " + ex.Message); }
        }

        // ---- hotkeys -------------------------------------------------------------------------
        public static void RegisterHotkeys()
        {
            if (Keys == null || !Keys.Ready) return;
            Keys.Register(Cfg.hotkey);
        }

        // ---- tray ----------------------------------------------------------------------------
        private static void CreateTray()
        {
            Tray = new NotifyIcon();
            Tray.Icon = MakeIcon();
            Tray.ContextMenuStrip = BuildMenu();
            Tray.DoubleClick += delegate { ShowSettings(); };
            Tray.Visible = true;
        }

        /// <summary>Re-label the tray after the user switches language, without a restart.</summary>
        public static void RebuildTray()
        {
            if (Tray == null) return;
            ContextMenuStrip old = Tray.ContextMenuStrip;
            Tray.ContextMenuStrip = BuildMenu();
            if (old != null) old.Dispose();
            SyncState();
        }

        private static ContextMenuStrip BuildMenu()
        {
            Tray.Text = Lang.T("appName");
            var menu = new ContextMenuStrip();
            Add(menu, Lang.T("traySettings"), delegate { ShowSettings(); });
            Add(menu, Lang.T("pauseBtn"), delegate { TogglePause(); }, "pause");
            Add(menu, Lang.T("trayNext"), delegate { Wallpaper.Command("next"); });
            Add(menu, Lang.T("trayAutostart"), delegate
            {
                Cfg.autoStart = !Cfg.autoStart;
                Store.SetAutoStart(Cfg.autoStart);
                if (Store.Packaged) WinRt.ApplyStartupTask(Cfg.autoStart); // MSIX: StartupTask
                Store.Save(Cfg);
                if (Settings != null) Settings.Push(Augment(Store.Json(Cfg)));   // keep wallHtmls: load() replaces the page's cfg wholesale
                Tray.ShowBalloonTip(1200, "像素幻境", Lang.T(Cfg.autoStart ? "autostartOn" : "autostartOff"), ToolTipIcon.None);
            });
            menu.Items.Add(new ToolStripSeparator());
            Add(menu, Lang.T("trayExit"), delegate { Exit(); });
            return menu;
        }

        private static void Add(ContextMenuStrip m, string text, EventHandler h, string tag)
        {
            var item = new ToolStripMenuItem(text);
            item.Click += h;
            if (tag != null) item.Tag = tag;
            m.Items.Add(item);
        }
        private static void Add(ContextMenuStrip m, string text, EventHandler h) { Add(m, text, h, null); }

        private static Icon MakeIcon()
        {
            try { return Icon.ExtractAssociatedIcon(Store.ExePath()); }
            catch { }
            var bmp = new Bitmap(16, 16);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.Transparent);
                g.FillRectangle(new SolidBrush(Color.FromArgb(245, 60, 209)), 2, 2, 6, 6);
                g.FillRectangle(new SolidBrush(Color.FromArgb(124, 92, 255)), 9, 2, 5, 5);
                g.FillRectangle(new SolidBrush(Color.FromArgb(80, 70, 110)), 2, 9, 5, 5);
                g.FillRectangle(new SolidBrush(Color.White), 9, 9, 5, 5);
            }
            return Icon.FromHandle(bmp.GetHicon());
        }

        public static void ShowSettings()
        {
            if (Env == null) { ShowPending = true; Log("settings: webview env not ready, will show later"); return; }
            if (Settings == null || Settings.IsDisposed)
            {
                Settings = new SettingsWindow();
                Settings.Message += OnSettingsMessage;
                Settings.FormClosed += delegate { Settings = null; };
                Settings.Start(Env, Augment(Store.Json(Cfg)));   // wallHtmls must be in the first push, or the ext preview stays on its placeholder card
            }
            Settings.Show();
            Settings.Push(Augment(Store.Json(Cfg)));
            Settings.PushState("{\"paused\":" + (Cfg.paused ? "true" : "false") + ",\"fx\":\"" + Cfg.fx + "\",\"packaged\":" + (Store.Packaged ? "true" : "false") + "}");
            if (Settings.WindowState == FormWindowState.Minimized) Settings.WindowState = FormWindowState.Normal;
            Settings.Activate();
            Native.SetForegroundWindow(Settings.Handle);
            Settings.FocusPage();
        }

        public static void Log(string msg)
        {
            try
            {
                Directory.CreateDirectory(Store.DataDir);
                File.AppendAllText(Path.Combine(Store.DataDir, "log.txt"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss ") + msg + Environment.NewLine);
            }
            catch { }
        }

        /// <summary>Explorer restarted: the old desktop window died with it, so build a new one.</summary>
        private static void RebuildWallpaperSoon()
        {
            Log("explorer restarted, rebuilding wallpaper");
            var t = new Timer();
            t.Interval = 1500;
            t.Tick += delegate
            {
                t.Stop();
                t.Dispose();
                RebuildWallpaper();
            };
            t.Start();
        }

        private static void RebuildWallpaper()
        {
            try
            {
                if (Wallpaper != null)
                {
                    Wallpaper.Message -= OnWallpaperMessage;
                    Wallpaper.Dispose();
                }
            }
            catch { }
            try
            {
                Wallpaper = new WallpaperWindow(Screen.PrimaryScreen.Bounds);
                Wallpaper.Message += OnWallpaperMessage;
                Wallpaper.Show();
                if (Env != null)
                {
                    Wallpaper.Start(Env);
                    Apply(Cfg);   // Apply decides internal vs external (ShowFx) and pushes config
                }
            }
            catch (Exception ex) { Log("rebuild failed: " + ex.Message); }
        }

        private static void ListenForSecondLaunch()
        {
            var t = new System.Threading.Thread(delegate ()
            {
                try
                {
                    using (var ev = new System.Threading.EventWaitHandle(false,
                        System.Threading.EventResetMode.AutoReset, "PixelPalette.Show"))
                    {
                        while (true)
                        {
                            ev.WaitOne();
                            if (Dispatcher != null && !Dispatcher.IsDisposed)
                                Dispatcher.BeginInvoke(new Action(delegate { ShowSettings(); }));
                        }
                    }
                }
                catch { }
            });
            t.IsBackground = true;
            t.Start();
        }

        private static void StartReloadTimer()
        {            if (ReloadTimer != null) { ReloadTimer.Stop(); ReloadTimer.Dispose(); ReloadTimer = null; }
            int hours = Cfg.reloadHours;
            if (hours <= 0) return;
            ReloadTimer = new Timer();
            ReloadTimer.Interval = Math.Min(int.MaxValue, hours * 3600 * 1000);
            ReloadTimer.Tick += delegate { Wallpaper.Reload(); Wallpaper.Push(Store.Json(Cfg)); };
            ReloadTimer.Start();
        }

        // ---- exit / uninstall ----------------------------------------------------------------
        public static void Exit()
        {
            try
            {
                if (Keys != null) Keys.Dispose();
                if (Tray != null) { Tray.Visible = false; Tray.Dispose(); }
                if (ReloadTimer != null) ReloadTimer.Dispose();
                if (Wallpaper != null) Wallpaper.Dispose();
                if (Settings != null) Settings.Dispose();
            }
            catch { }
            Application.Exit();
        }

        public static void Uninstall(bool ask)
        {
            if (Store.Packaged) return; // the Store owns the install; Windows Settings removes it
            if (ask && MessageBox.Show(Lang.T("uninstallConfirm"), "像素幻境",
                MessageBoxButtons.OKCancel, MessageBoxIcon.Warning) != DialogResult.OK) return;
            string exe = Store.ExePath();
            string dir = Path.GetDirectoryName(exe);
            string data = Store.DataDir;
            try { Store.SetAutoStart(false); } catch { }
            RemoveShortcuts();
            Exit();
            try
            {
                foreach (Process p in Process.GetProcessesByName("PixelPalette"))
                    if (p.Id != Process.GetCurrentProcess().Id) p.Kill();
            }
            catch { }
            // no cmd.exe here: an unsigned helper that spawns a shell to delete itself reads like a dropper
            // to antivirus heuristics. Delete with retries (the WebView2 child processes can hold the data
            // folder for a moment after we exit), then ask Windows to remove whatever survives on next boot.
            try { if (Directory.Exists(data)) DeleteTree(data); } catch { }
            try { DeleteTree(dir); } catch { }
        }

        /// <summary>Deletes a folder with retries, and schedules each survivor for deletion at next boot,
        /// so nothing of the app — not even the running exe — outlives the uninstall.</summary>
        private static void DeleteTree(string path)
        {
            for (int i = 0; i < 8; i++)
            {
                try
                {
                    if (!Directory.Exists(path)) return;
                    Directory.Delete(path, true);
                    if (!Directory.Exists(path)) return;
                }
                catch { }
                System.Threading.Thread.Sleep(400);
            }
            // still locked: everything left goes on Windows' delete-on-reboot list
            try
            {
                foreach (string f in Directory.GetFiles(path, "*", SearchOption.AllDirectories))
                    try { Native.MoveFileEx(f, null, Native.MOVEFILE_DELAY_UNTIL_REBOOT); } catch { }
                foreach (string d in SubDirsFirst(path)) try { Native.MoveFileEx(d, null, Native.MOVEFILE_DELAY_UNTIL_REBOOT); } catch { }
                Native.MoveFileEx(path, null, Native.MOVEFILE_DELAY_UNTIL_REBOOT);   // works once it is empty
            }
            catch { }
        }

        private static System.Collections.Generic.IEnumerable<string> SubDirsFirst(string path)
        {
            // deepest first, so each directory is empty when its own delete-on-reboot turn comes
            var all = Directory.GetDirectories(path, "*", SearchOption.AllDirectories);
            System.Array.Sort(all, (a, b) => b.Length.CompareTo(a.Length));
            return all;
        }

        private static void RemoveShortcuts()
        {
            try
            {
                string[] links =
                {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", Lang.T("appName") + ".lnk"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Lang.T("appName") + ".lnk")
                };
                foreach (string l in links) if (File.Exists(l)) File.Delete(l);
                using (RegistryKey k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelPalette", true))
                    if (k != null) { k.Close(); Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelPalette", false); }
            }
            catch { }
        }
    }

    /// <summary>Owns the message loop; nothing visible of its own.</summary>
    internal class Shell : ApplicationContext
    {
        private readonly Form handle;

        public Shell()
        {
            handle = new Form();
            handle.ShowInTaskbar = false;
            handle.FormBorderStyle = FormBorderStyle.None;
            handle.StartPosition = FormStartPosition.Manual;
            handle.Bounds = new Rectangle(-32000, -32000, 1, 1);
            App.Dispatcher = handle;
            handle.Show(); // a real handle, so async work resumes on the UI thread
            App.Start();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && handle != null) handle.Dispose();
            base.Dispose(disposing);
        }
    }

    /// <summary>Watches for Explorer coming back after a crash or restart, so we can rebuild the desktop window.</summary>
    public class ShellListener : NativeWindow
    {
        private readonly int msgTaskbarCreated = Native.RegisterWindowMessage("TaskbarCreated");
        public event Action Restarted;

        public ShellListener()
        {
            CreateHandle(new CreateParams());
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == msgTaskbarCreated && Restarted != null) Restarted();
            base.WndProc(ref m);
        }
    }

    /// <summary>A message-only window for WM_HOTKEY.</summary>
    public class HotkeyWindow : NativeWindow, IDisposable
    {
        private const int WM_HOTKEY = 0x0312;
        public event Action Pause;
        public event Action Next;
        private string registered = "";
        private uint mods, vk;
        public bool Ready;

        public HotkeyWindow()
        {
            CreateHandle(new CreateParams());
            Ready = true;
        }

        public void Register(string hotkey)
        {
            Native.UnregisterHotKey(Handle, 1);
            Native.UnregisterHotKey(Handle, 2);
            if (Native.ParseHotkey(hotkey, out mods, out vk))
            {
                bool ok = Native.RegisterHotKey(Handle, 1, mods, vk);
                App.Log("hotkey " + hotkey + " -> " + (ok ? "ok" : "FAILED " + Marshal.GetLastWin32Error()));
            }
            else App.Log("hotkey parse failed: " + hotkey);
            Native.RegisterHotKey(Handle, 2, Native.MOD_CONTROL | Native.MOD_ALT, (uint)'N');
            registered = hotkey;
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY)
            {
                int id = m.WParam.ToInt32();
                App.Log("hotkey fired: " + id);
                if (id == 1 && Pause != null) Pause();
                else if (id == 2 && Next != null) Next();
            }
            base.WndProc(ref m);
        }

        public void Dispose()
        {
            try { Native.UnregisterHotKey(Handle, 1); Native.UnregisterHotKey(Handle, 2); } catch { }
            DestroyHandle();
        }
    }
}
