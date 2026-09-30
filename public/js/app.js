"use strict";

import { CONFIG } from "./config.js";

import {
  getChatHistory,
  saveDraft,
  getDraft,
  clearDraft,
  getLiveMode,
  saveLiveMode
} from "./storage.js";

import {
  initChat,
  sendMessage,
  isSending,
  setLiveMode,
  getConversation
} from "./chat.js";

import {
  renderHistory,
  renderMessage,
  showThinking,
  removeThinking,
  setSending,
  showToast
} from "./ui.js";

import {
  loadMemories
} from "./memory.js";

import {
  registerPWA
} from "./pwa.js";

import {
  autoResizeTextarea,
  getSelectedFile
} from "./utils.js";


/* =====================================================
   DOM
===================================================== */

const form =
  document.getElementById(
    "chatForm"
  );

const input =
  document.getElementById(
    "messageInput"
  );

const sendButton =
  document.getElementById(
    "sendButton"
  );

const liveButton =
  document.getElementById(
    "liveButton"
  );

const modeLabel =
  document.getElementById(
    "modeLabel"
  );

const newChatButton =
  document.getElementById(
    "newChatButton"
  );

const attachButton =
  document.getElementById(
    "attachButton"
  );

const fileInput =
  document.getElementById(
    "fileInput"
  );

const filePreview =
  document.getElementById(
    "filePreview"
  );

const memoryButton =
  document.getElementById(
    "memoryButton"
  );

const memoryModal =
  document.getElementById(
    "memoryModal"
  );

const closeMemoryButton =
  document.getElementById(
    "closeMemoryButton"
  );

const closeMemoryButton2 =
  document.getElementById(
    "closeMemoryButton2"
  );

const memoryList =
  document.getElementById(
    "memoryList"
  );


/* =====================================================
   START
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  init
);


function init() {

  console.log(
    "================================"
  );

  console.log(
    "ATHARV AI FRONTEND 17.0.2"
  );

  console.log(
    "================================"
  );

  /*
  -------------------------------------------------------
  Restore local chat
  -------------------------------------------------------
  */

  initChat();

  renderHistory(
    getConversation()
  );

  /*
  -------------------------------------------------------
  Restore draft
  -------------------------------------------------------
  */

  const draft =
    getDraft();

  if (input && draft) {
    input.value =
      draft;

    autoResizeTextarea(
      input
    );
  }

  /*
  -------------------------------------------------------
  Restore live mode
  -------------------------------------------------------
  */

  const live =
    getLiveMode();

  setLiveMode(
    live
  );

  updateLiveUI(
    live
  );

  /*
  -------------------------------------------------------
  Bind events
  -------------------------------------------------------
  */

  bindEvents();

  /*
  -------------------------------------------------------
  PWA
  -------------------------------------------------------
  */

  registerPWA();

  console.log(
    "Atharv frontend initialized."
  );
}


/* =====================================================
   EVENTS
===================================================== */

function bindEvents() {

  /*
  -------------------------------------------------------
  FORM SUBMIT
  -------------------------------------------------------
  */

  if (form) {

    form.addEventListener(
      "submit",
      handleSubmit
    );
  }


  /*
  -------------------------------------------------------
  ENTER KEY
  -------------------------------------------------------
  */

  if (input) {

    input.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter" &&
          !event.shiftKey
        ) {

          event.preventDefault();

          if (
            !isSending()
          ) {
            form?.requestSubmit();
          }
        }
      }
    );


    input.addEventListener(
      "input",
      () => {

        autoResizeTextarea(
          input
        );

        saveDraft(
          input.value
        );
      }
    );
  }


  /*
  -------------------------------------------------------
  SEND BUTTON FALLBACK
  -------------------------------------------------------
  */

  if (sendButton) {

    sendButton.addEventListener(
      "click",
      event => {

        /*
        ---------------------------------------------------
        If browser somehow doesn't submit form,
        explicitly submit it.
        ---------------------------------------------------
        */

        if (
          event.defaultPrevented
        ) {
          return;
        }

        if (
          form &&
          !isSending()
        ) {
          /*
          Normal type="submit" handles this.
          No manual duplicate request.
          */
        }
      }
    );
  }


  /*
  -------------------------------------------------------
  LIVE
  -------------------------------------------------------
  */

  liveButton?.addEventListener(
    "click",
    toggleLive
  );


  /*
  -------------------------------------------------------
  NEW CHAT
  -------------------------------------------------------
  */

  newChatButton?.addEventListener(
    "click",
    startNewChat
  );


  /*
  -------------------------------------------------------
  ATTACHMENT
  -------------------------------------------------------
  */

  attachButton?.addEventListener(
    "click",
    () => {
      fileInput?.click();
    }
  );


  fileInput?.addEventListener(
    "change",
    handleFile
  );


  /*
  -------------------------------------------------------
  MEMORY
  -------------------------------------------------------
  */

  memoryButton?.addEventListener(
    "click",
    openMemory
  );

  closeMemoryButton?.addEventListener(
    "click",
    closeMemory
  );

  closeMemoryButton2?.addEventListener(
    "click",
    closeMemory
  );


  memoryModal?.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        memoryModal
      ) {
        closeMemory();
      }
    }
  );


  /*
  -------------------------------------------------------
  SUGGESTIONS
  -------------------------------------------------------
  */

  document
    .querySelectorAll(
      ".suggestion"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const message =
            button.dataset.message ||
            "";

          const live =
            button.dataset.live ===
            "true";

          if (input) {
            input.value =
              message;

            autoResizeTextarea(
              input
            );
          }

          await performSend(
            message,
            live
          );
        }
      );
    });
}


