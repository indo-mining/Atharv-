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

let previousResponseId = null;


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


  if (!message || isThinking) {
    return;
  }


  // User message
  addMessage(
    message,
    "user"
  );


  // Clear input
  messageInput.value = "";

  messageInput.style.height =
    "auto";


  // Thinking state
  isThinking = true;

  sendButton.disabled = true;

  sendButton.style.opacity =
    "0.5";


  showThinking();


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

          body: JSON.stringify({

            message: message,

            previousResponseId:
              previousResponseId

          })

        }
      );


    const data =
      await response.json();


    removeThinking();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Atharv server error"
      );

    }


    // Save conversation ID
    if (data.responseId) {

      previousResponseId =
        data.responseId;

    }


    const reply =
      data.reply ||
      "Atharv ko response nahi mila.";


    addMessage(
      reply,
      "ai"
    );


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

  }


  isThinking = false;

  sendButton.disabled = false;

  sendButton.style.opacity =
    "1";

  messageInput.focus();

}


// ========================================
// QUICK QUESTIONS
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
  function(event) {

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
  function() {

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
    function() {

      addMessage(

        "👤 Profile system Atharv ke next stage mein activate hoga.",

        "ai"

      );

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
  function(button) {

    button.addEventListener(
      "click",
      function() {

        navButtons.forEach(
          function(btn) {

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
  "ATHARV AI loaded successfully 🤖"
);

console.log(
  "Conversation mode enabled."
);
