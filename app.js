"use strict";

/*
=========================================================
 ATHARV AI FRONTEND
 app.js
 Version 17.1.0
 --------------------------------------------------------
 Compatible with:
 - Modular Backend v17+
 - Modular Frontend
 - Chat
 - Memory
 - Attachments
 - Suggestions
 - Chat History
 - Draft Saving
 - PWA
 - Streaming-ready chat module
=========================================================
*/

/*
=========================================================
 IMPORTS
=========================================================
*/

import { CONFIG } from "./config.js";

import {
  getHistory,
  getDraft,
  saveDraft,
  clearDraft
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
  startNewChat
} from "./chat.js";

import {
  openMemory,
  closeMemory,
  addMemory
} from "./memory.js";

import {
  registerPWA,
  setupInstallPrompt,
  installPWA
} from "./pwa.js";

import {
  getVersion
} from "./api.js";

import {
  $
} from "./utils.js";


/*
=========================================================
 GLOBAL STATE
=========================================================
*/

const state = {
  selectedFile: null,
  selectedFileData: null,
  isSending: false,
  currentView: "home",
  installAvailable: false
};


/*
=========================================================
 DOM HELPERS
=========================================================
*/

function el(...selectors) {
  for (const selector of selectors) {
    const node = $(selector);

    if (node) {
      return node;
    }
  }

  return null;
}

function all(selector) {
  return Array.from(
    document.querySelectorAll(selector)
  );
}

function on(element, event, handler) {
  if (!element) return;

  element.addEventListener(event, handler);
}


/*
=========================================================
 ELEMENTS
=========================================================
*/

const elements = {
  form: el(
    "#chatForm",
    "#messageForm",
    "form[data-chat-form]"
  ),

  input: el(
    "#messageInput",
    "#chatInput",
    "textarea[name='message']",
    "input[name='message']"
  ),

  sendButton: el(
    "#sendButton",
    "#sendBtn",
    "button[type='submit']"
  ),

  messages: el(
    "#messages",
    "#chatMessages",
    "#chatContainer",
    "[data-chat-messages]"
  ),

  newChat: el(
    "#newChat",
    "#newChatBtn",
    "[data-action='new-chat']"
  ),

  clearHistory: el(
    "#clearHistory",
    "#clearHistoryBtn",
    "[data-action='clear-history']"
  ),

  history: el(
    "#history",
    "#chatHistory",
    "[data-chat-history]"
  ),

  drawer: el(
    "#drawer",
    "#sidebar",
    "[data-drawer]"
  ),

  drawerOverlay: el(
    "#drawerOverlay",
    "[data-drawer-overlay]"
  ),

  menuButton: el(
    "#menuButton",
    "#menuBtn",
    "[data-action='open-drawer']"
  ),

  closeDrawer: el(
    "#closeDrawer",
    "#closeMenu",
    "[data-action='close-drawer']"
  ),

  attachButton: el(
    "#attachButton",
    "#attachBtn",
    "[data-action='attach']"
  ),

  fileInput: el(
    "#fileInput",
    "#attachmentInput",
    "input[type='file']"
  ),

  attachment: el(
    "#attachment",
    "#attachmentPreview",
    "[data-attachment]"
  ),

  removeAttachment: el(
    "#removeAttachment",
    "#removeFile",
    "[data-action='remove-attachment']"
  ),

  memoryButton: el(
    "#memoryButton",
    "#memoryBtn",
    "[data-action='memory']"
  ),

  memoryModal: el(
    "#memoryModal",
    "[data-memory-modal]"
  ),

  memoryClose: el(
    "#memoryClose",
    "#closeMemory",
    "[data-action='close-memory']"
  ),

  memoryInput: el(
    "#memoryInput",
    "#newMemory",
    "textarea[name='memory']"
  ),

  memoryAdd: el(
    "#memoryAdd",
    "#addMemory",
    "[data-action='add-memory']"
  ),

  installButton: el(
    "#installButton",
    "#installBtn",
    "[data-action='install']"
  ),

  version: el(
    "#version",
    "#appVersion",
    "[data-version]"
  ),

  homeButton: el(
    "#homeButton",
    "#homeBtn",
    "[data-action='home']"
  )
};


