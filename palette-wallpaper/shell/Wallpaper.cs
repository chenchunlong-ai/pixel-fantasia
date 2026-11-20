// The desktop window: a WebView2 showing the weather page, parented to Explorer's WorkerW so it sits
// behind the icons. A watchdog re-attaches it when Explorer restarts or the desktop window is rebuilt.
using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PixelFX
{
    public class WallpaperWindow : Form
    {
        private readonly Rectangle area;
        private readonly WebView2 web;
        private readonly Timer watchdog;
        private readonly Timer mousePoll;                 // cursor → window.wallMouse (see PollMouse)
        private Point lastMouse;                          // last pushed cursor position (window px)
        private bool lButtonDown;                         // previous poll's left-button state (edge detect)
        private IntPtr worker = IntPtr.Zero;
        private bool ready;
        private bool hiddenForSession;
        private string pending;
        private CoreWebView2Environment env;
        private bool externalShowing;                     // true while a user wallpaper file is loaded
        private string wantFile;                          // the external file to show (null = internal page)

        public event Action<string> Message;

        public WallpaperWindow(Rectangle r)
        {
            area = r;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            Bounds = new Rectangle(-32000, -32000, r.Width, r.Height);
            BackColor = Color.Black;
            Text = "pixelfx wallpaper";

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = Color.Black;
            Controls.Add(web);


            watchdog = new Timer();
            watchdog.Interval = 4000;
            watchdog.Tick += delegate { EnsureAttached(); };

            // the wallpaper window sits under the icon layer and never receives mouse events itself;
            // pages that want cursor interaction implement window.wallMouse(nx, ny) and we feed them
            // here (only pushed while the cursor moves inside the wallpaper area, never logged)
            mousePoll = new Timer();
            mousePoll.Interval = 40;
            mousePoll.Tick += delegate { PollMouse(); };
        }

        private void PollMouse()
        {
            if (!ready || web == null || web.CoreWebView2 == null) return;
            Native.POINT p;
            if (!Native.GetCursorPos(out p)) return;
            int x = p.X - area.X, y = p.Y - area.Y;
            if (x < 0 || y < 0 || x >= area.Width || y >= area.Height) return;
            // left-button press over the wallpaper → the page's window.wallClick(nx, ny).
            // GetAsyncKeyState is global input: a click in another app also lands here — acceptable,
            // the wallpaper is a background surface and a stray splash is harmless.
            bool down = (Native.GetAsyncKeyState(Native.VK_LBUTTON) & 0x8000) != 0;
            if (down && !lButtonDown)
            {
                float cx = x / (float)area.Width, cy = y / (float)area.Height;
                try
                {
                    web.CoreWebView2.ExecuteScriptAsync("window.wallClick && window.wallClick("
                        + cx.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) + ","
                        + cy.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) + ")");
                }
                catch { }
            }
            lButtonDown = down;
            if (x == lastMouse.X && y == lastMouse.Y) return;   // no motion → no traffic
            lastMouse = new Point(x, y);
            float nx = x / (float)area.Width, ny = y / (float)area.Height;
            try
            {
                web.CoreWebView2.ExecuteScriptAsync("window.wallMouse && window.wallMouse("
                    + nx.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) + ","
                    + ny.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture) + ")");
            }
            catch { }
        }

        public async void Start(CoreWebView2Environment e)
        {
            env = e;
            try
            {
                await web.EnsureCoreWebView2Async(env);
            }
            catch (Exception ex)
            {
                App.Log("wallpaper webview failed: " + ex);
                MessageBox.Show("WebView2 启动失败：" + ex.Message, "像素幻境");
                return;
            }
            CoreWebView2 c = web.CoreWebView2;
            c.Settings.AreDefaultContextMenusEnabled = false;
            c.Settings.AreDevToolsEnabled = false;
            c.Settings.IsStatusBarEnabled = false;
            c.Settings.IsZoomControlEnabled = false;
            c.Settings.IsBuiltInErrorPageEnabled = false;
            c.WebMessageReceived += delegate (object s, CoreWebView2WebMessageReceivedEventArgs e2)
            {
                string json = e2.WebMessageAsJson;
                App.Log("page msg: " + json.Substring(0, Math.Min(100, json.Length)));
                try
                {
                    var d = new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(json);
                    object type;
                    if (d.TryGetValue("type", out type) && (string)type == "ready")
                    {
                        ready = true;
                        if (pending != null) Push(pending);
                    }
                }
                catch { }
                if (Message != null) Message(json);
            };
            Sandbox(c);
            // virtual hosts: user files live in plain folders, but the pages we NavigateToString
            // have an opaque origin that cannot load file:// iframes — mapping the folders to
            // local-only hostnames makes user wallpaper/pet files loadable while staying offline
            try
            {
                Directory.CreateDirectory(Store.WallpaperDir);
                Directory.CreateDirectory(Store.PetDir);
                c.SetVirtualHostNameToFolderMapping("wp.local", Store.WallpaperDir, CoreWebView2HostResourceAccessKind.Allow);
                c.SetVirtualHostNameToFolderMapping("pets.local", Store.PetDir, CoreWebView2HostResourceAccessKind.Allow);
            }
            catch (Exception ex) { App.Log("vhost wp failed: " + ex.Message); }
            c.NavigationCompleted += delegate (object s, CoreWebView2NavigationCompletedEventArgs ne)
            {
                App.Log("wp nav ok=" + ne.IsSuccess + (ne.IsSuccess ? "" : " err=" + ne.WebErrorStatus));
            };
            externalShowing = wantFile != null;
            if (externalShowing) c.NavigateToString(App.WallWrapHtml);
            else c.NavigateToString(App.RuntimeHtml);
            Attach();

            // the page module may still be evaluating when the first config push lands, so the
            // shell re-pushes once shortly after load — apply is idempotent, this just beats the race
            var repush = new Timer { Interval = 1200 };
            repush.Tick += delegate { repush.Stop(); if (pending != null) Push(pending); };
            repush.Start();

            watchdog.Start();
            mousePoll.Start();
        }

        /// <summary>The sandbox: user-loaded HTML may draw, but it cannot reach the network, open
        /// windows, or navigate away. Every http/https/ws request gets a 403 with an empty body.
        /// (File access is already impossible: WebView2 forbids file:// pages from reading each
        /// other, and our pet iframes are additionally sandboxed without same-origin.)</summary>
        private void Sandbox(CoreWebView2 c)
        {
            try
            {
                c.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
                c.WebResourceRequested += delegate (object s, CoreWebView2WebResourceRequestedEventArgs e)
                {
                    string uri = e.Request != null ? e.Request.Uri : "";
                    // our virtual hosts are the only allowed "http": they are folder mappings, not network
                    bool vhost = uri.StartsWith("http://wp.local/") || uri.StartsWith("http://pets.local/");
                    if (!vhost && (uri.StartsWith("http://") || uri.StartsWith("https://") || uri.StartsWith("ws://") || uri.StartsWith("wss://")))
                    {
                        try { e.Response = env.CreateWebResourceResponse(null, 403, "Blocked", "Content-Type: text/plain"); }
                        catch { }
                    }
                };
                c.NewWindowRequested += delegate (object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            }
            catch (Exception ex) { App.Log("sandbox setup failed: " + ex.Message); }
        }

        /// <summary>Show a user-loaded wallpaper file (via the wp.local virtual host), or the
        /// built-in scene page. Switching resets the page's ready state, so config re-pushes.</summary>
        public void ShowFx(string fx, string externalFile)
        {
            bool external = externalFile != null;
            if (external == externalShowing && web.CoreWebView2 != null) return;   // already the right page
            wantFile = externalFile;                          // remembered, so a not-yet-ready webview
            externalShowing = external;                       // picks it up the moment Start() finishes
            ready = false;
            if (web.CoreWebView2 == null) return;             // Start() will navigate to wantFile
            try
            {
                if (external) web.CoreWebView2.NavigateToString(App.WallWrapHtml);
                else web.CoreWebView2.NavigateToString(App.RuntimeHtml);
            }
            catch (Exception ex) { App.Log("navigate failed: " + ex.Message); }
        }

        public bool ExternalShowing { get { return externalShowing; } }

        /// <summary>Send a config (JSON) to the wallpaper page, or hold it until it says ready.
        /// User wallpaper/pet files ride along as inline html (srcdoc), so the page needs no
        /// network requests at all to show them.</summary>
        public void Push(string json)
        {
            pending = App.Augment(json);
            if (ready && web.CoreWebView2 != null)
            {
                App.Log("push: len=" + pending.Length + " hasPose=" + pending.Contains("petCfg"));
                try { web.CoreWebView2.ExecuteScriptAsync("window.pixelFX && window.pixelFX.apply(" + pending + ")"); }
                catch (Exception ex) { App.Log("push failed: " + ex.Message); }
            }
        }





        public void Command(string name)
        {
            if (web.CoreWebView2 == null) return;
            try { web.CoreWebView2.ExecuteScriptAsync("window.pixelFX && window.pixelFX.command('" + name + "')"); }
            catch { }
        }

        public void Reload()
        {
            ready = false;
            externalShowing = false;              // App decides what to load next
            if (web.CoreWebView2 == null) return;
            try { web.CoreWebView2.NavigateToString(App.RuntimeHtml); }
            catch { }
        }

        /// <summary>Snap the live wallpaper to a PNG (for the lock screen). The webview composites
        /// offscreen, so this works even though the window sits under the icons.</summary>
        public async void CaptureSnapshot(string path, Action<bool> done)
        {
            try
            {
                if (web.CoreWebView2 == null) { done(false); return; }
                using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write))
                {
                    await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
                }
                done(true);
            }
            catch (Exception ex)
            {
                App.Log("capture failed: " + ex.Message);
                done(false);
            }
        }

        public void SessionLock(bool locked)
        {
            if (locked)
            {
                hiddenForSession = true;
                Command("pause");
            }
            else if (hiddenForSession)
            {
                hiddenForSession = false;
                Command("resume");
            }
        }

        private void Attach()
        {
            worker = Native.DesktopWorker();
            if (worker == IntPtr.Zero) return;
            Native.SetParent(this.Handle, worker);
            int style = Native.GetWindowLong(this.Handle, Native.GWL_STYLE);
            Native.SetWindowLong(this.Handle, Native.GWL_STYLE, (style | Native.WS_CHILD) & ~Native.WS_POPUP);
            Native.SetWindowPos(this.Handle, Native.HWND_BOTTOM, area.X, area.Y, area.Width, area.Height,
                Native.SWP_NOACTIVATE | Native.SWP_FRAMECHANGED | Native.SWP_SHOWWINDOW);
            App.Log("attached to " + worker + (Native.HostsIcons(worker) ? " (icons share this window, kept at the bottom)" : ""));
        }

        private void EnsureAttached()
        {
            if (!IsHandleCreated) return;
            IntPtr parent = Native.GetParent(this.Handle);
            if (worker == IntPtr.Zero || !Native.IsWindow(worker) || parent != worker)
            {
                Attach();
                return;
            }
            // Explorer can re-stack the icon layer after a refresh or a theme change; stay underneath it
            // (unless pets are being placed — the window must stay above the icons to get the mouse)
            Native.ToBottom(this.Handle);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true; // only the app decides when this goes away
                return;
            }
            watchdog.Stop();
            mousePoll.Stop();
            base.OnFormClosing(e);
        }
    
    }
}
