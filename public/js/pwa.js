"use strict";

import { $ } from "./utils.js";
import { CONFIG } from "./config.js";

let deferredPrompt = null;

export function registerPWA() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register(
        "/sw.js",
        {
          scope: "/"
        }
      );

      console.log("Atharv PWA service worker registered.");
    } catch (error) {
      console.warn(
        "PWA registration failed:",
        error
      );
    }
  });
}

export function setupInstallPrompt() {
  const button = $("#installButton");

  window.addEventListener(
    "beforeinstallprompt",
    (event) => {
      event.preventDefault();

      deferredPrompt = event;

      if (button) {
        button.hidden = false;
      }
    }
  );

  window.addEventListener(
    "appinstalled",
    () => {
      deferredPrompt = null;

      if (button) {
        button.hidden = true;
      }

      localStorage.setItem(
        CONFIG.STORAGE_KEYS.INSTALL_DISMISSED,
        "1"
      );
    }
  );
}

export async function installPWA() {
  if (!deferredPrompt) {
    return false;
  }

  deferredPrompt.prompt();

  const result =
    await deferredPrompt.userChoice;

  deferredPrompt = null;

  const button = $("#installButton");

  if (button) {
    button.hidden = true;
  }

  return result?.outcome === "accepted";
}
