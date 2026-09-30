"use strict";

/*
=========================================================
 ATHARV AI FRONTEND
 Version 17.1.0 ADVANCED
 --------------------------------------------------------
 Compatible with:
 - index.html v17.0.3+
 - style.css v17.1.0+
 - Direct non-module frontend
 - /api/chat
 - /api/chat/research
 - /api/memory
 - Mobile Android / PWA

 FEATURES
 --------------------------------------------------------
 ✓ Stable chat sending
 ✓ Live research mode
 ✓ Local chat history
 ✓ Stable user ID
 ✓ Memory API
 ✓ Stop generation
 ✓ Regenerate response
 ✓ Copy response
 ✓ Edit user message
 ✓ Markdown rendering
 ✓ Code blocks
 ✓ Copy code
 ✓ Chat export
 ✓ Clear chat
 ✓ Attachment preparation
 ✓ Better errors
 ✓ Request cancellation
 ✓ Auto scroll
 ✓ Mobile composer
 ✓ Future AI modes foundation
=========================================================
*/

(function () {

  /* =====================================================
     CONFIG
  ===================================================== */

  const API_BASE = "";

  const MAX_MESSAGE_LENGTH = 12000;

  const MAX_HISTORY = 30;

  const SEND_HISTORY = 12;

  const REQUEST_TIMEOUT = 120000;

  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  const USER_KEY = "atharv_user_id_v17";

  const HISTORY_KEY = "atharv_chat_history_v17";

  const LIVE_KEY = "atharv_live_mode_v17";

  const MODE_KEY = "atharv_ai_mode_v17";


  /* =====================================================
     STATE
  ===================================================== */

  let conversation = [];

  let sending = false;

  let liveMode = false;

  let currentMode = "auto";

  let currentController = null;

  let toastTimer = null;

  let selectedFile = null;


  /* =====================================================
     DOM
  ===================================================== */

  const form =
    document.getElementById("chatForm");

  const input =
    document.getElementById("messageInput");

  const sendButton =
    document.getElementById("sendButton");

  const messages =
    document.getElementById("messages");

  const welcome =
    document.getElementById("welcome");

  const thinking =
    document.getElementById("thinking");

  const liveButton =
    document.getElementById("liveButton");

  const newChatButton =
    document.getElementById("newChatButton");

  const memoryButton =
    document.getElementById("memoryButton");

  const memoryModal =
    document.getElementById("memoryModal");

  const closeMemoryButton =
    document.getElementById("closeMemoryButton");

  const memoryList =
    document.getElementById("memoryList");

  const toast =
    document.getElementById("toast");

  const attachmentButton =
    document.getElementById("attachmentButton");

  const fileInput =
    document.getElementById("fileInput");

  const attachmentInfo =
    document.getElementById("attachmentInfo");


  /* =====================================================
     SAFETY CHECK
  ===================================================== */

  if (!form || !input || !messages) {

    console.error(
      "ATHARV ERROR: Required chat elements not found."
    );

    return;
  }


  /* =====================================================
     USER ID
  ===================================================== */

  function getUserId() {

    let id =
      localStorage.getItem(USER_KEY);

    if (id) {
      return id;
    }

    try {

      if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID ===
          "function"
      ) {

        id =
          globalThis.crypto.randomUUID();

      } else {

        id =
          "atharv-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2);

      }

    } catch (error) {

      id =
        "atharv-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2);
    }

    localStorage.setItem(
      USER_KEY,
      id
    );

    return id;
  }


  /* =====================================================
     HISTORY
  ===================================================== */

  function loadHistory() {

    try {

      const raw =
        localStorage.getItem(
          HISTORY_KEY
        );

      if (!raw) {
        return [];
      }

      const parsed =
        JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(function (item) {

          return (
            item &&
            (
              item.role === "user" ||
              item.role === "assistant"
            ) &&
            typeof item.content === "string"
          );

        })
        .slice(-MAX_HISTORY);

    } catch (error) {

      console.error(
        "History load error:",
        error
      );

      return [];
    }
  }


  function saveHistory() {

    try {

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(
          conversation.slice(-MAX_HISTORY)
        )
      );

    } catch (error) {

      console.error(
        "History save error:",
        error
      );
    }
  }


  /* =====================================================
     ESCAPE HTML
  ===================================================== */

  function escapeHtml(value) {

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* =====================================================
     MARKDOWN
     Safe lightweight renderer
  ===================================================== */

  function renderMarkdown(value) {

    let text =
      escapeHtml(value || "");


    /*
     CODE BLOCKS
    */

    const codeBlocks = [];

    text =
      text.replace(
        /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g,
        function (
          full,
          language,
          code
        ) {

          const id =
            "atharv-code-" +
            codeBlocks.length;

          codeBlocks.push({
            id: id,
            code: code
          });

          return (
            '<div class="atharv-code-block">' +

              '<div class="atharv-code-header">' +

                '<span>' +
                  escapeHtml(
                    language ||
                    "code"
                  ) +
                '</span>' +

                '<button ' +
                  'type="button" ' +
                  'class="atharv-copy-code" ' +
                  'data-code-id="' +
                  id +
                  '">' +
                  'Copy' +
                '</button>' +

              '</div>' +

              '<pre><code id="' +
                id +
                '">' +
                code +
              '</code></pre>' +

            '</div>'
          );
        }
      );


    /*
     INLINE CODE
    */

    text =
      text.replace(
        /`([^`\n]+)`/g,
        "<code>$1</code>"
      );


    /*
     HEADINGS
    */

    text =
      text.replace(
        /^### (.+)$/gm,
        "<h4>$1</h4>"
      );

    text =
      text.replace(
        /^## (.+)$/gm,
        "<h3>$1</h3>"
      );

    text =
      text.replace(
        /^# (.+)$/gm,
        "<h2>$1</h2>"
      );


    /*
     BOLD
    */

    text =
      text.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      );


    /*
     ITALIC
    */

    text =
      text.replace(
        /(^|[^\*])\*([^*\n]+)\*/g,
        "$1<em>$2</em>"
      );


    /*
     UNORDERED LIST
    */

    text =
      text.replace(
        /^[•*-] (.+)$/gm,
        "<li>$1</li>"
      );

    text =
      text.replace(
        /(<li>.*<\/li>)/gs,
        "<ul>$1</ul>"
      );


    /*
     ORDERED LIST
    */

    text =
      text.replace(
        /^\d+\.\s+(.+)$/gm,
        "<li>$1</li>"
      );


    /*
     LINKS
     */

    text =
      text.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );


    /*
     NEW LINES
    */

    text =
      text.replace(
        /\n/g,
        "<br>"
      );


    /*
     Restore code block line breaks
    */

    text =
      text.replace(
        /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
        function (
          full,
          attrs,
          code
        ) {

          return (
            "<pre><code" +
            attrs +
            ">" +
            code.replace(
              /<br>/g,
              "\n"
            ) +
            "</code></pre>"
          );
        }
      );


    return text;
  }


  /* =====================================================
     COPY TEXT
  ===================================================== */

  async function copyText(text) {

    try {

      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {

        await navigator.clipboard.writeText(
          text
        );

      } else {

        const textarea =
          document.createElement("textarea");

        textarea.value = text;

        textarea.style.position =
          "fixed";

        textarea.style.opacity =
          "0";

        document.body.appendChild(
          textarea
        );

        textarea.select();

        document.execCommand(
          "copy"
        );

        textarea.remove();
      }

      showToast(
        "Copied."
      );

    } catch (error) {

      console.error(
        "Copy error:",
        error
      );

      showToast(
        "Copy nahi ho paaya."
      );
    }
  }


  /* =====================================================
     RENDER MESSAGE
  ===================================================== */

  function renderMessage(
    role,
    content,
    options
  ) {

    options =
      options || {};


    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      role === "user"
        ? "message-row user-row"
        : "message-row assistant-row";


    const bubble =
      document.createElement(
        "div"
      );

    bubble.className =
      role === "user"
        ? "message user-message"
        : "message assistant-message";


    if (role === "user") {

      bubble.textContent =
        content || "";

    } else {

      bubble.innerHTML =
        renderMarkdown(
          content || ""
        );
    }


    wrapper.appendChild(
      bubble
    );


    /*
     MESSAGE ACTIONS
    */

    const actions =
      document.createElement(
        "div"
      );

    actions.className =
      "atharv-message-actions";


    if (
      role === "assistant" &&
      content
    ) {

      const copyButton =
        document.createElement(
          "button"
        );

      copyButton.type =
        "button";

      copyButton.className =
        "atharv-message-action";

      copyButton.textContent =
        "Copy";

      copyButton.addEventListener(
        "click",
        function () {

          copyText(
            content
          );

        }
      );

      actions.appendChild(
        copyButton
      );
    }


    if (
      role === "user" &&
      !options.disableEdit
    ) {

      const editButton =
        document.createElement(
          "button"
        );

      editButton.type =
        "button";

      editButton.className =
        "atharv-message-action";

      editButton.textContent =
        "Edit";

      editButton.addEventListener(
        "click",
        function () {

          editUserMessage(
            content
          );

        }
      );

      actions.appendChild(
        editButton
      );
    }


    if (
      role === "assistant" &&
      !options.disableRegenerate
    ) {

      const regenerateButton =
        document.createElement(
          "button"
        );

      regenerateButton.type =
        "button";

      regenerateButton.className =
        "atharv-message-action";

      regenerateButton.textContent =
        "Regenerate";

      regenerateButton.addEventListener(
        "click",
        function () {

          regenerateLastResponse();

        }
      );

      actions.appendChild(
        regenerateButton
      );
    }


    if (
      actions.children.length
    ) {

      wrapper.appendChild(
        actions
      );
    }


    messages.appendChild(
      wrapper
    );


    /*
     CODE COPY BUTTONS
    */

    wrapper
      .querySelectorAll(
        ".atharv-copy-code"
      )
      .forEach(
        function (button) {

          button.addEventListener(
            "click",
            function () {

              const codeId =
                button.dataset.codeId;

              const code =
                document.getElementById(
                  codeId
                );

              if (!code) {
                return;
              }

              copyText(
                code.textContent
              );

            }
          );

        }
      );


    scrollBottom();
  }


  /* =====================================================
     RENDER CONVERSATION
  ===================================================== */

  function renderConversation() {

    messages.innerHTML = "";


    if (
      !conversation.length
    ) {

      if (welcome) {
        welcome.classList.remove(
          "hidden"
        );
      }

      return;
    }


    if (welcome) {
      welcome.classList.add(
        "hidden"
      );
    }


    conversation.forEach(
      function (item) {

        if (
          !item ||
          !(
            item.role === "user" ||
            item.role === "assistant"
          )
        ) {

          return;
        }


        renderMessage(
          item.role,
          item.content || ""
        );

      }
    );


    scrollBottom();
  }


  /* =====================================================
     SCROLL
  ===================================================== */

  function scrollBottom() {

    setTimeout(
      function () {

        window.scrollTo({
          top:
            document.body.scrollHeight,
          behavior: "smooth"
        });

      },
      30
    );
  }


  /* =====================================================
     THINKING
  ===================================================== */

  function showThinking() {

    if (!thinking) {
      return;
    }

    thinking.classList.remove(
      "hidden"
    );

    scrollBottom();
  }


  function hideThinking() {

    if (!thinking) {
      return;
    }

    thinking.classList.add(
      "hidden"
    );
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

        },
        2800
      );
  }


  /* =====================================================
     API REQUEST
  ===================================================== */

  async function apiRequest(
    url,
    options,
    externalSignal
  ) {

    options =
      options || {};


    const controller =
      new AbortController();


    currentController =
      controller;


    const timeout =
      setTimeout(
        function () {

          controller.abort();

        },
        REQUEST_TIMEOUT
      );


    if (externalSignal) {

      if (
        externalSignal.aborted
      ) {

        controller.abort();

      } else {

        externalSignal.addEventListener(
          "abort",
          function () {

            controller.abort();

          },
          {
            once: true
          }
        );
      }
    }


    try {

      const requestOptions =
        {
          ...options,

          signal:
            controller.signal,

          cache:
            "no-store",

          credentials:
            "same-origin",

          headers:
            {
              "Content-Type":
                "application/json",

              ...(options.headers || {})
            }
        };


      const response =
        await fetch(
          API_BASE + url,
          requestOptions
        );


      const text =
        await response.text();


      let data =
        null;


      try {

        data =
          text
            ? JSON.parse(text)
            : null;

      } catch (error) {

        data =
          {
            success: false,

            error:
              text ||
              "Invalid server response."
          };
      }


      if (!response.ok) {

        throw new Error(
          data &&
          (
            data.error ||
            data.message
          )
            ? (
                data.error ||
                data.message
              )
            : (
                "Server error: " +
                response.status
              )
        );
      }


      return data;


    } catch (error) {

      if (
        error &&
        error.name ===
          "AbortError"
      ) {

        throw new Error(
          "REQUEST_ABORTED"
        );
      }


      throw error;


    } finally {

      clearTimeout(
        timeout
      );


      if (
        currentController ===
        controller
      ) {

        currentController =
          null;
      }
    }
  }


  /* =====================================================
     EXTRACT AI REPLY
  ===================================================== */

  function extractReply(
    data
  ) {

    if (!data) {
      return "";
    }


    const possible =
      [

        data.reply,

        data.response,

        data.answer,

        data.message,

        data.content,

        data.text,

        data.result &&
          data.result.reply,

        data.result &&
          data.result.answer,

        data.result &&
          data.result.response,

        data.data &&
          data.data.reply,

        data.data &&
          data.data.answer,

        data.data &&
          data.data.response

      ];


    for (
      let i = 0;
      i < possible.length;
      i++
    ) {

      if (
        typeof possible[i] ===
          "string" &&
        possible[i].trim()
      ) {

        return possible[i].trim();
      }
    }


    return "";
  }


  /* =====================================================
     BUILD HISTORY
  ===================================================== */

  function buildHistory() {

    return conversation
      .slice(-SEND_HISTORY)
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
  }


  /* =====================================================
     SEND TO ATHARV
  ===================================================== */

  async function sendToAtharv(
    message
  ) {

    const history =
      buildHistory();


    let endpoint =
      "/api/chat";


    let body =
      {
        message:
          message,

        history:
          history,

        chatHistory:
          history,

        userId:
          getUserId(),

        mode:
          currentMode,

        live:
          liveMode
      };


    /*
     LIVE RESEARCH
    */

    if (liveMode) {

      endpoint =
        "/api/chat/research";


      body =
        {
          query:
            message,

          message:
            message,

          userId:
            getUserId(),

          history:
            history,

          mode:
            "research"
        };
    }


    /*
     OPTIONAL ATTACHMENT METADATA

     This does NOT pretend that the backend
     understands the file. It only sends metadata.
    */

    if (selectedFile) {

      body.attachment =
        {
          name:
            selectedFile.name,

          type:
            selectedFile.type,

          size:
            selectedFile.size
        };
    }


    console.log(
      "ATHARV SEND:",
      endpoint,
      body
    );


    const data =
      await apiRequest(
        endpoint,
        {
          method:
            "POST",

          body:
            JSON.stringify(
              body
            )
        }
      );


    console.log(
      "ATHARV RESPONSE:",
      data
    );


    const reply =
      extractReply(
        data
      );


    if (!reply) {

      console.error(
        "ATHARV EMPTY RESPONSE:",
        data
      );


      throw new Error(
        "Atharv ne koi response nahi diya."
      );
    }


    return reply;
  }


  /* =====================================================
     HANDLE SEND
  ===================================================== */

  async function handleSend(
    customMessage
  ) {

    if (sending) {
      return;
    }


    const message =
      typeof customMessage ===
        "string"
        ? customMessage.trim()
        : input.value.trim();


    if (!message) {

      showToast(
        "Pehle message likhiye."
      );

      input.focus();

      return;
    }


    if (
      message.length >
      MAX_MESSAGE_LENGTH
    ) {

      showToast(
        "Message bahut lamba hai."
      );

      return;
    }


    sending = true;


    if (sendButton) {
      sendButton.disabled =
        true;
    }

    input.disabled =
      true;


    if (welcome) {
      welcome.classList.add(
        "hidden"
      );
    }


    conversation.push(
      {
        role:
          "user",

        content:
          message
      }
    );


    saveHistory();


    renderMessage(
      "user",
      message
    );


    input.value = "";

    autoResize();


    showThinking();


    try {

      const reply =
        await sendToAtharv(
          message
        );


      conversation.push(
        {
          role:
            "assistant",

          content:
            reply
        }
      );


      saveHistory();


      renderMessage(
        "assistant",
        reply
      );


      clearSelectedFile();


    } catch (error) {

      console.error(
        "ATHARV SEND ERROR:",
        error
      );


      if (
        error.message ===
        "REQUEST_ABORTED"
      ) {

        renderMessage(
          "assistant",
          "Response stopped."
        );

      } else {

        renderMessage(
          "assistant",
          "Sorry, response nahi mil paaya.\n\n" +
          (
            error.message ||
            "Please try again."
          )
        );


        showToast(
          error.message ||
          "Message send nahi hua."
        );
      }


    } finally {

      hideThinking();


      sending =
        false;


      if (sendButton) {
        sendButton.disabled =
          false;
      }


      input.disabled =
        false;


      input.focus();


      currentController =
        null;
    }
  }


  /* =====================================================
     STOP GENERATION
  ===================================================== */

  function stopGeneration() {

    if (
      currentController
    ) {

      currentController.abort();

      currentController =
        null;

      showToast(
        "Response stopped."
      );
    }
  }


  /*
   Allow clicking the send button while sending
   to stop the current request.

   Normal state = Send
   Sending state = Stop
  */

  if (sendButton) {

    sendButton.addEventListener(
      "click",
      function (event) {

        if (sending) {

          event.preventDefault();

          stopGeneration();

        }

      },
      true
    );
  }


  /* =====================================================
     FORM SUBMIT
  ===================================================== */

  form.addEventListener(
    "submit",
    function (event) {

      event.preventDefault();

      event.stopPropagation();


      if (!sending) {

        handleSend();

      }

    },
    false
  );


  /* =====================================================
     ENTER KEY
  ===================================================== */

  input.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();


        if (!sending) {

          handleSend();

        }

      }

    }
  );


  /* =====================================================
     AUTO RESIZE
  ===================================================== */

  function autoResize() {

    input.style.height =
      "auto";


    input.style.height =
      Math.min(
        input.scrollHeight,
        140
      ) +
      "px";
  }


  input.addEventListener(
    "input",
    autoResize
  );


  /* =====================================================
     LIVE MODE
  ===================================================== */

  function updateLiveButton() {

    if (!liveButton) {
      return;
    }


    if (liveMode) {

      liveButton.innerHTML =
        '<span class="live-icon">◉</span>' +
        '<span class="live-text">Live ON</span>';

      liveButton.classList.add(
        "active"
      );

      liveButton.setAttribute(
        "aria-pressed",
        "true"
      );

      liveButton.title =
        "Live research enabled";

    } else {

      liveButton.innerHTML =
        '<span class="live-icon">◉</span>' +
        '<span class="live-text">Live</span>';

      liveButton.classList.remove(
        "active"
      );

      liveButton.setAttribute(
        "aria-pressed",
        "false"
      );

      liveButton.title =
        "Live research";
    }
  }


  liveMode =
    localStorage.getItem(
      LIVE_KEY
    ) === "true";


  updateLiveButton();


  if (liveButton) {

    liveButton.addEventListener(
      "click",
      function () {

        liveMode =
          !liveMode;


        localStorage.setItem(
          LIVE_KEY,
          String(
            liveMode
          )
        );


        updateLiveButton();


        showToast(
          liveMode
            ? "Live research ON"
            : "Live research OFF"
        );

      }
    );
  }


  /* =====================================================
     AI MODE FOUNDATION
  ===================================================== */

  function loadMode() {

    const saved =
      localStorage.getItem(
        MODE_KEY
      );


    const allowed =
      [
        "auto",
        "chat",
        "research",
        "study",
        "coding",
        "creative"
      ];


    if (
      allowed.includes(
        saved
      )
    ) {

      currentMode =
        saved;

    } else {

      currentMode =
        "auto";
    }
  }


  loadMode();


  /*
   Public helper for future UI.
  */

  window.AtharvAI =
    window.AtharvAI || {};


  window.AtharvAI.setMode =
    function (mode) {

      const allowed =
        [
          "auto",
          "chat",
          "research",
          "study",
          "coding",
          "creative"
        ];


      if (
        !allowed.includes(
          mode
        )
      ) {

        return false;
      }


      currentMode =
        mode;


      localStorage.setItem(
        MODE_KEY,
        mode
      );


      showToast(
        "Mode: " +
        mode
      );


      return true;
    };


  window.AtharvAI.getMode =
    function () {

      return currentMode;

    };


  /* =====================================================
     NEW CHAT
  ===================================================== */

  if (newChatButton) {

    newChatButton.addEventListener(
      "click",
      function () {

        if (sending) {

          showToast(
            "Pehle current response stop karein."
          );

          return;
        }


        conversation =
          [];


        localStorage.removeItem(
          HISTORY_KEY
        );


        clearSelectedFile();


        renderConversation();


        input.value = "";

        autoResize();

        input.focus();


        showToast(
          "New chat started."
        );

      }
    );
  }


  /* =====================================================
     SUGGESTIONS
  ===================================================== */

  document
    .querySelectorAll(
      ".suggestion"
    )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const text =
              button
                .querySelector(
                  ".suggestion-content"
                );


            input.value =
              text
                ? text.textContent.trim()
                : button.textContent.trim();


            autoResize();

            input.focus();

          }
        );

      }
    );


  /* =====================================================
     EXAMPLE CHIPS
  ===================================================== */

  document
    .querySelectorAll(
      ".example-chip"
    )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            input.value =
              button.textContent.trim();

            autoResize();

            input.focus();

          }
        );

      }
    );


  /* =====================================================
     ATTACHMENT
  ===================================================== */

  function clearSelectedFile() {

    selectedFile =
      null;


    if (fileInput) {
      fileInput.value =
        "";
    }


    if (attachmentInfo) {
      attachmentInfo.textContent =
        "";
    }
  }


  if (
    attachmentButton &&
    fileInput
  ) {

    attachmentButton.addEventListener(
      "click",
      function () {

        if (sending) {

          showToast(
            "Response complete hone dein."
          );

          return;
        }


        fileInput.click();

      }
    );


    fileInput.addEventListener(
      "change",
      function () {

        const file =
          fileInput.files &&
          fileInput.files[0];


        if (!file) {
          return;
        }


        if (
          file.size >
          MAX_FILE_SIZE
        ) {

          showToast(
            "File 20 MB se chhoti honi chahiye."
          );


          clearSelectedFile();

          return;
        }


        selectedFile =
          file;


        if (attachmentInfo) {

          const size =
            formatFileSize(
              file.size
            );


          attachmentInfo.textContent =
            "📎 " +
            file.name +
            " • " +
            size;

        }


        showToast(
          "File attached: " +
          file.name
        );

      }
    );
  }


  function formatFileSize(
    bytes
  ) {

    if (
      !Number.isFinite(
        bytes
      )
    ) {

      return "";
    }


    if (
      bytes <
      1024
    ) {

      return (
        bytes +
        " B"
      );
    }


    if (
      bytes <
      1024 * 1024
    ) {

      return (
        (bytes / 1024)
          .toFixed(1) +
        " KB"
      );
    }


    return (
      (bytes /
        (1024 * 1024))
        .toFixed(1) +
      " MB"
    );
  }


  /* =====================================================
     MEMORY
  ===================================================== */

  async function loadMemory() {

    if (!memoryList) {
      return;
    }


    memoryList.textContent =
      "Loading...";


    try {

      const userId =
        encodeURIComponent(
          getUserId()
        );


      const data =
        await apiRequest(
          "/api/memory?userId=" +
          userId,
          {
            method:
              "GET"
          }
        );


      const memories =
        Array.isArray(data)
          ? data
          : (
              data.memories ||
              data.result ||
              data.data ||
              []
            );


      if (
        !Array.isArray(
          memories
        ) ||
        !memories.length
      ) {

        memoryList.innerHTML =
          "<p>No saved memory yet.</p>";

        return;
      }


      memoryList.innerHTML =
        "";


      memories.forEach(
        function (memory) {

          const item =
            document.createElement(
              "div"
            );


          item.className =
            "memory-item";


          const text =
            typeof memory ===
              "string"
              ? memory
              : (
                  memory.memory ||
                  memory.content ||
                  ""
                );


          item.textContent =
            "🧠 " +
            text;


          memoryList.appendChild(
            item
          );

        }
      );


    } catch (error) {

      console.error(
        "Memory error:",
        error
      );


      memoryList.innerHTML =
        "<p>Memory load nahi ho paayi.</p>";
    }
  }


  if (memoryButton) {

    memoryButton.addEventListener(
      "click",
      function () {

        if (!memoryModal) {
          return;
        }


        memoryModal.classList.remove(
          "hidden"
        );


        loadMemory();

      }
    );
  }


  if (closeMemoryButton) {

    closeMemoryButton.addEventListener(
      "click",
      function () {

        memoryModal.classList.add(
          "hidden"
        );

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

          memoryModal.classList.add(
            "hidden"
          );

        }

      }
    );
  }


  /* =====================================================
     EDIT USER MESSAGE
  ===================================================== */

  function editUserMessage(
    content
  ) {

    if (sending) {

      showToast(
        "Current response complete hone dein."
      );

      return;
    }


    input.value =
      content || "";


    autoResize();

    input.focus();


    showToast(
      "Message edit karein aur Send dabayein."
    );
  }


  /* =====================================================
     REGENERATE
  ===================================================== */

  async function regenerateLastResponse() {

    if (sending) {
      return;
    }


    let lastUserIndex =
      -1;


    for (
      let i =
        conversation.length - 1;
      i >= 0;
      i--
    ) {

      if (
        conversation[i] &&
        conversation[i].role ===
          "user"
      ) {

        lastUserIndex =
          i;

        break;
      }
    }


    if (
      lastUserIndex === -1
    ) {

      showToast(
        "Regenerate karne ke liye message nahi hai."
      );

      return;
    }


    const userMessage =
      conversation[
        lastUserIndex
      ].content;


    /*
     Remove last assistant response
     */

    if (
      conversation.length >
        lastUserIndex + 1 &&
      conversation[
        conversation.length - 1
      ].role === "assistant"
    ) {

      conversation.pop();
    }


    /*
     Remove rendered conversation
     and rebuild.
    */

    saveHistory();

    renderConversation();


    /*
     Re-send without adding
     another user message.
    */

    sending =
      true;


    if (sendButton) {
      sendButton.disabled =
        true;
    }

    input.disabled =
      true;


    showThinking();


    try {

      const reply =
        await sendToAtharv(
          userMessage
        );


      conversation.push(
        {
          role:
            "assistant",

          content:
            reply
        }
      );


      saveHistory();


      renderConversation();


    } catch (error) {

      console.error(
        "Regenerate error:",
        error
      );


      showToast(
        error.message ||
        "Regenerate failed."
      );


    } finally {

      hideThinking();


      sending =
        false;


      if (sendButton) {
        sendButton.disabled =
          false;
      }


      input.disabled =
        false;

      input.focus();
    }
  }


  /* =====================================================
     EXPORT CHAT
  ===================================================== */

  function exportChat() {

    if (
      !conversation.length
    ) {

      showToast(
        "Export karne ke liye chat empty hai."
      );

      return;
    }


    const lines =
      conversation.map(
        function (item) {

          const role =
            item.role === "user"
              ? "You"
              : "Atharv";


          return (
            role +
            ":\n" +
            item.content +
            "\n"
          );
        }
      );


    const text =
      "ATHARV AI CHAT\n" +
      "====================\n\n" +
      lines.join(
        "\n"
      );


    const blob =
      new Blob(
        [text],
        {
          type:
            "text/plain;charset=utf-8"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;

    link.download =
      "atharv-chat-" +
      new Date()
        .toISOString()
        .slice(0, 10) +
      ".txt";


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
      url
    );


    showToast(
      "Chat exported."
    );
  }


  /*
   Public export helper.
   Can later be connected to Settings.
  */

  window.AtharvAI.exportChat =
    exportChat;


  /* =====================================================
     CLEAR CHAT HELPER
  ===================================================== */

  window.AtharvAI.clearChat =
    function () {

      if (sending) {
        return false;
      }


      conversation =
        [];


      localStorage.removeItem(
        HISTORY_KEY
      );


      clearSelectedFile();


      renderConversation();


      input.value = "";

      autoResize();

      input.focus();


      return true;
    };


  /* =====================================================
     INITIALIZE
  ===================================================== */

  conversation =
    loadHistory();


  renderConversation();


  autoResize();


  loadMode();


  input.focus();


  console.log(
    "================================"
  );

  console.log(
    " ATHARV AI 17.1.0 FRONTEND"
  );

  console.log(
    " Advanced frontend loaded."
  );

  console.log(
    " Chat handler: READY"
  );

  console.log(
    " Live mode:",
    liveMode
  );

  console.log(
    " AI mode:",
    currentMode
  );

  console.log(
    " User ID:",
    getUserId()
  );

  console.log(
    "================================"
  );

})();
