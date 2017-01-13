﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices.ComTypes;
using Emby.Server.Core;
using Emby.Server.Implementations;
using Emby.Server.Implementations.EntryPoints;
using Emby.Server.Implementations.FFMpeg;
using MediaBrowser.Model.IO;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.System;
using MediaBrowser.ServerApplication.Native;

namespace MediaBrowser.ServerApplication
{
    public class WindowsAppHost : ApplicationHost
    {
        public WindowsAppHost(ServerApplicationPaths applicationPaths, ILogManager logManager, StartupOptions options, IFileSystem fileSystem, IPowerManagement powerManagement, string releaseAssetFilename, IEnvironmentInfo environmentInfo, MediaBrowser.Controller.Drawing.IImageEncoder imageEncoder, ISystemEvents systemEvents, IMemoryStreamFactory memoryStreamFactory, MediaBrowser.Common.Net.INetworkManager networkManager, Action<string, string> certificateGenerator, Func<string> defaultUsernameFactory)
            : base(applicationPaths, logManager, options, fileSystem, powerManagement, releaseAssetFilename, environmentInfo, imageEncoder, systemEvents, memoryStreamFactory, networkManager, certificateGenerator, defaultUsernameFactory)
        {
        }

        public override bool IsRunningAsService
        {
            get { return MainStartup.IsRunningAsService; }
        }

        protected override FFMpegInstallInfo GetFfmpegInstallInfo()
        {
            var info = new FFMpegInstallInfo();

            info.FFMpegFilename = "ffmpeg.exe";
            info.FFProbeFilename = "ffprobe.exe";
            info.Version = "20160410";
            info.ArchiveType = "7z";
            info.DownloadUrls = GetDownloadUrls();

            return info;
        }

        private string[] GetDownloadUrls()
        {
            switch (EnvironmentInfo.SystemArchitecture)
            {
                case Architecture.X64:
                    return new[]
                    {
                                "https://github.com/MediaBrowser/Emby.Resources/raw/master/ffmpeg/windows/ffmpeg-20160410-win64.7z"
                    };
                case Architecture.X86:
                    return new[]
                    {
                                "https://github.com/MediaBrowser/Emby.Resources/raw/master/ffmpeg/windows/ffmpeg-20160410-win32.7z"
                    };
            }

            return new string[] { };
        }

        protected override void RestartInternal()
        {
            MainStartup.Restart();
        }

        protected override List<Assembly> GetAssembliesWithPartsInternal()
        {
            var list = new List<Assembly>();

            if (!Environment.Is64BitProcess)
            {
                //list.Add(typeof(PismoIsoManager).Assembly);
            }

            list.Add(GetType().Assembly);

            return list;
        }

        protected override void ShutdownInternal()
        {
            MainStartup.Shutdown();
        }

        protected override void AuthorizeServer()
        {
            ServerAuthorization.AuthorizeServer(UdpServerEntryPoint.PortNumber,
                    ServerConfigurationManager.Configuration.HttpServerPortNumber,
                    ServerConfigurationManager.Configuration.HttpsPortNumber,
                    MainStartup.ApplicationPath,
                    ConfigurationManager.CommonApplicationPaths.TempDirectory);
        }

        protected override void ConfigureAutoRunInternal(bool autorun)
        {
            var startupPath = System.Environment.GetFolderPath(System.Environment.SpecialFolder.Startup);

            if (autorun && !MainStartup.IsRunningAsService)
            {
                //Copy our shortut into the startup folder for this user
                var targetPath = Path.Combine(startupPath, "Emby Server.lnk");

                IShellLinkW link = (IShellLinkW)new ShellLink();

                var appPath = Process.GetCurrentProcess().MainModule.FileName;

                // setup shortcut information
                link.SetDescription(Name);
                link.SetPath(appPath);
                link.SetWorkingDirectory(Path.GetDirectoryName(appPath));

                // save it
                IPersistFile file = (IPersistFile)link;
                file.Save(targetPath, true);
            }
            else
            {
                //Remove our shortcut from the startup folder for this user
                FileSystemManager.DeleteFile(Path.Combine(startupPath, "Emby Server.lnk"));
            }
        }

        protected override bool SupportsDualModeSockets
        {
            get
            {
                return true;
            }
        }

        protected override void EnableLoopbackInternal(string appName)
        {
            LoopUtil.Run(appName);
        }

        public override bool SupportsRunningAsService
        {
            get
            {
                return true;
            }
        }

        public override bool CanSelfRestart
        {
            get
            {
                return MainStartup.CanSelfRestart;
            }
        }

        public override bool SupportsAutoRunAtStartup
        {
            get
            {
                return true;
            }
        }

        public override bool CanSelfUpdate
        {
            get
            {
                return MainStartup.CanSelfUpdate;
            }
        }

        public bool PortsRequireAuthorization(string applicationPath)
        {
            var appNameSrch = Path.GetFileName(applicationPath);

            var startInfo = new ProcessStartInfo
            {
                FileName = "netsh",

                Arguments = "advfirewall firewall show rule \"" + appNameSrch + "\"",

                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden,
                ErrorDialog = false,
                RedirectStandardOutput = true
            };

            using (var process = Process.Start(startInfo))
            {
                process.Start();

                try
                {
                    var data = process.StandardOutput.ReadToEnd() ?? string.Empty;

                    if (data.IndexOf("Block", StringComparison.OrdinalIgnoreCase) != -1)
                    {
                        Logger.Info("Found potential windows firewall rule blocking Emby Server: " + data);
                    }

                    //var parts = data.Split('\n');

                    //return parts.Length > 4;
                    //return Confirm();
                    return false;
                }
                catch (Exception ex)
                {
                    Logger.ErrorException("Error querying windows firewall", ex);

                    // Hate having to do this
                    try
                    {
                        process.Kill();
                    }
                    catch (Exception ex1)
                    {
                        Logger.ErrorException("Error killing process", ex1);
                    }

                    throw;
                }
            }
        }

    }
}
