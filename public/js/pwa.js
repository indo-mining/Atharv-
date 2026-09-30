"use strict";

export function registerPWA() {

  if (
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  window.addEventListener(
    "load",
    async () => {

      try {

        const registration =
          await navigator.serviceWorker.register(
            "/service-worker.js?v=17.0.2",
            {
              updateViaCache:
                "none"
            }
          );

        console.log(
          "Atharv Service Worker registered:",
          registration.scope
        );

        await registration.update();

      } catch (error) {

        console.warn(
          "Service Worker registration failed:",
          error
        );
      }
    }
  );
}
