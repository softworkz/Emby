﻿define(['loading', 'apphost', 'globalize', 'syncJobList', 'events', 'scripts/taskbutton', 'localsync', 'emby-button', 'paper-icon-button-light'], function (loading, appHost, globalize, syncJobList, events, taskButton) {
    'use strict';

    function getTabs() {
        return [
        {
            href: 'syncactivity.html',
            name: Globalize.translate('TabSyncJobs')
        },
         {
             href: 'devicesupload.html',
             name: Globalize.translate('TabCameraUpload')
         },
        {
            href: 'appservices.html?context=sync',
            name: Globalize.translate('TabServices')
        },
         {
             href: 'syncsettings.html',
             name: Globalize.translate('TabSettings')
         }];
    }

    return function (view, params) {

        var mySyncJobList = new syncJobList({
            isLocalSync: params.mode === 'offline',
            serverId: ApiClient.serverId(),
            userId: params.mode === 'offline' ? null : ApiClient.getCurrentUserId(),
            element: view.querySelector('.syncActivity'),
            mode: params.mode
        });

        view.addEventListener('viewshow', function () {

            LibraryMenu.setTabs('syncadmin', 0, getTabs);

            taskButton({
                mode: 'on',
                progressElem: view.querySelector('.syncProgress'),
                taskKey: 'SyncPrepare',
                button: view.querySelector('.btnSync')
            });
        });

        view.addEventListener('viewbeforehide', function () {

            taskButton({
                mode: 'off',
                taskKey: 'SyncPrepare',
                button: view.querySelector('.btnSync')
            });
        });

        view.addEventListener('viewdestroy', function () {

            mySyncJobList.destroy();
        });
    };

});