const CACHE_NAME =
  "atharv-ai-v17";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",

  "/js/config.js",
  "/js/api.js",
  "/js/storage.js",
  "/js/ui.js",
  "/js/chat.js",
  "/js/language.js",
  "/js/memory.js",
  "/js/pwa.js",
  "/js/utils.js"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache =>
          cache.addAll(
            STATIC_ASSETS
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

      caches.keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )
              .map(
                key =>
                  caches.delete(key)
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

    const url =
      new URL(request.url);

    /*
     * Never cache API requests.
     * AI responses must always be fresh.
     */

    if (
      url.pathname.startsWith(
        "/api/"
      ) ||
      url.pathname === "/health"
    ) {
      return;
    }

    /*
     * Only GET requests.
     */

    if (
      request.method !== "GET"
    ) {
      return;
    }

    event.respondWith(

      fetch(request)
        .then(response => {

          if (
            response.ok &&
            url.origin === location.origin
          ) {

            const clone =
              response.clone();

            caches.open(
              CACHE_NAME
            ).then(cache => {

              cache.put(
                request,
                clone
              );

            });
          }

          return response;
        })

        .catch(() =>
          caches.match(request)
        )

    );
  }
);
