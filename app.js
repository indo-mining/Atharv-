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
// PERMANENT USER ID
// =====================================================

const ATHARV_USER_ID_KEY =
  "atharv_user_id";


function getAtharvUserId() {

  try {

    let userId =
      localStorage.getItem(
        ATHARV_USER_ID_KEY
      );

    if (userId) {
      return userId;
    }

    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {

      userId =
        window.crypto.randomUUID();

    } else {

      userId =
        "atharv_" +
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .substring(2, 12);

    }

    localStorage.setItem(
      ATHARV_USER_ID_KEY,
      userId
    );

    return userId;

  } catch (error) {

    console.error(
      "USER ID ERROR:",
      error
    );

    return (
      "atharv_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 12)
    );

  }

}


const ATHARV_USER_ID =
  getAtharvUserId();


console.log(
  "ATHARV USER ID:",
  ATHARV_USER_ID
);


// =====================================================
// ADD MESSAGE
// =====================================================

function addMessage(text, type) {

  const message =
    document.createElement("div");

  message.className =
    "message " + type;

  message.textContent =
    text;

  chatBox.appendChild(
    message
  );

  message.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });

  return message;

}


// =====================================================
// SAVE CHAT HISTORY
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
// GET CHAT HISTORY
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
// LOAD CHAT HISTORY
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
// CLEAR CHAT HISTORY
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

  chatBox.appendChild(
    message
  );

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


  // USER MESSAGE

  addMessage(
    message,
    "user"
  );

  saveChatHistory();

  messageInput.value = "";

  messageInput.style.height =
    "auto";


  // THINKING

  isThinking = true;

  sendButton.disabled =
    true;

  sendButton.style.opacity =
    "0.5";

  showThinking();


  // TIMEOUT

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(function () {

      controller.abort();

    }, 60000);


  try {

    // -----------------------------------------------
    // RECENT HISTORY
    // -----------------------------------------------

    const fullHistory =
      getChatHistory();

    const recentHistory =
      fullHistory.slice(-8);


    // -----------------------------------------------
    // USER TIMEZONE
    // -----------------------------------------------

    const timeZone =
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "Asia/Kolkata";


    // -----------------------------------------------
    // API REQUEST
    // -----------------------------------------------

    const response =
      await fetch(
        API_BASE + "/api/chat",
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              message:
                message,

              history:
                recentHistory,

              timeZone:
                timeZone,

              userId:
                ATHARV_USER_ID

            }),

          signal:
            controller.signal

        }
      );


    // -----------------------------------------------
    // RESPONSE
    // -----------------------------------------------

    const responseText =
      await response.text();


    console.log(
      "ATHARV SERVER STATUS:",
      response.status
    );


    console.log(
      "ATHARV SERVER RESPONSE:",
      responseText
    );


    let data = {};


    try {

      data =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};

    } catch (jsonError) {

      console.error(
        "JSON PARSE ERROR:",
        jsonError
      );

      throw new Error(
        "Server ne valid JSON response nahi diya."
      );

    }


    // -----------------------------------------------
    // SERVER ERROR
    // -----------------------------------------------

    if (!response.ok) {

      const serverError =
        data.error ||
        data.message ||
        `Server error (${response.status})`;

      throw new Error(
        serverError
      );

    }


    // -----------------------------------------------
    // REMOVE THINKING
    // -----------------------------------------------

    removeThinking();


    // -----------------------------------------------
    // ATHARV RESPONSE
    // -----------------------------------------------

    const reply =
      data.reply ||
      data.response ||
      data.message ||
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


    if (
      error.name ===
      "AbortError"
    ) {

      addMessage(
        "⏳ Response lane mein zyada time lag raha hai. Please dobara try karein.",
        "ai"
      );

    } else {

      addMessage(
        "⚠️ Atharv response nahi la paaya.\n\nReason: " +
        error.message,
        "ai"
      );

    }


    saveChatHistory();


  } finally {

    clearTimeout(
      timeoutId
    );

    isThinking =
      false;

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
// NAVIGATION ELEMENTS
// =====================================================

const navButtons =
  document.querySelectorAll(
    ".bottom-nav button"
  );


// =====================================================
// PROFILE ELEMENTS
// =====================================================

const profileButton =
  document.querySelector(
    ".profile"
  );


const profileScreen =
  document.getElementById(
    "profileScreen"
  );


const chatScreen =
  document.getElementById(
    "chatScreen"
  );


const profileBack =
  document.getElementById(
    "profileBack"
  );


const memoryList =
  document.getElementById(
    "memoryList"
  );


const refreshMemory =
  document.getElementById(
    "refreshMemory"
  );


const clearAllMemory =
  document.getElementById(
    "clearAllMemory"
  );


// =====================================================
// MEMORY LABELS
// =====================================================

const memoryLabels = {

  name:
    "Name",

  language_preference:
    "Language Preference",

  response_style:
    "Response Style",

  answer_length:
    "Answer Length",

  teaching_style:
    "Teaching Style",

  learning_goal:
    "Learning Goal",

  user_note:
    "Personal Note"

};


// =====================================================
// SHOW CHAT SCREEN
// =====================================================

function showChatScreen() {

  if (chatScreen) {

    chatScreen.hidden =
      false;

  }

  if (profileScreen) {

    profileScreen.hidden =
      true;

  }

  updateNavActive(
    "chat"
  );

}


// =====================================================
// SHOW PROFILE SCREEN
// =====================================================

function showProfileScreen() {

  if (chatScreen) {

    chatScreen.hidden =
      true;

  }

  if (profileScreen) {

    profileScreen.hidden =
      false;

  }

  updateNavActive(
    "profile"
  );

  loadMemories();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// =====================================================
// UPDATE ACTIVE NAV
// =====================================================

function updateNavActive(
  name
) {

  navButtons.forEach(
    function (button) {

      button.classList.remove(
        "active"
      );

      if (
        button.dataset.nav ===
        name
      ) {

        button.classList.add(
          "active"
        );

      }

    }
  );

}


// =====================================================
// RENDER MEMORIES
// =====================================================

function renderMemories(
  memories
) {

  if (!memoryList) {
    return;
  }

  memoryList.innerHTML =
    "";


  if (
    !Array.isArray(memories) ||
    memories.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "memory-empty";

    empty.textContent =
      "🧠 Abhi Atharv ke paas koi saved memory nahi hai.";

    memoryList.appendChild(
      empty
    );

    return;

  }


  memories.forEach(
    function (memory) {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "memory-item";


      const content =
        document.createElement(
          "div"
        );

      content.className =
        "memory-content";


      const label =
        document.createElement(
          "div"
        );

      label.className =
        "memory-label";

      label.textContent =
        memoryLabels[
          memory.memory_key
        ] ||
        memory.memory_key;


      const value =
        document.createElement(
          "div"
        );

      value.className =
        "memory-value";

      value.textContent =
        memory.memory_value;


      content.appendChild(
        label
      );

      content.appendChild(
        value
      );


      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.type =
        "button";

      deleteButton.className =
        "memory-delete";

      deleteButton.textContent =
        "Forget";


      deleteButton.addEventListener(
        "click",
        function () {

          deleteSingleMemory(
            memory.memory_key
          );

        }
      );


      item.appendChild(
        content
      );

      item.appendChild(
        deleteButton
      );


      memoryList.appendChild(
        item
      );

    }
  );

}


// =====================================================
// LOAD MEMORIES
// =====================================================

async function loadMemories() {

  if (!memoryList) {
    return;
  }


  memoryList.innerHTML =
    '<div class="memory-loading">🧠 Memories load ho rahi hain...</div>';


  try {

    const response =
      await fetch(
        API_BASE +
        "/api/memory?userId=" +
        encodeURIComponent(
          ATHARV_USER_ID
        ),
        {

          method:
            "GET",

          headers: {

            "Accept":
              "application/json"

          }

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Memory load failed."
      );

    }


    renderMemories(
      data.memories || []
    );


  } catch (error) {

    console.error(
      "MEMORY LOAD ERROR:",
      error
    );


    memoryList.innerHTML =
      '<div class="memory-error">⚠️ Memory load nahi ho paayi.<br><br>' +
      error.message +
      "</div>";

  }

}


// =====================================================
// DELETE SINGLE MEMORY
// =====================================================

async function deleteSingleMemory(
  key
) {

  const label =
    memoryLabels[key] ||
    key;


  const confirmed =
    window.confirm(
      `Kya aap "${label}" memory ko bhoolna chahte hain?`
    );


  if (!confirmed) {
    return;
  }


  try {

    const response =
      await fetch(
        API_BASE +
        "/api/memory/delete",
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              userId:
                ATHARV_USER_ID,

              key:
                key

            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Memory delete failed."
      );

    }


    renderMemories(
      data.memories || []
    );


  } catch (error) {

    console.error(
      "MEMORY DELETE ERROR:",
      error
    );


    alert(
      "Memory delete nahi ho paayi.\n\n" +
      error.message
    );

  }

}


// =====================================================
// DELETE ALL MEMORIES
// =====================================================

async function deleteAllMemories() {

  const confirmed =
    window.confirm(
      "Kya aap Atharv ki SAARI memories delete karna chahte hain?\n\nYe action undo nahi kiya ja sakta."
    );


  if (!confirmed) {
    return;
  }


  try {

    if (clearAllMemory) {

      clearAllMemory.disabled =
        true;

      clearAllMemory.textContent =
        "Deleting...";

    }


    const response =
      await fetch(
        API_BASE +
        "/api/memory/clear",
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              userId:
                ATHARV_USER_ID

            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Memory clear failed."
      );

    }


    renderMemories(
      []
    );


  } catch (error) {

    console.error(
      "MEMORY CLEAR ERROR:",
      error
    );


    alert(
      "All memories delete nahi ho paayi.\n\n" +
      error.message
    );


  } finally {

    if (clearAllMemory) {

      clearAllMemory.disabled =
        false;

      clearAllMemory.textContent =
        "🧹 Forget All Memories";

    }

  }

}


