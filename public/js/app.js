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

let currentMode = "normal";

let submitting = false;


document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  console.log(
    "Atharv AI frontend v17.0.2 starting..."
  );


  try {

    bindEvents();

    restoreDraft();

    renderHistory(
      getHistory()
    );

    registerPWA();

    setupInstallPrompt();

    setupTextarea();

    setupSuggestionButtons();

    setupModes();

    await updateVersion();


    console.log(
      "Atharv AI frontend ready."
    );


  } catch (error) {

    console.error(
      "Atharv initialization failed:",
      error
    );


    showError(
      "Atharv AI initialize nahi ho paaya."
    );
  }
}


/* =====================================================
   EVENTS
===================================================== */

function bindEvents() {

  document.addEventListener(
    "click",
    handleGlobalClick
  );


  const form =
    $("#chatForm");


  if (form) {

    form.addEventListener(
      "submit",
      handleSubmit
    );

  } else {

    console.error(
      "chatForm not found."
    );
  }


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
    event => {

      if (
        event.target.id ===
        "memoryModal"
      ) {

        closeMemory();
      }
    }
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeMemory();

        closeDrawer();
      }
    }
  );
}


/* =====================================================
   GLOBAL CLICK
===================================================== */

async function handleGlobalClick(
  event
) {

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

        await openMemory();

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

    const input =
      $("#messageInput");


    if (input) {

      input.value =
        suggestion.dataset.suggestion;

      input.focus();

      autoResizeTextarea();

      saveDraft(
        input.value
      );
    }


    return;
  }


  const historyButton =
    event.target.closest(
      "[data-history-id]"
    );


  if (historyButton) {

    openHistoryChat(
      historyButton.dataset.historyId
    );

    closeDrawer();

    return;
  }


  const memoryDelete =
    event.target.closest(
      "[data-memory-delete]"
    );


  if (memoryDelete) {

    if (
      window.confirm(
        "Delete this memory?"
      )
    ) {

      await deleteMemory(
        memoryDelete.dataset.memoryDelete
      );
    }


    return;
  }


  const copyButton =
    event.target.closest(
      ".copy-code"
    );


  if (copyButton) {

    try {

      const code =
        decodeURIComponent(
          copyButton.dataset.code
        );


      await navigator.clipboard.writeText(
        code
      );


      copyButton.textContent =
        "Copied";


      setTimeout(
        () => {
          copyButton.textContent =
            "Copy";
        },
        1200
      );


    } catch {

      copyButton.textContent =
        "Failed";
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


/* =====================================================
   SUBMIT
===================================================== */

async function handleSubmit(
  event
) {

  event.preventDefault();

  event.stopPropagation();


  if (submitting) {
    return;
  }


  const input =
    $("#messageInput");


  if (!input) {

    showError(
      "Message input nahi mila."
    );

    return;
  }


  const message =
    input.value.trim();


  if (!message) {

    input.focus();

    return;
  }


  const maxLength =
    CONFIG.MAX_MESSAGE_LENGTH ||
    CONFIG.LIMITS?.MAX_MESSAGE_LENGTH ||
    12000;


  if (
    message.length >
    maxLength
  ) {

    showError(
      `Maximum ${maxLength} characters allowed.`
    );

    return;
  }


  submitting = true;


  const sendButton =
    $("#sendButton");


  if (sendButton) {

    sendButton.disabled =
      true;

    sendButton.setAttribute(
      "aria-busy",
      "true"
    );
  }


  input.value = "";

  autoResizeTextarea();

  hideError();


  try {

    await sendMessage(
      message,
      {
        file:
          selectedFile,

        research:
          currentMode === "live",

        mode:
          currentMode
      }
    );


  } catch (error) {

    console.error(
      "Message send failed:",
      error
    );


    showError(
      error?.message ||
      "Message send nahi ho paaya."
    );


  } finally {

    removeSelectedFile();

    submitting = false;


    if (sendButton) {

      sendButton.disabled =
        false;

      sendButton.removeAttribute(
        "aria-busy"
      );
    }


    input.focus();
  }
}


/* =====================================================
   KEYBOARD
===================================================== */

function handleInputKeydown(
  event
) {

  if (
    event.key !== "Enter"
  ) {
    return;
  }


  if (event.shiftKey) {
    return;
  }


  event.preventDefault();

  event.stopPropagation();


  const form =
    $("#chatForm");


  if (
    form &&
    typeof form.requestSubmit ===
      "function"
  ) {

    form.requestSubmit();

  } else if (form) {

    form.dispatchEvent(
      new Event(
        "submit",
        {
          bubbles: true,
          cancelable: true
        }
      )
    );
  }
}


/* =====================================================
   MODE
===================================================== */

function setupModes() {

  const buttons =
    $all(
      "[data-mode]"
    );


  buttons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          currentMode =
            button.dataset.mode ||
            "normal";


          buttons.forEach(
            item => {

              item.classList.toggle(
                "active",
                item === button
              );
            }
          );


          const input =
            $("#messageInput");


          if (input) {

            input.placeholder =
              currentMode === "live"
                ? "Ask Atharv Live..."
                : "Message Atharv...";

            input.focus();
          }
        }
      );
    }
  );
}


