const chatBox =
  document.getElementById("chatBox");

const messageInput =
  document.getElementById("message");

const sendButton =
  document.querySelector(".send");

const API_BASE = "";

let isThinking = false;

const ATHARV_HISTORY_KEY =
  "atharv_chat_history";

// =====================================================
// ADD MESSAGE
// =====================================================

function addMessage(text, type) {
  const message =
    document.createElement("div");

  message.className =
    "message " + type;

  message.textContent = text;

  chatBox.appendChild(message);

  message.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });

  return message;
}

// =====================================================
// SAVE HISTORY
// =====================================================

function saveChatHistory() {
  try {
    const messages = [];

    document
      .querySelectorAll(
        "#chatBox .message"
      )
      .forEach(function (message) {

        if (
          message.id ===
          "thinkingMessage"
        ) {
          return;
        }

        messages.push({
          text:
            message.textContent,

          type:
            message.classList.contains(
              "user"
            )
              ? "user"
              : "ai"
        });
      });

    localStorage.setItem(
      ATHARV_HISTORY_KEY,
      JSON.stringify(messages)
    );

  } catch (error) {

    console.error(
      "HISTORY SAVE ERROR:",
      error
    );
  }
}

// =====================================================
// GET HISTORY
// =====================================================

function getChatHistory() {
  try {
    const saved =
      localStorage.getItem(
        ATHARV_HISTORY_KEY
      );

    if (!saved) {
      return [];
    }

    const messages =
      JSON.parse(saved);

    if (!Array.isArray(messages)) {
      return [];
    }

    return messages;

  } catch (error) {

    console.error(
      "HISTORY READ ERROR:",
      error
    );

    return [];
  }
}

// =====================================================
// LOAD HISTORY
// =====================================================

function loadChatHistory() {
  try {

    const messages =
      getChatHistory();

    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return;
    }

    chatBox.innerHTML = "";

    messages.forEach(function (item) {

      if (
        item &&
        typeof item.text ===
          "string" &&
        (
          item.type === "user" ||
          item.type === "ai"
        )
      ) {

        addMessage(
          item.text,
          item.type
        );
      }
    });

  } catch (error) {

    console.error(
      "HISTORY LOAD ERROR:",
      error
    );
  }
}

// =====================================================
// CLEAR HISTORY
// =====================================================

function clearChatHistory() {

  try {

    localStorage.removeItem(
      ATHARV_HISTORY_KEY
    );

    chatBox.innerHTML = "";

  } catch (error) {

    console.error(
      "CLEAR HISTORY ERROR:",
      error
    );
  }
}

// =====================================================
// THINKING
// =====================================================

function showThinking() {

  removeThinking();

  const message =
    document.createElement("div");

  message.className =
    "message ai thinking";

  message.id =
    "thinkingMessage";

  message.textContent =
    "Atharv soch raha hai... 🤔";

  chatBox.appendChild(message);

  message.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });
}

// =====================================================
// REMOVE THINKING
// =====================================================

function removeThinking() {

  const thinking =
    document.getElementById(
      "thinkingMessage"
    );

  if (thinking) {
    thinking.remove();
  }
}

// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage() {

  const message =
    messageInput.value.trim();

  if (
    !message ||
    isThinking
  ) {
    return;
  }

  // -----------------------------------------------
  // USER MESSAGE
  // -----------------------------------------------

  addMessage(
    message,
    "user"
  );

  saveChatHistory();

  messageInput.value = "";

  messageInput.style.height =
    "auto";

  // -----------------------------------------------
  // THINKING STATE
  // -----------------------------------------------

  isThinking = true;

  sendButton.disabled = true;

  sendButton.style.opacity =
    "0.5";

  showThinking();

  // -----------------------------------------------
  // REQUEST TIMEOUT
  // -----------------------------------------------

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(function () {

      controller.abort();

    }, 30000);

  try {

    // ---------------------------------------------
    // RECENT HISTORY
    // ---------------------------------------------

    const fullHistory =
      getChatHistory();

    // Last 8 messages only.
    // This keeps context useful without
    // making every request unnecessarily large.

    const recentHistory =
      fullHistory.slice(-8);

    // ---------------------------------------------
    // SEND REQUEST
    // ---------------------------------------------

    const response =
      await fetch(
        API_BASE + "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              message:
                message,

              history:
                recentHistory,

              timeZone:
                Intl.DateTimeFormat()
                  .resolvedOptions()
                  .timeZone
            }),

          signal:
            controller.signal
        }
      );

    // ---------------------------------------------
    // RESPONSE JSON
    // ---------------------------------------------

    let data;

    try {

      data =
        await response.json();

    } catch (jsonError) {

      throw new Error(
        "Server ne valid response nahi diya."
      );
    }

    // ---------------------------------------------
    // SERVER ERROR
    // ---------------------------------------------

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Atharv server error"
      );
    }

    // ---------------------------------------------
    // REMOVE THINKING
    // ---------------------------------------------

    removeThinking();

    // ---------------------------------------------
    // ATHARV RESPONSE
    // ---------------------------------------------

    const reply =
      data.reply ||
      "Atharv ko response nahi mila.";

    addMessage(
      reply,
      "ai"
    );

    saveChatHistory();

  } catch (error) {

    removeThinking();

    console.error(
      "ATHARV ERROR:",
      error
    );

    // ---------------------------------------------
    // TIMEOUT
    // ---------------------------------------------

    if (
      error.name ===
      "AbortError"
    ) {

      addMessage(
        "⏳ Request ko zyada time lag raha hai. Please dobara try karein.",
        "ai"
      );

    } else {

      addMessage(
        "Sorry 🙏 Atharv se connection mein problem aa gayi. Please dobara try karein.",
        "ai"
      );
    }

    saveChatHistory();

  } finally {

    clearTimeout(
      timeoutId
    );

    isThinking = false;

    sendButton.disabled =
      false;

    sendButton.style.opacity =
      "1";

    messageInput.focus();
  }
}

// =====================================================
// QUICK ASK
// =====================================================

function quickAsk(text) {

  if (isThinking) {
    return;
  }

  messageInput.value =
    text;

  sendMessage();
}

// =====================================================
// ENTER TO SEND
// =====================================================

messageInput.addEventListener(
  "keydown",
  function (event) {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }
  }
);

// =====================================================
// AUTO RESIZE TEXTAREA
// =====================================================

messageInput.addEventListener(
  "input",
  function () {

    this.style.height =
      "auto";

    this.style.height =
      Math.min(
        this.scrollHeight,
        120
      ) + "px";
  }
);

// =====================================================
// PROFILE BUTTON
// =====================================================

const profileButton =
  document.querySelector(
    ".profile"
  );

if (profileButton) {

  profileButton.addEventListener(
    "click",
    function () {

      addMessage(
        "👤 Profile system Atharv ke next stage mein activate hoga.",
        "ai"
      );

      saveChatHistory();
    }
  );
}

// =====================================================
// BOTTOM NAVIGATION
// =====================================================

const navButtons =
  document.querySelectorAll(
    ".bottom-nav button"
  );

navButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        navButtons.forEach(
          function (btn) {

            btn.classList.remove(
              "active"
            );
          }
        );

        button.classList.add(
          "active"
        );
      }
    );
  }
);

// =====================================================
// START
// =====================================================

console.log(
  "================================"
);

console.log(
  "ATHARV AI LOADED 🤖"
);

console.log(
  "Fast mode enabled."
);

console.log(
  "Local chat history enabled."
);

console.log(
  "Short conversation context enabled."
);

console.log(
  "Previous Response ID disabled."
);

console.log(
  "================================"
);

loadChatHistory();
