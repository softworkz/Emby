using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.ScheduledTasks;
using MediaBrowser.Model.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CommonIO;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Configuration;
using MediaBrowser.Controller;
using MediaBrowser.Model.Sync;
using MediaBrowser.Model.Devices;
using MediaBrowser.Server.Implementations.FileOrganization;
using MediaBrowser.Server.Implementations.Sync;
using MediaBrowser.Server.Implementations.Devices;
using MediaBrowser.Server.Implementations.Intros;
using MediaBrowser.Server.Implementations.LiveTv;
using MediaBrowser.Controller.Health;

namespace MediaBrowser.Server.Implementations.Health
{
    /// <summary>
    /// Checks disk space
    /// </summary>
    public class CheckDiskspaceTask : IScheduledTask, IConfigurableScheduledTask
    {
        private IServerApplicationPaths _applicationPaths { get; set; }
        private readonly ILogger _logger;
        private readonly IFileSystem _fileSystem;
        private readonly IServerConfigurationManager _serverConfigManager;
        private readonly IHealthReporter _healthReporter;

        /// <summary>
        /// Initializes a new instance of the <see cref="CheckDiskspaceTask" /> class.
        /// </summary>
        public CheckDiskspaceTask(IServerApplicationPaths appPaths, ILogger logger, IFileSystem fileSystem, IServerConfigurationManager serverConfigManager, IHealthReporter healthReporter)
        {
            _applicationPaths = appPaths;
            _logger = logger;
            _fileSystem = fileSystem;
            _serverConfigManager = serverConfigManager;
            _healthReporter = healthReporter;
        }

        /// <summary>
        /// Creates the triggers that define when the task will run
        /// </summary>
        /// <returns>IEnumerable{BaseTaskTrigger}.</returns>
        public IEnumerable<ITaskTrigger> GetDefaultTriggers()
        {
            return new ITaskTrigger[] { 
            
                new StartupTrigger(),
                new IntervalTrigger { Interval = TimeSpan.FromHours(1)}
            };
        }