/* =====================================================
   DRAFT
===================================================== */

const saveDraftDebounced =
  debounce(
    value => {
      saveDraft(value);
    },
    250
  );


function handleDraftInput(
  event
) {

  saveDraftDebounced(
    event.target.value
  );

  autoResizeTextarea();
}


function restoreDraft() {

  const input =
    $("#messageInput");


  if (!input) {
    return;
  }


  const draft =
    getDraft();


  if (draft) {

    input.value =
      draft;

    autoResizeTextarea();
  }
}


/* =====================================================
   TEXTAREA
===================================================== */

function setupTextarea() {

  autoResizeTextarea();
}


function autoResizeTextarea() {

  const textarea =
    $("#messageInput");


  if (!textarea) {
    return;
  }


  textarea.style.height =
    "auto";


  textarea.style.height =
    `${Math.min(
      textarea.scrollHeight,
      150
    )}px`;
}


/* =====================================================
   SUGGESTIONS
===================================================== */

function setupSuggestionButtons() {

  $all(
    "[data-suggestion]"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const input =
            $("#messageInput");


          if (!input) {
            return;
          }


          input.value =
            button.dataset.suggestion;


          saveDraft(
            input.value
          );


          input.focus();

          autoResizeTextarea();
        }
      );
    }
  );
}


/* =====================================================
   FILE
===================================================== */

function handleFileChange(
  event
) {

  const file =
    event.target.files?.[0];


  if (!file) {

    removeSelectedFile();

    return;
  }


  const maxFile =
    CONFIG.MAX_FILE_SIZE ||
    CONFIG.LIMITS?.MAX_FILE_SIZE ||
    5 * 1024 * 1024;


  if (
    file.size >
    maxFile
  ) {

    showError(
      "File is too large. Maximum file size is 5 MB."
    );


    event.target.value =
      "";

    return;
  }


  selectedFile =
    file;


  hideError();

  showAttachment(
    file
  );
}


function removeSelectedFile() {

  selectedFile =
    null;


  const input =
    $("#fileInput");


  if (input) {

    input.value =
      "";
  }


  hideAttachment();
}


/* =====================================================
   HISTORY
===================================================== */

function openHistoryChat(
  id
) {

  const history =
    getHistory();


  const chat =
    history.find(
      item =>
        item.id === id
    );


  if (!chat) {
    return;
  }


  loadChat(chat);

  renderHistory(
    history,
    id
  );
}


function handleClearHistory() {

  if (
    !window.confirm(
      "Clear all recent chats from this device?"
    )
  ) {

    return;
  }


  clearHistory();

  renderHistory([]);

  startNewChat();
}


/* =====================================================
   DRAWER
===================================================== */

function openDrawer() {

  $("#drawer")
    ?.classList.add("open");

  $("#drawerOverlay")
    ?.classList.add("open");
}


function closeDrawer() {

  $("#drawer")
    ?.classList.remove("open");

  $("#drawerOverlay")
    ?.classList.remove("open");
}


/* =====================================================
   VERSION
===================================================== */

async function updateVersion() {

  const element =
    $("#version");


  if (!element) {
    return;
  }


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
      `v${CONFIG.APP?.VERSION || "17.0.2"}`;
  }
}
