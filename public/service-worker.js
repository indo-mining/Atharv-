"use strict";

const CACHE_NAME =
  "atharv-ai-v17-0-2";

const STATIC_FILES = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/js/config.js",
  "/js/storage.js",
  "/js/api.js",
  "/js/chat.js",
  "/js/ui.js",
  "/js/memory.js",
  "/js/pwa.js",
  "/js/utils.js",
  "/manifest.json"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
  "install",
  event => {

    self.skipWaiting();

    event.waitUntil(
      caches.open(
        CACHE_NAME
      ).then(cache =>
        cache.addAll(
          STATIC_FILES
        )
      ).catch(error => {
        console.warn(
          "SW cache install warning:",
          error
        );
      })
    );
  }
);


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(
      caches.keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key !==
                  CACHE_NAME
              )
              .map(key =>
                caches.delete(
                  key
                )
              )
          )
        )
        .then(() =>
          self.clients.claim()
        )
    );
  }
);


/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;

    const url =
      new URL(
        request.url
      );


    /*
    -----------------------------------------------------
    Only same-origin
    -----------------------------------------------------
    */

    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }


    /*
    -----------------------------------------------------
    API MUST NEVER BE CACHED
    -----------------------------------------------------
    */

    if (
      url.pathname.startsWith(
        "/api/"
      ) ||
      url.pathname ===
        "/health"
    ) {
      event.respondWith(
        fetch(
          request,
          {
            cache: "no-store"
          }
        )
      );

      return;
    }


    /*
    -----------------------------------------------------
    Service worker itself
    -----------------------------------------------------
    */

    if (
      url.pathname ===
      "/service-worker.js"
    ) {
      event.respondWith(
        fetch(
          request,
          {
            cache: "no-store"
          }
        )
      );

      return;
    }


    /*
    -----------------------------------------------------
    Navigation
    -----------------------------------------------------
    */

    if (
      request.mode ===
      "navigate"
    ) {

      event.respondWith(
        fetch(
          request,
          {
            cache: "no-store"
          }
        ).catch(
          () =>
            caches.match(
              "/index.html"
            )
        )
      );

      return;
    }


    /*
    -----------------------------------------------------
    JS / CSS
    -----------------------------------------------------
    Network first.
    This prevents old frontend code.
    -----------------------------------------------------
    */

    if (
      url.pathname.endsWith(
        ".js"
      ) ||
      url.pathname.endsWith(
        ".css"
      )
    ) {

      event.respondWith(

        fetch(
          request,
          {
            cache: "no-store"
          }
        )
          .then(response => {

            const copy =
              response.clone();

            caches.open(
              CACHE_NAME
            ).then(cache => {
              cache.put(
                request,
                copy
              );
            });

            return response;
          })
          .catch(() =>
            caches.match(
              request
            )
          )
      );

      return;
    }


    /*
    -----------------------------------------------------
    Other static assets
    -----------------------------------------------------
    */

    event.respondWith(
      caches.match(
        request
      ).then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(
          request
        );
      })
    );
  }
);
