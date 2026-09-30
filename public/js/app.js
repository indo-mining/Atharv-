"use strict";

/*
=========================================================
 ATHARV AI FRONTEND
 Version 17.1.0
 --------------------------------------------------------
 Compatible with:
 - Atharv AI Server 16.x / 17.x
 - /api/chat
 - /api/chat/research
 - /api/memory
 - Current index.html v17.x
 - Current style.css v17.1.0

 Features:
 - Normal Chat
 - Live Research Mode
 - Local Chat History
 - Persistent User ID
 - Message Formatting
 - Headings
 - Bullet Lists
 - Numbered Lists
 - Bold / Italic / Inline Code
 - Fenced Code Blocks
 - Copy Code
 - Copy Message
 - Regenerate Response
 - Edit User Message
 - Memory Modal
 - Attachment Preview
 - Enter to Send
 - Shift + Enter for New Line
 - AbortController timeout
 - Safe HTML escaping
 - No GET form navigation
=========================================================
*/

(() => {
  "use strict";

  /* =====================================================
     CONFIG
  ===================================================== */

  const API_BASE = "";

  const APP_VERSION = "17.1.0";

  const MAX_MESSAGE_LENGTH = 12000;

  const REQUEST_TIMEOUT = 120000;

  const STORAGE_KEYS = {
    USER_ID: "atharv_user_id_v17",
    HISTORY: "atharv_chat_history_v17",
    LIVE_MODE: "atharv_live_mode_v17"
  };

  /* =====================================================
     DOM
  ===================================================== */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const chatForm = $("#chatForm");
  const messageInput = $("#messageInput");
  const sendButton = $("#sendButton");

  const messagesContainer = $("#messages");
  const thinking = $("#thinking");

  const welcome = $("#welcome");

  const newChatButton = $("#newChatButton");
  const memoryButton = $("#memoryButton");

  const liveButton = $("#liveButton");

  const attachmentButton = $("#attachmentButton");
  const fileInput = $("#fileInput");
  const attachmentInfo = $("#attachmentInfo");

  const toast = $("#toast");

  const memoryModal = $("#memoryModal");
  const closeMemoryButton = $("#closeMemoryButton");
  const memoryList = $("#memoryList");

  /* =====================================================
     STATE
  ===================================================== */

  let sending = false;

  let currentAbortController = null;

  let attachedFile = null;

  let history = loadHistory();

  let liveMode = loadLiveMode();

  const userId = getOrCreateUserId();

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  document.addEventListener("DOMContentLoaded", init);

  /*
   * DOMContentLoaded may already have fired if this script
   * is loaded at the bottom of body.
   */
  if (document.readyState !== "loading") {
    init();
  }

  let initialized = false;

  function init() {
    if (initialized) return;

    initialized = true;

    bindEvents();

    updateLiveUI();

    renderHistory();

    resizeTextarea();

    registerServiceWorker();

    console.log(
      `%cATHARV AI v${APP_VERSION}`,
      "font-weight:bold"
    );

    console.log("ATHARV USER ID:", userId);
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  function bindEvents() {
    /*
     * IMPORTANT:
     * Explicitly prevent default form submission.
     * This prevents:
     * GET /?message=...
     */
    if (chatForm) {
      chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        await handleSend();
      });
    }

    if (messageInput) {
      messageInput.addEventListener("keydown", async (event) => {
        /*
         * Enter = Send
         * Shift + Enter = New Line
         */
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.isComposing
        ) {
          event.preventDefault();
          event.stopPropagation();

          await handleSend();
        }
      });

      messageInput.addEventListener("input", resizeTextarea);
    }

    if (sendButton) {
      sendButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        await handleSend();
      });
    }

    if (liveButton) {
      liveButton.addEventListener("click", (event) => {
        event.preventDefault();

        liveMode = !liveMode;

        saveLiveMode();

        updateLiveUI();

        showToast(
          liveMode
            ? "Live research mode ON"
            : "Live research mode OFF"
        );
      });
    }

    if (newChatButton) {
      newChatButton.addEventListener("click", (event) => {
        event.preventDefault();

        startNewChat();
      });
    }

    if (memoryButton) {
      memoryButton.addEventListener("click", async (event) => {
        event.preventDefault();

        await openMemoryModal();
      });
    }

    if (closeMemoryButton) {
      closeMemoryButton.addEventListener("click", closeMemoryModal);
    }

    if (memoryModal) {
      memoryModal.addEventListener("click", (event) => {
        if (event.target === memoryModal) {
          closeMemoryModal();
        }
      });
    }

    if (attachmentButton && fileInput) {
      attachmentButton.addEventListener("click", (event) => {
        event.preventDefault();

        fileInput.click();
      });

      fileInput.addEventListener("change", handleFileSelect);
    }

    /*
     * Suggestion buttons
     */
    $$(".suggestion, .example-chip").forEach((button) => {
      button.addEventListener("click", async () => {
        const text =
          button.dataset.message ||
          button.getAttribute("data-message") ||
          button.textContent.trim();

        if (!text) return;

        if (messageInput) {
          messageInput.value = text;
          resizeTextarea();
          messageInput.focus();
        }

        await handleSend();
      });
    });

    /*
     * Event delegation for dynamic message actions.
     */
    if (messagesContainer) {
      messagesContainer.addEventListener("click", handleMessageAction);
    }

    /*
     * Escape closes modal.
     */
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMemoryModal();
      }
    });
  }

  /* =====================================================
     USER ID
  ===================================================== */

  function getOrCreateUserId() {
    try {
      let id = localStorage.getItem(STORAGE_KEYS.USER_ID);

      if (id && typeof id === "string") {
        return id;
      }

      id =
        "atharv_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2, 10);

      localStorage.setItem(STORAGE_KEYS.USER_ID, id);

      return id;
    } catch {
      return (
        "atharv_" +
        Date.now().toString(36)
      );
    }
  }

  /* =====================================================
     HISTORY
  ===================================================== */

  function loadHistory() {
    try {
      const raw = localStorage.getItem(
        STORAGE_KEYS.HISTORY
      );

      if (!raw) return [];

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(
          (item) =>
            item &&
            typeof item.role === "string" &&
            typeof item.content === "string"
        )
        .map((item) => ({
          role:
            item.role === "assistant"
              ? "assistant"
              : "user",
          content: item.content
        }))
        .slice(-100);
    } catch (error) {
      console.warn(
        "History load error:",
        error
      );

      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.HISTORY,
        JSON.stringify(history.slice(-100))
      );
    } catch (error) {
      console.warn(
        "History save error:",
        error
      );
    }
  }

  function clearHistory() {
    history = [];

    try {
      localStorage.removeItem(
        STORAGE_KEYS.HISTORY
      );
    } catch {}
  }

  /* =====================================================
     LIVE MODE
  ===================================================== */

  function loadLiveMode() {
    try {
      return (
        localStorage.getItem(
          STORAGE_KEYS.LIVE_MODE
        ) === "true"
      );
    } catch {
      return false;
    }
  }

  function saveLiveMode() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.LIVE_MODE,
        String(liveMode)
      );
    } catch {}
  }

  function updateLiveUI() {
    if (!liveButton) return;

    liveButton.classList.toggle(
      "active",
      liveMode
    );

    liveButton.setAttribute(
      "aria-pressed",
      String(liveMode)
    );

    if (liveMode) {
      liveButton.title =
        "Live research mode is ON";
    } else {
      liveButton.title =
        "Turn on live research mode";
    }
  }

  /* =====================================================
     RENDER HISTORY
  ===================================================== */

  function renderHistory() {
    if (!messagesContainer) return;

    messagesContainer.innerHTML = "";

    if (!history.length) {
      showWelcome();
      return;
    }

    hideWelcome();

    history.forEach((item, index) => {
      appendMessage(
        item.role,
        item.content,
        {
          index
        }
      );
    });

    scrollToBottom(false);
  }

  function showWelcome() {
    if (welcome) {
      welcome.hidden = false;
      welcome.style.display = "";
    }
  }

  function hideWelcome() {
    if (welcome) {
      welcome.hidden = true;
      welcome.style.display = "none";
    }
  }

  /* =====================================================
     MESSAGE RENDER
  ===================================================== */

  function appendMessage(
    role,
    content,
    options = {}
  ) {
    if (!messagesContainer) return null;

    hideWelcome();

    const row = document.createElement("div");

    row.className =
      role === "user"
        ? "message-row user-message-row"
        : "message-row assistant-message-row";

    row.dataset.role = role;

    if (
      Number.isInteger(options.index)
    ) {
      row.dataset.index =
        String(options.index);
    }

    const bubble = document.createElement("div");

    bubble.className =
      role === "user"
        ? "message user-message"
        : "message assistant-message";

    if (role === "assistant") {
      bubble.innerHTML =
        formatAssistantMessage(content);
    } else {
      bubble.textContent = content;
    }

    row.appendChild(bubble);

    /*
     * Message action bar.
     */
    const actions =
      createMessageActions(
        role,
        content
      );

    if (actions) {
      row.appendChild(actions);
    }

    messagesContainer.appendChild(row);

    return row;
  }

  /* =====================================================
     MESSAGE ACTIONS
  ===================================================== */

  function createMessageActions(
    role,
    content
  ) {
    const actions =
      document.createElement("div");

    actions.className =
      "atharv-message-actions";

    if (role === "assistant") {
      actions.appendChild(
        createActionButton(
          "copy-message",
          "Copy",
          "Copy response"
        )
      );

      actions.appendChild(
        createActionButton(
          "regenerate",
          "Regenerate",
          "Generate this response again"
        )
      );
    } else {
      actions.appendChild(
        createActionButton(
          "edit-message",
          "Edit",
          "Edit this message"
        )
      );

      actions.appendChild(
        createActionButton(
          "copy-message",
          "Copy",
          "Copy message"
        )
      );
    }

    return actions;
  }

  function createActionButton(
    action,
    text,
    title
  ) {
    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "atharv-message-action";

    button.dataset.action = action;

    button.textContent = text;

    button.title = title;

    button.setAttribute(
      "aria-label",
      title
    );

    return button;
  }

  async function handleMessageAction(event) {
    const button =
      event.target.closest(
        ".atharv-message-action"
      );

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const row =
      button.closest(".message-row");

    if (!row) return;

    const action =
      button.dataset.action;

    const index = Number(
      row.dataset.index
    );

    if (!Number.isInteger(index)) {
      return;
    }

    if (action === "copy-message") {
      await copyMessage(index);
      return;
    }

    if (action === "edit-message") {
      editMessage(index);
      return;
    }

    if (action === "regenerate") {
      await regenerateMessage(index);
    }
  }

  /* =====================================================
     COPY MESSAGE
  ===================================================== */

  async function copyMessage(index) {
    const item = history[index];

    if (!item) return;

    const ok =
      await copyToClipboard(
        item.content
      );

    if (ok) {
      showToast("Copied");
    } else {
      showToast(
        "Copy failed. Please try again."
      );
    }
  }

  /* =====================================================
     EDIT MESSAGE
  ===================================================== */

  function editMessage(index) {
    const item = history[index];

    if (!item || item.role !== "user") {
      return;
    }

    if (!messageInput) return;

    messageInput.value =
      item.content;

    resizeTextarea();

    messageInput.focus();

    try {
      messageInput.setSelectionRange(
        messageInput.value.length,
        messageInput.value.length
      );
    } catch {}

    showToast(
      "Message loaded for editing"
    );
  }

  /* =====================================================
     REGENERATE
  ===================================================== */

  async function regenerateMessage(
    assistantIndex
  ) {
    if (sending) {
      showToast(
        "Please wait for the current response."
      );

      return;
    }

    if (
      !Number.isInteger(
        assistantIndex
      )
    ) {
      return;
    }

    const assistant =
      history[assistantIndex];

    if (
      !assistant ||
      assistant.role !== "assistant"
    ) {
      return;
    }

    /*
     * Find the user message immediately
     * before this assistant response.
     */
    let userIndex =
      assistantIndex - 1;

    while (
      userIndex >= 0 &&
      history[userIndex].role !== "user"
    ) {
      userIndex--;
    }

    if (userIndex < 0) {
      showToast(
        "Previous user message not found."
      );

      return;
    }

    const userMessage =
      history[userIndex].content;

    /*
     * Remove this assistant response and
     * everything after it.
     */
    history = history.slice(
      0,
      assistantIndex
    );

    saveHistory();

    renderHistory();

    await sendMessageInternal(
      userMessage,
      {
        regenerate: true
      }
    );
  }

  /* =====================================================
     SEND
  ===================================================== */

  async function handleSend() {
    if (sending) return;

    if (!messageInput) return;

    const message =
      messageInput.value.trim();

    if (!message) {
      showToast(
        "Please type a message."
      );

      messageInput.focus();

      return;
    }

    if (
      message.length >
      MAX_MESSAGE_LENGTH
    ) {
      showToast(
        `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`
      );

      return;
    }

    messageInput.value = "";

    resizeTextarea();

    await sendMessageInternal(
      message
    );
  }

  async function sendMessageInternal(
    message,
    options = {}
  ) {
    if (sending) return;

    sending = true;

    setSendingState(true);

    /*
     * Add user message only if this isn't
     * a regeneration request.
     */
    if (!options.regenerate) {
      history.push({
        role: "user",
        content: message
      });

      saveHistory();

      renderHistory();
    } else {
      /*
       * Regeneration:
       * render current history first.
       */
      renderHistory();
    }

    showThinking();

    scrollToBottom(true);

    try {
      console.log(
        "ATHARV SEND:",
        message
      );

      const response =
        await sendToAtharv(message);

      console.log(
        "ATHARV RESPONSE:",
        response
      );

      const reply =
        extractReply(response);

      if (!reply) {
        throw new Error(
          "Atharv returned an empty response."
        );
      }

      history.push({
        role: "assistant",
        content: reply
      });

      saveHistory();

      hideThinking();

      renderHistory();

      scrollToBottom(true);
    } catch (error) {
      console.error(
        "ATHARV SEND ERROR:",
        error
      );

      hideThinking();

      /*
       * If request was manually aborted,
       * don't show an error bubble.
       */
      if (
        error &&
        error.name === "AbortError"
      ) {
        showToast(
          "Request cancelled."
        );
      } else {
        const errorMessage =
          getFriendlyError(error);

        history.push({
          role: "assistant",
          content:
            "Sorry, response nahi mil paaya.\n\n" +
            errorMessage
        });

        saveHistory();

        renderHistory();

        scrollToBottom(true);
      }
    } finally {
      currentAbortController = null;

      sending = false;

      setSendingState(false);
    }
  }

  /* =====================================================
     API REQUEST
  ===================================================== */

  async function sendToAtharv(
    message
  ) {
    currentAbortController =
      new AbortController();

    const signal =
      currentAbortController.signal;

    const timeoutId =
      setTimeout(() => {
        try {
          currentAbortController.abort();
        } catch {}
      }, REQUEST_TIMEOUT);

    try {
      let endpoint;
      let payload;

      if (liveMode) {
        endpoint =
          "/api/chat/research";

        payload = {
          query: message,
          message: message,
          userId: userId
        };
      } else {
        endpoint =
          "/api/chat";

        /*
         * Send only recent history to backend.
         * Backend can accept history/chatHistory.
         */
        const recentHistory =
          history
            .slice(-12)
            .map((item) => ({
              role: item.role,
              content: item.content
            }));

        payload = {
          message: message,
          history: recentHistory,
          chatHistory: recentHistory,
          userId: userId
        };
      }

      return await apiRequest(
        endpoint,
        {
          method: "POST",
          body: payload,
          signal
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function apiRequest(
    endpoint,
    options = {}
  ) {
    const url =
      API_BASE + endpoint;

    const requestOptions = {
      method:
        options.method || "GET",

      credentials: "same-origin",

      cache: "no-store",

      headers: {
        Accept:
          "application/json"
      },

      signal:
        options.signal
    };

    if (options.body !== undefined) {
      requestOptions.headers[
        "Content-Type"
      ] = "application/json";

      requestOptions.body =
        JSON.stringify(
          options.body
        );
    }

    const response =
      await fetch(
        url,
        requestOptions
      );

    const text =
      await response.text();

    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {
          raw: text
        };
      }
    }

    if (!response.ok) {
      const serverMessage =
        data &&
        (
          data.error ||
          data.message ||
          data.details
        );

      throw new Error(
        serverMessage ||
        `Server error ${response.status}`
      );
    }

    return data;
  }

  /* =====================================================
     RESPONSE EXTRACTION
  ===================================================== */

  function extractReply(data) {
    if (!data) return "";

    const directKeys = [
      "reply",
      "response",
      "answer",
      "message",
      "content",
      "text"
    ];

    for (const key of directKeys) {
      if (
        typeof data[key] ===
        "string" &&
        data[key].trim()
      ) {
        return data[key].trim();
      }
    }

    /*
     * Nested response formats.
     */
    const nested =
      data.result ||
      data.data ||
      data.output;

    if (
      nested &&
      typeof nested === "object"
    ) {
      for (const key of directKeys) {
        if (
          typeof nested[key] ===
          "string" &&
          nested[key].trim()
        ) {
          return nested[key].trim();
        }
      }
    }

    /*
     * OpenAI/Groq-style response.
     */
    if (
      Array.isArray(
        data.choices
      )
    ) {
      const choice =
        data.choices[0];

      const content =
        choice &&
        choice.message &&
        choice.message.content;

      if (
        typeof content ===
        "string"
      ) {
        return content.trim();
      }
    }

    return "";
  }

  /* =====================================================
     SAFE MARKDOWN FORMATTER
  ===================================================== */

  function formatAssistantMessage(
    text
  ) {
    if (
      typeof text !== "string"
    ) {
      return "";
    }

    /*
     * First escape everything.
     * This prevents AI output from injecting
     * arbitrary HTML.
     */
    const escaped =
      escapeHTML(text);

    const lines =
      escaped.split(/\r?\n/);

    let html = "";

    let inCode = false;

    let codeLanguage = "";

    let codeLines = [];

    let listType = null;

    function closeList() {
      if (listType === "ul") {
        html += "</ul>";
      }

      if (listType === "ol") {
        html += "</ol>";
      }

      listType = null;
    }

    function flushCode() {
      if (!inCode) return;

      const code =
        codeLines.join("\n");

      html += createCodeBlockHTML(
        code,
        codeLanguage
      );

      codeLines = [];

      codeLanguage = "";

      inCode = false;
    }

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {
      const originalLine =
        lines[i];

      /*
       * Fenced code block.
       */
      const fenceMatch =
        originalLine.match(
          /^```([a-zA-Z0-9_+#.-]*)\s*$/
        );

      if (fenceMatch) {
        if (!inCode) {
          closeList();

          inCode = true;

          codeLanguage =
            fenceMatch[1] || "";

          codeLines = [];
        } else {
          flushCode();
        }

        continue;
      }

      if (inCode) {
        codeLines.push(
          originalLine
        );

        continue;
      }

      /*
       * Empty line.
       */
      if (
        originalLine.trim() === ""
      ) {
        closeList();

        html +=
          '<div class="message-spacer"></div>';

        continue;
      }

      /*
       * Headings.
       */
      const heading =
        originalLine.match(
          /^(#{1,4})\s+(.+)$/
        );

      if (heading) {
        closeList();

        const level =
          Math.min(
            heading[1].length,
            4
          );

        html +=
          `<h${level + 1}>` +
          formatInline(
            heading[2]
          ) +
          `</h${level + 1}>`;

        continue;
      }

      /*
       * Bullet list.
       */
      const bullet =
        originalLine.match(
          /^\s*[-*•]\s+(.+)$/
        );

      if (bullet) {
        if (listType !== "ul") {
          closeList();

          html += "<ul>";

          listType = "ul";
        }

        html +=
          "<li>" +
          formatInline(
            bullet[1]
          ) +
          "</li>";

        continue;
      }

      /*
       * Numbered list.
       */
      const numbered =
        originalLine.match(
          /^\s*\d+[.)]\s+(.+)$/
        );

      if (numbered) {
        if (listType !== "ol") {
          closeList();

          html += "<ol>";

          listType = "ol";
        }

        html +=
          "<li>" +
          formatInline(
            numbered[1]
          ) +
          "</li>";

        continue;
      }

      /*
       * Horizontal separator.
       */
      if (
        /^\s*(---+|\*\*\*+)\s*$/.test(
          originalLine
        )
      ) {
        closeList();

        html += "<hr>";

        continue;
      }

      /*
       * Normal paragraph.
       */
      closeList();

      html +=
        "<p>" +
        formatInline(
          originalLine
        ) +
        "</p>";
    }

    if (inCode) {
      flushCode();
    }

    closeList();

    return html;
  }

  /* =====================================================
     INLINE FORMAT
  ===================================================== */

  function formatInline(text) {
    if (!text) return "";

    let value = text;

    /*
     * Protect inline code.
     */
    const codeParts = [];

    value = value.replace(
      /`([^`]+)`/g,
      (_, code) => {
        const token =
          `@@ATHARV_INLINE_CODE_${codeParts.length}@@`;

        codeParts.push(
          "<code>" +
          code +
          "</code>"
        );

        return token;
      }
    );

    /*
     * Bold.
     */
    value = value.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

    /*
     * Italic.
     * Avoid treating standalone * bullets
     * as italic because bullets are handled
     * before this function.
     */
    value = value.replace(
      /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
      "$1<em>$2</em>"
    );

    /*
     * Restore inline code.
     */
    codeParts.forEach(
      (code, index) => {
        value =
          value.replace(
            `@@ATHARV_INLINE_CODE_${index}@@`,
            code
          );
      }
    );

    return value;
  }

  /* =====================================================
     CODE BLOCK
  ===================================================== */

  function createCodeBlockHTML(
    code,
    language
  ) {
    const safeCode =
      escapeHTML(code);

    const safeLanguage =
      escapeHTML(
        language || "code"
      );

    return `
      <div class="atharv-code-block">
        <div class="atharv-code-header">
          <span class="atharv-code-language">
            ${safeLanguage}
          </span>

          <button
            type="button"
            class="atharv-copy-code"
            data-code="${escapeAttribute(code)}"
            title="Copy code"
            aria-label="Copy code"
          >
            Copy Code
          </button>
        </div>

        <pre><code>${safeCode}</code></pre>
      </div>
    `;
  }

  /*
   * Code copy delegation.
   */
  document.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          ".atharv-copy-code"
        );

      if (!button) return;

      event.preventDefault();

      const code =
        button.dataset.code || "";

      const decoded =
        decodeAttributeValue(
          code
        );

      const ok =
        await copyToClipboard(
          decoded
        );

      const original =
        button.textContent;

      button.textContent =
        ok ? "Copied!" : "Failed";

      setTimeout(() => {
        button.textContent =
          original || "Copy Code";
      }, 1200);
    }
  );

  /* =====================================================
     HTML ESCAPING
  ===================================================== */

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return encodeURIComponent(
      String(value)
    );
  }

  function decodeAttributeValue(
    value
  ) {
    try {
      return decodeURIComponent(
        value
      );
    } catch {
      return value;
    }
  }

  /* =====================================================
     CLIPBOARD
  ===================================================== */

  async function copyToClipboard(
    text
  ) {
    if (!text) return false;

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          text
        );

        return true;
      }
    } catch {}

    /*
     * Older Android/browser fallback.
     */
    try {
      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value = text;

      textarea.style.position =
        "fixed";

      textarea.style.left =
        "-9999px";

      textarea.style.top =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.focus();

      textarea.select();

      const success =
        document.execCommand(
          "copy"
        );

      textarea.remove();

      return success;
    } catch {
      return false;
    }
  }

  /* =====================================================
     THINKING
  ===================================================== */

  function showThinking() {
    if (!thinking) return;

    thinking.hidden = false;

    thinking.style.display = "";

    thinking.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function hideThinking() {
    if (!thinking) return;

    thinking.hidden = true;

    thinking.style.display = "none";

    thinking.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  /* =====================================================
     SEND STATE
  ===================================================== */

  function setSendingState(
    active
  ) {
    if (sendButton) {
      sendButton.disabled = active;

      sendButton.setAttribute(
        "aria-disabled",
        String(active)
      );

      if (active) {
        sendButton.dataset.originalText =
          sendButton.textContent;

        /*
         * Do not aggressively replace innerHTML
         * because existing button may contain SVG.
         */
        sendButton.classList.add(
          "sending"
        );
      } else {
        sendButton.classList.remove(
          "sending"
        );
      }
    }

    if (messageInput) {
      messageInput.disabled = active;
    }

    if (liveButton) {
      liveButton.disabled = active;
    }
  }

  /* =====================================================
     TEXTAREA
  ===================================================== */

  function resizeTextarea() {
    if (!messageInput) return;

    messageInput.style.height =
      "auto";

    const maxHeight =
      window.innerWidth <= 600
        ? 150
        : 220;

    messageInput.style.height =
      Math.min(
        messageInput.scrollHeight,
        maxHeight
      ) + "px";
  }

  /* =====================================================
     SCROLL
  ===================================================== */

  function scrollToBottom(
    smooth = true
  ) {
    if (!messagesContainer) return;

    requestAnimationFrame(() => {
      try {
        messagesContainer.scrollTo({
          top:
            messagesContainer.scrollHeight,
          behavior:
            smooth
              ? "smooth"
              : "auto"
        });
      } catch {
        messagesContainer.scrollTop =
          messagesContainer.scrollHeight;
      }
    });
  }

  /* =====================================================
     NEW CHAT
  ===================================================== */

  function startNewChat() {
    if (sending) {
      showToast(
        "Please wait for the current response."
      );

      return;
    }

    clearHistory();

    attachedFile = null;

    if (fileInput) {
      fileInput.value = "";
    }

    updateAttachmentInfo();

    if (messageInput) {
      messageInput.value = "";

      resizeTextarea();

      messageInput.focus();
    }

    renderHistory();

    showToast("New chat started");
  }

  /* =====================================================
     ATTACHMENT
  ===================================================== */

  function handleFileSelect(
    event
  ) {
    const file =
      event.target.files &&
      event.target.files[0];

    if (!file) {
      attachedFile = null;

      updateAttachmentInfo();

      return;
    }

    attachedFile = file;

    updateAttachmentInfo();

    showToast(
      `Attached: ${file.name}`
    );
  }

  function updateAttachmentInfo() {
    if (!attachmentInfo) return;

    if (!attachedFile) {
      attachmentInfo.textContent = "";

      attachmentInfo.hidden = true;

      return;
    }

    attachmentInfo.textContent =
      attachedFile.name;

    attachmentInfo.hidden = false;
  }

  /* =====================================================
     MEMORY
  ===================================================== */

  async function openMemoryModal() {
    if (!memoryModal) return;

    memoryModal.hidden = false;

    memoryModal.style.display = "";

    if (memoryList) {
      memoryList.innerHTML =
        '<div class="memory-loading">Loading memory...</div>';
    }

    try {
      const data =
        await apiRequest(
          `/api/memory?userId=${encodeURIComponent(
            userId
          )}`
        );

      const memories =
        extractMemories(data);

      renderMemories(memories);
    } catch (error) {
      console.error(
        "Memory error:",
        error
      );

      if (memoryList) {
        memoryList.innerHTML =
          '<div class="memory-empty">Memory could not be loaded.</div>';
      }
    }
  }

  function closeMemoryModal() {
    if (!memoryModal) return;

    memoryModal.hidden = true;

    memoryModal.style.display = "none";
  }

  function extractMemories(
    data
  ) {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data;
    }

    if (
      Array.isArray(
        data.memories
      )
    ) {
      return data.memories;
    }

    if (
      data.data &&
      Array.isArray(
        data.data.memories
      )
    ) {
      return data.data.memories;
    }

    return [];
  }

  function renderMemories(
    memories
  ) {
    if (!memoryList) return;

    memoryList.innerHTML = "";

    if (!memories.length) {
      memoryList.innerHTML =
        '<div class="memory-empty">No saved memories yet.</div>';

      return;
    }

    memories.forEach(
      (item) => {
        const text =
          typeof item === "string"
            ? item
            : item.memory ||
              item.content ||
              item.text ||
              "";

        if (!text) return;

        const div =
          document.createElement(
            "div"
          );

        div.className =
          "memory-item";

        div.textContent = text;

        memoryList.appendChild(div);
      }
    );
  }

  /* =====================================================
     TOAST
  ===================================================== */

  let toastTimer = null;

  function showToast(
    message
  ) {
    if (!toast) {
      console.log("TOAST:", message);
      return;
    }

    toast.textContent = message;

    toast.hidden = false;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove(
        "show"
      );

      setTimeout(() => {
        toast.hidden = true;
      }, 200);
    }, 2200);
  }

  /* =====================================================
     FRIENDLY ERROR
  ===================================================== */

  function getFriendlyError(
    error
  ) {
    if (!error) {
      return "Something went wrong.";
    }

    const message =
      error.message ||
      String(error);

    if (
      /failed to fetch/i.test(
        message
      )
    ) {
      return "Network connection problem. Please check your internet and try again.";
    }

    if (
      /aborted|timeout/i.test(
        message
      )
    ) {
      return "Request took too long. Please try again.";
    }

    if (
      /429/.test(message)
    ) {
      return "Too many requests right now. Please wait a moment and try again.";
    }

    if (
      /500|502|503|504/.test(
        message
      )
    ) {
      return "Atharv server is temporarily unavailable. Please try again in a moment.";
    }

    return message;
  }

  /* =====================================================
     SERVICE WORKER
  ===================================================== */

  function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    window.addEventListener(
      "load",
      async () => {
        try {
          const registration =
            await navigator.serviceWorker.register(
              "/service-worker.js?v=17.1.0",
              {
                updateViaCache:
                  "none"
              }
            );

          console.log(
            "ATHARV SERVICE WORKER:",
            registration.scope
          );

          try {
            await registration.update();
          } catch {}
        } catch (error) {
          console.warn(
            "Service worker registration failed:",
            error
          );
        }
      }
    );
  }

  /* =====================================================
     ONLINE / OFFLINE
  ===================================================== */

  window.addEventListener(
    "online",
    () => {
      showToast(
        "Internet connection restored"
      );
    }
  );

  window.addEventListener(
    "offline",
    () => {
      showToast(
        "You are offline"
      );
    }
  );

  /* =====================================================
     PAGE VISIBILITY
  ===================================================== */

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        resizeTextarea();
      }
    }
  );

  /* =====================================================
     PUBLIC DEBUG HELPERS
  ===================================================== */

  window.AtharvAI = {
    version: APP_VERSION,

    getUserId() {
      return userId;
    },

    getHistory() {
      return [...history];
    },

    clearHistory() {
      if (sending) return;

      clearHistory();

      renderHistory();
    },

    stopRequest() {
      if (
        currentAbortController
      ) {
        try {
          currentAbortController.abort();
        } catch {}
      }
    }
  };
})();
