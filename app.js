const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("message");
const sendButton = document.querySelector(".send");

const API_BASE = "";

let isThinking = false;

// =====================================================
// STORAGE
// =====================================================

const ATHARV_HISTORY_KEY = "atharv_chat_history";
const ATHARV_USER_ID_KEY = "atharv_user_id";

// =====================================================
// PERMANENT USER ID
// =====================================================

function getAtharvUserId() {
  try {
    let userId = localStorage.getItem(ATHARV_USER_ID_KEY);

    if (userId) return userId;

    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      userId = window.crypto.randomUUID();
    } else {
      userId =
        "atharv_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2, 12);
    }

    localStorage.setItem(ATHARV_USER_ID_KEY, userId);

    return userId;
  } catch (error) {
    console.error("USER ID ERROR:", error);

    return (
      "atharv_" +
      Date.now() +
      "_" +
      Math.random().toString(36).substring(2, 12)
    );
  }
}

const ATHARV_USER_ID = getAtharvUserId();

console.log("ATHARV USER ID:", ATHARV_USER_ID);

// =====================================================
// VOICE STATE
// =====================================================

let speechRecognition = null;
let isListening = false;
let isSpeaking = false;
let currentSpeechUtterance = null;
let selectedVoiceLanguage = "en-IN";

// =====================================================
// VOICE LANGUAGE DETECTION
// =====================================================

function detectVoiceLanguage(text) {
  const value = String(text || "").trim();

  if (!value) return "en-IN";

  if (/[\u0900-\u097F]/.test(value)) return "hi-IN";
  if (/[\u0980-\u09FF]/.test(value)) return "bn-IN";
  if (/[\u0A00-\u0A7F]/.test(value)) return "pa-IN";
  if (/[\u0A80-\u0AFF]/.test(value)) return "gu-IN";
  if (/[\u0B80-\u0BFF]/.test(value)) return "ta-IN";
  if (/[\u0C00-\u0C7F]/.test(value)) return "te-IN";
  if (/[\u0C80-\u0CFF]/.test(value)) return "kn-IN";
  if (/[\u0D00-\u0D7F]/.test(value)) return "ml-IN";
  if (/[\u0600-\u06FF]/.test(value)) return "ar-SA";
  if (/[\u0590-\u05FF]/.test(value)) return "he-IL";
  if (/[\u0400-\u04FF]/.test(value)) return "ru-RU";
  if (/[\u0370-\u03FF]/.test(value)) return "el-GR";
  if (/[\u0E00-\u0E7F]/.test(value)) return "th-TH";
  if (/[\u3040-\u30FF]/.test(value)) return "ja-JP";
  if (/[\uAC00-\uD7AF]/.test(value)) return "ko-KR";
  if (/[\u4E00-\u9FFF]/.test(value)) return "zh-CN";

  const lower = value.toLowerCase();

  const hindiWords = [
    "mera",
    "meri",
    "mujhe",
    "mujhse",
    "aap",
    "apka",
    "apki",
    "kya",
    "kaise",
    "kyu",
    "kyon",
    "hai",
    "hain",
    "ho",
    "kar",
    "karo",
    "batao",
    "bataiye",
    "chahiye",
    "nahi",
    "nahin",
    "acha",
    "accha",
    "haan",
    "han",
    "ka",
    "ki",
    "ke",
    "mein",
    "me",
    "se",
    "ko"
  ];

  let matches = 0;

  hindiWords.forEach(function (word) {
    if (
      new RegExp("\\b" + word + "\\b", "i").test(lower)
    ) {
      matches++;
    }
  });

  if (matches >= 2) return "hi-IN";

  return "en-IN";
}

// =====================================================
// VOICE SUPPORT
// =====================================================

function getSpeechRecognitionClass() {
  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    null
  );
}

function isVoiceInputSupported() {
  return !!getSpeechRecognitionClass();
}

