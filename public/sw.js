"use strict";

/*
=========================================================
 ATHARV AI SERVICE WORKER
 Version 22.0.0
=========================================================
*/

const CACHE_NAME =
    "atharv-ai-v22";

const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/style.css?v=22.0.0",
    "/chat.js?v=22.0.0",
    "/app.js?v=22.0.0",
    "/manifest.json?v=22.0.0"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(cache =>
                    cache.addAll(
                        STATIC_ASSETS
                    )
                )
                .catch(error =>
                    console.warn(
                        "Cache install error:",
                        error
                    )
                )
        );

        self.skipWaiting();
    }
);


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches
                .keys()
                .then(keys =>
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


/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
    "fetch",
    event => {

        const request =
            event.request;


        if (
            request.method !==
            "GET"
        ) {
            return;
        }


        const url =
            new URL(
                request.url
            );


        /*
        Never cache API requests.
        */
        if (
            url.pathname.startsWith(
                "/api/"
            ) ||
            url.pathname ===
                "/health"
        ) {
            return;
        }


        event.respondWith(

            fetch(request)
                .then(response => {

                    if (
                        response &&
                        response.ok
                    ) {

                        const clone =
                            response.clone();

                        caches
                            .open(
                                CACHE_NAME
                            )
                            .then(
                                cache =>
                                    cache.put(
                                        request,
                                        clone
                                    )
                            );
                    }

                    return response;

                })
                .catch(() =>
                    caches
                        .match(request)
                        .then(
                            cached =>
                                cached ||
                                caches.match(
                                    "/index.html"
                                )
                        )
                )
        );
    }
);
