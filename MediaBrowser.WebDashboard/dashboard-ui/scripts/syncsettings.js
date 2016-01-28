﻿(function ($, document, window) {

    function loadPage(page, config) {

        $('#txtSyncTempPath', page).val(config.TemporaryPath || '');
        $('#txtUploadSpeedLimit', page).val((config.UploadSpeedLimitBytes / 1000000) || '');
        $('#txtCpuCoreLimit', page).val(config.TranscodingCpuCoreLimit);
        $('#chkEnableFullSpeedConversion', page).checked(config.EnableFullSpeedTranscoding);

        Dashboard.hideLoadingMsg();
    }

    function onSubmit() {
        Dashboard.showLoadingMsg();

        var form = this;

        ApiClient.getNamedConfiguration("sync").then(function (config) {

            config.TemporaryPath = $('#txtSyncTempPath', form).val();
            config.UploadSpeedLimitBytes = parseInt(parseFloat(($('#txtUploadSpeedLimit', form).val() || '0')) * 1000000);
            config.TranscodingCpuCoreLimit = parseInt($('#txtCpuCoreLimit', form).val());
            config.EnableFullSpeedTranscoding = $('#chkEnableFullSpeedConversion', form).checked();

            ApiClient.updateNamedConfiguration("sync", config).then(Dashboard.processServerConfigurationUpdateResult);
        });

        // Disable default form submission
        return false;
    }

    $(document).on('pageinit', "#syncSettingsPage", function () {

        var page = this;

        $('#btnSelectSyncTempPath', page).on("click.selectDirectory", function () {

            require(['directorybrowser'], function (directoryBrowser) {

                var picker = new directoryBrowser();

                picker.show({

                    includeHidden: true,
                    path: $('#txtSyncTempPath', page).val(),

                    callback: function (path) {
                        if (path) {
                            $('#txtSyncTempPath', page).val(path);
                        }
                        picker.close();
                    }
                });
            });
        });

        $('.syncSettingsForm').off('submit', onSubmit).on('submit', onSubmit);


    }).on('pageshow', "#syncSettingsPage", function () {

        Dashboard.showLoadingMsg();

        var page = this;

        ApiClient.getNamedConfiguration("sync").then(function (config) {

            loadPage(page, config);

        });
    });

})(jQuery, document, window);