function isVoiceOutputSupported() {
  return (
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

// =====================================================
// VOICE CONTROLS
// =====================================================

function getVoiceControls() {
  return {
    area: document.getElementById("atharvVoiceArea"),

    micButton: document.getElementById(
      "atharvMicButton"
    ),

    stopButton: document.getElementById(
      "atharvStopVoiceButton"
    ),

    status: document.getElementById(
      "atharvVoiceStatus"
    )
  };
}

// =====================================================
// CREATE FALLBACK VOICE CONTROLS
// =====================================================

function createVoiceControls() {
  if (!messageInput) return;

  let controls = getVoiceControls();

  // Existing HTML controls
  if (controls.micButton) {
    bindVoiceButtons(
      controls.micButton,
      controls.stopButton,
      controls.status
    );

    setupSpeechRecognition(
      controls.micButton,
      controls.status
    );

    return;
  }

  // Create inline mic button
  const micButton = document.createElement("button");

  micButton.type = "button";
  micButton.id = "atharvMicButton";
  micButton.className = "voice-input-button";
  micButton.textContent = "🎙️";
  micButton.title = "Bolkar poochhein";
  micButton.setAttribute(
    "aria-label",
    "Bolkar poochhein"
  );

  if (sendButton && sendButton.parentElement) {
    sendButton.parentElement.insertBefore(
      micButton,
      sendButton
    );
  } else if (messageInput.parentElement) {
    messageInput.parentElement.appendChild(
      micButton
    );
  }

  // Status below input
  let status = document.getElementById(
    "atharvVoiceStatus"
  );

  if (!status) {
    status = document.createElement("div");

    status.id = "atharvVoiceStatus";
    status.className = "voice-status";
    status.textContent = "Voice ready";

    const parent =
      messageInput.parentElement;

    if (parent && parent.parentElement) {
      parent.parentElement.appendChild(status);
    }
  }

  bindVoiceButtons(
    micButton,
    null,
    status
  );

  setupSpeechRecognition(
    micButton,
    status
  );
}

// =====================================================
// BIND VOICE BUTTONS
// =====================================================

function bindVoiceButtons(
  micButton,
  stopButton,
  status
) {
  if (!micButton || !status) return;

  if (
    micButton.dataset.atharvBound === "true"
  ) {
    return;
  }

  micButton.dataset.atharvBound = "true";

  micButton.addEventListener(
    "click",
    function () {
      toggleVoiceInput(
        micButton,
        status
      );
    }
  );

  if (stopButton) {
    stopButton.addEventListener(
      "click",
      function () {
        stopVoiceOutput();

        if (
          isListening &&
          speechRecognition
        ) {
          try {
            speechRecognition.stop();
          } catch (error) {
            console.warn(
              "VOICE STOP:",
              error
            );
          }
        }

        updateVoiceStatus(
          "Voice ready"
        );
      }
    );
  }
}

// =====================================================
// VOICE STATUS
// =====================================================

function updateVoiceStatus(text) {
  const controls = getVoiceControls();

  if (controls.status) {
    controls.status.textContent = text;
  }
}

// =====================================================
// SPEECH RECOGNITION
// =====================================================

function setupSpeechRecognition(
  micButton,
  status
) {
  const RecognitionClass =
    getSpeechRecognitionClass();

  if (!micButton || !status) return;

  if (!RecognitionClass) {
    micButton.disabled = true;
    micButton.style.opacity = "0.4";

    status.textContent =
      "Is browser mein voice input available nahi hai.";

    return;
  }

  if (speechRecognition) return;

  speechRecognition =
    new RecognitionClass();

  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.maxAlternatives = 1;
  speechRecognition.lang =
    selectedVoiceLanguage;

  speechRecognition.onstart =
    function () {
      isListening = true;

      micButton.textContent = "🛑";
      micButton.title = "Listening...";
      micButton.classList.add(
        "listening"
      );

      status.textContent =
        "🎙️ Sun raha hoon...";
    };

  speechRecognition.onresult =
    function (event) {
      let finalText = "";
      let interimText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0].transcript;

        if (
          event.results[i].isFinal
        ) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      // Show what is currently being spoken
      if (interimText) {
        messageInput.value =
          interimText;

        messageInput.dispatchEvent(
          new Event("input")
        );
      }

      // Final voice text
      if (finalText.trim()) {
        const cleaned =
          finalText.trim();

        messageInput.value = cleaned;

        messageInput.dispatchEvent(
          new Event("input")
        );

        selectedVoiceLanguage =
          detectVoiceLanguage(cleaned);

        speechRecognition.lang =
          selectedVoiceLanguage;

        // Automatically send after speaking
        setTimeout(function () {
          if (
            messageInput.value.trim() &&
            !isThinking
          ) {
            sendMessage();
          }
        }, 250);
      }
    };

  speechRecognition.onerror =
    function (event) {
      console.error(
        "SPEECH RECOGNITION ERROR:",
        event.error
      );

      isListening = false;

      micButton.textContent = "🎙️";
      micButton.title =
        "Bolkar poochhein";

      micButton.classList.remove(
        "listening"
      );

      if (
        event.error === "not-allowed"
      ) {
        status.textContent =
          "🎙️ Microphone permission allow karein.";
      } else if (
        event.error === "no-speech"
      ) {
        status.textContent =
          "Kuch sunai nahi diya.";
      } else if (
        event.error === "network"
      ) {
        status.textContent =
          "Voice service network error.";
      } else {
        status.textContent =
          "Voice input error.";
      }
    };

  speechRecognition.onend =
    function () {
      isListening = false;

      micButton.textContent = "🎙️";
      micButton.title =
        "Bolkar poochhein";

      micButton.classList.remove(
        "listening"
      );

      if (
        status.textContent.includes(
          "Sun raha"
        )
      ) {
        status.textContent =
          "Voice ready";
      }
    };
}

// =====================================================
// TOGGLE VOICE INPUT
// =====================================================

function toggleVoiceInput(
  micButton,
  status
) {
  if (!speechRecognition) {
    status.textContent =
      "Is browser mein voice input available nahi hai.";

    return;
  }

  if (isThinking) {
    status.textContent =
      "Pehle current answer complete hone dein.";

    return;
  }

  if (isListening) {
    try {
      speechRecognition.stop();
    } catch (error) {
      console.warn(
        "STOP LISTENING ERROR:",
        error
      );
    }

    return;
  }

  if (isSpeaking) {
    stopVoiceOutput();
  }

  const currentText =
    messageInput.value.trim();

  selectedVoiceLanguage =
    detectVoiceLanguage(currentText);

  speechRecognition.lang =
    selectedVoiceLanguage;

  try {
    speechRecognition.start();
  } catch (error) {
    console.warn(
      "START LISTENING ERROR:",
      error
    );

    status.textContent =
      "Mic start nahi ho paaya.";
  }
}

// =====================================================
// FIND BEST SPEECH VOICE
// =====================================================

function findBestSpeechVoice(
  language
) {
  if (!isVoiceOutputSupported()) {
    return null;
  }

  const voices =
    window.speechSynthesis.getVoices();

  if (
    !voices ||
    voices.length === 0
  ) {
    return null;
  }

  const target =
    String(
      language || "en-IN"
    ).toLowerCase();

  const base =
    target.split("-")[0];

  let voice =
    voices.find(function (item) {
      return (
        item.lang &&
        item.lang.toLowerCase() ===
          target
      );
    });

  if (voice) return voice;

  voice =
    voices.find(function (item) {
      return (
        item.lang &&
        item.lang
          .toLowerCase()
          .startsWith(base + "-")
      );
    });

  if (voice) return voice;

  voice =
    voices.find(function (item) {
      return (
        item.lang &&
        item.lang
          .toLowerCase()
          .startsWith(base)
      );
    });

  return voice || null;
}

// =====================================================
// SPEAK ATHARV ANSWER
// =====================================================

function speakText(
  text,
  button = null
) {
  if (!isVoiceOutputSupported()) {
    console.warn(
      "Speech synthesis not supported."
    );

    return;
  }

  const cleanText =
    String(text || "").trim();

  if (!cleanText) return;

  stopVoiceOutput();

  document
    .querySelectorAll(
      ".atharv-message-voice"
    )
    .forEach(function (item) {
      item.textContent = "🔊";
      item.classList.remove(
        "speaking"
      );
    });

  const language =
    detectVoiceLanguage(cleanText);

  selectedVoiceLanguage =
    language;

  const utterance =
    new SpeechSynthesisUtterance(
      cleanText
    );

  utterance.lang = language;
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice =
    findBestSpeechVoice(language);

  if (voice) {
    utterance.voice = voice;
  }

  utterance.onstart =
    function () {
      isSpeaking = true;

      if (button) {
        button.textContent = "⏹️";

        button.classList.add(
          "speaking"
        );
      }
    };

  utterance.onend =
    function () {
      isSpeaking = false;
      currentSpeechUtterance = null;

      if (button) {
        button.textContent = "🔊";

        button.classList.remove(
          "speaking"
        );
      }
    };

  utterance.onerror =
    function (event) {
      console.error(
        "SPEECH OUTPUT ERROR:",
        event.error
      );

      isSpeaking = false;
      currentSpeechUtterance = null;

      if (button) {
        button.textContent = "🔊";

        button.classList.remove(
          "speaking"
        );
      }
    };

  currentSpeechUtterance =
    utterance;

  window.speechSynthesis.speak(
    utterance
  );
}

// =====================================================
// STOP VOICE OUTPUT
// =====================================================

function stopVoiceOutput() {
  if (isVoiceOutputSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.warn(
        "SPEECH CANCEL ERROR:",
        error
      );
    }
  }

  isSpeaking = false;
  currentSpeechUtterance = null;

  document
    .querySelectorAll(
      ".atharv-message-voice"
    )
    .forEach(function (button) {
      button.textContent = "🔊";

      button.classList.remove(
        "speaking"
      );
    });
}

