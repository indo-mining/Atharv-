import { CONFIG } from "./config.js";
import { createId } from "./utils.js";


/**
 * @returns {string}
 */
export function getSessionId() {
  let id = localStorage.getItem(CONFIG.STORAGE.SESSION_ID);

  if (!id) {
    id = createId();
    localStorage.setItem(CONFIG.STORAGE.SESSION_ID, id);
  }

  return id;
}


/**
 * @returns {string}
 */
export function getUserId() {
  let id = localStorage.getItem(CONFIG.STORAGE.USER_ID);

  if (!id) {
    id = getSessionId();

    localStorage.setItem(
      CONFIG.STORAGE.USER_ID,
      id
    );
  }

  return id;
}


/**
 * @returns {Array}
 */
export function getHistory() {
  try {
    const raw = localStorage.getItem(
      CONFIG.STORAGE.HISTORY
    );

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}


/**
 * @param {Array} history
 */
export function saveHistory(history) {
  try {
    const limited = history.slice(
      -CONFIG.LIMITS.MAX_HISTORY
    );

    localStorage.setItem(
      CONFIG.STORAGE.HISTORY,
      JSON.stringify(limited)
    );
  } catch {
    // Storage can fail in private/restricted browsers.
  }
}


/**
 * @param {{role:string,content:string}} message
 */
export function addHistoryMessage(message) {
  const history = getHistory();

  history.push({
    role: message.role,
    content: message.content
  });

  saveHistory(history);
}


/**
 * Clears local chat history.
 */
export function clearHistory() {
  localStorage.removeItem(
    CONFIG.STORAGE.HISTORY
  );
}


/**
 * @param {string} value
 */
export function saveDraft(value) {
  try {
    localStorage.setItem(
      CONFIG.STORAGE.DRAFT,
      value
    );
  } catch {
    // Ignore storage errors.
  }
}


/**
 * @returns {string}
 */
export function getDraft() {
  return localStorage.getItem(
    CONFIG.STORAGE.DRAFT
  ) || "";
}


/**
 * Clears composer draft.
 */
export function clearDraft() {
  localStorage.removeItem(
    CONFIG.STORAGE.DRAFT
  );
}
