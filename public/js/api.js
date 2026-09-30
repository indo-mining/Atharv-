"use strict";

import { CONFIG } from "./config.js";


function buildUrl(path) {

  const base =
    String(CONFIG.API_BASE || "").replace(/\/+$/, "");

  const cleanPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  return `${base}${cleanPath}`;
}


async function parseResponse(response) {

  const text =
    await response.text();

  let data = {};

  try {

    data =
      text
        ? JSON.parse(text)
        : {};

  } catch {

    data = {
      success: false,
      message:
        text ||
        "Invalid server response."
    };
  }


  if (!response.ok) {

    throw new Error(
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}.`
    );
  }


  return data;
}


async function request(
  path,
  options = {}
) {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      CONFIG.API_TIMEOUT || 60000
    );


  try {

    const response =
      await fetch(
        buildUrl(path),
        {
          ...options,
          signal: controller.signal
        }
      );

    return await parseResponse(
      response
    );

  } catch (error) {

    if (
      error?.name === "AbortError"
    ) {

      throw new Error(
        "Atharv server response mein zyada time lag raha hai. Please try again."
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


export async function getVersion() {

  return request(
    "/api/version",
    {
      method: "GET",
      headers: {
        Accept:
          "application/json"
      }
    }
  );
}


export async function sendChat(
  payload
) {

  return request(
    "/api/chat",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json"
      },

      body:
        JSON.stringify(payload)
    }
  );
}


export async function sendResearch(
  payload
) {

  return request(
    "/api/chat/research",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json"
      },

      body:
        JSON.stringify(payload)
    }
  );
}


export async function getMemories() {

  return request(
    "/api/memory",
    {
      method: "GET",

      headers: {
        Accept:
          "application/json"
      }
    }
  );
}


export async function addMemory(
  text
) {

  return request(
    "/api/memory",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json"
      },

      body:
        JSON.stringify({
          memory: text,
          content: text,
          text
        })
    }
  );
}


export async function deleteMemory(
  id
) {

  return request(
    `/api/memory/${encodeURIComponent(id)}`,
    {
      method: "DELETE",

      headers: {
        Accept:
          "application/json"
      }
    }
  );
}
