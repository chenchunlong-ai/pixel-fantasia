// Entry point: one instance only; a second launch just brings the settings window up.
using System;
using System.Windows.Forms;

namespace PixelFX
{
    internal static class Entry
    {
        // no Process.Start / ShellExecute here on purpose: WACK's blocked-executable test fails
        // the package for ANY process-launch API reference; the WebView2 download URL is shown
        // as text instead of opened

        [STAThread]
        private static void Main(string[] args)
        {
            bool uninstall = args.Length > 0 && args[0] == "--uninstall";
            bool wantsSettings = args.Length > 0 && args[0] == "--settings";

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (uninstall)
            {
                App.Uninstall(true);
                return;
            }

            if (!WebView2Ready()) return;

            bool created;
            using (var mutex = new System.Threading.Mutex(true, "PixelPalette.SingleInstance", out created))
            {
                if (!created)
                {
                    try
                    {
                        using (var show = new System.Threading.EventWaitHandle(false, System.Threading.EventResetMode.AutoReset, "PixelPalette.Show"))
                            show.Set();
                    }
                    catch { }
                    return;
                }

                var shell = new Shell();
                if (wantsSettings)
                    try { App.ShowSettings(); } catch { }
                Application.Run(shell);
                GC.KeepAlive(mutex);
            }
        }

        /// <summary>The renderer is a Windows component, not something we ship. Say so in plain words if it is missing.</summary>
        private static bool WebView2Ready()
        {
            try
            {
                if (!string.IsNullOrEmpty(Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString()))
                    return true;
            }
            catch { }

            Lang.Use(Store.Load().lang);
            MessageBox.Show(
                Lang.T("webviewMissing") + "\n\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703",
                Lang.T("appName"), MessageBoxButtons.OK, MessageBoxIcon.Information);
            return false;
        }
    }
}
