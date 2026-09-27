"use strict";

import { CONFIG } from "./config.js";

function buildUrl(path) {
  return `${CONFIG.API_BASE}${path}`;
}

async function parseResponse(response) {
  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      success: false,
      message: text || "Invalid server response."
    };
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return data;
}

export async function getVersion() {
  const response = await fetch(buildUrl("/api/version"), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  return parseResponse(response);
}

export async function sendChat(payload) {
  const response = await fetch(buildUrl("/api/chat"), {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },

    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function sendResearch(payload) {
  const response = await fetch(buildUrl("/api/chat/research"), {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },

    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function getMemories() {
  const response = await fetch(buildUrl("/api/memory"), {
    method: "GET",

    headers: {
      Accept: "application/json"
    }
  });

  return parseResponse(response);
}

export async function addMemory(text) {
  const response = await fetch(buildUrl("/api/memory"), {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },

    body: JSON.stringify({
      memory: text,
      content: text,
      text
    })
  });

  return parseResponse(response);
}

export async function deleteMemory(id) {
  const response = await fetch(
    buildUrl(`/api/memory/${encodeURIComponent(id)}`),
    {
      method: "DELETE",

      headers: {
        Accept: "application/json"
      }
    }
  );

  return parseResponse(response);
}
