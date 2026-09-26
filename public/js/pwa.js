let deferredPrompt = null;


/**
 * Register service worker.
 */
export async function registerPWA() {

  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {

    await navigator.serviceWorker.register(
      "/sw.js",
      {
        scope: "/"
      }
    );

  } catch (error) {

    console.warn(
      "Service worker registration failed:",
      error
    );
  }
}


/**
 * Listen for install prompt.
 *
 * @param {(event:Event)=>void} onAvailable
 */
export function setupInstallPrompt(
  onAvailable
) {

  window.addEventListener(
    "beforeinstallprompt",
    event => {

      event.preventDefault();

      deferredPrompt = event;

      onAvailable?.(event);
    }
  );
}


/**
 * Show browser install prompt.
 *
 * @returns {Promise<boolean>}
 */
export async function installPWA() {

  if (!deferredPrompt) {
    return false;
  }

  deferredPrompt.prompt();

  const result =
    await deferredPrompt.userChoice;

  deferredPrompt = null;

  return result?.outcome === "accepted";
}


/**
 * @returns {boolean}
 */
export function isStandalone() {

  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone === true
  );
}
