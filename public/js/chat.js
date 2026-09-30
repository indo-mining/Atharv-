"use strict";

import { CONFIG } from "./config.js";

import {
  sendChat,
  sendResearch
} from "./api.js";

import {
  getUserId,
  getChatHistory,
  saveChatHistory,
  saveDraft,
  clearDraft
} from "./storage.js";


let conversation = [];
let sending = false;
let liveMode = false;


/* =====================================================
   INIT
===================================================== */

export function initChat() {
  conversation =
    getChatHistory();

  if (
    !Array.isArray(conversation)
  ) {
    conversation = [];
  }

  return conversation;
}


/* =====================================================
   STATE
===================================================== */

export function isSending() {
  return sending;
}

export function setLiveMode(value) {
  liveMode =
    Boolean(value);
}

export function getLiveMode() {
  return liveMode;
}


/* =====================================================
   HISTORY
===================================================== */

function cleanHistory() {
  return conversation
    .slice(-CONFIG.MAX_HISTORY_MESSAGES)
    .map(item => ({
      role:
        item.role === "assistant"
          ? "assistant"
          : "user",

      content:
        String(
          item.content || ""
        ).slice(0, 5000)
    }))
    .filter(
      item => item.content.trim()
    );
}


/* =====================================================
   ADD MESSAGE
===================================================== */

export function addMessage(
  role,
  content
) {
  conversation.push({
    role,
    content,
    timestamp:
      Date.now()
  });
}


/* =====================================================
   GET HISTORY
===================================================== */

export function getConversation() {
  return [...conversation];
}


/* =====================================================
   SEND
===================================================== */

export async function sendMessage(
  message,
  options = {}
) {
  const text =
    String(
      message || ""
    ).trim();

  if (!text) {
    throw new Error(
      "Message is empty."
    );
  }

  if (
    text.length >
    CONFIG.MAX_MESSAGE_LENGTH
  ) {
    throw new Error(
      `Message maximum ${CONFIG.MAX_MESSAGE_LENGTH} characters hai.`
    );
  }

  /*
  -------------------------------------------------------
  Duplicate send protection
  -------------------------------------------------------
  */

  if (sending) {
    return null;
  }

  sending = true;

  try {

    /*
    -----------------------------------------------------
    Save user message
    -----------------------------------------------------
    */

    addMessage(
      "user",
      text
    );

    saveChatHistory(
      conversation
    );

    saveDraft("");

    /*
    -----------------------------------------------------
    IMPORTANT:
    userId is automatically included inside api.js
    -----------------------------------------------------
    */

    let result;

    if (
      options.live === true ||
      liveMode === true
    ) {

      result =
        await sendResearch({
          message: text
        });

    } else {

      result =
        await sendChat({
          message: text,
          history:
            cleanHistory()
        });
    }

    /*
    -----------------------------------------------------
    EXTRACT RESPONSE
    -----------------------------------------------------
    */

    const reply =
      extractReply(result);

    if (!reply) {
      throw new Error(
        "Atharv ne empty response diya."
      );
    }

    addMessage(
      "assistant",
      reply
    );

    saveChatHistory(
      conversation
    );

    return {
      reply,
      raw: result
    };

  } finally {
    sending = false;
  }
}


/* =====================================================
   RESPONSE PARSER
===================================================== */

function extractReply(data) {

  if (!data) {
    return "";
  }

  const candidates = [
    data.reply,
    data.response,
    data.message,
    data.answer,
    data.content,
    data.text,

    data.data?.reply,
    data.data?.response,
    data.data?.message,
    data.data?.answer,
    data.data?.content,

    data.result?.reply,
    data.result?.response,
    data.result?.answer,
    data.result?.content
  ];

  for (
    const candidate of candidates
  ) {

    if (
      typeof candidate ===
      "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  /*
  -------------------------------------------------------
  Research APIs sometimes return answer/result.
  -------------------------------------------------------
  */

  if (
    typeof data.result ===
    "string"
  ) {
    return data.result.trim();
  }

  if (
    typeof data.raw ===
    "string"
  ) {
    return data.raw.trim();
  }

  return "";
}


/* =====================================================
   CLEAR CHAT ONLY
===================================================== */

export function clearConversation() {
  conversation = [];

  /*
  IMPORTANT:
  PostgreSQL memory is NOT touched.
  */

  saveChatHistory([]);
}


/* =====================================================
   USER ID
===================================================== */

export function getCurrentUserId() {
  return getUserId();
}
