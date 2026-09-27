"use strict";

import { CONFIG } from "./config.js";

import {
  $,
  $all,
  debounce
} from "./utils.js";

import {
  getHistory,
  clearHistory,
  getDraft,
  saveDraft
} from "./storage.js";

import {
  renderHistory,
  hideError,
  showError,
  showAttachment,
  hideAttachment
} from "./ui.js";

import {
  sendMessage,
  startNewChat,
  loadChat
} from "./chat.js";

import {
  openMemory,
  closeMemory,
  addMemory,
  deleteMemory
} from "./memory.js";

import {
  registerPWA,
  setupInstallPrompt,
  installPWA
} from "./pwa.js";

import {
  getVersion
} from "./api.js";


let selectedFile = null;


/* ================= INITIALIZATION ================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);

async function init() {
  console.log(
    `Atharv AI frontend ${CONFIG.VERSION} starting...`
  );

  bindEvents();

  restoreDraft();

  renderHistory(
    getHistory()
  );

  registerPWA();

  setupInstallPrompt();

  updateVersion();

  setupTextarea();

  setupSuggestionButtons();

  console.log("Atharv AI frontend ready.");
}


/* ================= EVENTS ================= */

function bindEvents() {

  document.addEventListener(
    "click",
    handleGlobalClick
  );

  $("#chatForm")?.addEventListener(
    "submit",
    handleSubmit
  );

  $("#fileInput")?.addEventListener(
    "change",
    handleFileChange
  );

  $("#messageInput")?.addEventListener(
    "input",
    handleDraftInput
  );

  $("#messageInput")?.addEventListener(
    "keydown",
    handleInputKeydown
  );

  $("#memoryModal")?.addEventListener(
    "click",
    (event) => {
      if (
        event.target.id === "memoryModal"
      ) {
        closeMemory();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        closeMemory();
        closeDrawer();
      }
    }
  );
}


/* ================= GLOBAL CLICK ================= */

async function handleGlobalClick(event) {

  const actionElement =
    event.target.closest(
      "[data-action]"
    );

  if (actionElement) {

    const action =
      actionElement.dataset.action;

    switch (action) {

      case "new-chat":
        startNewChat();
        closeDrawer();
        return;

      case "home":
        startNewChat();
        closeDrawer();
        return;

      case "memory":
        openMemory();
        closeDrawer();
        return;

      case "close-memory":
        closeMemory();
        return;

      case "add-memory":
        await addMemory();
        return;

      case "open-drawer":
        openDrawer();
        return;

      case "close-drawer":
        closeDrawer();
        return;

      case "install":
        await installPWA();
        return;

      case "clear-history":
        handleClearHistory();
        return;

      case "attach":
        $("#fileInput")?.click();
        return;

      case "remove-attachment":
        removeSelectedFile();
        return;
    }
  }


  const suggestion =
    event.target.closest(
      "[data-suggestion]"
    );

  if (suggestion) {

    const text =
      suggestion.dataset.suggestion;

    const input =
      $("#messageInput");

    if (input) {
      input.value = text;
      input.focus();
    }

    return;
  }


  const historyButton =
    event.target.closest(
      "[data-history-id]"
    );

  if (historyButton) {

    const id =
      historyButton.dataset.historyId;

    openHistoryChat(id);

    closeDrawer();

    return;
  }


  const memoryDelete =
    event.target.closest(
      "[data-memory-delete]"
    );

  if (memoryDelete) {

    const id =
      memoryDelete.dataset.memoryDelete;

    if (
      window.confirm(
        "Delete this memory?"
      )
    ) {
      await deleteMemory(id);
    }

    return;
  }


  const copyButton =
    event.target.closest(
      ".copy-code"
    );

  if (copyButton) {

    const encoded =
      copyButton.dataset.code;

    try {
      const code =
        decodeURIComponent(encoded);

      await navigator.clipboard.writeText(
        code
      );

      copyButton.textContent = "Copied";

      setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1200);

    } catch {
      copyButton.textContent = "Failed";
    }

    return;
  }


  if (
    event.target.matches(
      "[data-drawer-overlay]"
    )
  ) {
    closeDrawer();
  }
}