// =====================================================
// PROFILE BUTTON
// =====================================================

if (profileButton) {

  profileButton.addEventListener(
    "click",
    showProfileScreen
  );

}


// =====================================================
// BACK FROM PROFILE
// =====================================================

if (profileBack) {

  profileBack.addEventListener(
    "click",
    showChatScreen
  );

}


// =====================================================
// REFRESH MEMORY
// =====================================================

if (refreshMemory) {

  refreshMemory.addEventListener(
    "click",
    loadMemories
  );

}


// =====================================================
// CLEAR ALL MEMORY
// =====================================================

if (clearAllMemory) {

  clearAllMemory.addEventListener(
    "click",
    deleteAllMemories
  );

}


// =====================================================
// BOTTOM NAVIGATION
// =====================================================

navButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const nav =
          button.dataset.nav;


        // CHAT

        if (
          nav === "chat"
        ) {

          showChatScreen();

          return;

        }


        // PROFILE

        if (
          nav === "profile"
        ) {

          showProfileScreen();

          return;

        }


        // MARKET

        if (
          nav === "market"
        ) {

          alert(
            "📈 Market module next stage mein activate hoga."
          );

          showChatScreen();

          return;

        }


        // ALERTS

        if (
          nav === "alerts"
        ) {

          alert(
            "🔔 Alerts module next stage mein activate hoga."
          );

          showChatScreen();

          return;

        }

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
  "Permanent User ID enabled."
);

console.log(
  "Intelligent Memory UI enabled."
);

console.log(
  "Individual memory delete enabled."
);

console.log(
  "Delete all memory enabled."
);

console.log(
  "Chat history enabled."
);

console.log(
  "Conversation context enabled."
);

console.log(
  "================================"
);


// =====================================================
// LOAD EXISTING CHAT
// =====================================================

loadChatHistory();
