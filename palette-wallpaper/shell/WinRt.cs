// WinRT calls that only exist through the metadata: the MSIX StartupTask (autostart) and the
// lock screen image. Works on .NET Framework 4.8 by referencing the contract winmds
// (Microsoft.Windows.SDK.Contracts) plus System.Runtime.WindowsRuntime from the GAC.
using System;

namespace PixelFX
{
    public static class WinRt
    {
        /// <summary>MSIX autostart: enable/disable the manifest-declared startupTask. Fire and forget.</summary>
        public static async void ApplyStartupTask(bool on)
        {
            if (!Store.Packaged) return;
            try
            {
                var tasks = await Windows.ApplicationModel.StartupTask.GetForCurrentPackageAsync().AsTask();
                foreach (Windows.ApplicationModel.StartupTask st in tasks)
                {
                    if (st.State == Windows.ApplicationModel.StartupTaskState.Enabled
                        || st.State == Windows.ApplicationModel.StartupTaskState.EnabledByPolicy)
                    {
                        if (!on) st.Disable();
                        App.Log("startup task disabled");
                    }
                    else if (on && st.State == Windows.ApplicationModel.StartupTaskState.Disabled)
                    {
                        var result = await st.RequestEnableAsync().AsTask();
                        App.Log("startup task -> " + result);
                    }
                    else App.Log("startup task state " + st.State + " (left as is)");
                }
            }
            catch (Exception ex) { App.Log("startup task failed: " + ex.Message); }
        }

        /// <summary>Set the lock screen to a rendered frame of the wallpaper. Fire and forget.</summary>
        public static async void SetLockScreen(string pngPath)
        {
            try
            {
                var file = await Windows.Storage.StorageFile.GetFileFromPathAsync(pngPath).AsTask();
                await Windows.System.UserProfile.LockScreen.SetImageFileAsync(file).AsTask();
                App.Log("lock screen set: " + pngPath);
            }
            catch (Exception ex) { App.Log("lock screen failed: " + ex.Message); }
        }
    }
}
