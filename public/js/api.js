"use strict";

import { CONFIG } from "./config.js";
import { getUserId } from "./storage.js";


function buildUrl(path) {
  return `${CONFIG.API_BASE}${path}`;
}


/* =====================================================
   REQUEST
===================================================== */

async function request(
  path,
  options = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, CONFIG.API_TIMEOUT);

  try {

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers || {})
    };

    const response =
      await fetch(
        buildUrl(path),
        {
          ...options,
          headers,
          signal:
            controller.signal,

          cache: "no-store",

          credentials: "same-origin"
        }
      );

    const text =
      await response.text();

    let data = {};

    if (text) {
      try {
        data =
          JSON.parse(text);
      } catch {
        data = {
          raw: text
        };
      }
    }

    if (!response.ok) {

      const message =
        data?.error ||
        data?.message ||
        `Server error (${response.status})`;

      throw new Error(
        message
      );
    }

    return data;

  } catch (error) {

    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Atharv took too long to respond. Please try again."
      );
    }

    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Network error. Atharv server se connection nahi ho paaya."
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}


/* =====================================================
   NORMAL CHAT
===================================================== */

export async function sendChat({
  message,
  history
}) {
  return request(
    "/api/chat",
    {
      method: "POST",

      body: JSON.stringify({
        message,
        history:
          Array.isArray(history)
            ? history
            : [],

        chatHistory:
          Array.isArray(history)
            ? history
            : [],

        userId:
          getUserId()
      })
    }
  );
}


/* =====================================================
   LIVE / RESEARCH
===================================================== */

export async function sendResearch({
  message
}) {
  return request(
    "/api/chat/research",
    {
      method: "POST",

      body: JSON.stringify({
        query: message,
        message,

        userId:
          getUserId()
      })
    }
  );
}


/* =====================================================
   MEMORY
===================================================== */

export async function getMemories() {
  return request(
    `/api/memory?userId=${encodeURIComponent(
      getUserId()
    )}`,
    {
      method: "GET"
    }
  );
}

export async function deleteMemory(
  memoryId
) {
  return request(
    `/api/memory/${encodeURIComponent(
      memoryId
    )}`,
    {
      method: "DELETE",

      body: JSON.stringify({
        userId:
          getUserId()
      })
    }
  );
}


/* =====================================================
   VERSION
===================================================== */

export async function getVersion() {
  return request(
    "/api/version",
    {
      method: "GET"
    }
  );
}
