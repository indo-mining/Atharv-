"use strict";

import { CONFIG } from "./config.js";

import {
  sendChat,
  sendResearch
} from "./api.js";

import {
  appendUserMessage,
  appendAssistantMessage,
  showThinking,
  removeThinking,
  setSending,
  showError,
  hideError,
  clearMessages,
  showWelcome
} from "./ui.js";

import {
  getHistory,
  saveHistory,
  clearDraft
} from "./storage.js";

import {
  createId
} from "./utils.js";


let currentChatId = null;

let conversation = [];

let sending = false;


function getAssistantText(data) {

  if (!data) {
    return "";
  }


  return (
    data.reply ||
    data.response ||
    data.message ||
    data.answer ||
    data.content ||
    data.data?.reply ||
    data.data?.response ||
    ""
  );
}


function cleanHistory() {

  return conversation
    .filter(
      item =>
        item &&
        (
          item.role === "user" ||
          item.role === "assistant"
        ) &&
        typeof item.content === "string"
    )
    .slice(
      -(
        CONFIG.MAX_HISTORY_MESSAGES ||
        CONFIG.LIMITS?.MAX_HISTORY_MESSAGES ||
        12
      )
    );
}


function saveCurrentChat() {

  if (!conversation.length) {
    return;
  }


  const firstUser =
    conversation.find(
      item =>
        item.role === "user"
    );


  const title =
    firstUser?.content?.trim() ||
    "New chat";


  const history =
    getHistory();


  const item = {

    id:
      currentChatId ||
      createId("chat"),

    title:
      title.slice(0, 80),

    messages:
      cleanHistory(),

    updatedAt:
      Date.now()

  };


  currentChatId =
    item.id;


  const filtered =
    history.filter(
      entry =>
        entry.id !== item.id
    );


  filtered.unshift(item);

  saveHistory(filtered);
}


function buildPayload(
  message,
  options = {}
) {

  const history =
    cleanHistory();


  return {

    message,

    history,

    chatHistory:
      history,

    research:
      Boolean(options.research),

    mode:
      options.research
        ? "live"
        : "chat"

  };
}


export async function sendMessage(
  message,
  options = {}
) {

  const text =
    String(message || "").trim();


  if (!text) {
    return;
  }


  if (sending) {
    return;
  }


  const maxLength =
    CONFIG.MAX_MESSAGE_LENGTH ||
    CONFIG.LIMITS?.MAX_MESSAGE_LENGTH ||
    12000;


  if (
    text.length >
    maxLength
  ) {

    showError(
      `Message is too long. Maximum ${maxLength} characters.`
    );

    return;
  }


  sending = true;

  hideError();


  appendUserMessage(
    text
  );


  conversation.push({
    role: "user",
    content: text
  });


  setSending(true);


  const thinking =
    showThinking();


  try {

    const payload =
      buildPayload(
        text,
        options
      );


    let data;


    if (
      options.research ||
      options.mode === "live"
    ) {

      data =
        await sendResearch(
          payload
        );

    } else {

      data =
        await sendChat(
          payload
        );
    }


    removeThinking(
      thinking
    );


    const reply =
      getAssistantText(
        data
      );


    if (!reply) {

      throw new Error(
        "Atharv did not return a response."
      );
    }


    appendAssistantMessage(
      reply
    );


    conversation.push({

      role:
        "assistant",

      content:
        reply

    });


    conversation =
      cleanHistory();


    saveCurrentChat();

    clearDraft();


  } catch (error) {

    removeThinking(
      thinking
    );


    console.error(
      "CHAT ERROR:",
      error
    );


    showError(
      error?.message ||
      "Response nahi mil paaya. Please try again."
    );

  } finally {

    setSending(false);

    sending = false;
  }
}


export function startNewChat() {

  currentChatId = null;

  conversation = [];

  clearMessages();

  hideError();

  clearDraft();


  const input =
    document.querySelector(
      "#messageInput"
    );


  if (input) {

    input.value = "";

    input.focus();
  }
}


export function loadChat(
  chat
) {

  if (!chat) {
    return;
  }


  currentChatId =
    chat.id;


  conversation =
    Array.isArray(
      chat.messages
    )
      ? chat.messages.slice()
      : [];


  clearMessages();


  for (
    const message
    of conversation
  ) {

    if (
      message.role === "user"
    ) {

      appendUserMessage(
        message.content
      );

    } else if (
      message.role === "assistant"
    ) {

      appendAssistantMessage(
        message.content
      );
    }
  }


  showWelcome(
    conversation.length === 0
  );
}
