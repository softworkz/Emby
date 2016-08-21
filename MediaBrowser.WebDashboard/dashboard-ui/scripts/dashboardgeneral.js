﻿define(['jQuery'], function ($) {

    var brandingConfigKey = "branding";
    var currentBrandingOptions;

    var currentLanguage;

    function loadPage(page, config, languageOptions, systemInfo) {

        var os = systemInfo.OperatingSystem.toLowerCase();

        if (os.indexOf('windows') != -1) {
            $('#windowsStartupDescription', page).show();
        } else {
            $('#windowsStartupDescription', page).hide();
        }

        if (systemInfo.SupportsAutoRunAtStartup) {
            $('#fldRunAtStartup', page).show();
        } else {
            $('#fldRunAtStartup', page).hide();
        }

        page.querySelector('#txtServerName').value = config.ServerName || '';
        page.querySelector('#txtCachePath').value = config.CachePath || '';

        $('#selectLocalizationLanguage', page).html(languageOptions.map(function (l) {

            return '<option value="' + l.Value + '">' + l.Name + '</option>';

        })).val(config.UICulture);

        currentLanguage = config.UICulture;
        $('#chkUsageData', page).checked(config.EnableAnonymousUsageReporting);
        $('#chkRunAtStartup', page).checked(config.RunAtStartup);

        if (systemInfo.CanSelfUpdate) {
            $('.fldAutomaticUpdates', page).show();
            $('.lnlAutomaticUpdateLevel', page).html(Globalize.translate('LabelAutomaticUpdateLevel'));
        } else {
            $('.fldAutomaticUpdates', page).hide();
            $('.lnlAutomaticUpdateLevel', page).html(Globalize.translate('LabelAutomaticUpdateLevelForPlugins'));
        }

        $('#chkEnableAutomaticServerUpdates', page).checked(config.EnableAutoUpdate);
        $('#chkEnableAutomaticRestart', page).checked(config.EnableAutomaticRestart);

        if (systemInfo.CanSelfRestart) {
            $('#fldEnableAutomaticRestart', page).show();
        } else {
            $('#fldEnableAutomaticRestart', page).hide();
        }

        $('#selectAutomaticUpdateLevel', page).val(config.SystemUpdateLevel).trigger('change');

        $('#chkEnableDashboardResponseCache', page).checked(config.EnableDashboardResponseCaching);
        $('#chkEnableMinification', page).checked(config.EnableDashboardResourceMinification);
        $('#txtDashboardSourcePath', page).val(config.DashboardSourcePath).trigger('change');

        Dashboard.hideLoadingMsg();
    }

    function onSubmit() {
        Dashboard.showLoadingMsg();

        var form = this;
        var page = $(form).parents('.page');

        ApiClient.getServerConfiguration().then(function (config) {

            config.ServerName = form.querySelector('#txtServerName').value;
            config.UICulture = $('#selectLocalizationLanguage', form).val();

            config.CachePath = form.querySelector('#txtCachePath').value;

            var requiresReload = false;

            if (config.UICulture != currentLanguage) {
                requiresReload = true;
            }

            config.EnableAnonymousUsageReporting = $('#chkUsageData', form).checked();
            config.RunAtStartup = $('#chkRunAtStartup', form).checked();

            config.SystemUpdateLevel = $('#selectAutomaticUpdateLevel', form).val();
            config.EnableAutomaticRestart = $('#chkEnableAutomaticRestart', form).checked();
            config.EnableAutoUpdate = $('#chkEnableAutomaticServerUpdates', form).checked();

            config.EnableDashboardResourceMinification = $('#chkEnableMinification', form).checked();
            config.EnableDashboardResponseCaching = $('#chkEnableDashboardResponseCache', form).checked();
            config.DashboardSourcePath = $('#txtDashboardSourcePath', form).val();

            ApiClient.updateServerConfiguration(config).then(function () {

                ApiClient.getNamedConfiguration(brandingConfigKey).then(function (brandingConfig) {

                    brandingConfig.LoginDisclaimer = form.querySelector('#txtLoginDisclaimer').value;
                    brandingConfig.CustomCss = form.querySelector('#txtCustomCss').value;

                    if (currentBrandingOptions && brandingConfig.CustomCss != currentBrandingOptions.CustomCss) {
                        requiresReload = true;
                    }

                    ApiClient.updateNamedConfiguration(brandingConfigKey, brandingConfig).then(Dashboard.processServerConfigurationUpdateResult);

                    if (requiresReload && !AppInfo.isNativeApp) {
                        window.location.reload(true);
                    }
                });

            });
        });

        // Disable default form submission
        return false;
    }

    return function (view, params) {

        $('#selectAutomaticUpdateLevel', view).on('change', function () {

            if (this.value == "Dev") {
                $('#devBuildWarning', view).show();
            } else {
                $('#devBuildWarning', view).hide();
            }

        });

        $('#btnSelectCachePath', view).on("click.selectDirectory", function () {

            require(['directorybrowser'], function (directoryBrowser) {

                var picker = new directoryBrowser();

                picker.show({

                    callback: function (path) {

                        if (path) {
                            view.querySelector('#txtCachePath').value = path;
                        }
                        picker.close();
                    },

                    header: Globalize.translate('HeaderSelectServerCachePath'),

                    instruction: Globalize.translate('HeaderSelectServerCachePathHelp')
                });
            });
        });

        $('#btnSelectDashboardSourcePath', view).on("click.selectDirectory", function () {

            require(['directorybrowser'], function (directoryBrowser) {

                var picker = new directoryBrowser();

                picker.show({

                    callback: function (path) {

                        if (path) {
                            view.querySelector('#txtDashboardSourcePath').value = path;
                        }
                        picker.close();
                    }
                });
            });
        });

        $('.dashboardGeneralForm', view).off('submit', onSubmit).on('submit', onSubmit);

        view.addEventListener('viewshow', function () {

            var promise1 = ApiClient.getServerConfiguration();
            var promise2 = ApiClient.getJSON(ApiClient.getUrl("Localization/Options"));
            var promise3 = ApiClient.getSystemInfo();

            Promise.all([promise1, promise2, promise3]).then(function (responses) {

                loadPage(view, responses[0], responses[1], responses[2]);

            });

            ApiClient.getNamedConfiguration(brandingConfigKey).then(function (config) {

                currentBrandingOptions = config;

                view.querySelector('#txtLoginDisclaimer').value = config.LoginDisclaimer || '';
                view.querySelector('#txtCustomCss').value = config.CustomCss || '';
            });
        });
    };
});
