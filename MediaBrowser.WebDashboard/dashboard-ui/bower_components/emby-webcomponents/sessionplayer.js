﻿define(['playbackManager', 'events', 'serverNotifications'], function (playbackManager, events, serverNotifications) {
    'use strict';

    function getActivePlayerId() {
        var info = playbackManager.getPlayerInfo();
        return info ? info.id : null;
    }

    function sendPlayCommand(options, playType) {

        var sessionId = getActivePlayerId();

        var ids = options.ids || options.items.map(function (i) {
            return i.Id;
        });

        var remoteOptions = {
            ItemIds: ids.join(','),

            PlayCommand: playType
        };

        if (options.startPositionTicks) {
            remoteOptions.startPositionTicks = options.startPositionTicks;
        }

        return ApiClient.sendPlayCommand(sessionId, remoteOptions);
    }

    function sendPlayStateCommand(command, options) {

        var sessionId = getActivePlayerId();

        ApiClient.sendPlayStateCommand(sessionId, command, options);
    }

    return function () {

        var self = this;

        self.name = 'Remote Control';
        self.type = 'mediaplayer';
        self.isLocalPlayer = false;
        self.id = 'remoteplayer';

        function sendCommandByName(name, options) {

            var command = {
                Name: name
            };

            if (options) {
                command.Arguments = options;
            }

            self.sendCommand(command);
        }

        self.sendCommand = function (command) {

            var sessionId = getActivePlayerId();

            ApiClient.sendCommand(sessionId, command);
        };

        self.play = function (options) {

            var playOptions = {};
            playOptions.ids = options.ids || options.items.map(function (i) {
                return i.Id;
            });

            if (options.startPositionTicks) {
                playOptions.startPositionTicks = options.startPositionTicks;
            }

            return sendPlayCommand(playOptions, 'PlayNow');
        };

        self.shuffle = function (item) {

            sendPlayCommand({ ids: [item.Id] }, 'PlayShuffle');
        };

        self.instantMix = function (item) {

            sendPlayCommand({ ids: [item.Id] }, 'PlayInstantMix');
        };

        self.queue = function (options) {

            sendPlayCommand(options, 'PlayNext');
        };

        self.queueNext = function (options) {

            sendPlayCommand(options, 'PlayLast');
        };

        self.canPlayMediaType = function (mediaType) {

            mediaType = (mediaType || '').toLowerCase();
            return mediaType === 'audio' || mediaType === 'video';
        };

        self.canQueueMediaType = function (mediaType) {
            return self.canPlayMediaType(mediaType);
        };

        self.stop = function () {
            sendPlayStateCommand('stop');
        };

        self.nextTrack = function () {
            sendPlayStateCommand('nextTrack');
        };

        self.previousTrack = function () {
            sendPlayStateCommand('previousTrack');
        };

        self.seek = function (positionTicks) {
            sendPlayStateCommand('seek',
            {
                SeekPositionTicks: positionTicks
            });
        };

        self.currentTime = function (val) {

            if (val != null) {
                return self.seek(val);
            }

            var state = self.lastPlayerData || {};
            state = state.PlayState || {};
            return state.PositionTicks;
        };

        self.duration = function () {

        };

        self.paused = function () {
        };

        self.pause = function () {
            sendPlayStateCommand('Pause');
        };

        self.unpause = function () {
            sendPlayStateCommand('Unpause');
        };

        self.setMute = function (isMuted) {

            if (isMuted) {
                sendCommandByName('Mute');
            } else {
                sendCommandByName('Unmute');
            }
        };

        self.toggleMute = function () {
            sendCommandByName('ToggleMute');
        };

        self.setVolume = function (vol) {
            sendCommandByName('SetVolume', {
                Volume: vol
            });
        };

        self.volumeUp = function () {
            sendCommandByName('VolumeUp');
        };

        self.volumeDown = function () {
            sendCommandByName('VolumeDown');
        };

        self.toggleFullscreen = function () {
            sendCommandByName('ToggleFullscreen');
        };

        self.audioTracks = function () {
            return [];
        };

        self.getAudioStreamIndex = function () {

        };

        self.setAudioStreamIndex = function (index) {
            sendCommandByName('SetAudioStreamIndex', {
                Index: index
            });
        };

        self.subtitleTracks = function () {
            return [];
        };

        self.getSubtitleStreamIndex = function () {

        };

        self.setSubtitleStreamIndex = function (index) {
            sendCommandByName('SetSubtitleStreamIndex', {
                Index: index
            });
        };

        self.getMaxStreamingBitrate = function () {

        };

        self.setMaxStreamingBitrate = function (bitrate) {

        };

        self.isFullscreen = function () {

        };

        self.toggleFullscreen = function () {

        };

        self.getRepeatMode = function () {

        };

        self.setRepeatMode = function (mode) {

            sendCommandByName('SetRepeatMode', {
                RepeatMode: mode
            });
        };

        self.displayContent = function (options) {

            sendCommandByName('DisplayContent', options);
        };

        self.isPlaying = function () {
            var state = self.lastPlayerData || {};
            return state.NowPlayingItem != null;
        };

        self.isPlayingVideo = function () {
            var state = self.lastPlayerData || {};
            state = state.NowPlayingItem || {};
            return state.MediaType === 'Video';
        };

        self.isPlayingAudio = function () {
            var state = self.lastPlayerData || {};
            state = state.NowPlayingItem || {};
            return state.MediaType === 'Audio';
        };

        self.getPlayerState = function () {

            var apiClient = window.ApiClient;

            if (apiClient) {
                return apiClient.getSessions().then(function (sessions) {

                    var currentTargetId = getActivePlayerId();

                    // Update existing data
                    //updateSessionInfo(popup, msg.Data);
                    var session = sessions.filter(function (s) {
                        return s.Id === currentTargetId;
                    })[0];

                    if (session) {
                        session = getPlayerState(session);
                    }

                    return session;
                });
            } else {
                return Promise.resolve({});
            }
        };

        var pollInterval;

        function onPollIntervalFired() {

            if (!ApiClient.isWebSocketOpen()) {
                var apiClient = window.ApiClient;

                if (apiClient) {
                    apiClient.getSessions().then(processUpdatedSessions);
                }
            }
        }

        self.subscribeToPlayerUpdates = function () {

            self.isUpdating = true;

            if (ApiClient.isWebSocketOpen()) {

                ApiClient.sendWebSocketMessage("SessionsStart", "100,800");
            }
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            pollInterval = setInterval(onPollIntervalFired, 5000);
        };

        function unsubscribeFromPlayerUpdates() {

            self.isUpdating = true;

            if (ApiClient.isWebSocketOpen()) {

                ApiClient.sendWebSocketMessage("SessionsStop");
            }
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        }

        var playerListenerCount = 0;
        self.beginPlayerUpdates = function () {

            if (playerListenerCount <= 0) {

                playerListenerCount = 0;

                self.subscribeToPlayerUpdates();
            }

            playerListenerCount++;
        };

        self.endPlayerUpdates = function () {

            playerListenerCount--;

            if (playerListenerCount <= 0) {

                unsubscribeFromPlayerUpdates();
                playerListenerCount = 0;
            }
        };

        self.getTargets = function () {

            var apiClient = window.ApiClient;

            var sessionQuery = {
                ControllableByUserId: apiClient.getCurrentUserId()
            };

            if (apiClient) {
                return apiClient.getSessions(sessionQuery).then(function (sessions) {

                    return sessions.filter(function (s) {
                        return s.DeviceId !== apiClient.deviceId();

                    }).map(function (s) {
                        return {
                            name: s.DeviceName,
                            deviceName: s.DeviceName,
                            id: s.Id,
                            playerName: self.name,
                            appName: s.Client,
                            playableMediaTypes: s.PlayableMediaTypes,
                            isLocalPlayer: false,
                            supportedCommands: s.SupportedCommands
                        };
                    });

                });

            } else {
                return Promise.resolve([]);
            }
        };

        self.tryPair = function (target) {

            return Promise.resolve();
        };

        function getPlayerState(session) {

            return session;
        }

        function firePlaybackEvent(name, session) {

            events.trigger(self, name, [getPlayerState(session)]);
        }

        function onWebSocketConnectionChange() {

            // Reconnect
            if (self.isUpdating) {
                self.subscribeToPlayerUpdates();
            }
        }

        function processUpdatedSessions(sessions) {

            var currentTargetId = getActivePlayerId();

            // Update existing data
            //updateSessionInfo(popup, msg.Data);
            var session = sessions.filter(function (s) {
                return s.Id === currentTargetId;
            })[0];

            if (session) {
                firePlaybackEvent('statechange', session);
                firePlaybackEvent('timeupdate', session);
                firePlaybackEvent('pause', session);
            }
        }

        events.on(serverNotifications, 'Sessions', function (e, apiClient, data) {
            processUpdatedSessions(data);
        });

        events.on(serverNotifications, 'SessionEnded', function (e, apiClient, data) {
            console.log("Server reports another session ended");

            if (getActivePlayerId() === data.Id) {
                playbackManager.setDefaultPlayerActive();
            }
        });

        events.on(serverNotifications, 'PlaybackStart', function (e, apiClient, data) {
            if (data.DeviceId !== apiClient.deviceId()) {
                if (getActivePlayerId() === data.Id) {
                    firePlaybackEvent('playbackstart', data);
                }
            }
        });

        events.on(serverNotifications, 'PlaybackStopped', function (e, apiClient, data) {
            if (data.DeviceId !== apiClient.deviceId()) {
                if (getActivePlayerId() === data.Id) {
                    firePlaybackEvent('playbackstop', data);
                }
            }
        });
    };
});