/**
 * Atharv AI Frontend Configuration
 */

export const CONFIG = Object.freeze({
  API_BASE: "",

  ENDPOINTS: Object.freeze({
    CHAT: "/api/chat",
    CHAT_STREAM: "/api/chat/stream",
    MEMORY: "/api/memory",
    SEARCH: "/api/search",
    WEATHER: "/api/weather",
    VERSION: "/api/version",
    HEALTH: "/health"
  }),

  STORAGE: Object.freeze({
    HISTORY: "atharv_chat_history_v17",
    SESSION_ID: "atharv_session_id_v17",
    USER_ID: "atharv_user_id_v17",
    DRAFT: "atharv_draft_v17"
  }),

  LIMITS: Object.freeze({
    MAX_HISTORY: 30,
    MAX_MESSAGE_LENGTH: 12000,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    MAX_FILE_TEXT: 30000
  }),

  APP: Object.freeze({
    NAME: "Atharv AI",
    VERSION: "17.0.0"
  })
});

export function apiUrl(endpoint) {
  return `${CONFIG.API_BASE}${endpoint}`;
}
