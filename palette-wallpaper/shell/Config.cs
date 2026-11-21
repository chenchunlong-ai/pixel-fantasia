// The settings file: what the JS side reads, saved to %LOCALAPPDATA%\PixelPalette\settings.json
using System;
using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;
using Microsoft.Win32;

namespace PixelFX
{
    public class Rule
    {
        public string time { get; set; }
        public string fx { get; set; }
        public Rule() { time = "08:00"; fx = "weather/snow"; }
    }

    public class Cycle
    {
        public bool enabled { get; set; }
        public int minutes { get; set; }
        public List<string> list { get; set; }
        public Cycle() { minutes = 30; list = new List<string>(); }
    }

    /// <summary>How the 320x180 canvas meets the screen: fill stretches, contain letterboxes,
    /// cover crops — align says which side stays when cover crops.</summary>
    public class DisplayCfg
    {
        public string mode { get; set; }
        public string align { get; set; }
        public DisplayCfg() { mode = "fill"; align = "center"; }
    }

    /// <summary>A user-loaded single-file wallpaper: an HTML page (or a video with a generated
    /// wrapper page) living in our wallpapers folder.</summary>
    public class WallpaperFile
    {
        public string id { get; set; }
        public string name { get; set; }
        public string file { get; set; }     // full path of the (wrapper) html to load
        public string type { get; set; }     // "html" | "video"
    }

    /// <summary>A user-loaded pet file: a transparent-background HTML page.</summary>
    public class PetFile
    {
        public string id { get; set; }
        public string name { get; set; }
        public string file { get; set; }
    }

    /// <summary>Where one pet sits on one wallpaper: percentage of the screen, plus look.
    /// Remembered per wallpaper — switching to another scene snaps the pets to where they were.</summary>
    public class PetPose
    {
        public double x { get; set; }
        public double y { get; set; }
        public double scale { get; set; }
        public double rot { get; set; }
        public bool flip { get; set; }
        public bool on { get; set; }
        public PetPose() { x = 62; y = 45; scale = 1; rot = 0; flip = false; on = true; }
    }

    public class Settings
    {
        public int version { get; set; }
        public string fx { get; set; }
        public string palette { get; set; }
        public string bg { get; set; }
        public bool mirror { get; set; }
        public bool? critters { get; set; } // null (old config) means on
        public List<WallpaperFile> wallpapers { get; set; }  // user-loaded wallpaper files
        public bool daisyPondGone { get; set; }              // user deleted the bundled 1080P daisy pond: do not re-add it
        public List<string> hiddenFx { get; set; }           // internal scenes hidden from the list
        public List<string> hiddenWallpapers { get; set; }   // user wallpapers hidden from the list
        public bool petOn { get; set; }                      // the pet layer master switch
        public List<PetFile> pets { get; set; }              // user-loaded pet files
        public Dictionary<string, Dictionary<string, PetPose>> petCfg { get; set; }
        public bool paused { get; set; }
        public int fps { get; set; }
        public double speed { get; set; }
        public Dictionary<string, Dictionary<string, double>> @params { get; set; }
        public List<Rule> rules { get; set; }
        public Cycle cycle { get; set; }
        public string hotkey { get; set; }
        public string lang { get; set; }
        public bool autoStart { get; set; }
        public int reloadHours { get; set; }
        public DisplayCfg display { get; set; }

        public Settings()
        {
            version = 1;
            fx = "weather/snow";
            palette = "none";
            bg = "sky";
            critters = true;
            wallpapers = new List<WallpaperFile>();
            hiddenFx = new List<string>();
            hiddenWallpapers = new List<string>();
            petOn = true;
            pets = new List<PetFile>();
            petCfg = new Dictionary<string, Dictionary<string, PetPose>>();
            fps = 30;
            speed = 1;
            @params = new Dictionary<string, Dictionary<string, double>>();
            rules = new List<Rule>();
            cycle = new Cycle();
            hotkey = "Ctrl+Alt+P";
            lang = "auto";
            reloadHours = 6;
            display = new DisplayCfg();
        }
    }

    public static class Store
    {
        public static readonly string DataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PixelPalette");
        public static readonly string FilePath = Path.Combine(DataDir, "settings.json");
        public static readonly string WallpaperDir = Path.Combine(DataDir, "wallpapers");
        public static readonly string PetDir = Path.Combine(DataDir, "pets");

        private static int? packaged;

        /// <summary>True when we run inside an MSIX package: the store owns the install, shortcuts and startup entry.</summary>
        public static bool Packaged
        {
            get
            {
                if (packaged == null)
                {
                    try
                    {
                        int len = 0;
                        packaged = Native.GetCurrentPackageFullName(ref len, null) == 122 ? 1 : 0;
                    }
                    catch { packaged = 0; }
                }
                return packaged.Value == 1;
            }
        }

        public static Settings Load()
        {
            try
            {
                if (File.Exists(FilePath))
                {
                    var s = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                    var cfg = s.Deserialize<Settings>(File.ReadAllText(FilePath));
                    if (cfg != null) return Fix(cfg);
                }
            }
            catch { }
            return new Settings();
        }

        private static Settings Fix(Settings c)
        {
            if (string.IsNullOrEmpty(c.hotkey)) c.hotkey = "Ctrl+Alt+P";
            if (string.IsNullOrEmpty(c.lang)) c.lang = "auto";
            if (string.IsNullOrEmpty(c.fx)) c.fx = "weather/snow";
            if (string.IsNullOrEmpty(c.palette)) c.palette = "none";
            if (string.IsNullOrEmpty(c.bg)) c.bg = "sky";
            if (c.critters == null) c.critters = true;
            if (c.@params == null) c.@params = new Dictionary<string, Dictionary<string, double>>();
            if (c.rules == null) c.rules = new List<Rule>();
            if (c.cycle == null) c.cycle = new Cycle();
            if (c.cycle.list == null) c.cycle.list = new List<string>();
            if (c.wallpapers == null) c.wallpapers = new List<WallpaperFile>();
            if (c.hiddenFx == null) c.hiddenFx = new List<string>();
            if (c.hiddenWallpapers == null) c.hiddenWallpapers = new List<string>();
            if (c.pets == null) c.pets = new List<PetFile>();
            if (c.petCfg == null) c.petCfg = new Dictionary<string, Dictionary<string, PetPose>>();
            if (c.display == null) c.display = new DisplayCfg();
            if (string.IsNullOrEmpty(c.display.mode)) c.display.mode = "fill";
            if (string.IsNullOrEmpty(c.display.align)) c.display.align = "center";
            if (c.fps <= 0) c.fps = 30;
            if (c.speed <= 0) c.speed = 1;
            return c;
        }

        public static void Save(Settings c)
        {
            try
            {
                Directory.CreateDirectory(DataDir);
                var s = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                File.WriteAllText(FilePath, s.Serialize(c));
            }
            catch { }
        }

        public static string Json(Settings c)
        {
            return new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Serialize(c);
        }

        public static Settings FromJson(string json)
        {
            var c = new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Deserialize<Settings>(json);
            return Fix(c ?? new Settings());
        }

        public static string ExePath()
        {
            return System.Reflection.Assembly.GetExecutingAssembly().Location;
        }

        public static void SetAutoStart(bool on)
        {
            if (Packaged) return; // MSIX apps start from the manifest's startupTask, not from HKCU\...\Run
            try
            {
                using (RegistryKey k = Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (k == null) return;
                    if (on) k.SetValue("PixelPalette", "\"" + ExePath() + "\"");
                    else k.DeleteValue("PixelPalette", false);
                }
            }
            catch { }
        }
    }
}
