const CACHE_NAME = "atharv-ai-v2";

const APP_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json"
];

/* =========================================================
   INSTALL
========================================================= */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }

          return null;
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});


/* =========================================================
   FETCH
========================================================= */

self.addEventListener("fetch", (event) => {

  if (event.request.method !== "GET") {
    return;
  }

  const requestURL = new URL(event.request.url);

  /* Only handle Atharv's own files */
  if (requestURL.origin !== self.location.origin) {
    return;
  }

  /* Never cache API requests */
  if (requestURL.pathname.startsWith("/api/")) {
    return;
  }

  /*
    Network first:
    - fresh files when internet is available
    - cached files when offline
  */

  event.respondWith(
    fetch(event.request)
      .then((response) => {

        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {

          if (cached) {
            return cached;
          }

          /* Offline fallback */
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }

          return new Response(
            "Atharv AI is currently offline.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        });
      })
  );
});
