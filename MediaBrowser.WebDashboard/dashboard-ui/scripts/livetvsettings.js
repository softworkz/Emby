﻿(function ($, document, window) {

    function loadPage(page, config) {

        $('.liveTvSettingsForm', page).show();
        $('.noLiveTvServices', page).hide();

        $('#selectGuideDays', page).val(config.GuideDays || '');

        $('#chkMovies', page).checked(config.EnableMovieProviders);
        $('#chkOrganize', page).checked(config.EnableAutoOrganize);

        $('#txtRecordingPath', page).val(config.RecordingPath || '');

        $('#txtPrePaddingMinutes', page).val(config.PrePaddingSeconds / 60);
        $('#txtPostPaddingMinutes', page).val(config.PostPaddingSeconds / 60);

        Dashboard.hideLoadingMsg();
    }

    function onSubmit() {

			Dashboard.showLoadingMsg();

            var form = this;

            ApiClient.getNamedConfiguration("livetv").then(function (config) {

                config.GuideDays = $('#selectGuideDays', form).val() || null;
                config.EnableMovieProviders = $('#chkMovies', form).checked();
                config.EnableAutoOrganize = $('#chkOrganize', form).checked();
                config.RecordingPath = $('#txtRecordingPath', form).val() || null;

                config.PrePaddingSeconds = $('#txtPrePaddingMinutes', form).val() * 60;
                config.PostPaddingSeconds = $('#txtPostPaddingMinutes', form).val() * 60;

                ApiClient.updateNamedConfiguration("livetv", config).then(Dashboard.processServerConfigurationUpdateResult);
            });

            // Disable default form submission
            return false;
    }

    $(document).on('pageinit', "#liveTvSettingsPage", function () {

        var page = this;

        $('.liveTvSettingsForm').off('submit', onSubmit).on('submit', onSubmit);

        $('#btnSelectRecordingPath', page).on("click.selectDirectory", function () {

            require(['directorybrowser'], function (directoryBrowser) {

                var picker = new directoryBrowser();

                picker.show({

                    includeHidden: true,
                    path: $('#txtRecordingPath', page).val(),

                    callback: function (path) {

                        if (path) {
                            $('#txtRecordingPath', page).val(path);
                        }
                        picker.close();
                    }
                });
            });
        });

    }).on('pageshow', "#liveTvSettingsPage", function () {

        Dashboard.showLoadingMsg();

        var page = this;

        ApiClient.getNamedConfiguration("livetv").then(function (config) {

            loadPage(page, config);

        });

    });

})(jQuery, document, window);
