/*
=========================================================
 ATHARV AI FRONTEND
 Version 17.0.0
 --------------------------------------------------------
 Modular ES Module Frontend

 Modules:
 - config.js
 - api.js
 - storage.js
 - ui.js
 - chat.js
 - language.js
 - memory.js
 - pwa.js
 - utils.js
=========================================================
*/

import {
  CONFIG
} from "./js/config.js";

import {
  getHistory,
  getDraft,
  saveDraft,
  clearDraft
} from "./js/storage.js";

import {
  renderHistory,
  hideError,
  showError,
  showAttachment,
  hideAttachment
} from "./js/ui.js";

import {
  sendMessage,
  startNewChat
} from "./js/chat.js";

import {
  openMemory,
  closeMemory,
  addMemory
} from "./js/memory.js";

import {
  registerPWA,
  setupInstallPrompt,
  installPWA
} from "./js/pwa.js";

import {
  getVersion
} from "./js/api.js";

import {
  $
} from "./js/utils.js";


let selectedFile = null;


/* =====================================================
   INIT
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  setupUI();

  restoreDraft();

  restoreHistory();

  await registerPWA();

  setupInstall();

  loadVersion();

  console.log(
    `Atharv AI Frontend ${CONFIG.APP.VERSION}`
  );
}


/* =====================================================
   UI EVENTS
===================================================== */

function setupUI() {

  $("sendBtn")
    ?.addEventListener(
      "click",
      handleSend
    );


  $("messageInput")
    ?.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {

          event.preventDefault();

          handleSend();
        }

      }
    );


  $("messageInput")
    ?.addEventListener(
      "input",
      autoResizeInput
    );


  $("messageInput")
    ?.addEventListener(
      "input",
      event => {
        saveDraft(
          event.target.value
        );
      }
    );


  $("newChatBtn")
    ?.addEventListener(
      "click",
      startNewChat
    );


  $("drawerNewChatBtn")
    ?.addEventListener(
      "click",
      () => {

        startNewChat();

        closeDrawer();
      }
    );


  $("clearHistoryBtn")
    ?.addEventListener(
      "click",
      () => {

        const confirmed =
          confirm(
            "Clear this chat?"
          );

        if (!confirmed) {
          return;
        }

        startNewChat();

        closeDrawer();
      }
    );


  $("menuBtn")
    ?.addEventListener(
      "click",
      openDrawer
    );


  $("closeDrawerBtn")
    ?.addEventListener(
      "click",
      closeDrawer
    );


  $("drawerOverlay")
    ?.addEventListener(
      "click",
      closeDrawer
    );


  $("memoryBtn")
    ?.addEventListener(
      "click",
      async () => {

        closeDrawer();

        await openMemory();
      }
    );


  $("closeMemoryBtn")
    ?.addEventListener(
      "click",
      closeMemory
    );


  $("saveMemoryBtn")
    ?.addEventListener(
      "click",
      addMemory
    );


  $("memoryInput")
    ?.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {
          addMemory();
        }

      }
    );


  $("attachBtn")
    ?.addEventListener(
      "click",
      () => {
        $("fileInput")?.click();
      }
    );


  $("fileInput")
    ?.addEventListener(
      "change",
      handleFile
    );


  $("closeFileBtn")
    ?.addEventListener(
      "click",
      closeFileModal
    );


  $("useFileBtn")
    ?.addEventListener(
      "click",
      useSelectedFile
    );


  document
    .querySelectorAll(".suggestion")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const prompt =
            button.dataset.prompt || "";

          const input =
            $("messageInput");

          if (input) {
            input.value = prompt;

            autoResizeInput({
              target: input
            });
          }

          handleSend();
        }
      );

    });


  document.addEventListener(
    "click",
    handleCopyCode
  );
}


/* =====================================================
   SEND
===================================================== */

async function handleSend() {

  const input =
    $("messageInput");

  if (!input) {
    return;
  }

  const message =
    input.value.trim();

  if (!message) {
    return;
  }

  if (
    message.length >
    CONFIG.LIMITS.MAX_MESSAGE_LENGTH
  ) {

    showError(
      `Message is too long. Maximum ${CONFIG.LIMITS.MAX_MESSAGE_LENGTH} characters.`
    );

    return;
  }

  input.value = "";

  clearDraft();

  autoResizeInput({
    target: input
  });

  hideError();

  await sendMessage(message);
}


/* =====================================================
   HISTORY
===================================================== */

function restoreHistory() {

  const history =
    getHistory();

  renderHistory(history);
}


/* =====================================================
   DRAFT
===================================================== */

