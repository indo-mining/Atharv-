"use strict";

import { CONFIG } from "./config.js";

function safeGet(key, fallback = null) {
  try {
    const value =
      localStorage.getItem(key);

    return value === null
      ? fallback
      : value;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(
      key,
      value
    );

    return true;
  } catch {
    return false;
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}


/* =====================================================
   USER ID
===================================================== */

export function getUserId() {
  let id =
    safeGet(
      CONFIG.STORAGE.USER_ID,
      ""
    );

  if (
    !id ||
    typeof id !== "string"
  ) {
    id =
      crypto?.randomUUID?.() ||
      `atharv_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;

    safeSet(
      CONFIG.STORAGE.USER_ID,
      id
    );
  }

  return id;
}


/* =====================================================
   CHAT HISTORY
===================================================== */

export function getChatHistory() {
  try {
    const raw =
      safeGet(
        CONFIG.STORAGE.CHAT_HISTORY,
        "[]"
      );

    const parsed =
      JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(history) {
  const clean =
    Array.isArray(history)
      ? history.slice(-100)
      : [];

  safeSet(
    CONFIG.STORAGE.CHAT_HISTORY,
    JSON.stringify(clean)
  );
}

export function clearChatHistory() {
  /*
  IMPORTANT:
  This only clears browser chat history.

  It does NOT clear PostgreSQL memory.
  */

  safeRemove(
    CONFIG.STORAGE.CHAT_HISTORY
  );
}


/* =====================================================
   DRAFT
===================================================== */

export function getDraft() {
  return safeGet(
    CONFIG.STORAGE.DRAFT,
    ""
  );
}

export function saveDraft(value) {
  safeSet(
    CONFIG.STORAGE.DRAFT,
    value || ""
  );
}

export function clearDraft() {
  safeRemove(
    CONFIG.STORAGE.DRAFT
  );
}


/* =====================================================
   LIVE MODE
===================================================== */

export function getLiveMode() {
  return (
    safeGet(
      CONFIG.STORAGE.LIVE_MODE,
      "false"
    ) === "true"
  );
}

export function saveLiveMode(value) {
  safeSet(
    CONFIG.STORAGE.LIVE_MODE,
    value
      ? "true"
      : "false"
  );
}