/*
=========================================================
 INITIALIZATION
=========================================================
*/

async function init() {
  try {
    setupUI();

    restoreDraft();

    restoreHistory();

    setupNavigation();

    setupChat();

    setupAttachment();

    setupMemory();

    setupDrawer();

    setupSuggestions();

    setupCopyButtons();

    setupPWA();

    loadVersion();

    hideError();

    focusInput();

    console.log(
      "Atharv AI frontend initialized."
    );
  } catch (error) {
    console.error(
      "Atharv initialization error:",
      error
    );

    showError(
      "Atharv start nahi ho paaya. Page refresh karke dobara try karein."
    );
  }
}


/*
=========================================================
 BASIC UI
=========================================================
*/

function setupUI() {
  document.documentElement.setAttribute(
    "data-atharv-ready",
    "true"
  );

  document.body.classList.add(
    "atharv-ready"
  );
}


/*
=========================================================
 CHAT SETUP
=========================================================
*/

function setupChat() {
  on(
    elements.form,
    "submit",
    async (event) => {
      event.preventDefault();

      await handleSend();
    }
  );

  on(
    elements.input,
    "keydown",
    async (event) => {
      /*
      -----------------------------------------------------
      Enter = Send
      Shift + Enter = New Line
      -----------------------------------------------------
      */

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();

        await handleSend();
      }
    }
  );

  on(
    elements.input,
    "input",
    () => {
      saveCurrentDraft();
      autoResizeInput();
    }
  );

  on(
    elements.sendButton,
    "click",
    async (event) => {
      /*
      Prevent duplicate handling when the button
      is inside a form.
      */

      if (!elements.form) {
        event.preventDefault();

        await handleSend();
      }
    }
  );
}


/*
=========================================================
 SEND MESSAGE
=========================================================
*/

async function handleSend() {
  if (state.isSending) {
    return;
  }

  if (!elements.input) {
    return;
  }

  const message =
    String(elements.input.value || "").trim();

  if (!message && !state.selectedFile) {
    focusInput();
    return;
  }

  state.isSending = true;

  setSendingState(true);

  hideError();

  try {
    const result = await sendMessage({
      message,
      file: state.selectedFile,
      fileData: state.selectedFileData
    });

    /*
    -------------------------------------------------------
    Clear input only after successful send
    -------------------------------------------------------
    */

    if (result !== false) {
      elements.input.value = "";

      clearDraft();

      removeSelectedFile();

      autoResizeInput();
    }
  } catch (error) {
    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    showError(
      getReadableError(error)
    );
  } finally {
    state.isSending = false;

    setSendingState(false);

    focusInput();
  }
}


/*
=========================================================
 SENDING UI
=========================================================
*/

function setSendingState(sending) {
  if (elements.sendButton) {
    elements.sendButton.disabled = sending;

    elements.sendButton.classList.toggle(
      "sending",
      sending
    );

    elements.sendButton.setAttribute(
      "aria-busy",
      String(sending)
    );
  }

  if (elements.input) {
    elements.input.disabled = sending;

    elements.input.classList.toggle(
      "sending",
      sending
    );
  }

  document.body.classList.toggle(
    "chat-sending",
    sending
  );
}


/*
=========================================================
 ERROR MESSAGE
=========================================================
*/

