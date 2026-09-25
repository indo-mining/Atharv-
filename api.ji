import {
  CONFIG,
  apiUrl
} from "./config.js";

import {
  getSessionId,
  getUserId
} from "./storage.js";


/**
 * Build standard headers.
 *
 * @returns {Headers}
 */
function buildHeaders() {

  const headers = new Headers();

  headers.set(
    "Content-Type",
    "application/json"
  );

  headers.set(
    "X-Atharv-Session",
    getSessionId()
  );

  headers.set(
    "X-Atharv-User",
    getUserId()
  );

  return headers;
}


/**
 * Generic JSON API request.
 *
 * @param {string} endpoint
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
export async function apiRequest(
  endpoint,
  options = {}
) {

  const headers = buildHeaders();

  if (options.headers) {
    Object.entries(options.headers).forEach(
      ([key, value]) => {
        headers.set(key, value);
      }
    );
  }

  const response = await fetch(
    apiUrl(endpoint),
    {
      ...options,
      headers
    }
  );

  const contentType =
    response.headers.get("content-type") || "";

  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {

    const message =
      typeof data === "object"
        ? data.error ||
          data.message ||
          `Request failed (${response.status})`
        : data ||
          `Request failed (${response.status})`;

    const error = new Error(message);

    error.status = response.status;

    throw error;
  }

  return data;
}


/**
 * @param {string} message
 * @param {Array} history
 * @param {string} languageInstruction
 * @returns {Promise<any>}
 */
export function chat(
  message,
  history,
  languageInstruction
) {

  return apiRequest(
    CONFIG.ENDPOINTS.CHAT,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        history,
        languageInstruction,
        userId: getUserId()
      })
    }
  );
}


/**
 * Streaming chat.
 *
 * @param {string} message
 * @param {Array} history
 * @param {string} languageInstruction
 * @param {(text:string)=>void} onDelta
 * @param {(meta:any)=>void} onDone
 * @returns {Promise<void>}
 */
export async function chatStream(
  message,
  history,
  languageInstruction,
  onDelta,
  onDone
) {

  const headers = buildHeaders();

  const response = await fetch(
    apiUrl(CONFIG.ENDPOINTS.CHAT_STREAM),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        history,
        languageInstruction,
        userId: getUserId()
      })
    }
  );

  if (!response.ok) {

    let messageText =
      `Request failed (${response.status})`;

    try {
      const data = await response.json();

      messageText =
        data.error ||
        data.message ||
        messageText;

    } catch {
      // Ignore JSON parsing failure.
    }

    const error = new Error(messageText);

    error.status = response.status;

    throw error;
  }

  if (!response.body) {
    throw new Error(
      "Streaming response is not supported by this browser."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  while (true) {

    const {
      value,
      done
    } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(
      value,
      { stream: true }
    );

    const lines =
      buffer.split("\n");

    buffer = lines.pop() || "";

    for (const rawLine of lines) {

      const line = rawLine.trim();

      if (!line.startsWith("data:")) {
        continue;
      }

      const payload =
        line.slice(5).trim();

      if (!payload) {
        continue;
      }

      let data;

      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }

      if (data.type === "delta") {

        onDelta(
          String(data.content || "")
        );

      } else if (data.type === "done") {

        onDone?.(data);

      } else if (data.type === "error") {

        throw new Error(
          data.error ||
          "Atharv could not generate a response."
        );
      }
    }
  }
}


/**
 * @returns {Promise<any>}
 */
export function getMemory() {

  return apiRequest(
    CONFIG.ENDPOINTS.MEMORY +
      `?userId=${encodeURIComponent(getUserId())}`
  );
}


/**
 * @param {string} memory
 * @returns {Promise<any>}
 */
export function saveMemory(memory) {

  return apiRequest(
    CONFIG.ENDPOINTS.MEMORY,
    {
      method: "POST",
      body: JSON.stringify({
        userId: getUserId(),
        memory
      })
    }
  );
}


/**
 * @returns {Promise<any>}
 */
export function getVersion() {
  return apiRequest(
    CONFIG.ENDPOINTS.VERSION
  );
}