// =====================================================
// AI MESSAGE SPEAKER BUTTON
// =====================================================

function addVoiceButtonToMessage(
  messageElement,
  text
) {
  if (
    !messageElement ||
    !isVoiceOutputSupported()
  ) {
    return;
  }

  const voiceButton =
    document.createElement(
      "button"
    );

  voiceButton.type = "button";
  voiceButton.className =
    "atharv-message-voice";

  voiceButton.textContent = "🔊";
  voiceButton.title =
    "Atharv ka jawab sunen";

  voiceButton.setAttribute(
    "aria-label",
    "Listen to Atharv"
  );

  voiceButton.addEventListener(
    "click",
    function () {
      if (isSpeaking) {
        stopVoiceOutput();
        return;
      }

      speakText(
        text,
        voiceButton
      );
    }
  );

  messageElement.appendChild(
    voiceButton
  );
}

// =====================================================
// ADD MESSAGE
// =====================================================

function addMessage(
  text,
  type
) {
  const cleanText =
    String(text || "");

  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message " + type;

  message.dataset.messageText =
    cleanText;

  message.textContent =
    cleanText;

  chatBox.appendChild(
    message
  );

  if (type === "ai") {
    addVoiceButtonToMessage(
      message,
      cleanText
    );
  }

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

        const cleanText =
          message.dataset
            .messageText !== undefined
            ? message.dataset.messageText
            : message.textContent;

        messages.push({
          text: cleanText,
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

    if (!saved) return [];

    const messages =
      JSON.parse(saved);

    if (
      !Array.isArray(messages)
    ) {
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

// =====================================================
// CLEAR CHAT HISTORY
// =====================================================

function clearChatHistory() {
  try {
    stopVoiceOutput();

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
    document.createElement(
      "div"
    );

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
// SERVER ANSWER
// =====================================================

function getServerAnswer(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return "";
  }

  const possibleAnswers = [
    data.answer,
    data.response,
    data.reply,
    data.message,
    data.text,
    data.content
  ];

  for (
    const value of possibleAnswers
  ) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage() {
  if (!messageInput) return;

  const message =
    messageInput.value.trim();

  if (
    !message ||
    isThinking
  ) {
    return;
  }

  stopVoiceOutput();

  addMessage(
    message,
    "user"
  );

  saveChatHistory();

  messageInput.value = "";
  messageInput.style.height = "auto";

  isThinking = true;

  if (sendButton) {
    sendButton.disabled = true;
    sendButton.style.opacity = "0.5";
  }

  showThinking();

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(function () {
      controller.abort();
    }, 60000);

  try {
    const fullHistory =
      getChatHistory();

    const recentHistory =
      fullHistory.slice(-8);

    const timeZone =
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "Asia/Kolkata";

    const response =
      await fetch(
        API_BASE + "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body: JSON.stringify({
            message: message,
            history: recentHistory,
            timeZone: timeZone,
            userId: ATHARV_USER_ID
          }),

          signal:
            controller.signal
        }
      );

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
      data = responseText
        ? JSON.parse(responseText)
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

    if (!response.ok) {
      const serverError =
        data.error ||
        data.message ||
        `Server error (${response.status})`;

      throw new Error(
        serverError
      );
    }

    const reply =
      getServerAnswer(data);

    if (!reply) {
      console.error(
        "EMPTY ATHARV RESPONSE:",
        data
      );

      throw new Error(
        "Atharv server ne empty response diya."
      );
    }

    removeThinking();

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
      error.name === "AbortError"
    ) {
      addMessage(
        "⏳ Response lane mein zyada time lag raha hai. Please dobara try karein.",
        "ai"
      );
    } else {
      addMessage(
        "⚠️ Atharv response nahi la paaya.\n\nReason: " +
          (
            error.message ||
            "Unknown error"
          ),
        "ai"
      );
    }

    saveChatHistory();

  } finally {
    clearTimeout(timeoutId);

    isThinking = false;

    if (sendButton) {
      sendButton.disabled = false;
      sendButton.style.opacity = "1";
    }

    if (messageInput) {
      messageInput.focus();
    }
  }
}

// =====================================================
// QUICK ASK
// =====================================================

function quickAsk(text) {
  if (
    isThinking ||
    !messageInput
  ) {
    return;
  }

  messageInput.value = text;

  messageInput.dispatchEvent(
    new Event("input")
  );

  sendMessage();
}

// =====================================================
// ENTER TO SEND
// =====================================================

if (messageInput) {
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

  messageInput.addEventListener(
    "input",
    function () {
      this.style.height = "auto";

      this.style.height =
        Math.min(
          this.scrollHeight,
          120
        ) + "px";
    }
  );
}

// =====================================================
// NAVIGATION
// =====================================================

const navButtons =
  document.querySelectorAll(
    ".bottom-nav button"
  );

// =====================================================
// PROFILE
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
  name: "Name",
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
// SHOW CHAT
// =====================================================

function showChatScreen() {
  if (chatScreen) {
    chatScreen.hidden = false;
  }

  if (profileScreen) {
    profileScreen.hidden = true;
  }

  updateNavActive("chat");
}

// =====================================================
// SHOW PROFILE
// =====================================================

function showProfileScreen() {
  if (chatScreen) {
    chatScreen.hidden = true;
  }

  if (profileScreen) {
    profileScreen.hidden = false;
  }

  updateNavActive("profile");

  loadMemories();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// =====================================================
// NAV ACTIVE
// =====================================================

function updateNavActive(name) {
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
  if (!memoryList) return;

  memoryList.innerHTML = "";

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
      if (
        !memory ||
        typeof memory !== "object"
      ) {
        return;
      }

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
        memory.memory_key ||
        "Memory";

      const value =
        document.createElement(
          "div"
        );

      value.className =
        "memory-value";

      value.textContent =
        memory.memory_value ||
        "";

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

      deleteButton.type = "button";
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
  if (!memoryList) return;

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
          method: "GET",
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
      (
        error.message ||
        "Unknown error"
      ) +
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

  if (!confirmed) return;

  try {
    const response =
      await fetch(
        API_BASE +
          "/api/memory/delete",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body: JSON.stringify({
            userId:
              ATHARV_USER_ID,

            key: key
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

    if (
      Array.isArray(
        data.memories
      )
    ) {
      renderMemories(
        data.memories
      );
    } else {
      await loadMemories();
    }
  } catch (error) {
    console.error(
      "MEMORY DELETE ERROR:",
      error
    );

    alert(
      "Memory delete nahi ho paayi.\n\n" +
        (
          error.message ||
          "Unknown error"
        )
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

  if (!confirmed) return;

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
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body: JSON.stringify({
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

    renderMemories([]);
  } catch (error) {
    console.error(
      "MEMORY CLEAR ERROR:",
      error
    );

    alert(
      "All memories delete nahi ho paayi.\n\n" +
        (
          error.message ||
          "Unknown error"
        )
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
// PROFILE EVENTS
// =====================================================

if (profileButton) {
  profileButton.addEventListener(
    "click",
    showProfileScreen
  );
}

if (profileBack) {
  profileBack.addEventListener(
    "click",
    showChatScreen
  );
}

if (refreshMemory) {
  refreshMemory.addEventListener(
    "click",
    loadMemories
  );
}

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

        if (nav === "chat") {
          showChatScreen();
          return;
        }

        if (nav === "profile") {
          showProfileScreen();
          return;
        }

        if (nav === "market") {
          alert(
            "📈 Market module next stage mein activate hoga."
          );

          showChatScreen();
          return;
        }

        if (nav === "alerts") {
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
// VOICE INITIALIZATION
// =====================================================

function initializeAtharvVoice() {
  createVoiceControls();

  if (isVoiceOutputSupported()) {
    window.speechSynthesis.onvoiceschanged =
      function () {
        console.log(
          "ATHARV SPEECH VOICES:",
          window.speechSynthesis
            .getVoices()
            .length
        );
      };
  }

  console.log(
    "Voice input supported:",
    isVoiceInputSupported()
  );

  console.log(
    "Voice output supported:",
    isVoiceOutputSupported()
  );
}

// =====================================================
// GLOBAL FUNCTIONS
// =====================================================

window.sendMessage =
  sendMessage;

window.quickAsk =
  quickAsk;

window.clearChatHistory =
  clearChatHistory;

window.speakText =
  speakText;

window.stopVoiceOutput =
  stopVoiceOutput;

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
  "Memory UI enabled."
);

console.log(
  "Chat history enabled."
);

console.log(
  "Conversation context enabled."
);

console.log(
  "Text chat enabled 💬"
);

console.log(
  "Voice input enabled 🎙️"
);

console.log(
  "Voice output enabled 🔊"
);

console.log(
  "================================"
);

// =====================================================
// LOAD CHAT
// =====================================================

loadChatHistory();

// =====================================================
// INITIALIZE VOICE
// =====================================================

initializeAtharvVoice();
