const chatBox =
  document.getElementById("chatBox");

const messageInput =
  document.getElementById("message");

const sendButton =
  document.querySelector(".send");


// ========================================
// API
// ========================================

const API_BASE = "";


// ========================================
// STATE
// ========================================

let isThinking = false;

// Current browser session only.
// localStorage me save nahi hota.
let previousResponseId = null;

const ATHARV_HISTORY_KEY =
  "atharv_chat_history";


// ========================================
// ADD MESSAGE
// ========================================

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


// ========================================
// SAVE HISTORY
// ========================================

function saveChatHistory() {
  try {
    const messages = [];

    document
      .querySelectorAll("#chatBox .message")
      .forEach(function (message) {

        if (
          message.id ===
          "thinkingMessage"
        ) {
          return;
        }

        messages.push({
          text: message.textContent,
          type:
            message.classList.contains("user")
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


// ========================================
// LOAD HISTORY
// ========================================

function loadChatHistory() {
  try {
    const saved =
      localStorage.getItem(
        ATHARV_HISTORY_KEY
      );

    if (!saved) {
      return;
    }

    const messages =
      JSON.parse(saved);

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
        typeof item.text === "string" &&
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


// ========================================
// CLEAR HISTORY
// ========================================

function clearChatHistory() {
  localStorage.removeItem(
    ATHARV_HISTORY_KEY
  );

  previousResponseId = null;

  chatBox.innerHTML = "";

  addMessage(
    "Namaste! 🙏 Main Atharv hoon. Aap mujhse kuch bhi pooch sakte hain.",
    "ai"
  );
}


// ========================================
// THINKING
// ========================================

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


function removeThinking() {
  const thinking =
    document.getElementById(
      "thinkingMessage"
    );

  if (thinking) {
    thinking.remove();
  }
}


// ========================================
// SEND MESSAGE
// ========================================

async function sendMessage() {

  const message =
    messageInput.value.trim();

  if (
    !message ||
    isThinking
  ) {
    return;
  }


  // ======================================
  // USER MESSAGE
  // ======================================

  addMessage(
    message,
    "user"
  );

  saveChatHistory();


  // ======================================
  // CLEAR INPUT
  // ======================================

  messageInput.value = "";

  messageInput.style.height =
    "auto";


  // ======================================
  // THINKING
  // ======================================

  isThinking = true;

  sendButton.disabled = true;

  sendButton.style.opacity =
    "0.5";

  showThinking();


  // ======================================
  // REQUEST
  // ======================================

  try {

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

              previousResponseId:
                previousResponseId,

              timeZone:
                Intl
                  .DateTimeFormat()
                  .resolvedOptions()
                  .timeZone
            })
        }
      );


    let data;

    try {
      data =
        await response.json();
    } catch (jsonError) {
      throw new Error(
        "Server ne valid response nahi diya."
      );
    }


    // ====================================
    // HTTP ERROR
    // ====================================

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Atharv server error"
      );
    }


    // ====================================
    // REMOVE THINKING
    // ====================================

    removeThinking();


    // ====================================
    // RESPONSE ID
    // ====================================

    if (data.responseId) {
      previousResponseId =
        data.responseId;
    }


    // ====================================
    // AI RESPONSE
    // ====================================

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


    addMessage(
      "Sorry 🙏 Atharv se connection mein problem aa gayi. Please dobara try karein.",
      "ai"
    );

    saveChatHistory();

  }


  // ======================================
  // RESET
  // ======================================

  isThinking = false;

  sendButton.disabled = false;

  sendButton.style.opacity =
    "1";

  messageInput.focus();
}


// ========================================
// QUICK ASK
// ========================================

function quickAsk(text) {

  if (isThinking) {
    return;
  }

  messageInput.value =
    text;

  sendMessage();
}


// ========================================
// ENTER TO SEND
// ========================================

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


// ========================================
// AUTO RESIZE
// ========================================

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


// ========================================
// PROFILE
// ========================================

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


// ========================================
// NAVIGATION
// ========================================

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


// ========================================
// START
// ========================================

console.log(
  "ATHARV FAST AI loaded 🤖"
);

console.log(
  "Fast response mode enabled."
);

console.log(
  "Chat history enabled."
);

loadChatHistory();
