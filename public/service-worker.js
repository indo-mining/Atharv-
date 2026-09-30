"use strict";

/*
=========================================================
 ATHARV AI
 SERVICE WORKER
 Version 17.0.3
 --------------------------------------------------------
 FIXES:
 - Old cache removed
 - Fresh HTML
 - Fresh JS
 - Fresh CSS
 - API never cached
 - Service worker never cached
 - Navigation network-first
 - Automatic activation
 - Old Atharv caches deleted
=========================================================
*/


const CACHE_NAME =
  "atharv-ai-v17-0-3";


/* =====================================================
   STATIC FILES
===================================================== */

const STATIC_FILES = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/manifest.json"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
  "install",
  function (event) {

    console.log(
      "Atharv AI Service Worker 17.0.3 installing..."
    );

    /*
    Immediately activate the new worker.
    */

    self.skipWaiting();


    event.waitUntil(

      caches.open(
        CACHE_NAME
      )
      .then(function (cache) {

        return cache.addAll(
          STATIC_FILES
        );

      })
      .catch(function (error) {

        console.warn(
          "Atharv SW cache install warning:",
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
  function (event) {

    console.log(
      "Atharv AI Service Worker 17.0.3 activated."
    );


    event.waitUntil(

      caches.keys()

        .then(function (keys) {

          return Promise.all(

            keys.map(
              function (key) {

                /*
                Delete every old Atharv cache.
                */

                if (
                  key !== CACHE_NAME
                ) {

                  console.log(
                    "Deleting old cache:",
                    key
                  );

                  return caches.delete(
                    key
                  );

                }

                return Promise.resolve(
                  true
                );

              }
            )

          );

        })

        .then(function () {

          /*
          Take control of all open pages.
          */

          return self.clients.claim();

        })

    );

  }
);


/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
  "fetch",
  function (event) {

    const request =
      event.request;


    /*
    -----------------------------------------------------
    Only GET requests are handled.
    -----------------------------------------------------

    POST /api/chat
    POST /api/chat/research

    are NEVER intercepted by cache.
    -----------------------------------------------------
    */

    if (
      request.method !== "GET"
    ) {

      return;

    }


    const url =
      new URL(
        request.url
      );


    /*
    -----------------------------------------------------
    ONLY SAME ORIGIN
    -----------------------------------------------------
    */

    if (
      url.origin !==
      self.location.origin
    ) {

      return;

    }


    /* =================================================
       API
    ================================================= */

    if (
      url.pathname.startsWith(
        "/api/"
      )
      ||
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


    /* =================================================
       SERVICE WORKER
    ================================================= */

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


    /* =================================================
       NAVIGATION / HTML
    ================================================= */

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
        )

        .then(function (response) {

          /*
          Fresh page mil gaya.
          Cache mein purana HTML nahi rakhenge.
          */

          return response;

        })

        .catch(function () {

          /*
          Internet unavailable hone par
          cached index.html use kar sakte hain.
          */

          return caches.match(
            "/index.html"
          );

        })

      );

      return;

    }


    /* =================================================
       JAVASCRIPT
    ================================================= */

    if (
      url.pathname.endsWith(
        ".js"
      )
    ) {

      event.respondWith(

        fetch(
          request,
          {
            cache: "no-store"
          }
        )

        .then(function (response) {

          /*
          Fresh JS ko cache mein save karo.
          */

          const copy =
            response.clone();


          caches.open(
            CACHE_NAME
          )
          .then(function (cache) {

            cache.put(
              request,
              copy
            );

          })
          .catch(function () {

            /*
            Cache failure should never
            break the application.
            */

          });


          return response;

        })

        .catch(function () {

          /*
          Network unavailable:
          cached JS fallback.
          */

          return caches.match(
            request
          );

        })

      );

      return;

    }


    /* =================================================
       CSS
    ================================================= */

    if (
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

        .then(function (response) {

          const copy =
            response.clone();


          caches.open(
            CACHE_NAME
          )
          .then(function (cache) {

            cache.put(
              request,
              copy
            );

          })
          .catch(function () {

          });


          return response;

        })

        .catch(function () {

          return caches.match(
            request
          );

        })

      );

      return;

    }


    /* =================================================
       MANIFEST
    ================================================= */

    if (
      url.pathname ===
      "/manifest.json"
    ) {

      event.respondWith(

        fetch(
          request,
          {
            cache: "no-store"
          }
        )

        .catch(function () {

          return caches.match(
            request
          );

        })

      );

      return;

    }


    /* =================================================
       OTHER STATIC FILES
    ================================================= */

    event.respondWith(

      fetch(
        request,
        {
          cache: "no-store"
        }
      )

      .then(function (response) {

        /*
        Successful static response ko cache
        kar sakte hain.
        */

        if (
          response &&
          response.ok
        ) {

          const copy =
            response.clone();


          caches.open(
            CACHE_NAME
          )
          .then(function (cache) {

            cache.put(
              request,
              copy
            );

          })
          .catch(function () {

          });

        }


        return response;

      })

      .catch(function () {

        return caches.match(
          request
        );

      })

    );

  }
);


/* =====================================================
   MESSAGE
===================================================== */

self.addEventListener(
  "message",
  function (event) {

    if (
      event.data &&
      event.data.type ===
        "SKIP_WAITING"
    ) {

      self.skipWaiting();

    }

  }
);
