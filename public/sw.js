"use strict";

/*
=========================================================
 ATHARV AI
 SERVICE WORKER
 Version 18.4.0
 --------------------------------------------------------
 FIXES:
 - Removes old v17 cache
 - Does NOT cache JS/CSS aggressively
 - API requests always go to server
 - Navigation uses network first
 - Prevents stale script.js/app.js
=========================================================
*/

const CACHE_NAME = "atharv-ai-v18-4-0";

const APP_SHELL = [
    "/",
    "/index.html",
    "/manifest.json",
    "/atharv-icon-192x192.png",
    "/atharv-icon-512x512.png"
];

/* ======================================================
   INSTALL
====================================================== */

self.addEventListener("install", (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())

    );

});


/* ======================================================
   ACTIVATE
====================================================== */

self.addEventListener("activate", (event) => {

    event.waitUntil(

        caches.keys()
            .then((keys) => {

                return Promise.all(

                    keys.map((key) => {

                        if (key !== CACHE_NAME) {
                            return caches.delete(key);
                        }

                        return Promise.resolve();
                    })

                );

            })
            .then(() => self.clients.claim())

    );

});


/* ======================================================
   FETCH
====================================================== */

self.addEventListener("fetch", (event) => {

    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    /* ==================================================
       API
       Never cache API
    ================================================== */

    if (url.pathname.startsWith("/api/")) {
        return;
    }


    /* ==================================================
       JAVASCRIPT
       ALWAYS NETWORK
    ================================================== */

    if (
        url.pathname.endsWith(".js") ||
        url.pathname.endsWith(".mjs")
    ) {

        event.respondWith(

            fetch(request, {
                cache: "no-store"
            })

            .catch(() => {

                return caches.match(request);

            })

        );

        return;
    }


    /* ==================================================
       CSS
       ALWAYS NETWORK
    ================================================== */

    if (url.pathname.endsWith(".css")) {

        event.respondWith(

            fetch(request, {
                cache: "no-store"
            })

            .catch(() => {

                return caches.match(request);

            })

        );

        return;
    }


    /* ==================================================
       NAVIGATION
       NETWORK FIRST
    ================================================== */

    if (request.mode === "navigate") {

        event.respondWith(

            fetch(request, {
                cache: "no-store"
            })

            .then((response) => {

                if (response && response.ok) {

                    const copy = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {

                            cache.put(
                                "/index.html",
                                copy
                            );

                        });

                }

                return response;

            })

            .catch(() => {

                return caches.match("/index.html");

            })

        );

        return;
    }


    /* ==================================================
       IMAGES / MANIFEST / OTHER STATIC FILES
       CACHE FIRST
    ================================================== */

    event.respondWith(

        caches.match(request)

            .then((cached) => {

                if (cached) {
                    return cached;
                }

                return fetch(request)

                    .then((response) => {

                        if (
                            response &&
                            response.ok
                        ) {

                            const copy =
                                response.clone();

                            caches.open(CACHE_NAME)
                                .then((cache) => {

                                    cache.put(
                                        request,
                                        copy
                                    );

                                });

                        }

                        return response;

                    });

            })

    );

});
