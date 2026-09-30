"use strict";


const CACHE_NAME =
  "atharv-ai-v17-0-2";


const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/manifest.json",

  "/js/app.js",
  "/js/api.js",
  "/js/chat.js",
  "/js/config.js",
  "/js/storage.js",
  "/js/memory.js",
  "/js/ui.js",
  "/js/utils.js",
  "/js/pwa.js"
];


self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches.open(
        CACHE_NAME
      ).then(
        cache =>
          cache.addAll(
            APP_SHELL
          )
      )
    );


    self.skipWaiting();
  }
);


self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches.keys()
        .then(
          keys =>
            Promise.all(
              keys
                .filter(
                  key =>
                    key !==
                    CACHE_NAME
                )
                .map(
                  key =>
                    caches.delete(
                      key
                    )
                )
            )
        )
    );


    self.clients.claim();
  }
);


self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
     * NEVER cache API requests.
     */

    if (
      new URL(
        request.url
      ).pathname.startsWith(
        "/api/"
      )
    ) {

      event.respondWith(
        fetch(request)
      );

      return;
    }


    /*
     * Navigation always goes
     * to the network first.
     */

    if (
      request.mode ===
      "navigate"
    ) {

      event.respondWith(

        fetch(request)
          .then(
            response => {

              const copy =
                response.clone();


              caches.open(
                CACHE_NAME
              ).then(
                cache =>
                  cache.put(
                    "/",
                    copy
                  )
              );


              return response;
            }
          )
          .catch(
            () =>
              caches.match(
                "/"
              )
          )
      );

      return;
    }


    /*
     * JS/CSS: network first.
     */

    event.respondWith(

      fetch(request)
        .then(
          response => {

            const copy =
              response.clone();


            caches.open(
              CACHE_NAME
            ).then(
              cache =>
                cache.put(
                  request,
                  copy
                )
            );


            return response;
          }
        )
        .catch(
          () =>
            caches.match(
              request
            )
        )
    );
  }
);
