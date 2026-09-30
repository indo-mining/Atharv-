"use strict";

/*
=========================================================
 ATHARV AI FRONTEND
 Version 17.0.3
 SIMPLE DIRECT FRONTEND
 --------------------------------------------------------
 FIXES:
 - Form navigation fixed
 - POST /api/chat guaranteed
 - No ES module dependency
 - Mobile composer fixed
 - Live mode
 - Local chat history
 - Stable user ID
 - Memory API
 - No service-worker dependency for chat
=========================================================
*/

(function () {

  const API_BASE = "";

  const MAX_MESSAGE_LENGTH = 12000;

  const USER_KEY = "atharv_user_id_v17";

  const HISTORY_KEY = "atharv_chat_history_v17";

  const LIVE_KEY = "atharv_live_mode_v17";


  let conversation = [];

  let sending = false;

  let liveMode = false;


  /* =====================================================
     DOM
  ===================================================== */

  const form = document.getElementById("chatForm");

  const input = document.getElementById("messageInput");

  const sendButton = document.getElementById("sendButton");

  const messages = document.getElementById("messages");

  const welcome = document.getElementById("welcome");

  const thinking = document.getElementById("thinking");

  const liveButton = document.getElementById("liveButton");

  const newChatButton = document.getElementById("newChatButton");

  const memoryButton = document.getElementById("memoryButton");

  const memoryModal = document.getElementById("memoryModal");

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

    let id = localStorage.getItem(USER_KEY);

    if (id) {
      return id;
    }

    try {

      if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === "function"
      ) {

        id = globalThis.crypto.randomUUID();

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

    localStorage.setItem(USER_KEY, id);

    return id;
  }


  /* =====================================================
     HISTORY
  ===================================================== */

  function loadHistory() {

    try {

      const raw =
        localStorage.getItem(HISTORY_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.slice(-30);

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
          conversation.slice(-30)
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
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  /* =====================================================
     RENDER
  ===================================================== */

  function renderMessage(role, content) {

    const wrapper =
      document.createElement("div");

    wrapper.className =
      role === "user"
        ? "message-row user-row"
        : "message-row assistant-row";


    const bubble =
      document.createElement("div");

    bubble.className =
      role === "user"
        ? "message user-message"
        : "message assistant-message";


    bubble.innerHTML =
      escapeHtml(content)
        .replace(/\n/g, "<br>");


    wrapper.appendChild(bubble);

    messages.appendChild(wrapper);

    scrollBottom();
  }


  function renderConversation() {

    messages.innerHTML = "";

    if (conversation.length === 0) {

      welcome.classList.remove("hidden");

      return;
    }

    welcome.classList.add("hidden");


    conversation.forEach(function (item) {

      if (
        item &&
        (item.role === "user" ||
         item.role === "assistant")
      ) {

        renderMessage(
          item.role,
          item.content || ""
        );

      }

    });

    scrollBottom();
  }


  /* =====================================================
     SCROLL
  ===================================================== */

  function scrollBottom() {

    setTimeout(function () {

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
      });

    }, 30);
  }


  /* =====================================================
     THINKING
  ===================================================== */

  function showThinking() {

    thinking.classList.remove("hidden");

    scrollBottom();
  }


  function hideThinking() {

    thinking.classList.add("hidden");
  }


  /* =====================================================
     TOAST
  ===================================================== */

  let toastTimer = null;

  function showToast(message) {

    if (!toast) {
      alert(message);
      return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
      setTimeout(function () {

        toast.classList.remove("show");

      }, 3000);
  }


  /* =====================================================
     API REQUEST
  ===================================================== */

  async function apiRequest(
    url,
    options
  ) {

    const controller =
      new AbortController();

    const timeout =
      setTimeout(function () {

        controller.abort();

      }, 120000);


    try {

      const response =
        await fetch(
          API_BASE + url,
          {
            ...options,

            signal:
              controller.signal,

            cache: "no-store",

            credentials: "same-origin",

            headers: {
              "Content-Type":
                "application/json",

              ...(options &&
                options.headers
                ? options.headers
                : {})
            }
          }
        );


      const text =
        await response.text();


      let data = null;


      try {

        data =
          text
            ? JSON.parse(text)
            : null;

      } catch (error) {

        data = {
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
            : "Server error: " +
              response.status
        );

      }


      return data;

    } catch (error) {

      if (
        error &&
        error.name === "AbortError"
      ) {

        throw new Error(
          "Atharv response timeout. Please try again."
        );

      }

      throw error;

    } finally {

      clearTimeout(timeout);
    }
  }


  /* =====================================================
     EXTRACT AI REPLY
  ===================================================== */

  function extractReply(data) {

    if (!data) {
      return "";
    }


    const possible = [

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
        typeof possible[i] === "string" &&
        possible[i].trim()
      ) {

        return possible[i].trim();
      }
    }


    return "";
  }


  /* =====================================================
     SEND CHAT
  ===================================================== */

  async function sendToAtharv(message) {

    const history =
      conversation
        .slice(-12)
        .map(function (item) {

          return {
            role: item.role,
            content: item.content
          };

        });


    let endpoint =
      "/api/chat";

    let body;


    if (liveMode) {

      endpoint =
        "/api/chat/research";

      body = {

        query: message,

        message: message,

        userId: getUserId()

      };

    } else {

      body = {

        message: message,

        history: history,

        chatHistory: history,

        userId: getUserId()

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
          method: "POST",

          body:
            JSON.stringify(body)
        }
      );


    console.log(
      "ATHARV RESPONSE:",
      data
    );


    const reply =
      extractReply(data);


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
     SEND MESSAGE
  ===================================================== */

  async function handleSend() {

    if (sending) {
      return;
    }


    const message =
      input.value.trim();


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


    sendButton.disabled = true;

    input.disabled = true;


    welcome.classList.add("hidden");


    conversation.push({

      role: "user",

      content: message

    });


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


      conversation.push({

        role: "assistant",

        content: reply

      });


      saveHistory();


      renderMessage(
        "assistant",
        reply
      );


    } catch (error) {

      console.error(
        "ATHARV SEND ERROR:",
        error
      );


      renderMessage(
        "assistant",
        "Sorry, response nahi mil paaya. " +
        (error.message || "Please try again.")
      );


      showToast(
        error.message ||
        "Message send nahi hua."
      );


    } finally {

      hideThinking();


      sending = false;

      sendButton.disabled = false;

      input.disabled = false;

      input.focus();

    }
  }


  /* =====================================================
     FORM SUBMIT
  ===================================================== */

  form.addEventListener(
    "submit",
    function (event) {

      /*
      VERY IMPORTANT:
      Browser ko ?message=... par navigate
      karne se rokta hai.
      */

      event.preventDefault();

      event.stopPropagation();


      handleSend();

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

    input.style.height = "auto";

    input.style.height =
      Math.min(
        input.scrollHeight,
        140
      ) + "px";
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

      liveButton.textContent =
        "🌐 Live ON";

      liveButton.classList.add(
        "active"
      );

    } else {

      liveButton.textContent =
        "🌐 Live";

      liveButton.classList.remove(
        "active"
      );
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

        liveMode = !liveMode;

        localStorage.setItem(
          LIVE_KEY,
          String(liveMode)
        );

        updateLiveButton();

      }
    );
  }


  /* =====================================================
     NEW CHAT
  ===================================================== */

  if (newChatButton) {

    newChatButton.addEventListener(
      "click",
      function () {

        conversation = [];

        localStorage.removeItem(
          HISTORY_KEY
        );

        renderConversation();

        input.value = "";

        autoResize();

        input.focus();

      }
    );
  }


  /* =====================================================
     SUGGESTIONS
  ===================================================== */

  document
    .querySelectorAll(".suggestion")
    .forEach(function (button) {

      button.addEventListener(
        "click",
        function () {

          input.value =
            button.textContent.trim();

          autoResize();

          input.focus();

        }
      );

    });


  /* =====================================================
     ATTACHMENT
  ===================================================== */

  if (
    attachmentButton &&
    fileInput
  ) {

    attachmentButton.addEventListener(
      "click",
      function () {

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


        if (attachmentInfo) {

          attachmentInfo.textContent =
            "📎 " +
            file.name;

        }

      }
    );
  }


  /* =====================================================
     MEMORY
  ===================================================== */

  async function loadMemory() {

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
            method: "GET"
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
        !Array.isArray(memories) ||
        memories.length === 0
      ) {

        memoryList.innerHTML =
          "<p>No saved memory yet.</p>";

        return;
      }


      memoryList.innerHTML = "";


      memories.forEach(
        function (memory) {

          const item =
            document.createElement(
              "div"
            );

          item.className =
            "memory-item";


          const text =
            typeof memory === "string"
              ? memory
              : (
                  memory.memory ||
                  memory.content ||
                  ""
                );


          item.textContent =
            "🧠 " + text;


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
     INITIALIZE
  ===================================================== */

  conversation =
    loadHistory();


  renderConversation();


  autoResize();


  input.focus();


  console.log(
    "================================"
  );

  console.log(
    " ATHARV AI 17.0.3 FRONTEND"
  );

  console.log(
    " Chat handler loaded successfully."
  );

  console.log(
    " User ID:",
    getUserId()
  );

  console.log(
    "================================"
  );

})();
