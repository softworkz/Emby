﻿using System;
using System.Collections.Generic;
using System.Reflection;
using Emby.Server.Core;
using Emby.Server.Implementations;
using Emby.Server.Implementations.FFMpeg;
using MediaBrowser.IsoMounter;
using MediaBrowser.Model.IO;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.System;

namespace MediaBrowser.Server.Mono
{
    public class MonoAppHost : ApplicationHost
    {
        public MonoAppHost(ServerApplicationPaths applicationPaths, ILogManager logManager, StartupOptions options, IFileSystem fileSystem, IPowerManagement powerManagement, string releaseAssetFilename, IEnvironmentInfo environmentInfo, MediaBrowser.Controller.Drawing.IImageEncoder imageEncoder, ISystemEvents systemEvents, IMemoryStreamFactory memoryStreamFactory, MediaBrowser.Common.Net.INetworkManager networkManager, Action<string, string> certificateGenerator, Func<string> defaultUsernameFactory) : base(applicationPaths, logManager, options, fileSystem, powerManagement, releaseAssetFilename, environmentInfo, imageEncoder, systemEvents, memoryStreamFactory, networkManager, certificateGenerator, defaultUsernameFactory)
        {
        }

        public override bool CanSelfRestart
        {
            get
            {
                // A restart script must be provided
                return StartupOptions.ContainsOption("-restartpath");
            }
        }

        public override bool CanSelfUpdate
        {
            get
            {
                return false;
            }
        }

        protected override FFMpegInstallInfo GetFfmpegInstallInfo()
        {
            var info = new FFMpegInstallInfo();

            // Windows builds: http://ffmpeg.zeranoe.com/builds/
            // Linux builds: http://johnvansickle.com/ffmpeg/
            // OS X builds: http://ffmpegmac.net/
            // OS X x64: http://www.evermeet.cx/ffmpeg/

            var environment = (MonoEnvironmentInfo) EnvironmentInfo;

            if (environment.IsBsd)
            {

            }
            else if (environment.OperatingSystem == Model.System.OperatingSystem.Linux)
            {
                info.FFMpegFilename = "ffmpeg";
                info.FFProbeFilename = "ffprobe";
                info.ArchiveType = "7z";
                info.Version = "20160215";
                info.DownloadUrls = GetDownloadUrls();
            }

            // No version available - user requirement
            info.DownloadUrls = new string[] { };

            return info;
        }

        private string[] GetDownloadUrls()
        {
            switch (EnvironmentInfo.SystemArchitecture)
            {
                case Architecture.X64:
                    return new[]
                    {
                                "https://github.com/MediaBrowser/Emby.Resources/raw/master/ffmpeg/linux/ffmpeg-git-20160215-64bit-static.7z"
                    };
                case Architecture.X86:
                    return new[]
                    {
                                "https://github.com/MediaBrowser/Emby.Resources/raw/master/ffmpeg/linux/ffmpeg-git-20160215-32bit-static.7z"
                    };
            }

            return new string[] { };
        }

        protected override void RestartInternal()
        {
            MainClass.Restart(StartupOptions);
        }

        protected override List<Assembly> GetAssembliesWithPartsInternal()
        {
            var list = new List<Assembly>();

            list.Add(GetType().Assembly);
            list.AddRange(GetLinuxAssemblies());

            return list;
        }

        private IEnumerable<Assembly> GetLinuxAssemblies()
        {
            var list = new List<Assembly>();

            list.Add(typeof(LinuxIsoManager).Assembly);

            return list;
        }

        protected override void ShutdownInternal()
        {
            MainClass.Shutdown();
        }

        protected override bool SupportsDualModeSockets
        {
            get
            {
                return GetMonoVersion() >= new Version(4, 6);
            }
        }

        private static Version GetMonoVersion()
        {
            Type type = Type.GetType("Mono.Runtime");
            if (type != null)
            {
                MethodInfo displayName = type.GetTypeInfo().GetMethod("GetDisplayName", BindingFlags.NonPublic | BindingFlags.Static);
                var displayNameValue = displayName.Invoke(null, null).ToString().Trim().Split(' ')[0];

                Version version;
                if (Version.TryParse(displayNameValue, out version))
                {
                    return version;
                }
            }

            return new Version(1, 0);
        }

        protected override void AuthorizeServer()
        {
            throw new NotImplementedException();
        }

        protected override void ConfigureAutoRunInternal(bool autorun)
        {
            throw new NotImplementedException();
        }

        protected override void EnableLoopbackInternal(string appName)
        {
        }

        public override bool SupportsRunningAsService
        {
            get
            {
                return false;
            }
        }

        public override bool SupportsAutoRunAtStartup
        {
            get { return false; }
        }

        public override bool IsRunningAsService
        {
            get
            {
                return false;
            }
        }
    }
}