function restoreDraft() {

  const draft =
    getDraft();

  if (!draft) {
    return;
  }

  const input =
    $("messageInput");

  if (!input) {
    return;
  }

  input.value =
    draft;

  autoResizeInput({
    target: input
  });
}


/* =====================================================
   TEXTAREA
===================================================== */

function autoResizeInput(event) {

  const input =
    event?.target ||
    $("messageInput");

  if (!input) {
    return;
  }

  input.style.height =
    "auto";

  input.style.height =
    `${Math.min(
      input.scrollHeight,
      180
    )}px`;
}


/* =====================================================
   DRAWER
===================================================== */

function openDrawer() {

  $("drawer")
    ?.classList.add("open");

  $("drawerOverlay")
    ?.classList.remove("hidden");
}


function closeDrawer() {

  $("drawer")
    ?.classList.remove("open");

  $("drawerOverlay")
    ?.classList.add("hidden");
}


/* =====================================================
   PWA
===================================================== */

function setupInstall() {

  const install =
    $("installBtn");

  if (!install) {
    return;
  }

  setupInstallPrompt(
    () => {
      install.classList.remove(
        "hidden"
      );
    }
  );

  install.addEventListener(
    "click",
    async () => {

      const installed =
        await installPWA();

      if (installed) {
        install.classList.add(
          "hidden"
        );
      }
    }
  );
}


/* =====================================================
   VERSION
===================================================== */

async function loadVersion() {

  const element =
    $("versionInfo");

  if (!element) {
    return;
  }

  try {

    const result =
      await getVersion();

    const version =
      result?.version ||
      result?.appVersion ||
      "17.x";

    element.textContent =
      `Server: ${version}`;

  } catch {

    element.textContent =
      "Server status unavailable.";
  }
}


/* =====================================================
   FILE ATTACHMENT
===================================================== */

async function handleFile(event) {

  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  if (
    file.size >
    CONFIG.LIMITS.MAX_FILE_SIZE
  ) {

    showError(
      "File is too large. Maximum size is 5 MB."
    );

    event.target.value = "";

    return;
  }

  selectedFile =
    file;

  showAttachment(
    file.name,
    file.size
  );

  await readFileForPreview(file);
}


async function readFileForPreview(file) {

  const textTypes = [
    "text/",
    "application/json"
  ];

  const isText =
    textTypes.some(
      type =>
        file.type.startsWith(type)
    ) ||
    /\.(txt|md|json|csv|js|ts|py|java|cpp|c|html|css|xml)$/i
      .test(file.name);

  if (!isText) {
    openFileModal(
      `${file.name} is selected.`
    );

    return;
  }

  try {

    const text =
      await file.text();

    const limited =
      text.slice(
        0,
        CONFIG.LIMITS.MAX_FILE_TEXT
      );

    openFileModal(
      limited
    );

  } catch {

    openFileModal(
      "The selected file could not be read."
    );
  }
}


function openFileModal(info) {

  const modal =
    $("fileModal");

  const fileInfo =
    $("fileInfo");

  if (!modal || !fileInfo) {
    return;
  }

  fileInfo.textContent =
    info;

  modal.classList.remove(
    "hidden"
  );
}


function closeFileModal() {

  $("fileModal")
    ?.classList.add("hidden");
}


function useSelectedFile() {

  if (!selectedFile) {
    closeFileModal();
    return;
  }

  const input =
    $("messageInput");

  if (!input) {
    return;
  }

  const name =
    selectedFile.name;

  const isText =
    /\.(txt|md|json|csv|js|ts|py|java|cpp|c|html|css|xml)$/i
      .test(name);

  if (isText) {

    selectedFile
      .text()
      .then(text => {

        const limited =
          text.slice(
            0,
            CONFIG.LIMITS.MAX_FILE_TEXT
          );

        input.value =
          `Please analyze this file: ${name}\n\n${limited}`;

        autoResizeInput({
          target: input
        });

        closeFileModal();
      });

  } else {

    input.value =
      `I have attached the file "${name}". Please help me analyze it.`;

    autoResizeInput({
      target: input
    });

    closeFileModal();
  }

  hideAttachment();

  $("fileInput").value = "";

  selectedFile = null;
}


/* =====================================================
   CODE COPY
===================================================== */

async function handleCopyCode(event) {

  const button =
    event.target.closest(
      ".copy-code"
    );

  if (!button) {
    return;
  }

  const block =
    button.closest(
      ".code-block"
    );

  const code =
    block?.querySelector("code");

  if (!code) {
    return;
  }

  try {

    await navigator.clipboard.writeText(
      code.textContent
    );

    button.textContent =
      "Copied";

    setTimeout(
      () => {
        button.textContent =
          "Copy";
      },
      1200
    );

  } catch {

    button.textContent =
      "Failed";
  }
}
