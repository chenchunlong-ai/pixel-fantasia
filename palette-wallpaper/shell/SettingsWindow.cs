// The settings window: the same page the wallpaper uses for looks, as a normal window with a form.
using System;
using System.Drawing;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PixelFX
{
    public class SettingsWindow : Form
    {
        private readonly WebView2 web;
        private bool ready;
        private string pending;

        public event Action<string> Message;

        public SettingsWindow()
        {
            Text = Lang.T("settingsTitle");
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1020, 800);
            MinimumSize = new Size(820, 620);
            BackColor = Color.FromArgb(13, 12, 20);
            ShowInTaskbar = true;

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = Color.FromArgb(13, 12, 20);
            Controls.Add(web);
        }

        public void Start(CoreWebView2Environment env, string configJson)
        {
            pending = configJson;
            web.EnsureCoreWebView2Async(env).ContinueWith(delegate
            {
                if (InvokeRequired) { BeginInvoke(new Action(delegate { Hook(); })); return; }
                Hook();
            });
        }

        private void Hook()
        {
            if (web.CoreWebView2 == null) return;
            CoreWebView2 c = web.CoreWebView2;
            c.Settings.AreDefaultContextMenusEnabled = false;
            c.Settings.IsStatusBarEnabled = false;
            c.Settings.AreDevToolsEnabled = false;
            c.WebMessageReceived += delegate (object s, CoreWebView2WebMessageReceivedEventArgs e)
            {
                string json = e.WebMessageAsJson;
                if (json.Contains("\"ready\""))
                {
                    ready = true;
                    if (pending != null) Push(pending);
                }
                if (Message != null) Message(json);
            };
            c.NavigateToString(App.SettingsHtml);
        }

        /// <summary>Hand the page its config: window.pixelFXSettings.load(...)</summary>
        public void Push(string json)
        {
            if (web.CoreWebView2 == null) { pending = json; return; }
            pending = json;
            if (!ready) return;
            try { web.CoreWebView2.ExecuteScriptAsync("window.pixelFXSettings && window.pixelFXSettings.load(" + json + ")"); }
            catch { }
        }

        /// <summary>Hand keyboard focus to the page, so shortcuts like Ctrl+S work right away.</summary>
        public void FocusPage()
        {
            try { web.Focus(); } catch { }
        }

        public void PushState(string json)        {
            if (web.CoreWebView2 == null || !ready) return;
            try { web.CoreWebView2.ExecuteScriptAsync("window.pixelFXSettings && window.pixelFXSettings.state(" + json + ")"); }
            catch { }
        }
    }
}