function getReadableError(error) {
  if (!error) {
    return "Kuch problem aa gayi. Please dobara try karein.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  return "Response nahi mil paaya. Please dobara try karein.";
}


/*
=========================================================
 DRAFT
=========================================================
*/

function restoreDraft() {
  if (!elements.input) {
    return;
  }

  try {
    const draft = getDraft();

    if (draft) {
      elements.input.value = draft;

      autoResizeInput();
    }
  } catch (error) {
    console.warn(
      "Draft restore failed:",
      error
    );
  }
}


function saveCurrentDraft() {
  if (!elements.input) {
    return;
  }

  const value =
    String(elements.input.value || "");

  try {
    if (value.trim()) {
      saveDraft(value);
    } else {
      clearDraft();
    }
  } catch (error) {
    console.warn(
      "Draft save failed:",
      error
    );
  }
}


/*
=========================================================
 HISTORY
=========================================================
*/

function restoreHistory() {
  try {
    const history = getHistory();

    if (!Array.isArray(history)) {
      return;
    }

    if (elements.history) {
      renderHistory(
        history,
        elements.history
      );
    }
  } catch (error) {
    console.warn(
      "History restore failed:",
      error
    );
  }
}


/*
=========================================================
 NEW CHAT
=========================================================
*/

function setupNavigation() {
  on(
    elements.newChat,
    "click",
    handleNewChat
  );

  on(
    elements.homeButton,
    "click",
    () => {
      scrollToTop();

      focusInput();
    }
  );

  on(
    elements.clearHistory,
    "click",
    handleClearHistory
  );
}


async function handleNewChat() {
  if (state.isSending) {
    return;
  }

  try {
    startNewChat();

    if (elements.input) {
      elements.input.value = "";
    }

    clearDraft();

    removeSelectedFile();

    autoResizeInput();

    restoreHistory();

    hideError();

    closeDrawer();

    focusInput();
  } catch (error) {
    console.error(
      "New chat error:",
      error
    );

    showError(
      "New chat start nahi ho paaya."
    );
  }
}


function handleClearHistory() {
  const confirmed = window.confirm(
    "Kya aap chat history clear karna chahte hain?"
  );

  if (!confirmed) {
    return;
  }

  try {
    localStorage.removeItem(
      "atharv_chat_history"
    );

    localStorage.removeItem(
      "atharv_history"
    );

    if (elements.history) {
      elements.history.innerHTML = "";
    }

    startNewChat();

    closeDrawer();

    focusInput();
  } catch (error) {
    console.error(
      "Clear history error:",
      error
    );

    showError(
      "History clear nahi ho paayi."
    );
  }
}


/*
=========================================================
 DRAWER / SIDEBAR
=========================================================
*/

function setupDrawer() {
  on(
    elements.menuButton,
    "click",
    openDrawer
  );

  on(
    elements.closeDrawer,
    "click",
    closeDrawer
  );

  on(
    elements.drawerOverlay,
    "click",
    closeDrawer
  );

  all(
    "[data-drawer-link], .drawer-link"
  ).forEach((button) => {
    on(
      button,
      "click",
      closeDrawer
    );
  });
}


function openDrawer() {
  if (!elements.drawer) {
    return;
  }

  elements.drawer.classList.add(
    "open"
  );

  if (elements.drawerOverlay) {
    elements.drawerOverlay.classList.add(
      "show"
    );
  }

  document.body.classList.add(
    "drawer-open"
  );
}


function closeDrawer() {
  if (elements.drawer) {
    elements.drawer.classList.remove(
      "open"
    );
  }

  if (elements.drawerOverlay) {
    elements.drawerOverlay.classList.remove(
      "show"
    );
  }

  document.body.classList.remove(
    "drawer-open"
  );
}


/*
=========================================================
 ATTACHMENTS
=========================================================
*/

function setupAttachment() {
  on(
    elements.attachButton,
    "click",
    () => {
      if (elements.fileInput) {
        elements.fileInput.click();
      }
    }
  );

  on(
    elements.fileInput,
    "change",
    handleFileSelect
  );

  on(
    elements.removeAttachment,
    "click",
    removeSelectedFile
  );
}


async function handleFileSelect(event) {
  const file =
    event?.target?.files?.[0];

  if (!file) {
    return;
  }

  /*
  -------------------------------------------------------
  Basic safety limits
  -------------------------------------------------------
  */

  const MAX_FILE_SIZE =
    Number(
      CONFIG.MAX_FILE_SIZE ||
      10 * 1024 * 1024
    );

  if (file.size > MAX_FILE_SIZE) {
    showError(
      `File bahut badi hai. Maximum ${
        formatFileSize(MAX_FILE_SIZE)
      } allowed hai.`
    );

    clearFileInput();

    return;
  }

  state.selectedFile = file;

  try {
    state.selectedFileData =
      await readFilePreview(file);

    showAttachmentSafe(file);

    hideError();
  } catch (error) {
    console.error(
      "Attachment error:",
      error
    );

    state.selectedFile = null;
    state.selectedFileData = null;

    showError(
      "File read nahi ho paayi."
    );

    clearFileInput();
  }
}


function readFilePreview(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(
          new Error(
            "File reading failed."
          )
        );
      };

      reader.readAsDataURL(file);
    }
  );
}


