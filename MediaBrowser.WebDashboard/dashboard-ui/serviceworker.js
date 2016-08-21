var staticFileCacheName = 'staticfiles';
var staticFileList;

var baseUrl = self.location.toString().substring(0, self.location.toString().lastIndexOf('/'));
var staticFileBaseUrl = baseUrl + '/staticfiles';

console.log('service worker location: ' + self.location);
console.log('service worker base url: ' + baseUrl);

var connectionManager;

function getStaticFileList() {

    if (staticFileList) {
        return Promise.resolve(staticFileList);
    }

    return fetch('staticfiles').then(function (response) {
        return response.json().then(function (list) {
            staticFileList = list;
            return list;
        });
    });
}

self.addEventListener('install', function (event) {
    event.waitUntil(
      caches.open(staticFileCacheName).then(function (cache) {
          return getStaticFileList().then(function (files) {
              return cache.addAll(files);
          });
      })
    );
});

function isCacheable(request) {

    if ((request.method || '').toUpperCase() !== 'GET') {
        return false;
    }

    var url = request.url || '';

    if (url.indexOf(baseUrl) != 0) {
        return false;
    }

    if (url.indexOf(staticFileBaseUrl) == 0) {
        return false;
    }

    return true;
}

if (self.location.toString().indexOf('localhost') == -1) {
    self.addEventListener('fetch', function (event) {

        if (!isCacheable(event.request)) {
            return;
        }

        event.respondWith(
          caches.open(staticFileCacheName).then(function (cache) {
              return cache.match(event.request).then(function (response) {
                  return response || fetch(event.request).then(function (response) {
                      cache.put(event.request, response.clone());
                      return response;
                  });
              });
          })
        );
    });
}

self.addEventListener('activate', function (event) {

    event.waitUntil(
      caches.open(staticFileCacheName).then(function (cache) {
          return getStaticFileList().then(function (staticFiles) {

              var setOfExpectedUrls = new Set(staticFiles);

              return cache.keys().then(function (existingRequests) {

                  var existingBaseUrl = baseUrl + '/';

                  return Promise.all(
                    existingRequests.map(function (existingRequest) {
                        if (!setOfExpectedUrls.has(existingRequest.url.replace(existingBaseUrl, ''))) {

                            console.log('deleting cached file: ' + existingRequest.url);
                            return cache.delete(existingRequest);
                        }
                    })
                  );
              });
          });
      }).then(function () {
          return self.clients.claim();
      })
    );
});

function getApiClient(serverId) {

    if (connectionManager) {
        return Promise.resolve(connectionManager.getApiClient(serverId));
    }

    //importScripts('serviceworker-cache-polyfill.js');

    return Promise.reject();
}

function executeAction(action, data, serverId) {

    return getApiClient(serverId).then(function (apiClient) {

        switch (action) {
            case 'cancel-install':
                var id = data.id;
                return apiClient.cancelPackageInstallation(id);
            case 'restart':
                return apiClient.restartServer();
            default:
                clients.openWindow("/");
                return Promise.resolve();
        }
    });
}

self.addEventListener('notificationclick', function (event) {

    var notification = event.notification;
    notification.close();

    var data = notification.data;
    var serverId = data.serverId;
    var action = event.action;

    if (!action) {
        clients.openWindow("/");
        event.waitUntil(Promise.resolve());
        return;
    }

    event.waitUntil(executeAction(action, data, serverId));

}, false);