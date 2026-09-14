const CACHE_NAME = "atharv-ai-v1";

const APP_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        const copy = response.clone();

        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });

        return response;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});