function showAttachmentSafe(file) {
  try {
    showAttachment(
      file,
      elements.attachment
    );
  } catch (error) {
    console.warn(
      "UI attachment renderer failed:",
      error
    );

    if (elements.attachment) {
      elements.attachment.textContent =
        file.name;

      elements.attachment.classList.add(
        "show"
      );
    }
  }
}


function removeSelectedFile() {
  state.selectedFile = null;
  state.selectedFileData = null;

  clearFileInput();

  try {
    hideAttachment(
      elements.attachment
    );
  } catch (error) {
    console.warn(
      "Attachment hide failed:",
      error
    );

    if (elements.attachment) {
      elements.attachment.classList.remove(
        "show"
      );

      elements.attachment.innerHTML = "";
    }
  }
}


function clearFileInput() {
  if (elements.fileInput) {
    elements.fileInput.value = "";
  }
}


function formatFileSize(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  let size = bytes;
  let index = 0;

  while (
    size >= 1024 &&
    index < units.length - 1
  ) {
    size /= 1024;
    index++;
  }

  return `${size.toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}


/*
=========================================================
 MEMORY
=========================================================
*/

function setupMemory() {
  on(
    elements.memoryButton,
    "click",
    () => {
      try {
        openMemory();
      } catch (error) {
        console.error(
          "Open memory error:",
          error
        );
      }
    }
  );

  on(
    elements.memoryClose,
    "click",
    () => {
      try {
        closeMemory();
      } catch (error) {
        console.error(
          "Close memory error:",
          error
        );
      }
    }
  );

  on(
    elements.memoryAdd,
    "click",
    handleAddMemory
  );

  on(
    elements.memoryInput,
    "keydown",
    async (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        await handleAddMemory();
      }
    }
  );

  /*
  -------------------------------------------------------
  Close modal by clicking outside
  -------------------------------------------------------
  */

  on(
    elements.memoryModal,
    "click",
    (event) => {
      if (
        event.target ===
        elements.memoryModal
      ) {
        try {
          closeMemory();
        } catch (error) {
          console.warn(
            "Memory modal close failed:",
            error
          );
        }
      }
    }
  );
}


async function handleAddMemory() {
  if (!elements.memoryInput) {
    return;
  }

  const value =
    String(
      elements.memoryInput.value || ""
    ).trim();

  if (!value) {
    return;
  }

  try {
    await addMemory(value);

    elements.memoryInput.value = "";
  } catch (error) {
    console.error(
      "Add memory error:",
      error
    );

    showError(
      getReadableError(error)
    );
  }
}


/*
=========================================================
 SUGGESTIONS
=========================================================
*/

function setupSuggestions() {
  all(
    "[data-suggestion], .suggestion, .suggestion-btn"
  ).forEach((button) => {
    on(
      button,
      "click",
      async () => {
        const text =
          button.dataset.suggestion ||
          button.getAttribute(
            "data-prompt"
          ) ||
          button.textContent ||
          "";

        const clean =
          text.trim();

        if (!clean) {
          return;
        }

        if (elements.input) {
          elements.input.value =
            clean;

          autoResizeInput();

          await handleSend();
        }
      }
    );
  });
}


/*
=========================================================
 COPY CODE
=========================================================
*/

function setupCopyButtons() {
  document.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          "[data-copy], .copy-code, .copy-button"
        );

      if (!button) {
        return;
      }

      let text = "";

      const selector =
        button.dataset.copy;

      if (selector) {
        const target =
          document.querySelector(
            selector
          );

        text =
          target?.textContent || "";
      }

      if (!text) {
        const code =
          button.closest(
            "pre"
          )?.querySelector(
            "code"
          );

        text =
          code?.textContent || "";
      }

      if (!text) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          text
        );

        const original =
          button.textContent;

        button.textContent =
          "Copied";

        setTimeout(() => {
          button.textContent =
            original;
        }, 1200);
      } catch (error) {
        console.warn(
          "Copy failed:",
          error
        );
      }
    }
  );
}


/*
=========================================================
 PWA
=========================================================
*/

function setupPWA() {
  try {
    registerPWA();
  } catch (error) {
    console.warn(
      "PWA registration failed:",
      error
    );
  }

  try {
    setupInstallPrompt(
      (available) => {
        state.installAvailable =
          Boolean(available);

        if (elements.installButton) {
          elements.installButton.hidden =
            !state.installAvailable;
        }
      }
    );
  } catch (error) {
    console.warn(
      "Install prompt setup failed:",
      error
    );
  }

  on(
    elements.installButton,
    "click",
    async () => {
      try {
        await installPWA();
      } catch (error) {
        console.warn(
          "PWA install failed:",
          error
        );
      }
    }
  );
}


/*
=========================================================
 VERSION
=========================================================
*/

async function loadVersion() {
  try {
    const result =
      await getVersion();

    if (!elements.version) {
      return;
    }

    const version =
      result?.version ||
      result?.data?.version ||
      CONFIG.VERSION ||
      "17.1.0";

    elements.version.textContent =
      `v${version}`;
  } catch (error) {
    console.warn(
      "Version request failed:",
      error
    );

    if (elements.version) {
      elements.version.textContent =
        `v${CONFIG.VERSION || "17.1.0"}`;
    }
  }
}


/*
=========================================================
 INPUT HELPERS
=========================================================
*/

function autoResizeInput() {
  const input =
    elements.input;

  if (!input) {
    return;
  }

  if (
    input.tagName !==
    "TEXTAREA"
  ) {
    return;
  }

  input.style.height = "auto";

  const maxHeight =
    Number(
      CONFIG.MAX_INPUT_HEIGHT ||
      180
    );

  input.style.height =
    Math.min(
      input.scrollHeight,
      maxHeight
    ) + "px";
}


function focusInput() {
  if (!elements.input) {
    return;
  }

  /*
  Don't force keyboard open on mobile
  during initial page load.
  */

  if (
    document.activeElement ===
    elements.input
  ) {
    return;
  }

  setTimeout(() => {
    try {
      elements.input.focus({
        preventScroll: true
      });
    } catch {
      elements.input.focus();
    }
  }, 100);
}


function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/*
=========================================================
 ESC KEY
=========================================================
*/

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeDrawer();

    try {
      closeMemory();
    } catch {
      // Memory modal may not be open.
    }
  }
);


/*
=========================================================
 ONLINE / OFFLINE
=========================================================
*/

window.addEventListener(
  "online",
  () => {
    document.body.classList.remove(
      "offline"
    );

    hideError();
  }
);

window.addEventListener(
  "offline",
  () => {
    document.body.classList.add(
      "offline"
    );

    showError(
      "Internet connection nahi hai. Connection aane ke baad dobara try karein."
    );
  }
);


/*
=========================================================
 VISIBILITY
=========================================================
*/

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      /*
      Restore draft/history when user
      returns to the app.
      */

      restoreDraft();
    }
  }
);


/*
=========================================================
 GLOBAL ATHARV API
 Useful for UI modules / debugging
=========================================================
*/

window.Atharv = {
  state,

  send: handleSend,

  newChat: handleNewChat,

  openDrawer,

  closeDrawer,

  openMemory: () => {
    try {
      openMemory();
    } catch (error) {
      console.error(error);
    }
  },

  closeMemory: () => {
    try {
      closeMemory();
    } catch (error) {
      console.error(error);
    }
  },

  removeAttachment: removeSelectedFile
};


/*
=========================================================
 START APP
=========================================================
*/

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init,
    {
      once: true
    }
  );
} else {
  init();
}