/* =====================================================
   SUBMIT
===================================================== */

async function handleSubmit(
  event
) {
  event.preventDefault();

  /*
  IMPORTANT:
  Never allow browser GET navigation like:

  /?message=hello
  */

  if (
    event.cancelable
  ) {
    event.preventDefault();
  }

  if (
    isSending()
  ) {
    return;
  }

  const message =
    input?.value?.trim() ||
    "";

  if (!message) {
    showToast(
      "Pehle message type karo."
    );

    input?.focus();

    return;
  }

  await performSend(
    message,
    getLiveMode()
  );
}


/* =====================================================
   PERFORM SEND
===================================================== */

async function performSend(
  message,
  live
) {

  if (
    isSending()
  ) {
    return;
  }

  const text =
    String(
      message || ""
    ).trim();

  if (!text) {
    return;
  }

  if (
    text.length >
    CONFIG.MAX_MESSAGE_LENGTH
  ) {
    showToast(
      `Maximum ${CONFIG.MAX_MESSAGE_LENGTH} characters allowed.`
    );

    return;
  }


  /*
  -------------------------------------------------------
  UI
  -------------------------------------------------------
  */

  if (input) {
    input.value =
      "";

    autoResizeTextarea(
      input
    );
  }

  clearDraft();

  setSending(
    true
  );

  /*
  -------------------------------------------------------
  Immediately show user message
  -------------------------------------------------------
  */

  renderMessage(
    "user",
    text
  );

  /*
  -------------------------------------------------------
  Thinking
  -------------------------------------------------------
  */

  showThinking();


  try {

    /*
    -----------------------------------------------------
    IMPORTANT:
    Actual API call happens here.
    -----------------------------------------------------
    */

    const result =
      await sendMessage(
        text,
        {
          live
        }
      );

    removeThinking();

    if (
      !result ||
      !result.reply
    ) {
      throw new Error(
        "Atharv ne response nahi diya."
      );
    }

    renderMessage(
      "assistant",
      result.reply
    );

  } catch (error) {

    console.error(
      "ATHARV SEND ERROR:",
      error
    );

    removeThinking();

    renderMessage(
      "assistant",
      `⚠️ ${error?.message || "Atharv response nahi de paaya."}`
    );

    showToast(
      error?.message ||
      "Message send nahi ho paaya."
    );

  } finally {

    setSending(
      false
    );

    input?.focus();
  }
}


/* =====================================================
   LIVE MODE
===================================================== */

function toggleLive() {

  const next =
    !getLiveMode();

  setLiveMode(
    next
  );

  saveLiveMode(
    next
  );

  updateLiveUI(
    next
  );

  showToast(
    next
      ? "Live mode ON"
      : "Live mode OFF"
  );
}


function updateLiveUI(
  active
) {

  liveButton?.classList.toggle(
    "active",
    active
  );

  liveButton?.setAttribute(
    "aria-pressed",
    String(active)
  );

  if (modeLabel) {
    modeLabel.textContent =
      active
        ? "Live mode — current information"
        : "Normal mode";
  }
}


/* =====================================================
   NEW CHAT
===================================================== */

function startNewChat() {

  /*
  IMPORTANT:
  Only local conversation is cleared.

  PostgreSQL memory remains untouched.
  */

  const confirmed =
    window.confirm(
      "New chat start karein?\n\nSaved AI memory delete nahi hogi."
    );

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(
    CONFIG.STORAGE.CHAT_HISTORY
  );

  window.location.reload();
}


/* =====================================================
   FILE
===================================================== */

function handleFile() {

  const file =
    getSelectedFile(
      fileInput
    );

  if (!file) {
    filePreview?.classList.add(
      "hidden"
    );

    return;
  }

  if (
    file.size >
    5 * 1024 * 1024
  ) {

    showToast(
      "File maximum 5 MB honi chahiye."
    );

    fileInput.value =
      "";

    return;
  }

  if (filePreview) {

    filePreview.textContent =
      `Attached: ${file.name}`;

    filePreview.classList.remove(
      "hidden"
    );
  }
}


/* =====================================================
   MEMORY
===================================================== */

async function openMemory() {

  if (!memoryModal) {
    return;
  }

  memoryModal.classList.remove(
    "hidden"
  );

  memoryModal.setAttribute(
    "aria-hidden",
    "false"
  );

  await loadMemories(
    memoryList
  );
}


function closeMemory() {

  memoryModal?.classList.add(
    "hidden"
  );

  memoryModal?.setAttribute(
    "aria-hidden",
    "true"
  );
}
