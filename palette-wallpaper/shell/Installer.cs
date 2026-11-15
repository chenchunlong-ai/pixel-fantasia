// The installer: a small window that copies the app out of itself and sets up shortcuts.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;
using PixelFX;

namespace PixelFXSetup
{
    internal static class Setup
    {
        private static string InstallDir()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "PixelPalette");
        }

        [STAThread]
        private static void Main()
        {
            Lang.Use("auto");
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }

        private class SetupForm : Form
        {
            private readonly TextBox path;
            private readonly CheckBox autoStart;
            private readonly CheckBox desktop;
            private readonly Button go;
            private readonly Label status;
            private readonly ProgressBar bar;

            public SetupForm()
            {
                Text = Lang.T("installTitle");
                FormBorderStyle = FormBorderStyle.FixedSingle;
                MaximizeBox = false;
                StartPosition = FormStartPosition.CenterScreen;
                ClientSize = new Size(520, 300);
                BackColor = Color.FromArgb(13, 12, 20);
                ForeColor = Color.FromArgb(232, 228, 245);
                Font = new Font("Microsoft YaHei UI", 9f);

                var title = new Label();
                title.Text = Lang.T("appName");
                title.Font = new Font("Microsoft YaHei UI", 14f, FontStyle.Bold);
                title.ForeColor = Color.White;
                title.SetBounds(24, 22, 400, 30);
                Controls.Add(title);

                var sub = new Label();
                sub.Text = Lang.T("appSub");
                sub.ForeColor = Color.FromArgb(154, 147, 181);
                sub.SetBounds(26, 56, 460, 20);
                Controls.Add(sub);

                var l1 = new Label();
                l1.Text = Lang.T("installPath");
                l1.SetBounds(26, 96, 60, 22);
                Controls.Add(l1);

                path = new TextBox();
                path.Text = InstallDir();
                path.SetBounds(90, 94, 330, 24);
                path.BackColor = Color.FromArgb(27, 24, 40);
                path.ForeColor = Color.White;
                path.BorderStyle = BorderStyle.FixedSingle;
                Controls.Add(path);

                var browse = new Button();
                browse.Text = "…";
                browse.SetBounds(430, 93, 60, 26);
                browse.Click += delegate
                {
                    using (var d = new FolderBrowserDialog())
                    {
                        d.SelectedPath = path.Text;
                        if (d.ShowDialog() == DialogResult.OK) path.Text = d.SelectedPath;
                    }
                };
                Controls.Add(browse);

                autoStart = new CheckBox();
                autoStart.Text = Lang.T("installAutoStart");
                autoStart.Checked = true;
                autoStart.SetBounds(28, 134, 200, 22);
                Controls.Add(autoStart);

                desktop = new CheckBox();
                desktop.Text = Lang.T("installDesktop");
                desktop.Checked = true;
                desktop.SetBounds(28, 160, 200, 22);
                Controls.Add(desktop);

                status = new Label();
                status.Text = Lang.T("installStatusSize");
                status.ForeColor = Color.FromArgb(154, 147, 181);
                status.SetBounds(26, 196, 470, 40);
                Controls.Add(status);

                bar = new ProgressBar();
                bar.SetBounds(26, 236, 466, 6);
                bar.Style = ProgressBarStyle.Continuous;
                bar.Visible = false;
                Controls.Add(bar);

                go = new Button();
                go.Text = Lang.T("installGo");
                go.SetBounds(330, 256, 82, 30);
                go.BackColor = Color.FromArgb(124, 92, 255);
                go.ForeColor = Color.White;
                go.FlatStyle = FlatStyle.Flat;
                go.FlatAppearance.BorderSize = 0;
                go.Click += delegate { Install(); };
                Controls.Add(go);
                AcceptButton = go;

                var cancel = new Button();
                cancel.Text = Lang.T("installCancel");
                cancel.SetBounds(418, 256, 74, 30);
                cancel.FlatStyle = FlatStyle.Flat;
                cancel.FlatAppearance.BorderColor = Color.FromArgb(42, 37, 64);
                cancel.ForeColor = Color.FromArgb(200, 195, 220);
                cancel.Click += delegate { Close(); };
                Controls.Add(cancel);
            }

            private void Install()
            {
                string dir = path.Text.Trim();
                if (dir.Length < 3)
                {
                    MessageBox.Show(Lang.T("installPathShort"), "像素幻境");
                    return;
                }
                go.Enabled = false;
                bar.Visible = true;
                try
                {
                    Directory.CreateDirectory(dir);
                    status.Text = Lang.T("installExtracting");
                    Application.DoEvents();

                    string exe = Path.Combine(dir, "PixelPalette.exe");
                    Assembly a = Assembly.GetExecutingAssembly();
                    foreach (string n in a.GetManifestResourceNames())
                        if (n.EndsWith("app.zip", StringComparison.OrdinalIgnoreCase))
                        {
                            string tmp = Path.Combine(Path.GetTempPath(), "pixelfx-app-" + Guid.NewGuid().ToString("N") + ".zip");
                            using (Stream s = a.GetManifestResourceStream(n))
                            using (FileStream f = File.Create(tmp))
                                s.CopyTo(f);
                            using (var z = System.IO.Compression.ZipFile.OpenRead(tmp))
                            {
                                foreach (var entry in z.Entries)
                                {
                                    if (string.IsNullOrEmpty(entry.Name)) continue;
                                    string target = Path.Combine(dir, entry.FullName);
                                    string parent = Path.GetDirectoryName(target);
                                    if (!string.IsNullOrEmpty(parent) && !Directory.Exists(parent)) Directory.CreateDirectory(parent);
                                    entry.ExtractToFile(target, true);
                                }
                            }
                            try { File.Delete(tmp); } catch { }
                            break;
                        }
                    bar.Value = 60;

                    status.Text = Lang.T("installShortcuts");
                    Application.DoEvents();
                    Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                        "Programs", Lang.T("appName") + ".lnk"), exe);
                    if (desktop.Checked)
                        Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                            Lang.T("appName") + ".lnk"), exe);
                    bar.Value = 80;

                    status.Text = Lang.T("installRegistry");
                    Application.DoEvents();
                    RegisterUninstall(exe, dir);

                    using (RegistryKey k = Registry.CurrentUser.OpenSubKey(
                        @"Software\Microsoft\Windows\CurrentVersion\Run", true))
                    {
                        if (k != null)
                        {
                            if (autoStart.Checked) k.SetValue("PixelPalette", "\"" + exe + "\"");
                            else k.DeleteValue("PixelPalette", false);
                        }
                    }

                    bar.Value = 100;
                    status.Text = Lang.T("installDone");
                    Application.DoEvents();
                    Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true });
                    Close();
                }
                catch (Exception ex)
                {
                    MessageBox.Show(Lang.T("installFailed") + "\n" + ex.Message, "像素幻境", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    go.Enabled = true;
                    bar.Visible = false;
                }
            }

            private static void Shortcut(string lnk, string target)
            {
                object shell = null, link = null;
                try
                {
                    shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                    link = shell.GetType().InvokeMember("CreateShortcut",
                        BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
                    link.GetType().InvokeMember("TargetPath", BindingFlags.SetProperty, null, link, new object[] { target });
                    link.GetType().InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, link,
                        new object[] { Path.GetDirectoryName(target) });
                    link.GetType().InvokeMember("IconLocation", BindingFlags.SetProperty, null, link, new object[] { target + ",0" });
                    link.GetType().InvokeMember("Description", BindingFlags.SetProperty, null, link, new object[] { Lang.T("appName") });
                    link.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
                }
                catch { }
                finally
                {
                    if (link != null && Marshal.IsComObject(link)) Marshal.ReleaseComObject(link);
                    if (shell != null && Marshal.IsComObject(shell)) Marshal.ReleaseComObject(shell);
                }
            }

            private static void RegisterUninstall(string exe, string dir)
            {
                try
                {
                    using (RegistryKey k = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelPalette"))
                    {
                        if (k == null) return;
                        k.SetValue("DisplayName", Lang.T("appName"));
                        k.SetValue("DisplayVersion", "1.0");
                        k.SetValue("Publisher", "像素幻境");
                        k.SetValue("DisplayIcon", exe + ",0");
                        k.SetValue("InstallLocation", dir);
                        k.SetValue("UninstallString", "\"" + exe + "\" --uninstall");
                        k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                        k.SetValue("EstimatedSize", 2048, RegistryValueKind.DWord);
                    }
                }
                catch { }
            }
        }
    }
}
