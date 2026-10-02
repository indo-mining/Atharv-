"use strict";

/*
=========================================================
 ATHARV AI SERVICE WORKER
 Version 19.0.0
=========================================================
*/

const CACHE_NAME =
    "atharv-ai-v19-0-0";


const STATIC_FILES = [
    "/",
    "/index.html",
    "/style.css",
    "/manifest.json"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
    "install",
    function (event) {

        event.waitUntil(

            caches.open(
                CACHE_NAME
            )
            .then(
                function (cache) {

                    return cache.addAll(
                        STATIC_FILES
                    );

                }
            )
            .then(
                function () {

                    return self.skipWaiting();

                }
            )

        );

    }
);


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener(
    "activate",
    function (event) {

        event.waitUntil(

            caches.keys()
                .then(
                    function (keys) {

                        return Promise.all(

                            keys
                                .filter(
                                    function (key) {

                                        return (
                                            key !==
                                            CACHE_NAME
                                        );

                                    }
                                )
                                .map(
                                    function (key) {

                                        return caches.delete(
                                            key
                                        );

                                    }
                                )

                        );

                    }
                )
                .then(
                    function () {

                        return self.clients.claim();

                    }
                )

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


        const url =
            new URL(
                request.url
            );


        /*
         * NEVER cache API requests.
         */

        if (
            url.pathname.startsWith(
                "/api/"
            )
        ) {

            return;

        }


        /*
         * JavaScript and CSS:
         * always network.
         *
         * This prevents old frontend code
         * from remaining active.
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
                        cache:
                            "no-store"
                    }
                )

            );

            return;

        }


        /*
         * Navigation:
         * network first.
         */

        if (
            request.mode ===
            "navigate"
        ) {

            event.respondWith(

                fetch(
                    request,
                    {
                        cache:
                            "no-store"
                    }
                )
                .then(
                    function (response) {

                        if (
                            response &&
                            response.ok
                        ) {

                            const copy =
                                response.clone();


                            caches.open(
                                CACHE_NAME
                            )
                            .then(
                                function (cache) {

                                    cache.put(
                                        request,
                                        copy
                                    );

                                }
                            );

                        }


                        return response;

                    }
                )
                .catch(
                    function () {

                        return caches.match(
                            "/index.html"
                        );

                    }
                )

            );

            return;

        }


        /*
         * Other static assets.
         */

        event.respondWith(

            caches.match(
                request
            )
            .then(
                function (cached) {

                    if (cached) {
                        return cached;
                    }


                    return fetch(
                        request
                    )
                    .then(
                        function (response) {

                            if (
                                response &&
                                response.ok &&
                                request.method ===
                                    "GET"
                            ) {

                                const copy =
                                    response.clone();


                                caches.open(
                                    CACHE_NAME
                                )
                                .then(
                                    function (cache) {

                                        cache.put(
                                            request,
                                            copy
                                        );

                                    }
                                );

                            }


                            return response;

                        }
                    );

                }
            )

        );

    }
);
