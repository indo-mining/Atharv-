"use strict";

const CACHE_NAME = "atharv-ai-v17";

const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/manifest.json",
  "/atharv-icon-192x192.png",
  "/atharv-icon-512x512.png",

  "/js/app.js",
  "/js/api.js",
  "/js/chat.js",
  "/js/config.js",
  "/js/language.js",
  "/js/memory.js",
  "/js/pwa.js",
  "/js/storage.js",
  "/js/ui.js",
  "/js/utils.js"
];


self.addEventListener(
  "install",
  (event) => {

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(APP_SHELL)
        )
        .then(() =>
          self.skipWaiting()
        )
    );
  }
);


self.addEventListener(
  "activate",
  (event) => {

    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key !== CACHE_NAME
              )
              .map((key) =>
                caches.delete(key)
              )
          )
        )
        .then(() =>
          self.clients.claim()
        )
    );
  }
);


self.addEventListener(
  "fetch",
  (event) => {

    const request =
      event.request;

    /*
     * API requests should always reach
     * the live backend.
     */
    if (
      new URL(request.url)
        .pathname
        .startsWith("/api/")
    ) {
      return;
    }

    /*
     * Navigation requests:
     * network first, cached fallback.
     */
    if (
      request.mode === "navigate"
    ) {

      event.respondWith(
        fetch(request)
          .then((response) => {

            const copy =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then((cache) =>
                cache.put(
                  request,
                  copy
                )
              );

            return response;
          })
          .catch(() =>
            caches.match(
              "/index.html"
            )
          )
      );

      return;
    }

    /*
     * Static files:
     * cache first, network fallback.
     */
    event.respondWith(
      caches
        .match(request)
        .then(
          (cached) =>
            cached ||
            fetch(request)
              .then((response) => {

                if (
                  response.ok &&
                  request.method === "GET"
                ) {

                  const copy =
                    response.clone();

                  caches
                    .open(CACHE_NAME)
                    .then((cache) =>
                      cache.put(
                        request,
                        copy
                      )
                    );
                }

                return response;
              })
        )
    );
  }
);
