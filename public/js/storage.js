"use strict";

/*
=========================================================
 ATHARV AI
 FRONTEND CONFIGURATION
 Version 17.0.2
=========================================================
*/


/* ================= STORAGE ================= */

const STORAGE = Object.freeze({

  HISTORY:
    "atharv_chat_history_v17",

  SESSION_ID:
    "atharv_session_id_v17",

  USER_ID:
    "atharv_user_id_v17",

  DRAFT:
    "atharv_draft_v17"

});


/* ================= LIMITS ================= */

const LIMITS = Object.freeze({

  MAX_HISTORY:
    30,

  MAX_MESSAGE_LENGTH:
    12000,

  MAX_FILE_SIZE:
    5 * 1024 * 1024,

  MAX_FILE_TEXT:
    30000

});


/* ================= APP ================= */

const APP = Object.freeze({

  NAME:
    "Atharv AI",

  VERSION:
    "17.0.2"

});


/* ================= CONFIG ================= */

export const CONFIG = Object.freeze({

  API_BASE: "",


  ENDPOINTS: Object.freeze({

    CHAT:
      "/api/chat",

    CHAT_STREAM:
      "/api/chat/stream",

    MEMORY:
      "/api/memory",

    SEARCH:
      "/api/search",

    WEATHER:
      "/api/weather",

    VERSION:
      "/api/version",

    HEALTH:
      "/health"

  }),


  /* Current structure */

  STORAGE:
    STORAGE,


  LIMITS:
    LIMITS,


  APP:
    APP,


  /* Compatibility with older modules */

  STORAGE_KEYS:
    STORAGE,


  MAX_HISTORY_MESSAGES:
    LIMITS.MAX_HISTORY,


  MAX_MESSAGE_LENGTH:
    LIMITS.MAX_MESSAGE_LENGTH,


  MAX_FILE_SIZE:
    LIMITS.MAX_FILE_SIZE,


  VERSION:
    APP.VERSION

});


/* ================= API URL ================= */

export function apiUrl(endpoint) {

  return `${CONFIG.API_BASE}${endpoint}`;

}
