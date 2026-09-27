"use strict";

import { CONFIG } from "./config.js";


/* =========================================================
   ATHARV AI STORAGE
   Version 17.0.1
   Compatible with config.js v17
========================================================= */


function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    return JSON.parse(value);

  } catch (error) {

    console.warn(
      "Storage read failed:",
      error
    );

    return fallback;
  }
}


function write(key, value) {
  try {

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;

  } catch (error) {

    console.warn(
      "Storage write failed:",
      error
    );

    return false;
  }
}


/* ================= HISTORY ================= */

export function getHistory() {

  return read(
    CONFIG.STORAGE.HISTORY,
    []
  );
}


export function saveHistory(history) {

  const safeHistory =
    Array.isArray(history)
      ? history.slice(
          0,
          CONFIG.LIMITS.MAX_HISTORY
        )
      : [];

  return write(
    CONFIG.STORAGE.HISTORY,
    safeHistory
  );
}


export function clearHistory() {

  try {

    localStorage.removeItem(
      CONFIG.STORAGE.HISTORY
    );

    return true;

  } catch (error) {

    console.warn(
      "History clear failed:",
      error
    );

    return false;
  }
}


/* ================= DRAFT ================= */

export function getDraft() {

  try {

    return (
      localStorage.getItem(
        CONFIG.STORAGE.DRAFT
      ) || ""
    );

  } catch (error) {

    console.warn(
      "Draft read failed:",
      error
    );

    return "";
  }
}


export function saveDraft(value) {

  try {

    localStorage.setItem(
      CONFIG.STORAGE.DRAFT,
      String(value || "")
    );

  } catch (error) {

    console.warn(
      "Draft save failed:",
      error
    );
  }
}


export function clearDraft() {

  try {

    localStorage.removeItem(
      CONFIG.STORAGE.DRAFT
    );

  } catch (error) {

    console.warn(
      "Draft clear failed:",
      error
    );
  }
}


/* ================= SESSION ================= */

export function getSessionId() {

  return read(
    CONFIG.STORAGE.SESSION_ID,
    null
  );
}


export function saveSessionId(sessionId) {

  if (!sessionId) {
    return false;
  }

  return write(
    CONFIG.STORAGE.SESSION_ID,
    String(sessionId)
  );
}


export function clearSessionId() {

  try {

    localStorage.removeItem(
      CONFIG.STORAGE.SESSION_ID
    );

    return true;

  } catch (error) {

    console.warn(
      "Session clear failed:",
      error
    );

    return false;
  }
}


/* ================= USER ID ================= */

export function getUserId() {

  return read(
    CONFIG.STORAGE.USER_ID,
    null
  );
}


export function saveUserId(userId) {

  if (!userId) {
    return false;
  }

  return write(
    CONFIG.STORAGE.USER_ID,
    String(userId)
  );
}


export function clearUserId() {

  try {

    localStorage.removeItem(
      CONFIG.STORAGE.USER_ID
    );

    return true;

  } catch (error) {

    console.warn(
      "User ID clear failed:",
      error
    );

    return false;
  }
}
