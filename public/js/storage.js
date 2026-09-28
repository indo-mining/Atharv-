"use strict";

import { CONFIG } from "./config.js";

/*
=========================================================
 ATHARV AI
 STORAGE MODULE
 Version 17.0.1
 --------------------------------------------------------
 Compatible with:
 - config.js v17
 - app.js v17
 - Local chat history
 - Draft messages
 - Session ID
 - User ID
=========================================================
*/


/* ======================================================
   SAFE READ
====================================================== */

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


/* ======================================================
   SAFE WRITE
====================================================== */

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


/* ======================================================
   CHAT HISTORY
====================================================== */

export function getHistory() {

  const history = read(
    CONFIG.STORAGE.HISTORY,
    []
  );

  return Array.isArray(history)
    ? history
    : [];
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


/* ======================================================
   DRAFT
====================================================== */

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

    return true;

  } catch (error) {

    console.warn(
      "Draft save failed:",
      error
    );

    return false;
  }
}


export function clearDraft() {

  try {

    localStorage.removeItem(
      CONFIG.STORAGE.DRAFT
    );

    return true;

  } catch (error) {

    console.warn(
      "Draft clear failed:",
      error
    );

    return false;
  }
}


/* ======================================================
   SESSION ID
====================================================== */

export function getSessionId() {

  try {

    return (
      localStorage.getItem(
        CONFIG.STORAGE.SESSION_ID
      ) || ""
    );

  } catch (error) {

    console.warn(
      "Session ID read failed:",
      error
    );

    return "";
  }
}


export function saveSessionId(sessionId) {

  if (!sessionId) {
    return false;
  }

  try {

    localStorage.setItem(
      CONFIG.STORAGE.SESSION_ID,
      String(sessionId)
    );

    return true;

  } catch (error) {

    console.warn(
      "Session ID save failed:",
      error
    );

    return false;
  }
}


export function clearSessionId() {

  try {

    localStorage.removeItem(
      CONFIG.STORAGE.SESSION_ID
    );

    return true;

  } catch (error) {

    console.warn(
      "Session ID clear failed:",
      error
    );

    return false;
  }
}


/* ======================================================
   USER ID
====================================================== */

export function getUserId() {

  try {

    return (
      localStorage.getItem(
        CONFIG.STORAGE.USER_ID
      ) || ""
    );

  } catch (error) {

    console.warn(
      "User ID read failed:",
      error
    );

    return "";
  }
}


export function saveUserId(userId) {

  if (!userId) {
    return false;
  }

  try {

    localStorage.setItem(
      CONFIG.STORAGE.USER_ID,
      String(userId)
    );

    return true;

  } catch (error) {

    console.warn(
      "User ID save failed:",
      error
    );

    return false;
  }
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
