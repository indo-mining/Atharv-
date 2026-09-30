"use strict";

/*
=========================================================
 ATHARV AI FRONTEND
 Version 17.2.0
 --------------------------------------------------------
 PRESERVED:
 - Existing UI
 - Existing index.html
 - Existing CSS
 - Normal chat
 - Live research
 - Memory
 - Attachment preview
 - Local history
 - PWA compatibility
 - Existing /api/chat
 - Existing /api/chat/research

 ADVANCED:
 - Copy message
 - Edit user message
 - Regenerate assistant response
 - Copy Code
 - Code blocks
 - Headings
 - Bulleted lists
 - Numbered lists
 - Bold
 - Italic
 - Inline code
 - Safe HTML escaping
 - Mobile-friendly actions
 - Request timeout
 - Abort support
 - Better error handling

 IMPORTANT:
 - No ?message= navigation
 - No form default GET request
 - User content never rendered with raw innerHTML
=========================================================
*/

(function () {
  "use strict";

  /* =====================================================
     CONFIG
  ===================================================== */

  const API_BASE = "";

  const MAX_MESSAGE_LENGTH = 12000;

  const REQUEST_TIMEOUT = 120000;

  const MAX_HISTORY_ITEMS = 100;

  const MAX_SERVER_HISTORY = 12;

  const STORAGE = {
    USER_ID: "atharv_user_id_v17",

    HISTORY: "atharv_chat_history_v17",

    LIVE: "atharv_live_mode_v17"
  };


  /* =====================================================
     STATE
  ===================================================== */

  let initialized = false;

  let sending = false;

  let abortController = null;

  let attachedFile = null;

  let toastTimer = null;

  let history = loadHistory();

  let liveMode = loadLiveMode();

  const userId = getUserId();


  /* =====================================================
     DOM
  ===================================================== */

  const chatForm =
    document.getElementById("chatForm");

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

    hideThinking();

    console.log(
      "ATHARV AI frontend loaded:",
      "17.2.0"
    );
  }


  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }


  /* =====================================================
     EVENTS
  ===================================================== */

  function bindEvents() {

    /*
     * Chat form
     *
     * IMPORTANT:
     * preventDefault prevents browser GET:
     * /?message=...
     */
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


    /*
     * Enter key
     */
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


    /*
     * Send button
     */
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


    /*
     * New chat
     */
    if (newChatButton) {
      newChatButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          newChat();
        }
      );
    }


    /*
     * Live search
     */
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


    /*
     * Attachment
     */
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


    /*
     * Memory
     */
    if (memoryButton) {
      memoryButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          openMemory();
        }
      );
    }


    if (closeMemoryButton) {
      closeMemoryButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          closeMemory();
        }
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
     * Welcome suggestions
     */
    document
      .querySelectorAll(
        ".suggestion, .example-chip"
      )
      .forEach(
        function (button) {

          button.addEventListener(
            "click",
            function (event) {
              event.preventDefault();

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
        }
      );


    /*
     * Dynamic message actions
     */
    if (messages) {
      messages.addEventListener(
        "click",
        handleMessageAction
      );
    }


    /*
     * Dynamic code copy
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

      if (id) {
        return id;
      }


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
     HISTORY LOAD
  ===================================================== */

  function loadHistory() {
    try {

      const raw =
        localStorage.getItem(
          STORAGE.HISTORY
        );


      if (!raw) {
        return [];
      }


      const data =
        JSON.parse(raw);


      if (!Array.isArray(data)) {
        return [];
      }


      return data
        .filter(
          function (item) {

            return (
              item &&
              (
                item.role === "user" ||
                item.role === "assistant"
              ) &&
              typeof item.content ===
                "string"
            );
          }
        )
        .slice(
          -MAX_HISTORY_ITEMS
        );

    } catch (error) {

      console.warn(
        "History load failed:",
        error
      );

      return [];
    }
  }


  /* =====================================================
     HISTORY SAVE
  ===================================================== */

  function saveHistory() {
    try {

      localStorage.setItem(
        STORAGE.HISTORY,
        JSON.stringify(
          history.slice(
            -MAX_HISTORY_ITEMS
          )
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


    /*
     * Keep existing text if HTML
     * already provides it.
     */
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
     MESSAGE RENDERING
  ===================================================== */

  function renderMessage(
    role,
    content,
    index
  ) {

    if (!messages) return;


    const row =
      document.createElement(
        "div"
      );


    row.className =
      "message-row";


    row.dataset.role =
      role;


    row.dataset.index =
      String(index);


    const bubble =
      document.createElement(
        "div"
      );


    bubble.className =
      "message " +
      (
        role === "user"
          ? "user-message"
          : "assistant-message"
      );


    /*
     * NEVER use raw innerHTML
     * for user content.
     */
    if (role === "assistant") {

      bubble.innerHTML =
        formatResponse(
          content
        );

    } else {

      bubble.textContent =
        content;
    }


    row.appendChild(
      bubble
    );


    row.appendChild(
      createActions(
        role,
        index
      )
    );


    messages.appendChild(
      row
    );
  }


  /* =====================================================
     MESSAGE ACTIONS
  ===================================================== */

  function createActions(
    role,
    index
  ) {

    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.className =
      "atharv-message-actions";


    if (role === "assistant") {

      wrapper.appendChild(
        actionButton(
          "copy",
          "Copy",
          index
        )
      );


      wrapper.appendChild(
        actionButton(
          "regenerate",
          "Regenerate",
          index
        )
      );

    } else {

      wrapper.appendChild(
        actionButton(
          "edit",
          "Edit",
          index
        )
      );


      wrapper.appendChild(
        actionButton(
          "copy",
          "Copy",
          index
        )
      );
    }


    return wrapper;
  }


  function actionButton(
    action,
    text,
    index
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


    button.dataset.index =
      String(index);


    button.textContent =
      text;


    button.setAttribute(
      "aria-label",
      text
    );


    button.title =
      text;


    return button;
  }


  /* =====================================================
     MESSAGE ACTION HANDLER
  ===================================================== */

  async function handleMessageAction(
    event
  ) {

    const button =
      event.target.closest(
        ".atharv-message-action"
      );


    if (!button) return;


    event.preventDefault();


    const index =
      Number(
        button.dataset.index
      );


    if (
      !Number.isInteger(index)
    ) {
      return;
    }


    const action =
      button.dataset.action;


    if (action === "copy") {

      await copyMessage(
        index
      );

      return;
    }


    if (action === "edit") {

      editMessage(
        index
      );

      return;
    }


    if (
      action === "regenerate"
    ) {

      await regenerate(
        index
      );
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


    const success =
      await copyText(
        item.content
      );


    showToast(
      success
        ? "Copied"
        : "Copy failed"
    );
  }


  /* =====================================================
     EDIT MESSAGE
  ===================================================== */

  function editMessage(
    index
  ) {

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
        "Please wait for current response"
      );

      return;
    }


    const assistant =
      history[
        assistantIndex
      ];


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
      !history[userIndex] ||
      history[userIndex].role !==
        "user"
    ) {

      showToast(
        "Previous message not found"
      );

      return;
    }


    const userMessage =
      history[
        userIndex
      ].content;


    /*
     * Keep user message.
     * Remove old assistant message
     * and everything after it.
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

    if (sending) {
      return;
    }


    if (!messageInput) {
      return;
    }


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


    /*
     * Clear composer only after
     * valid message.
     */
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

    if (sending) {
      return;
    }


    sending = true;


    setSending(true);


    /*
     * Add user message.
     */
    history.push({
      role: "user",
      content: message
    });


    /*
     * Keep history within limit.
     */
    history =
      history.slice(
        -MAX_HISTORY_ITEMS
      );


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
        extractReply(
          response
        );


      if (!reply) {

        throw new Error(
          "Empty response from server"
        );
      }


      history.push({
        role: "assistant",
        content: reply
      });


      history =
        history.slice(
          -MAX_HISTORY_ITEMS
        );


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

        const errorText =
          friendlyError(
            error
          );


        history.push({
          role: "assistant",
          content:
            "Sorry, response nahi mil paaya.\n\n" +
            errorText
        });


        history =
          history.slice(
            -MAX_HISTORY_ITEMS
          );


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
     API REQUEST
  ===================================================== */

  async function sendToServer(
    message
  ) {

    abortController =
      new AbortController();


    const controller =
      abortController;


    const timer =
      setTimeout(
        function () {

          try {
            controller.abort();
          } catch {}
        },
        REQUEST_TIMEOUT
      );


    try {

      let endpoint;

      let body;


      /*
       * LIVE RESEARCH
       */
      if (liveMode) {

        endpoint =
          "/api/chat/research";


        body = {
          query: message,

          message: message,

          userId: userId
        };


      /*
       * NORMAL CHAT
       */
      } else {

        endpoint =
          "/api/chat";


        const recent =
          history
            .slice(
              -MAX_SERVER_HISTORY
            )
            .map(
              function (item) {

                return {
                  role:
                    item.role,

                  content:
                    item.content
                };
              }
            );


        body = {
          message: message,

          history: recent,

          chatHistory: recent,

          userId: userId
        };
      }


      const response =
        await fetch(
          API_BASE +
            endpoint,
          {
            method: "POST",

            credentials:
              "same-origin",

            cache:
              "no-store",

            headers: {
              "Content-Type":
                "application/json",

              "Accept":
                "application/json"
            },

            body:
              JSON.stringify(
                body
              ),

            signal:
              controller.signal
          }
        );


      const raw =
        await response.text();


      let data;


      try {

        data =
          raw
            ? JSON.parse(raw)
            : {};

      } catch {

        data = {
          raw: raw
        };
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

    } finally {

      clearTimeout(
        timer
      );
    }
  }


  /* =====================================================
     RESPONSE EXTRACTION
  ===================================================== */

  function extractReply(
    data
  ) {

    if (!data) {
      return "";
    }


    const keys = [
      "reply",
      "response",
      "answer",
      "message",
      "content",
      "text"
    ];


    /*
     * Direct response
     */
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


    /*
     * Nested response
     */
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

          return nested[
            key
          ].trim();
        }
      }
    }


    /*
     * OpenAI / Groq format
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


    /*
     * OpenAI-style output text
     */
    if (
      Array.isArray(
        data.output
      )
    ) {

      const first =
        data.output[0];


      if (
        first &&
        typeof first.content ===
          "string"
      ) {

        return first.content.trim();
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
      typeof text !==
      "string"
    ) {
      return "";
    }


    /*
     * Split fenced code blocks.
     *
     * Example:
     *
     * ```python
     * print("Hello")
     * ```
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
       * Odd sections are fenced code.
       */
      if (
        i % 2 === 1
      ) {

        let code =
          part;

        let language =
          "";


        const firstNewLine =
          code.indexOf(
            "\n"
          );


        if (
          firstNewLine >= 0
        ) {

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


        html +=
          codeBlock(
            code.replace(
              /\n$/,
              ""
            ),
            language
          );

      } else {

        html +=
          formatText(
            part
          );
      }
    }


    return html;
  }


  /* =====================================================
     TEXT FORMATTER
  ===================================================== */

  function formatText(
    text
  ) {

    const lines =
      text.split(
        /\r?\n/
      );


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


      /*
       * Escape first.
       */
      const line =
        escapeHTML(
          raw
        );


      /*
       * Empty line.
       */
      if (!line.trim()) {

        closeList();

        html += "<br>";

        continue;
      }


      /*
       * H1-H4
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
       * Bullet list
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


      /*
       * Normal paragraph
       */
      closeList();


      html +=
        "<p>" +
        inlineFormat(
          line
        ) +
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

    if (!text) {
      return "";
    }


    const codes = [];


    /*
     * Inline code first.
     */
    text =
      text.replace(
        /`([^`]+)`/g,
        function (
          match,
          code
        ) {

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
     * Bold
     */
    text =
      text.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      );


    /*
     * Italic
     */
    text =
      text.replace(
        /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
      );


    /*
     * Restore inline code.
     */
    codes.forEach(
      function (
        code,
        index
      ) {

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
      escapeHTML(
        code
      );


    const lang =
      escapeHTML(
        language ||
        "code"
      );


    /*
     * data-code is encoded so quotes,
     * HTML and newlines don't break DOM.
     */
    const encoded =
      encodeURIComponent(
        code
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
          encoded +
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


    if (!button) {
      return;
    }


    event.preventDefault();


    let code =
      button.dataset.code ||
      "";


    try {

      code =
        decodeURIComponent(
          code
        );

    } catch {}


    const success =
      await copyText(
        code
      );


    const oldText =
      button.textContent;


    button.textContent =
      success
        ? "Copied!"
        : "Failed";


    button.disabled = true;


    setTimeout(
      function () {

        button.disabled =
          false;


        button.textContent =
          oldText ||
          "Copy Code";

      },
      1200
    );
  }


  /* =====================================================
     HTML ESCAPE
  ===================================================== */

  function escapeHTML(
    value
  ) {

    return String(
      value
    )
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
        typeof navigator
          .clipboard
          .writeText ===
          "function"
      ) {

        await navigator.clipboard
          .writeText(
            String(text)
          );


        return true;
      }

    } catch {}


    /*
     * Fallback for older browsers.
     */
    try {

      const textarea =
        document.createElement(
          "textarea"
        );


      textarea.value =
        String(text);


      textarea.setAttribute(
        "readonly",
        ""
      );


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


    thinking.hidden =
      false;


    thinking.style.display =
      "";
  }


  function hideThinking() {

    if (!thinking) return;


    thinking.hidden =
      true;


    thinking.style.display =
      "none";
  }


  /* =====================================================
     SEND STATE
  ===================================================== */

  function setSending(
    active
  ) {

    if (!sendButton) {
      return;
    }


    sendButton.disabled =
      active;


    sendButton.classList.toggle(
      "sending",
      active
    );


    sendButton.setAttribute(
      "aria-busy",
      String(active)
    );


    /*
     * IMPORTANT:
     * Message input stays enabled
     * to preserve existing composer.
     */
  }


  /* =====================================================
     TEXTAREA RESIZE
  ===================================================== */

  function resizeInput() {

    if (!messageInput) {
      return;
    }


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
      ) +
      "px";
  }


  /* =====================================================
     SCROLL
  ===================================================== */

  function scrollBottom(
    smooth
  ) {

    if (!messages) {
      return;
    }


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


    attachedFile =
      null;


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

      messageInput.value =
        "";

      resizeInput();

      messageInput.focus();
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


    attachedFile =
      file || null;


    if (!attachmentInfo) {
      return;
    }


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

    if (!memoryModal) {
      return;
    }


    memoryModal.hidden =
      false;


    memoryModal.style.display =
      "";


    if (memoryList) {

      memoryList.textContent =
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

            cache:
              "no-store",

            credentials:
              "same-origin",

            headers: {
              "Accept":
                "application/json"
            }
          }
        );


      if (!response.ok) {

        throw new Error(
          "Memory request failed"
        );
      }


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


      if (!memoryList) {
        return;
      }


      memoryList.innerHTML =
        "";


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


          if (
            typeof item ===
            "string"
          ) {

            div.textContent =
              item;

          } else {

            div.textContent =
              (
                item &&
                (
                  item.memory ||
                  item.content ||
                  item.text
                )
              ) || "";
          }


          memoryList.appendChild(
            div
          );
        }
      );

    } catch (error) {

      console.error(
        "Memory error:",
        error
      );


      if (memoryList) {

        memoryList.textContent =
          "Memory could not be loaded.";
      }
    }
  }


  function closeMemory() {

    if (!memoryModal) {
      return;
    }


    memoryModal.hidden =
      true;


    memoryModal.style.display =
      "none";
  }


  /* =====================================================
     TOAST
  ===================================================== */

  function showToast(
    message
  ) {

    if (!toast) {

      console.log(
        message
      );

      return;
    }


    toast.textContent =
      message;


    toast.hidden =
      false;


    toast.classList.add(
      "show"
    );


    clearTimeout(
      toastTimer
    );


    toastTimer =
      setTimeout(
        function () {

          toast.classList.remove(
            "show"
          );


          setTimeout(
            function () {

              toast.hidden =
                true;

            },
            200
          );

        },
        2200
      );
  }


  /* =====================================================
     FRIENDLY ERROR
  ===================================================== */

  function friendlyError(
    error
  ) {

    const text =
      error &&
      error.message
        ? error.message
        : String(
            error || ""
          );


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
      /401|403/.test(
        text
      )
    ) {

      return (
        "Atharv request was not authorized. " +
        "Please refresh the app and try again."
      );
    }


    if (
      /404/.test(text)
    ) {

      return (
        "Atharv API endpoint was not found. " +
        "Please check the server deployment."
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


    if (
      /empty response/i.test(
        text
      )
    ) {

      return (
        "Server ne empty response diya. " +
        "Please try again."
      );
    }


    return (
      text ||
      "Something went wrong."
    );
  }


  /* =====================================================
     ONLINE / OFFLINE
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
     WINDOW RESIZE
  ===================================================== */

  window.addEventListener(
    "resize",
    function () {

      resizeInput();
    }
  );


  /* =====================================================
     ESC KEY
  ===================================================== */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key !== "Escape"
      ) {
        return;
      }


      if (
        memoryModal &&
        !memoryModal.hidden
      ) {

        closeMemory();

        return;
      }


      /*
       * Escape can cancel active request.
       */
      if (sending) {

        if (abortController) {

          try {
            abortController.abort();
          } catch {}
        }
      }
    }
  );


  /* =====================================================
     PUBLIC DEBUG API
  ===================================================== */

  window.AtharvAI = {

    version:
      "17.2.0",


    getUserId:
      function () {
        return userId;
      },


    getHistory:
      function () {
        return history.slice();
      },


    isSending:
      function () {
        return sending;
      },


    isLive:
      function () {
        return liveMode;
      },


    clearHistory:
      function () {

        if (sending) {
          return;
        }


        history = [];


        saveHistory();


        renderHistory();
      },


    stop:
      function () {

        if (abortController) {

          try {
            abortController.abort();
          } catch {}
        }
      },


    newChat:
      function () {

        newChat();
      }
  };


})();
