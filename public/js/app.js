"use strict";

/*
=========================================================
 ATHARV AI FRONTEND
 Version 17.1.1
 --------------------------------------------------------
 IMPORTANT:
 - Existing UI preserved
 - Existing index.html preserved
 - Existing CSS preserved
 - Normal chat preserved
 - Live research preserved
 - Memory preserved
 - Attachment preview preserved
 - Local history preserved
 - Advanced message actions added
 - Safe response formatting added
=========================================================
*/

(function () {
  const API_BASE = "";
  const MAX_MESSAGE_LENGTH = 12000;
  const REQUEST_TIMEOUT = 120000;

  const STORAGE = {
    USER_ID: "atharv_user_id_v17",
    HISTORY: "atharv_chat_history_v17",
    LIVE: "atharv_live_mode_v17"
  };

  let initialized = false;
  let sending = false;
  let abortController = null;
  let attachedFile = null;

  let history = loadHistory();
  let liveMode = loadLiveMode();

  const userId = getUserId();

  /* =====================================================
     DOM
  ===================================================== */

  const chatForm = document.getElementById("chatForm");
  const messageInput =
    document.getElementById("messageInput");
  const sendButton =
    document.getElementById("sendButton");

  const messages =
    document.getElementById("messages");

  const thinking =
    document.getElementById("thinking");

  const welcome =
    document.getElementById("welcome");

  const newChatButton =
    document.getElementById("newChatButton");

  const memoryButton =
    document.getElementById("memoryButton");

  const liveButton =
    document.getElementById("liveButton");

  const attachmentButton =
    document.getElementById("attachmentButton");

  const fileInput =
    document.getElementById("fileInput");

  const attachmentInfo =
    document.getElementById("attachmentInfo");

  const memoryModal =
    document.getElementById("memoryModal");

  const closeMemoryButton =
    document.getElementById("closeMemoryButton");

  const memoryList =
    document.getElementById("memoryList");

  const toast =
    document.getElementById("toast");

  /* =====================================================
     INIT
  ===================================================== */

  function init() {
    if (initialized) return;
    initialized = true;

    bindEvents();
    updateLiveButton();
    renderHistory();
    resizeInput();

    console.log(
      "ATHARV AI frontend loaded:",
      "17.1.1"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  function bindEvents() {
    if (chatForm) {
      chatForm.addEventListener(
        "submit",
        function (event) {
          event.preventDefault();
          event.stopPropagation();

          handleSend();
        }
      );
    }

    if (messageInput) {
      messageInput.addEventListener(
        "keydown",
        function (event) {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
          ) {
            event.preventDefault();
            event.stopPropagation();

            handleSend();
          }
        }
      );

      messageInput.addEventListener(
        "input",
        resizeInput
      );
    }

    if (sendButton) {
      sendButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          event.stopPropagation();

          handleSend();
        }
      );
    }

    if (newChatButton) {
      newChatButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          newChat();
        }
      );
    }

    if (liveButton) {
      liveButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          liveMode = !liveMode;

          saveLiveMode();
          updateLiveButton();

          showToast(
            liveMode
              ? "Live search ON"
              : "Live search OFF"
          );
        }
      );
    }

    if (
      attachmentButton &&
      fileInput
    ) {
      attachmentButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          fileInput.click();
        }
      );

      fileInput.addEventListener(
        "change",
        handleAttachment
      );
    }

    if (memoryButton) {
      memoryButton.addEventListener(
        "click",
        openMemory
      );
    }

    if (closeMemoryButton) {
      closeMemoryButton.addEventListener(
        "click",
        closeMemory
      );
    }

    if (memoryModal) {
      memoryModal.addEventListener(
        "click",
        function (event) {
          if (
            event.target ===
            memoryModal
          ) {
            closeMemory();
          }
        }
      );
    }

    /*
     * Existing suggestion cards.
     */
    document
      .querySelectorAll(
        ".suggestion, .example-chip"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function () {
            const text =
              button.dataset.message ||
              button.textContent.trim();

            if (!text) return;

            if (messageInput) {
              messageInput.value =
                text;

              resizeInput();
              messageInput.focus();
            }

            handleSend();
          }
        );
      });

    /*
     * Advanced dynamic actions.
     */
    if (messages) {
      messages.addEventListener(
        "click",
        handleMessageAction
      );
    }

    /*
     * Code-copy buttons are created dynamically.
     */
    document.addEventListener(
      "click",
      handleCodeCopy
    );
  }

  /* =====================================================
     USER ID
  ===================================================== */

  function getUserId() {
    try {
      let id =
        localStorage.getItem(
          STORAGE.USER_ID
        );

      if (id) return id;

      id =
        "atharv_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 10);

      localStorage.setItem(
        STORAGE.USER_ID,
        id
      );

      return id;
    } catch (error) {
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
      const raw =
        localStorage.getItem(
          STORAGE.HISTORY
        );

      if (!raw) return [];

      const data =
        JSON.parse(raw);

      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .filter(function (item) {
          return (
            item &&
            (
              item.role === "user" ||
              item.role === "assistant"
            ) &&
            typeof item.content ===
              "string"
          );
        })
        .slice(-100);
    } catch (error) {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE.HISTORY,
        JSON.stringify(
          history.slice(-100)
        )
      );
    } catch (error) {
      console.warn(
        "History save failed:",
        error
      );
    }
  }

  /* =====================================================
     LIVE MODE
  ===================================================== */

  function loadLiveMode() {
    try {
      return (
        localStorage.getItem(
          STORAGE.LIVE
        ) === "true"
      );
    } catch {
      return false;
    }
  }

  function saveLiveMode() {
    try {
      localStorage.setItem(
        STORAGE.LIVE,
        String(liveMode)
      );
    } catch {}
  }

  function updateLiveButton() {
    if (!liveButton) return;

    liveButton.classList.toggle(
      "active",
      liveMode
    );

    liveButton.setAttribute(
      "aria-pressed",
      String(liveMode)
    );
  }

  /* =====================================================
     HISTORY RENDER
  ===================================================== */

  function renderHistory() {
    if (!messages) return;

    messages.innerHTML = "";

    if (!history.length) {
      if (welcome) {
        welcome.hidden = false;
        welcome.style.display = "";
      }

      return;
    }

    if (welcome) {
      welcome.hidden = true;
      welcome.style.display = "none";
    }

    history.forEach(
      function (item, index) {
        renderMessage(
          item.role,
          item.content,
          index
        );
      }
    );

    scrollBottom(false);
  }

  /* =====================================================
     MESSAGE
  ===================================================== */

  function renderMessage(
    role,
    content,
    index
  ) {
    if (!messages) return;

    const row =
      document.createElement("div");

    /*
     * Preserve existing message-row
     * structure expected by CSS.
     */
    row.className =
      "message-row";

    row.dataset.role = role;
    row.dataset.index = String(index);

    const bubble =
      document.createElement("div");

    bubble.className =
      "message " +
      (
        role === "user"
          ? "user-message"
          : "assistant-message"
      );

    if (role === "assistant") {
      bubble.innerHTML =
        formatResponse(content);
    } else {
      bubble.textContent = content;
    }

    row.appendChild(bubble);

    /*
     * Advanced actions are only appended
     * after the existing message.
     */
    const actions =
      createActions(
        role,
        index
      );

    row.appendChild(actions);

    messages.appendChild(row);
  }

  /* =====================================================
     ACTIONS
  ===================================================== */

  function createActions(
    role,
    index
  ) {
    const wrapper =
      document.createElement("div");

    wrapper.className =
      "atharv-message-actions";

    if (role === "assistant") {
      wrapper.appendChild(
        actionButton(
          "copy",
          "Copy"
        )
      );

      wrapper.appendChild(
        actionButton(
          "regenerate",
          "Regenerate"
        )
      );
    } else {
      wrapper.appendChild(
        actionButton(
          "edit",
          "Edit"
        )
      );

      wrapper.appendChild(
        actionButton(
          "copy",
          "Copy"
        )
      );
    }

    return wrapper;
  }

  function actionButton(
    action,
    text
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type = "button";

    button.className =
      "atharv-message-action";

    button.dataset.action =
      action;

    button.textContent = text;

    return button;
  }

  async function handleMessageAction(
    event
  ) {
    const button =
      event.target.closest(
        ".atharv-message-action"
      );

    if (!button) return;

    const row =
      button.closest(
        ".message-row"
      );

    if (!row) return;

    const index =
      Number(row.dataset.index);

    if (!Number.isInteger(index)) {
      return;
    }

    const action =
      button.dataset.action;

    if (action === "copy") {
      await copyMessage(index);
    }

    if (action === "edit") {
      editMessage(index);
    }

    if (action === "regenerate") {
      regenerate(index);
    }
  }

  /* =====================================================
     COPY MESSAGE
  ===================================================== */

  async function copyMessage(
    index
  ) {
    const item =
      history[index];

    if (!item) return;

    const ok =
      await copyText(
        item.content
      );

    showToast(
      ok
        ? "Copied"
        : "Copy failed"
    );
  }

  /* =====================================================
     EDIT
  ===================================================== */

  function editMessage(index) {
    const item =
      history[index];

    if (
      !item ||
      item.role !== "user"
    ) {
      return;
    }

    if (!messageInput) return;

    messageInput.value =
      item.content;

    resizeInput();

    messageInput.focus();

    try {
      messageInput.setSelectionRange(
        messageInput.value.length,
        messageInput.value.length
      );
    } catch {}

    showToast(
      "Message ready to edit"
    );
  }

  /* =====================================================
     REGENERATE
  ===================================================== */

  async function regenerate(
    assistantIndex
  ) {
    if (sending) {
      showToast(
        "Please wait..."
      );

      return;
    }

    const assistant =
      history[assistantIndex];

    if (
      !assistant ||
      assistant.role !==
        "assistant"
    ) {
      return;
    }

    const userIndex =
      assistantIndex - 1;

    if (
      userIndex < 0 ||
      history[userIndex].role !==
        "user"
    ) {
      showToast(
        "Previous message not found"
      );

      return;
    }

    const userMessage =
      history[userIndex].content;

    /*
     * Remove old assistant response.
     * Keep user message.
     */
    history =
      history.slice(
        0,
        assistantIndex
      );

    saveHistory();

    renderHistory();

    await requestAnswer(
      userMessage
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
        "Please type a message"
      );

      return;
    }

    if (
      message.length >
      MAX_MESSAGE_LENGTH
    ) {
      showToast(
        "Message is too long"
      );

      return;
    }

    messageInput.value = "";

    resizeInput();

    await requestAnswer(
      message
    );
  }

  /* =====================================================
     REQUEST ANSWER
  ===================================================== */

  async function requestAnswer(
    message
  ) {
    if (sending) return;

    sending = true;

    setSending(true);

    /*
     * Add user message.
     */
    history.push({
      role: "user",
      content: message
    });

    saveHistory();

    renderHistory();

    showThinking();

    scrollBottom(true);

    try {
      console.log(
        "ATHARV SEND:",
        message
      );

      const response =
        await sendToServer(
          message
        );

      console.log(
        "ATHARV RESPONSE:",
        response
      );

      const reply =
        extractReply(response);

      if (!reply) {
        throw new Error(
          "Empty response from server"
        );
      }

      history.push({
        role: "assistant",
        content: reply
      });

      saveHistory();

      hideThinking();

      renderHistory();

      scrollBottom(true);
    } catch (error) {
      console.error(
        "ATHARV ERROR:",
        error
      );

      hideThinking();

      if (
        error &&
        error.name ===
          "AbortError"
      ) {
        showToast(
          "Request cancelled"
        );
      } else {
        const message =
          friendlyError(error);

        /*
         * Keep error inside chat,
         * same as previous behaviour.
         */
        history.push({
          role: "assistant",
          content:
            "Sorry, response nahi mil paaya.\n\n" +
            message
        });

        saveHistory();

        renderHistory();

        scrollBottom(true);
      }
    } finally {
      sending = false;

      abortController = null;

      setSending(false);
    }
  }

  /* =====================================================
     API
  ===================================================== */

  async function sendToServer(
    message
  ) {
    abortController =
      new AbortController();

    const timer =
      setTimeout(
        function () {
          if (abortController) {
            abortController.abort();
          }
        },
        REQUEST_TIMEOUT
      );

    try {
      let endpoint;
      let body;

      if (liveMode) {
        endpoint =
          "/api/chat/research";

        body = {
          query: message,
          message: message,
          userId: userId
        };
      } else {
        endpoint =
          "/api/chat";

        const recent =
          history
            .slice(-12)
            .map(function (item) {
              return {
                role: item.role,
                content:
                  item.content
              };
            });

        body = {
          message: message,
          history: recent,
          chatHistory: recent,
          userId: userId
        };
      }

      const response =
        await fetch(
          API_BASE + endpoint,
          {
            method: "POST",

            credentials:
              "same-origin",

            cache: "no-store",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json"
            },

            body:
              JSON.stringify(body),

            signal:
              abortController.signal
          }
        );

      const raw =
        await response.text();

      let data;

      try {
        data = raw
          ? JSON.parse(raw)
          : {};
      } catch {
        data = {
          raw: raw
        };
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Server error ${response.status}`
        );
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /* =====================================================
     RESPONSE EXTRACTION
  ===================================================== */

  function extractReply(
    data
  ) {
    if (!data) return "";

    const keys = [
      "reply",
      "response",
      "answer",
      "message",
      "content",
      "text"
    ];

    for (
      const key of keys
    ) {
      if (
        typeof data[key] ===
          "string" &&
        data[key].trim()
      ) {
        return data[key].trim();
      }
    }

    const nested =
      data.result ||
      data.data ||
      data.output;

    if (
      nested &&
      typeof nested ===
        "object"
    ) {
      for (
        const key of keys
      ) {
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
     * OpenAI/Groq style.
     */
    if (
      Array.isArray(
        data.choices
      )
    ) {
      const choice =
        data.choices[0];

      if (
        choice &&
        choice.message &&
        typeof choice.message.content ===
          "string"
      ) {
        return choice.message.content.trim();
      }
    }

    return "";
  }

  /* =====================================================
     SAFE RESPONSE FORMATTER
  ===================================================== */

  function formatResponse(
    text
  ) {
    if (
      typeof text !== "string"
    ) {
      return "";
    }

    /*
     * Parse fenced code first.
     */
    const parts =
      text.split("```");

    let html = "";

    for (
      let i = 0;
      i < parts.length;
      i++
    ) {
      const part =
        parts[i];

      /*
       * Odd sections are code.
       */
      if (i % 2 === 1) {
        let code = part;
        let language = "";

        const firstNewLine =
          code.indexOf("\n");

        if (firstNewLine >= 0) {
          const possibleLanguage =
            code
              .slice(
                0,
                firstNewLine
              )
              .trim();

          if (
            /^[a-zA-Z0-9_+#.-]{1,20}$/.test(
              possibleLanguage
            )
          ) {
            language =
              possibleLanguage;

            code =
              code.slice(
                firstNewLine + 1
              );
          }
        }

        html += codeBlock(
          code.replace(
            /\n$/,
            ""
          ),
          language
        );
      } else {
        html +=
          formatText(part);
      }
    }

    return html;
  }

  function formatText(
    text
  ) {
    const lines =
      text.split(/\r?\n/);

    let html = "";

    let list = null;

    function closeList() {
      if (list === "ul") {
        html += "</ul>";
      }

      if (list === "ol") {
        html += "</ol>";
      }

      list = null;
    }

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {
      const raw =
        lines[i];

      const line =
        escapeHTML(raw);

      if (!line.trim()) {
        closeList();

        html +=
          "<br>";

        continue;
      }

      /*
       * Headings
       */
      const heading =
        line.match(
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
          "<h" +
          (level + 1) +
          ">" +
          inlineFormat(
            heading[2]
          ) +
          "</h" +
          (level + 1) +
          ">";

        continue;
      }

      /*
       * Bullets
       */
      const bullet =
        line.match(
          /^\s*[-*•]\s+(.+)$/
        );

      if (bullet) {
        if (list !== "ul") {
          closeList();

          html += "<ul>";

          list = "ul";
        }

        html +=
          "<li>" +
          inlineFormat(
            bullet[1]
          ) +
          "</li>";

        continue;
      }

      /*
       * Numbered list
       */
      const number =
        line.match(
          /^\s*\d+[.)]\s+(.+)$/
        );

      if (number) {
        if (list !== "ol") {
          closeList();

          html += "<ol>";

          list = "ol";
        }

        html +=
          "<li>" +
          inlineFormat(
            number[1]
          ) +
          "</li>";

        continue;
      }

      closeList();

      html +=
        "<p>" +
        inlineFormat(line) +
        "</p>";
    }

    closeList();

    return html;
  }

  /* =====================================================
     INLINE FORMAT
  ===================================================== */

  function inlineFormat(
    text
  ) {
    if (!text) return "";

    const codes = [];

    /*
     * Inline code.
     */
    text = text.replace(
      /`([^`]+)`/g,
      function (_, code) {
        const token =
          "ATHARVCODE" +
          codes.length +
          "END";

        codes.push(
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
    text = text.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

    /*
     * Italic.
     */
    text = text.replace(
      /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
      "$1<em>$2</em>"
    );

    /*
     * Restore code.
     */
    codes.forEach(
      function (code, index) {
        text =
          text.replace(
            "ATHARVCODE" +
              index +
              "END",
            code
          );
      }
    );

    return text;
  }

  /* =====================================================
     CODE BLOCK
  ===================================================== */

  function codeBlock(
    code,
    language
  ) {
    const safe =
      escapeHTML(code);

    const lang =
      escapeHTML(
        language || "code"
      );

    return (
      '<div class="atharv-code-block">' +
        '<div class="atharv-code-header">' +
          '<span class="atharv-code-language">' +
            lang +
          "</span>" +
          '<button type="button" ' +
          'class="atharv-copy-code" ' +
          'data-code="' +
          encodeURIComponent(code) +
          '">' +
            "Copy Code" +
          "</button>" +
        "</div>" +
        "<pre><code>" +
          safe +
        "</code></pre>" +
      "</div>"
    );
  }

  /* =====================================================
     CODE COPY
  ===================================================== */

  async function handleCodeCopy(
    event
  ) {
    const button =
      event.target.closest(
        ".atharv-copy-code"
      );

    if (!button) return;

    event.preventDefault();

    let code =
      button.dataset.code ||
      "";

    try {
      code =
        decodeURIComponent(code);
    } catch {}

    const success =
      await copyText(code);

    const old =
      button.textContent;

    button.textContent =
      success
        ? "Copied!"
        : "Failed";

    setTimeout(
      function () {
        button.textContent =
          old || "Copy Code";
      },
      1200
    );
  }

  /* =====================================================
     ESCAPE
  ===================================================== */

  function escapeHTML(
    value
  ) {
    return String(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  /* =====================================================
     CLIPBOARD
  ===================================================== */

  async function copyText(
    text
  ) {
    try {
      if (
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(
          text
        );

        return true;
      }
    } catch {}

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

      document.body.appendChild(
        textarea
      );

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
  }

  function hideThinking() {
    if (!thinking) return;

    thinking.hidden = true;

    thinking.style.display =
      "none";
  }

  /* =====================================================
     SEND STATE
  ===================================================== */

  function setSending(
    active
  ) {
    if (sendButton) {
      sendButton.disabled =
        active;

      sendButton.classList.toggle(
        "sending",
        active
      );
    }

    /*
     * Do NOT disable messageInput.
     * This keeps the existing composer
     * appearance and behaviour.
     */
  }

  /* =====================================================
     TEXTAREA
  ===================================================== */

  function resizeInput() {
    if (!messageInput) return;

    messageInput.style.height =
      "auto";

    const max =
      window.innerWidth <= 600
        ? 140
        : 220;

    messageInput.style.height =
      Math.min(
        messageInput.scrollHeight,
        max
      ) + "px";
  }

  /* =====================================================
     SCROLL
  ===================================================== */

  function scrollBottom(
    smooth
  ) {
    if (!messages) return;

    requestAnimationFrame(
      function () {
        try {
          messages.scrollTo({
            top:
              messages.scrollHeight,
            behavior:
              smooth
                ? "smooth"
                : "auto"
          });
        } catch {
          messages.scrollTop =
            messages.scrollHeight;
        }
      }
    );
  }

  /* =====================================================
     NEW CHAT
  ===================================================== */

  function newChat() {
    if (sending) {
      showToast(
        "Please wait for response"
      );

      return;
    }

    history = [];

    saveHistory();

    attachedFile = null;

    if (fileInput) {
      fileInput.value = "";
    }

    if (attachmentInfo) {
      attachmentInfo.textContent =
        "";

      attachmentInfo.hidden =
        true;
    }

    if (messageInput) {
      messageInput.value = "";

      resizeInput();
    }

    renderHistory();

    showToast(
      "New chat started"
    );
  }

  /* =====================================================
     ATTACHMENT
  ===================================================== */

  function handleAttachment(
    event
  ) {
    const file =
      event.target.files &&
      event.target.files[0];

    attachedFile = file || null;

    if (!attachmentInfo) return;

    if (!file) {
      attachmentInfo.textContent =
        "";

      attachmentInfo.hidden =
        true;

      return;
    }

    attachmentInfo.textContent =
      file.name;

    attachmentInfo.hidden =
      false;

    showToast(
      "File selected: " +
        file.name
    );
  }

  /* =====================================================
     MEMORY
  ===================================================== */

  async function openMemory() {
    if (!memoryModal) return;

    memoryModal.hidden = false;

    memoryModal.style.display =
      "";

    if (memoryList) {
      memoryList.innerHTML =
        "Loading memory...";
    }

    try {
      const response =
        await fetch(
          "/api/memory?userId=" +
            encodeURIComponent(
              userId
            ),
          {
            method: "GET",
            cache: "no-store",
            credentials:
              "same-origin"
          }
        );

      const data =
        await response.json();

      const memories =
        Array.isArray(
          data.memories
        )
          ? data.memories
          : Array.isArray(data)
          ? data
          : [];

      if (!memoryList) return;

      memoryList.innerHTML = "";

      if (!memories.length) {
        memoryList.textContent =
          "No saved memories yet.";

        return;
      }

      memories.forEach(
        function (item) {
          const div =
            document.createElement(
              "div"
            );

          div.className =
            "memory-item";

          div.textContent =
            typeof item ===
            "string"
              ? item
              : item.memory ||
                item.content ||
                "";

          memoryList.appendChild(
            div
          );
        }
      );
    } catch (error) {
      if (memoryList) {
        memoryList.textContent =
          "Memory could not be loaded.";
      }
    }
  }

  function closeMemory() {
    if (!memoryModal) return;

    memoryModal.hidden = true;

    memoryModal.style.display =
      "none";
  }

  /* =====================================================
     TOAST
  ===================================================== */

  let toastTimer = null;

  function showToast(
    message
  ) {
    if (!toast) {
      console.log(message);
      return;
    }

    toast.textContent = message;

    toast.hidden = false;

    toast.classList.add(
      "show"
    );

    clearTimeout(toastTimer);

    toastTimer =
      setTimeout(
        function () {
          toast.classList.remove(
            "show"
          );

          setTimeout(
            function () {
              toast.hidden = true;
            },
            200
          );
        },
        2200
      );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  function friendlyError(
    error
  ) {
    const text =
      error &&
      error.message
        ? error.message
        : String(error || "");

    if (
      /failed to fetch/i.test(
        text
      )
    ) {
      return (
        "Network connection problem. " +
        "Please check your internet and try again."
      );
    }

    if (
      /429/.test(text)
    ) {
      return (
        "Too many requests right now. " +
        "Please wait a moment and try again."
      );
    }

    if (
      /500|502|503|504/.test(
        text
      )
    ) {
      return (
        "Atharv server is temporarily unavailable. " +
        "Please try again."
      );
    }

    return (
      text ||
      "Something went wrong."
    );
  }

  /* =====================================================
     ONLINE STATUS
  ===================================================== */

  window.addEventListener(
    "online",
    function () {
      showToast(
        "Internet connection restored"
      );
    }
  );

  window.addEventListener(
    "offline",
    function () {
      showToast(
        "You are offline"
      );
    }
  );

  /* =====================================================
     PUBLIC DEBUG
  ===================================================== */

  window.AtharvAI = {
    version: "17.1.1",

    getUserId: function () {
      return userId;
    },

    getHistory: function () {
      return history.slice();
    },

    clearHistory: function () {
      if (sending) return;

      history = [];

      saveHistory();

      renderHistory();
    },

    stop: function () {
      if (abortController) {
        try {
          abortController.abort();
        } catch {}
      }
    }
  };
})();
