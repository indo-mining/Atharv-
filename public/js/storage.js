"use strict";

import { CONFIG } from "./config.js";

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    return JSON.parse(value);
  } catch (error) {
    console.warn("Storage read failed:", error);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Storage write failed:", error);
    return false;
  }
}

export function getHistory() {
  return read(CONFIG.STORAGE_KEYS.HISTORY, []);
}

export function saveHistory(history) {
  return write(
    CONFIG.STORAGE_KEYS.HISTORY,
    Array.isArray(history)
      ? history.slice(0, CONFIG.MAX_HISTORY_MESSAGES)
      : []
  );
}

export function clearHistory() {
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.HISTORY);
    return true;
  } catch {
    return false;
  }
}

export function getDraft() {
  try {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.DRAFT) || "";
  } catch {
    return "";
  }
}

export function saveDraft(value) {
  try {
    localStorage.setItem(
      CONFIG.STORAGE_KEYS.DRAFT,
      String(value || "")
    );
  } catch (error) {
    console.warn("Draft save failed:", error);
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.DRAFT);
  } catch {
    // Ignore storage errors.
  }
}