        /// <summary>
        /// Returns the task to be executed
        /// </summary>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <param name="progress">The progress.</param>
        /// <returns>Task.</returns>
        public Task Execute(CancellationToken cancellationToken, IProgress<double> progress)
        {
            _healthReporter.RemoveHealthMessagesById(this, null);

            var pathInfos = new Dictionary<string, string>();

            pathInfos.Add("ApplicationPath", _applicationPaths.ApplicationPath);
            pathInfos.Add("ProgramDataPath", _applicationPaths.ProgramDataPath);
            pathInfos.Add("CachePath", _applicationPaths.CachePath);
            pathInfos.Add("MetadataPath", _applicationPaths.InternalMetadataPath);
            pathInfos.Add("TranscodingTempPath", _applicationPaths.TranscodingTempPath);

            var cinemaModeConfig = _serverConfigManager.GetCinemaModeConfiguration();
            if (cinemaModeConfig != null)
            {
                pathInfos.Add("CustomIntroPath", cinemaModeConfig.CustomIntroPath);
                pathInfos.Add("MediaInfoIntroPath", cinemaModeConfig.MediaInfoIntroPath);
            }

            var syncOptions = _serverConfigManager.GetSyncOptions();
            if (syncOptions != null)
            {
                pathInfos.Add("SyncTemporaryPath", syncOptions.TemporaryPath);
            }

            var devicesOptions = _serverConfigManager.GetUploadOptions();
            if (devicesOptions != null)
            {
                pathInfos.Add("CameraUploadPath", devicesOptions.CameraUploadPath);
            }

            var organizeOptions = _serverConfigManager.GetAutoOrganizeOptions();
            if (organizeOptions != null && organizeOptions.TvOptions.WatchLocations != null)
            {
                for (int i = 0; i < organizeOptions.TvOptions.WatchLocations.Length; i++)
                {
                    pathInfos.Add("AutoOrganizeFolder" + i.ToString(), organizeOptions.TvOptions.WatchLocations[i]);
                }
            }

            var liveTvOptions = _serverConfigManager.GetLiveTvOptions();
            if (liveTvOptions != null)
            {
                pathInfos.Add("LiveTvRecordingPath", liveTvOptions.RecordingPath);
                pathInfos.Add("LiveTvMovieRecordingPath", liveTvOptions.MovieRecordingPath);
                pathInfos.Add("LiveTvSeriesRecordingPath", liveTvOptions.SeriesRecordingPath);
            }

            var configuredPathInfos = pathInfos.Where(e => !string.IsNullOrWhiteSpace(e.Value)).Select(kvp => new KeyValuePair<string, DirectoryInfo>(kvp.Key, new DirectoryInfo(kvp.Value)));

            var distinctRoots = configuredPathInfos.Where(e => e.Value.Exists).Select(d => d.Value.Root.Name).Distinct();

            foreach (var root in distinctRoots)
            {
                try
                {
                    var drive = new DriveInfo(root);
                    var freeSpacePercent = (double)drive.AvailableFreeSpace / drive.TotalSize;
                    var totalSizeGB = (double)drive.TotalSize / 1024 / 1024 / 1024;
                    var freeSpaceMB = (double)drive.AvailableFreeSpace / 1024 / 1024;
                    var freeSpaceGB = (double)drive.AvailableFreeSpace / 1024 / 1024 / 1024;

                    var affectedPaths = configuredPathInfos.Where(e => e.Value.Root.Name == root).Select(kvp => string.Format("\n    {0}: {1}", kvp.Key, kvp.Value)).ToList();
                    var affectedPathsList = string.Join("", affectedPaths);

                    if (drive.AvailableFreeSpace < 500 * 1024 * 1204)
                    {
                        // "Disk space on drive '{0}': {1:n1} MB free of {2:n0} GB. This is less than 500 MB. You should urgently free up some disk space to keep Emby running without problems. The following folders are located on this drive: {3}";
                        var msg = new HealthMessage(this, "HealthMsgDiskspaceProblem", HealthMessageType.ServerStatus, HealthMessageSeverity.Problem, "Status|Diskspace", drive.Name, freeSpaceMB, totalSizeGB, affectedPathsList);
                        _healthReporter.AddHealthMessage(msg, false);
                    }
                    else if (freeSpacePercent < 0.02)
                    {
                        // "Disk space on drive '{0}': {1:n3} GB free of {2:n0} GB. This is less than 2%. Please free up some disk space to keep Emby running without problems. The following folders are located on this drive: {3}";
                        var msg = new HealthMessage(this, "HealthMsgDiskspaceWarning", HealthMessageType.ServerStatus, HealthMessageSeverity.Warning, "Status|Diskspace", drive.Name, freeSpaceGB, totalSizeGB, affectedPathsList);
                        _healthReporter.AddHealthMessage(msg, false);
                    }
                    else if (freeSpacePercent < 0.1)
                    {
                        // "Disk space on drive '{0}': {1:n2} GB free of {2:n0} GB. This is less than 10%. You might want to consider freeing up some disk space. The following folders are located on this drive: {3}";
                        var msg = new HealthMessage(this, "HealthMsgDiskspaceSuggestion", HealthMessageType.ServerStatus, HealthMessageSeverity.Suggestion, "Status|Diskspace", drive.Name, freeSpaceGB, totalSizeGB, affectedPathsList);
                        _healthReporter.AddHealthMessage(msg, false);
                    }
                    else
                    {
                        // "Disk space on drive '{0}': {1:n1} GB free of {2:n0} GB. The following folders are located on this drive: {3}";
                        var msg = new HealthMessage(this, "HealthMsgDiskspaceInfo", HealthMessageType.ServerStatus, HealthMessageSeverity.Informational, "Status|Diskspace", drive.Name, freeSpaceGB, totalSizeGB, affectedPathsList);
                        _healthReporter.AddHealthMessage(msg, false);
                    }
                }
                catch (Exception)
                {
                }
            }

            return Task.FromResult(true);
        }


        /// <summary>
        /// Gets the name of the task
        /// </summary>
        /// <value>The name.</value>
        public string Name
        {
            get { return "Disk space check"; }
        }

        /// <summary>
        /// Gets the description.
        /// </summary>
        /// <value>The description.</value>
        public string Description
        {
            get { return "Checks the free disk space on all configured folders."; }
        }

        /// <summary>
        /// Gets the category.
        /// </summary>
        /// <value>The category.</value>
        public string Category
        {
            get
            {
                return "Maintenance";
            }
        }

        /// <summary>
        /// Gets a value indicating whether this instance is hidden.
        /// </summary>
        /// <value><c>true</c> if this instance is hidden; otherwise, <c>false</c>.</value>
        public bool IsHidden
        {
            get { return false; }
        }

        public bool IsEnabled
        {
            get { return true; }
        }
    }
}
