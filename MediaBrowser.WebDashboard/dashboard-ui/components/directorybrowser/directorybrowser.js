﻿define(['components/paperdialoghelper', 'paper-item', 'paper-input', 'paper-fab', 'paper-item-body'], function (paperDialogHelper) {

    var systemInfo;
    function getSystemInfo() {

        var deferred = DeferredBuilder.Deferred();

        if (systemInfo) {
            deferred.resolveWith(null, [systemInfo]);
        } else {
            ApiClient.getPublicSystemInfo().then(function (info) {
                systemInfo = info;
                deferred.resolveWith(null, [systemInfo]);
            });
        }

        return deferred.promise();
    }

    function onDialogClosed() {

        $(this).remove();
        Dashboard.hideLoadingMsg();
    }

    function refreshDirectoryBrowser(page, path, fileOptions) {

        Dashboard.showLoadingMsg();

        if (path) {
            $('.networkHeadline').hide();
        } else {
            $('.networkHeadline').show();
        }

        var promise;

        var parentPathPromise = null;

        if (path === "Network") {
            promise = ApiClient.getNetworkDevices();
        }
        else if (path) {
            promise = ApiClient.getDirectoryContents(path, fileOptions);
            parentPathPromise = ApiClient.getParentPath(path).then(function (response) {
                if (response.status < 400) {
                    return response.text();
                } else {
                    onFetchFail(request.url, response);
                    return Promise.reject(response);
                }
            });
        } else {
            promise = ApiClient.getDrives();
        }

        if (!parentPathPromise) {
            parentPathPromise = new Promise(function (resolve, reject) {
                resolve();
            });
        }

        Promise.all([promise, parentPathPromise]).then(function (responses) {

            var folders = responses[0];
            var parentPath = responses[1] || '';

            $('#txtDirectoryPickerPath', page).val(path || "");

            var html = '';

            if (path) {

                html += getItem("lnkPath lnkDirectory", "", parentPath, '...');
            }

            for (var i = 0, length = folders.length; i < length; i++) {

                var folder = folders[i];

                var cssClass = folder.Type == "File" ? "lnkPath lnkFile" : "lnkPath lnkDirectory";

                html += getItem(cssClass, folder.Type, folder.Path, folder.Name);
            }

            if (!path) {
                html += getItem("lnkPath lnkDirectory", "", "Network", Globalize.translate('ButtonNetwork'));
            }

            $('.results', page).html(html);

            Dashboard.hideLoadingMsg();

        }, function () {

            $('#txtDirectoryPickerPath', page).val("");
            $('.results', page).html('');

            Dashboard.hideLoadingMsg();
        });
    }

    function getItem(cssClass, type, path, name) {

        var html = '';
        html += '<paper-item role="menuitem" class="' + cssClass + '" data-type="' + type + '" data-path="' + path + '">';

        var icon = (type == 'File') ? 'menu' : 'folder';
        html += '<iron-icon icon="' + icon + '" style="margin-right: 10px;" ></iron-icon>';

        html += '<paper-item-body>';
        html += name;
        html += '</paper-item-body>';
        html += '<iron-icon icon="arrow-forward"></iron-icon>';
        html += '</paper-item>';

        return html;
    }

    function getEditorHtml(options, systemInfo) {

        var html = '';

        var instruction = options.instruction ? options.instruction + '<br/><br/>' : '';

        html += '<p class="directoryPickerHeadline">';
        html += instruction;
        html += Globalize.translate('MessageDirectoryPickerInstruction')
            .replace('{0}', '<b>\\\\server</b>')
            .replace('{1}', '<b>\\\\192.168.1.101</b>');

        if (systemInfo.OperatingSystem.toLowerCase() == 'bsd') {

            html += '<br/>';
            html += '<br/>';
            html += Globalize.translate('MessageDirectoryPickerBSDInstruction');
            html += '<br/>';
            html += '<a href="http://doc.freenas.org/9.3/freenas_jails.html#add-storage" target="_blank">' + Globalize.translate('ButtonMoreInformation') + '</a>';
        }
        else if (systemInfo.OperatingSystem.toLowerCase() == 'linux') {

            html += '<br/>';
            html += '<br/>';
            html += Globalize.translate('MessageDirectoryPickerLinuxInstruction');
            html += '<br/>';
            //html += '<a href="http://doc.freenas.org/9.3/freenas_jails.html#add-storage" target="_blank">' + Globalize.translate('ButtonMoreInformation') + '</a>';
        }

        html += '</p>';

        html += '<form style="max-width:100%;">';
        html += '<div>';
        html += '<paper-input id="txtDirectoryPickerPath" type="text" required="required" style="width:82%;display:inline-block;" label="' + Globalize.translate('LabelCurrentPath') + '"></paper-input>';

        html += '<paper-icon-button icon="refresh" class="btnRefreshDirectories" title="' + Globalize.translate('ButtonRefresh') + '"></paper-icon-button>';
        html += '</div>';

        html += '<div class="results paperList" style="height: 180px; overflow-y: auto;"></div>';

        html += '<div>';
        html += '<button type="submit" class="clearButton" data-role="none"><paper-button raised class="submit block">' + Globalize.translate('ButtonOk') + '</paper-button></button>';
        html += '</div>';

        html += '</form>';
        html += '</div>';

        return html;
    }

    function initEditor(content, options, fileOptions) {

        $(content).on("click", ".lnkPath", function () {

            var path = this.getAttribute('data-path');

            if ($(this).hasClass('lnkFile')) {
                $('#txtDirectoryPickerPath', content).val(path);
            } else {
                refreshDirectoryBrowser(content, path, fileOptions);
            }


        }).on("click", ".btnRefreshDirectories", function () {

            var path = $('#txtDirectoryPickerPath', content).val();

            refreshDirectoryBrowser(content, path, fileOptions);

        }).on("change", "#txtDirectoryPickerPath", function () {

            refreshDirectoryBrowser(content, this.value, fileOptions);
        });

        $('form', content).on('submit', function () {

            if (options.callback) {
                options.callback(this.querySelector('#txtDirectoryPickerPath').value);
            }

            return false;
        });
    }

    function directoryBrowser() {

        var self = this;
        var currentDialog;

        self.show = function (options) {

            options = options || {};

            var fileOptions = {
                includeDirectories: true
            };

            if (options.includeDirectories != null) {
                fileOptions.includeDirectories = options.includeDirectories;
            }

            if (options.includeFiles != null) {
                fileOptions.includeFiles = options.includeFiles;
            }

            if (options.includeHidden != null) {
                fileOptions.includeHidden = options.includeHidden;
            }

            getSystemInfo().then(function (systemInfo) {

                var dlg = paperDialogHelper.createDialog({
                    theme: 'a',
                    size: 'medium'
                });

                dlg.classList.add('directoryPicker');

                var html = '';
                html += '<h2 class="dialogHeader">';
                html += '<paper-fab icon="arrow-back" mini class="btnCloseDialog"></paper-fab>';
                html += '<div style="display:inline-block;margin-left:.6em;vertical-align:middle;">' + (options.header || Globalize.translate('HeaderSelectPath')) + '</div>';
                html += '</h2>';

                html += '<div class="editorContent" style="max-width:800px;margin:auto;">';
                html += getEditorHtml(options, systemInfo);
                html += '</div>';

                dlg.innerHTML = html;
                document.body.appendChild(dlg);

                var editorContent = dlg.querySelector('.editorContent');
                initEditor(editorContent, options, fileOptions);

                // Has to be assigned a z-index after the call to .open() 
                $(dlg).on('iron-overlay-opened', function () {
                    this.querySelector('#txtDirectoryPickerPath input').focus();
                });
                $(dlg).on('iron-overlay-closed', onDialogClosed);

                paperDialogHelper.open(dlg);

                $('.btnCloseDialog', dlg).on('click', function () {

                    paperDialogHelper.close(dlg);
                });

                currentDialog = dlg;

                var txtCurrentPath = $('#txtDirectoryPickerPath', editorContent);

                if (options.path) {
                    txtCurrentPath.val(options.path);
                }

                refreshDirectoryBrowser(editorContent, txtCurrentPath.val(), fileOptions);

            });
        };

        self.close = function () {
            if (currentDialog) {
                paperDialogHelper.close(currentDialog);
            }
        };

    }

    return directoryBrowser;
});