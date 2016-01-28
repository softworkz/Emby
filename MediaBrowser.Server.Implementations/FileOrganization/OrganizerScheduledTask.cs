﻿using MediaBrowser.Common.IO;
using MediaBrowser.Common.ScheduledTasks;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.FileOrganization;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.FileOrganization;
using MediaBrowser.Model.Logging;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CommonIO;
using MediaBrowser.Controller.Net;
using MediaBrowser.Controller.Localization;

namespace MediaBrowser.Server.Implementations.FileOrganization
{
    public class OrganizerScheduledTask : IScheduledTask, IConfigurableScheduledTask, IScheduledTaskActivityLog, IHasKey
    {
        private readonly ILibraryMonitor _libraryMonitor;
        private readonly ILibraryManager _libraryManager;
        private readonly ILogger _logger;
        private readonly IFileSystem _fileSystem;
        private readonly IServerConfigurationManager _config;
        private readonly IFileOrganizationService _organizationService;
        private readonly IProviderManager _providerManager;
        private readonly IServerManager _serverManager;
        private readonly ILocalizationManager _localizationManager;

        public OrganizerScheduledTask(ILibraryMonitor libraryMonitor, ILibraryManager libraryManager, ILogger logger, IFileSystem fileSystem, IServerConfigurationManager config, IFileOrganizationService organizationService, IProviderManager providerManager, IServerManager serverManager, ILocalizationManager localizationManager)
        {
            _libraryMonitor = libraryMonitor;
            _libraryManager = libraryManager;
            _logger = logger;
            _fileSystem = fileSystem;
            _config = config;
            _organizationService = organizationService;
            _providerManager = providerManager;
            _serverManager = serverManager;
            _localizationManager = localizationManager;
        }

        public string Name
        {
            get { return "Organize new media files"; }
        }

        public string Description
        {
            get { return "Processes new files available in the configured watch folder."; }
        }

        public string Category
        {
            get { return "Library"; }
        }

        private AutoOrganizeOptions GetAutoOrganizeOptions()
        {
            return _config.GetAutoOrganizeOptions();
        }

        public async Task Execute(CancellationToken cancellationToken, IProgress<double> progress)
        {
            if (GetAutoOrganizeOptions().TvOptions.IsEnabled)
            {
                await new TvFolderOrganizer(_libraryManager, _logger, _fileSystem, _libraryMonitor, _organizationService, _config, _providerManager, _serverManager, _localizationManager)
                    .Organize(GetAutoOrganizeOptions(), cancellationToken, progress).ConfigureAwait(false);
            }
        }

        public IEnumerable<ITaskTrigger> GetDefaultTriggers()
        {
            return new ITaskTrigger[]
                {
                    new IntervalTrigger{ Interval = TimeSpan.FromMinutes(5)}
                };
        }

        public bool IsHidden
        {
            get { return !GetAutoOrganizeOptions().TvOptions.IsEnabled; }
        }

        public bool IsEnabled
        {
            get { return GetAutoOrganizeOptions().TvOptions.IsEnabled; }
        }

        public bool IsActivityLogged
        {
            get { return false; }
        }

        public string Key
        {
            get { return "AutoOrganize"; }
        }
    }
}
