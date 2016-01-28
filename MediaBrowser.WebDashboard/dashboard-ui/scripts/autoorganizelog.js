﻿(function ($, document, window) {

    var query = {

        StartIndex: 0,
        Limit: 20
    };

    var currentResult;

    function showStatusMessage(id) {

        var item = currentResult.Items.filter(function (i) {
            return i.Id == id;

        })[0];

        Dashboard.alert({

            title: getStatusText(item, false),
            message: item.StatusMessage

        });
    }

    function deleteOriginalFile(page, id) {

        var item = currentResult.Items.filter(function (i) {
            return i.Id == id;

        })[0];

        var message = Globalize.translate('MessageFileWillBeDeleted') + '<p style="word-wrap:break-word;">' + item.OriginalPath + '</p><p>' + Globalize.translate('MessageSureYouWishToProceed') + '</p>';

        Dashboard.confirm(message, Globalize.translate('HeaderDeleteFile'), function (confirmResult) {

            if (confirmResult) {

                Dashboard.showLoadingMsg();

                ApiClient.deleteOriginalFileFromOrganizationResult(id).done(function () {

                    Dashboard.hideLoadingMsg();

                    reloadItems(page);

                }).fail(onApiFailure);
            }

        });
    }

    function organizeEpsiodeWithCorrections(page, item) {

        Dashboard.showLoadingMsg();

        var seriesItems;

        ApiClient.getItems(null, {
            recursive: true,
            includeItemTypes: 'Series',
            sortBy: 'SortName'

        }).done(function (result) {

            seriesItems = result.Items;

            ApiClient.getVirtualFolders().done(function (result) {

                Dashboard.hideLoadingMsg();

                var movieLocations = [];
                var seriesLocations = [];

                for (var n = 0; n < result.length; n++) {

                    var virtualFolder = result[n];

                    for (var i = 0, length = virtualFolder.Locations.length; i < length; i++) {
                        var location = {
                            value: virtualFolder.Locations[i],
                            display: virtualFolder.Name + ': ' + virtualFolder.Locations[i]
                        };

                        if (virtualFolder.CollectionType == 'movies') {
                            movieLocations.push(location);
                        }
                        if (virtualFolder.CollectionType == 'tvshows') {
                            seriesLocations.push(location);
                        }
                    }
                }

                showEpisodeCorrectionPopup(page, item, seriesItems, movieLocations, seriesLocations);
            }).fail(onApiFailure);

        }).fail(onApiFailure);
    }

    function showEpisodeCorrectionPopup(page, item, allSeries, movieLocations, seriesLocations) {

        require(['components/fileorganizer/fileorganizer'], function () {

            FileOrganizer.show(page, item, allSeries, movieLocations, seriesLocations, function () {
                reloadItems(page);
            });
        });
    }

    function organizeFile(page, id) {

        var item = currentResult.Items.filter(function (i) {
            return i.Id == id;

        })[0];

        if (!item.TargetPath) {

            if (item.Type == "Episode") {
                organizeEpsiodeWithCorrections(page, item);
            }

            return;
        }

        var message = Globalize.translate('MessageFollowingFileWillBeMovedFrom') + '<p style="word-wrap:break-word;">' + item.OriginalPath + '</p><p>' + Globalize.translate('MessageDestinationTo') + '</p><p style="word-wrap:break-word;">' + item.TargetPath + '</p>';

        if (item.DuplicatePaths.length) {
            message += '<p><b>' + Globalize.translate('MessageDuplicatesWillBeDeleted') + '</b></p>';

            message += '<p style="word-wrap:break-word;">' + item.DuplicatePaths.join('<br/>') + '</p>';
        }

        message += '<p>' + Globalize.translate('MessageSureYouWishToProceed') + '</p>';

        Dashboard.confirm(message, Globalize.translate('HeaderOrganizeFile'), function (confirmResult) {

            if (confirmResult) {

                Dashboard.showLoadingMsg();

                ApiClient.performOrganization(id).done(function () {

                    Dashboard.hideLoadingMsg();

                    reloadItems(page);

                }).fail(onApiFailure);
            }

        });
    }

    function reloadItems(page) {

        Dashboard.showLoadingMsg();

        ApiClient.getFileOrganizationResults(query).done(function (result) {

            currentResult = result;
            renderResults(page, result);

            Dashboard.hideLoadingMsg();
        }).fail(onApiFailure);

    }

    function getStatusText(item, enhance) {

        var status = item.Status;

        var color = null;

        if (status == 'SkippedExisting') {
            status = Globalize.translate('StatusSkipped');
        }
        else if (status == 'Failure') {
            color = '#cc0000';
            status = Globalize.translate('StatusFailed');
        }
        if (status == 'Success') {
            color = 'green';
            status = Globalize.translate('StatusSuccess');
        }

        if (enhance) {

            if (item.StatusMessage) {

                return '<a style="color:' + color + ';" data-resultid="' + item.Id + '" href="#" class="btnShowStatusMessage">' + status + '</a>';
            } else {
                return '<span data-resultid="' + item.Id + '" style="color:' + color + ';">' + status + '</span>';
            }
        }


        return status;
    }

    function renderResults(page, result) {

        var rows = result.Items.map(function (item) {

            var html = '';

            html += '<tr>';

            html += '<td>';

            var date = parseISO8601Date(item.Date, { toLocal: true });
            html += date.toLocaleDateString();

            html += '</td>';

            html += '<td>';
            var status = item.Status;

            if (status == 'SkippedExisting') {
                html += '<a data-resultid="' + item.Id + '" style="color:blue;" href="#" class="btnShowStatusMessage">';
                html += item.OriginalFileName;
                html += '</a>';
            }
            else if (status == 'Failure') {
                html += '<a data-resultid="' + item.Id + '" style="color:red;" href="#" class="btnShowStatusMessage">';
                html += item.OriginalFileName;
                html += '</a>';
            } else {
                html += '<div style="color:green;">';
                html += item.OriginalFileName;
                html += '</div>';
            }
            html += '</td>';

            html += '<td>';
            html += item.TargetPath || '';
            html += '</td>';

            html += '<td class="organizerButtonCell">';


            if (item.Status != 'Success') {
                html += '<paper-icon-button data-resultid="' + item.Id + '" icon="folder" class="btnProcessResult organizerButton" title="' + Globalize.translate('ButtonOrganizeFile') + '"></paper-icon-button>';
                html += '<paper-icon-button data-resultid="' + item.Id + '" icon="delete" class="btnDeleteResult organizerButton" title="' + Globalize.translate('ButtonDeleteFile') + '"></paper-icon-button>';
            }

            html += '</td>';

            html += '</tr>';

            return html;
        }).join('');

        var elem = $('.resultBody', page).html(rows).parents('.tblOrganizationResults').table("refresh").trigger('create');

        $('.btnShowStatusMessage', elem).on('click', function () {

            var id = this.getAttribute('data-resultid');

            showStatusMessage(id);
        });

        $('.btnProcessResult', elem).on('click', function () {

            var id = this.getAttribute('data-resultid');

            organizeFile(page, id);
        });

        $('.btnDeleteResult', elem).on('click', function () {

            var id = this.getAttribute('data-resultid');

            deleteOriginalFile(page, id);
        });

        var pagingHtml = LibraryBrowser.getQueryPagingHtml({
            startIndex: query.StartIndex,
            limit: query.Limit,
            totalRecordCount: result.TotalRecordCount,
            showLimit: false,
            updatePageSizeSetting: false
        });

        $(page)[0].querySelector('.listTopPaging').innerHTML = pagingHtml;

        if (result.TotalRecordCount > query.Limit && result.TotalRecordCount > 50) {
            $('.listBottomPaging', page).html(pagingHtml).trigger('create');
        } else {
            $('.listBottomPaging', page).empty();
        }

        $('.btnNextPage', page).on('click', function () {
            query.StartIndex += query.Limit;
            reloadItems(page);
        });

        $('.btnPreviousPage', page).on('click', function () {
            query.StartIndex -= query.Limit;
            reloadItems(page);
        });

        if (result.TotalRecordCount) {
            $('.btnClearLog', page).show();
        } else {
            $('.btnClearLog', page).hide();
        }
    }

    function onWebSocketMessage(e, msg) {

        var page = $.mobile.activePage;

        if ((msg.MessageType == 'ScheduledTaskEnded' && msg.Data.Key == 'AutoOrganize') || msg.MessageType == 'AutoOrganizeUpdate') {

            reloadItems(page);
        }
    }

    function onApiFailure(e) {

        Dashboard.hideLoadingMsg();

        var page = $.mobile.activePage;
        $('.episodeCorrectionPopup', page).popup("close");

        if (e.status == 0) {
            Dashboard.alert({
                title: 'Auto-Organize',
                message: 'The operation is going to take a little longer. The view will be updated on completion.'
            });
        }
        else {
            Dashboard.alert({
                title: Globalize.translate('AutoOrganizeError'),
                message: Globalize.translate('ErrorOrganizingFileWithErrorCode', e.getResponseHeader("X-Application-Error-Code"))
            });
        }
    }

    $(document).on('pageinit', "#libraryFileOrganizerLogPage", function () {

        var page = this;

        $('.btnClearLog', page).on('click', function () {

            ApiClient.clearOrganizationLog().done(function () {
                reloadItems(page);
            }).fail(onApiFailure);

        });

    }).on('pageshow', "#libraryFileOrganizerLogPage", function () {

        var page = this;

        reloadItems(page);

        // on here
        $('.btnOrganize', page).taskButton({
            mode: 'on',
            progressElem: page.querySelector('.organizeProgress'),
            panel: $('.organizeTaskPanel', page),
            taskKey: 'AutoOrganize'
        });

        $(ApiClient).on("websocketmessage", onWebSocketMessage);

    }).on('pagebeforehide', "#libraryFileOrganizerLogPage", function () {

        var page = this;

        currentResult = null;

        // off here
        $('.btnOrganize', page).taskButton({
            mode: 'off'
        });

        $(ApiClient).off("websocketmessage", onWebSocketMessage);
    });

})(jQuery, document, window);
