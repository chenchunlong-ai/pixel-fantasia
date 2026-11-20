// Win32 bits: parenting our web view to the desktop's WorkerW window, and the global hotkeys.
using System;
using System.Runtime.InteropServices;

namespace PixelFX
{
    internal static class Native
    {
        public const int GWL_STYLE = -16;
        public const int WS_CHILD = 0x40000000;
        public const int WS_POPUP = unchecked((int)0x80000000);
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_FRAMECHANGED = 0x0020;
        public const uint SWP_SHOWWINDOW = 0x0040;
        public static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        public const int GWL_EXSTYLE = -20;
        public const int WS_EX_LAYERED = 0x00080000;
        public const uint LWA_COLORKEY = 0x00000001;
        [DllImport("user32.dll")]
        public static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint key, byte alpha, uint flags);
        public const uint SMTO_NORMAL = 0x0000;

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr FindWindow(string cls, string win);
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string win);
        [DllImport("user32.dll")]
        public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumProc cb, IntPtr param);
        public delegate bool EnumProc(IntPtr hWnd, IntPtr param);
        [DllImport("user32.dll")]
        public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
        [DllImport("user32.dll")]
        public static extern IntPtr GetParent(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern int GetWindowLong(IntPtr hWnd, int index);
        [DllImport("user32.dll")]
        public static extern int SetWindowLong(IntPtr hWnd, int index, int value);
        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
        public struct POINT { public int X; public int Y; }
        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out POINT p);
        public const int VK_LBUTTON = 0x01;
        [DllImport("user32.dll")]
        public static extern short GetAsyncKeyState(int vKey);
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint mods, uint vk);
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        public const uint MOD_ALT = 0x1, MOD_CONTROL = 0x2, MOD_SHIFT = 0x4, MOD_WIN = 0x8;

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool SetDllDirectory(string path);

        public const int MOVEFILE_DELAY_UNTIL_REBOOT = 0x4;
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool MoveFileEx(string from, string to, int flags);

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left, Top, Right, Bottom; }

        /// <summary>
        /// The window that the desktop wallpaper lives in. On most builds the icons sit in a WorkerW and the
        /// wallpaper in its sibling WorkerW behind it; on Windows 11 24H2 the icons sit straight in Progman and
        /// there is no sibling, so Progman itself is the right host -- as long as we stay at the bottom of its
        /// z-order, otherwise we cover the icons.
        /// </summary>
        public static IntPtr DesktopWorker()
        {
            IntPtr progman = FindWindow("Progman", null);
            IntPtr res;
            // 0x052C with 0xD/0x1 asks Explorer to spawn the WorkerW; the plain call is the older trick
            if (progman != IntPtr.Zero)
            {
                SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(0x1), SMTO_NORMAL, 1000, out res);
                SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, SMTO_NORMAL, 1000, out res);
            }
            IntPtr host = IntPtr.Zero;
            IntPtr behind = IntPtr.Zero;
            EnumWindows(delegate(IntPtr h, IntPtr p)
            {
                if (FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero)
                {
                    host = h;
                    // Windows 11 24H2 keeps the wallpaper WorkerW *inside* Progman, right under the icons;
                    // older builds put a sibling WorkerW after the icon window at top level.
                    behind = FindWindowEx(h, IntPtr.Zero, "WorkerW", null);
                    if (behind == IntPtr.Zero) behind = FindWindowEx(IntPtr.Zero, h, "WorkerW", null);
                    return false; // first hit wins, stop here
                }
                return true;
            }, IntPtr.Zero);
            if (behind != IntPtr.Zero) return behind;
            if (host != IntPtr.Zero) return host;
            return progman;
        }

        /// <summary>The window that holds the desktop icons (SHELLDLL_DefView).</summary>
        public static IntPtr DesktopIcons()
        {
            IntPtr progman = FindWindow("Progman", null);
            IntPtr icons = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (icons != IntPtr.Zero) return icons;
            EnumWindows(delegate(IntPtr h, IntPtr p)
            {
                icons = FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
                return icons == IntPtr.Zero;
            }, IntPtr.Zero);
            return icons;
        }

        /// <summary>True when this window is the one holding the desktop icons.</summary>
        public static bool HostsIcons(IntPtr h)
        {
            return h != IntPtr.Zero && FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero;
        }

        /// <summary>Put a child window at the bottom of its parent's z-order so siblings (the icons) stay on top.</summary>
        public static void ToBottom(IntPtr h)
        {
            SetWindowPos(h, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }

        /// <summary>Every WorkerW on screen, so a multi-monitor setup can put one behind each.</summary>
        public static System.Collections.Generic.List<IntPtr> AllWorkers()
        {
            var list = new System.Collections.Generic.List<IntPtr>();
            EnumWindows(delegate(IntPtr h, IntPtr p)
            {
                var sb = new System.Text.StringBuilder(32);
                GetClassName(h, sb, sb.Capacity);
                if (sb.ToString() == "WorkerW") list.Add(h);
                return true;
            }, IntPtr.Zero);
            return list;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder name, int max);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetCurrentPackageFullName(ref int length, System.Text.StringBuilder name);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int RegisterWindowMessage(string name);

        /// <summary>Turn a "Ctrl+Alt+P" style hotkey into RegisterHotKey arguments.</summary>
        public static bool ParseHotkey(string text, out uint mods, out uint vk)
        {
            mods = 0; vk = 0;
            if (string.IsNullOrEmpty(text)) return false;
            string[] parts = text.Split(new[] { '+' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < parts.Length; i++)
            {
                string p = parts[i].Trim().ToUpperInvariant();
                if (p == "CTRL" || p == "CONTROL") mods |= MOD_CONTROL;
                else if (p == "ALT") mods |= MOD_ALT;
                else if (p == "SHIFT") mods |= MOD_SHIFT;
                else if (p == "WIN") mods |= MOD_WIN;
                else
                {
                    if (p.Length == 1) vk = (uint)p[0];
                    else
                    {
                        int n;
                        if (p.Length >= 2 && p[0] == 'F' && int.TryParse(p.Substring(1), out n)) vk = (uint)(0x70 + n - 1);
                        else return false;
                    }
                }
            }
            return vk != 0;
        }
    }
}
