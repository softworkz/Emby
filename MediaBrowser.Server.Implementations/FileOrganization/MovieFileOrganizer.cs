﻿using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.FileOrganization;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Extensions;
using MediaBrowser.Model.FileOrganization;
using MediaBrowser.Model.Logging;
using MediaBrowser.Server.Implementations.Library;
using MediaBrowser.Server.Implementations.Logging;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CommonIO;

namespace MediaBrowser.Server.Implementations.FileOrganization
{
    public class MovieFileOrganizer : EpisodeFileOrganizer
    {
        private readonly ILibraryMonitor _libraryMonitor;
        private readonly ILibraryManager _libraryManager;
        private readonly ILogger _logger;
        private readonly IFileSystem _fileSystem;
        private readonly IFileOrganizationService _organizationService;
        private readonly IServerConfigurationManager _config;
        private readonly IProviderManager _providerManager;

        private readonly CultureInfo _usCulture = new CultureInfo("en-US");

        public MovieFileOrganizer(IFileOrganizationService organizationService, IServerConfigurationManager config, IFileSystem fileSystem, ILogger logger, ILibraryManager libraryManager, ILibraryMonitor libraryMonitor, IProviderManager providerManager)
            : base (organizationService, config, fileSystem, logger, libraryManager, libraryMonitor, providerManager)
        {
            _organizationService = organizationService;
            _config = config;
            _fileSystem = fileSystem;
            _logger = logger;
            _libraryManager = libraryManager;
            _libraryMonitor = libraryMonitor;
            _providerManager = providerManager;
        }

        public async Task<FileOrganizationResult> OrganizeWithCorrection(MovieFileOrganizationRequest baseRequest, AutoOrganizeOptions options, CancellationToken cancellationToken)
        {
            var request = (MovieFileOrganizationRequest)baseRequest;

            var result = _organizationService.GetResult(request.ResultId);

            var file = _fileSystem.GetFileInfo(result.OriginalPath);

            result.Type = FileOrganizerType.Movie;

            await OrganizeMovie(result.OriginalPath, request.Name, request.Year, request.TargetFolder, options, true, result, cancellationToken).ConfigureAwait(false);

            await _organizationService.SaveResult(result, CancellationToken.None).ConfigureAwait(false);

            return result;
        }

        private async Task OrganizeMovie(string sourcePath, string movieName, string movieYear, string targetPath, AutoOrganizeOptions options, bool overwriteExisting, FileOrganizationResult result, CancellationToken cancellationToken)
        {
            _logger.Info("Sorting file {0} into movie folder {1}", sourcePath, targetPath);

            if (!_organizationService.AddToInProgressList(result, true))
            {
                throw new Exception("File is currently processed otherwise. Please try again later.");
            }

            try
            {
                // Proceed to sort the file
                var newPath = GetNewPath(sourcePath, movieName, movieYear, targetPath, options, true, result, cancellationToken);

                if (string.IsNullOrEmpty(newPath))
                {
                    var msg = string.Format("Unable to sort {0} because target path could not be determined.", sourcePath);
                    throw new Exception(msg);
                }

                _logger.Info("Sorting file {0} to new path {1}", sourcePath, newPath);
                result.TargetPath = newPath;

                var fileExists = _fileSystem.FileExists(result.TargetPath);

                if (!overwriteExisting)
                {
                    if (options.TvOptions.CopyOriginalFile && fileExists)
                    {
                        _logger.Info("File {0} already copied to new path {1}, stopping organization", sourcePath, newPath);
                        result.Status = FileSortingStatus.SkippedExisting;
                        result.StatusMessage = string.Empty;
                        return;
                    }

                    if (fileExists)
                    {
                        var msg = string.Format("File '{0}' already exists as '{1}', stopping organization", sourcePath, newPath);
                        _logger.Info(msg);
                        result.Status = FileSortingStatus.SkippedExisting;
                        result.StatusMessage = msg;
                        result.TargetPath = newPath;
                        return;
                    }
                }

                await Task.Yield();

                PerformFileSorting(options.TvOptions, result);

            }
            catch (Exception ex)
            {
                result.Status = FileSortingStatus.Failure;
                result.StatusMessage = ex.Message;
                _logger.Warn(ex.Message);
                return;
            }
            finally
            {
                _organizationService.RemoveFromInprogressList(result);
            }
        }

        //private void PerformFileSorting(TvFileOrganizationOptions options, FileOrganizationResult result)
        //{
        //    _libraryMonitor.ReportFileSystemChangeBeginning(result.TargetPath);

        //    _fileSystem.CreateDirectory(Path.GetDirectoryName(result.TargetPath));

        //    var targetAlreadyExists = _fileSystem.FileExists(result.TargetPath);

        //    try
        //    {
        //        if (targetAlreadyExists || options.CopyOriginalFile)
        //        {
        //            _fileSystem.CopyFile(result.OriginalPath, result.TargetPath, true);
        //        }
        //        else
        //        {
        //            _fileSystem.MoveFile(result.OriginalPath, result.TargetPath);
        //        }

        //        result.Status = FileSortingStatus.Success;
        //        result.StatusMessage = string.Empty;
        //    }
        //    catch (Exception ex)
        //    {
        //        var errorMsg = string.Format("Failed to move file from {0} to {1}: {2}", result.OriginalPath, result.TargetPath, ex.Message);

        //        result.Status = FileSortingStatus.Failure;
        //        result.StatusMessage = errorMsg;
        //        _logger.ErrorException(errorMsg, ex);

        //        return;
        //    }
        //    finally
        //    {
        //        _libraryMonitor.ReportFileSystemChangeComplete(result.TargetPath, true);
        //    }

        //    if (targetAlreadyExists && !options.CopyOriginalFile)
        //    {
        //        try
        //        {
        //            _fileSystem.DeleteFile(result.OriginalPath);
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.ErrorException("Error deleting {0}", ex, result.OriginalPath);
        //        }
        //    }
        //}

        /// <summary>
        /// Gets the new path.
        /// </summary>
        /// <param name="sourcePath">The source path.</param>
        /// <param name="series">The series.</param>
        /// <param name="seasonNumber">The season number.</param>
        /// <param name="episodeNumber">The episode number.</param>
        /// <param name="endingEpisodeNumber">The ending episode number.</param>
        /// <param name="options">The options.</param>
        /// <returns>System.String.</returns>
        private string GetNewPath(string sourcePath, string movieName, string movieYear, string targetPath, AutoOrganizeOptions options, bool overwriteExisting, FileOrganizationResult result, CancellationToken cancellationToken)
        {
            var folderName = _fileSystem.GetValidFilename(movieName).Trim();

            if (!string.IsNullOrEmpty(movieYear))
            {
                folderName = string.Format("{0} ({1})", folderName, movieYear);
            }

            var newPath = Path.Combine(targetPath, folderName);

            var fileName = _fileSystem.GetFileNameWithoutExtension(sourcePath);
            fileName = string.Format("{0}{1}", fileName, Path.GetExtension(sourcePath));

            newPath = Path.Combine(newPath, fileName);

            return newPath;
        }
    }
}