/* ================= CHAT ================= */

async function handleSubmit(event) {

  event.preventDefault();

  const input =
    $("#messageInput");

  if (!input) return;

  const message =
    input.value.trim();

  if (!message) return;

  if (
    message.length >
    CONFIG.MAX_MESSAGE_LENGTH
  ) {
    showError(
      `Maximum ${CONFIG.MAX_MESSAGE_LENGTH} characters allowed.`
    );

    return;
  }

  input.value = "";

  autoResizeTextarea();

  hideError();

  await sendMessage(
    message,
    {
      file: selectedFile
    }
  );

  removeSelectedFile();
}


/* ================= DRAFT ================= */

const saveDraftDebounced =
  debounce(
    (value) => saveDraft(value),
    250
  );

function handleDraftInput(event) {
  saveDraftDebounced(
    event.target.value
  );

  autoResizeTextarea();
}

function restoreDraft() {

  const input =
    $("#messageInput");

  if (!input) return;

  const draft =
    getDraft();

  if (draft) {
    input.value = draft;
    autoResizeTextarea();
  }
}


/* ================= KEYBOARD ================= */

function handleInputKeydown(event) {

  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {

    event.preventDefault();

    $("#chatForm")?.requestSubmit();
  }
}


/* ================= TEXTAREA ================= */

function setupTextarea() {
  autoResizeTextarea();
}

function autoResizeTextarea() {

  const textarea =
    $("#messageInput");

  if (!textarea) return;

  textarea.style.height = "auto";

  textarea.style.height =
    `${Math.min(
      textarea.scrollHeight,
      150
    )}px`;
}


/* ================= SUGGESTIONS ================= */

function setupSuggestionButtons() {

  $all(
    "[data-suggestion]"
  ).forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const input =
          $("#messageInput");

        if (!input) return;

        input.value =
          button.dataset.suggestion;

        input.focus();

        autoResizeTextarea();
      }
    );
  });
}


/* ================= FILE ================= */

function handleFileChange(event) {

  const file =
    event.target.files?.[0];

  if (!file) {
    removeSelectedFile();
    return;
  }

  if (
    file.size >
    CONFIG.MAX_FILE_SIZE
  ) {

    showError(
      "File is too large. Maximum file size is 10 MB."
    );

    event.target.value = "";

    return;
  }

  selectedFile = file;

  showAttachment(file);
}

function removeSelectedFile() {

  selectedFile = null;

  const input =
    $("#fileInput");

  if (input) {
    input.value = "";
  }

  hideAttachment();
}


/* ================= HISTORY ================= */

function openHistoryChat(id) {

  const history =
    getHistory();

  const chat =
    history.find(
      (item) => item.id === id
    );

  if (!chat) return;

  loadChat(chat);

  renderHistory(
    history,
    id
  );
}

function handleClearHistory() {

  const confirmed =
    window.confirm(
      "Clear all recent chats from this device?"
    );

  if (!confirmed) return;

  clearHistory();

  renderHistory([]);

  startNewChat();
}


/* ================= DRAWER ================= */

function openDrawer() {

  const drawer =
    $("#drawer");

  const overlay =
    $("#drawerOverlay");

  drawer?.classList.add(
    "open"
  );

  overlay?.classList.add(
    "open"
  );
}

function closeDrawer() {

  const drawer =
    $("#drawer");

  const overlay =
    $("#drawerOverlay");

  drawer?.classList.remove(
    "open"
  );

  overlay?.classList.remove(
    "open"
  );
}


/* ================= VERSION ================= */

async function updateVersion() {

  const element =
    $("#version");

  if (!element) return;

  try {

    const data =
      await getVersion();

    if (
      data?.version
    ) {
      element.textContent =
        `v${data.version}`;
    }

  } catch (error) {

    console.warn(
      "Version check failed:",
      error
    );

    element.textContent =
      `v${CONFIG.VERSION}`;
  }
}
