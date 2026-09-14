/* =========================================================
   ATHARV AI - FINAL FRONTEND CONTROLLER
   Version 8.0
   Multilingual • Memory • Voice • Files • Market • Alerts
   ========================================================= */

"use strict";

/* =========================================================
   BASIC CONFIG
   ========================================================= */

const API_BASE = "";

const ATHARV_HISTORY_KEY = "atharv_chat_history";
const ATHARV_USER_ID_KEY = "atharv_user_id";
const ATHARV_LANGUAGE_KEY = "atharv_language";

/* =========================================================
   ELEMENTS
   ========================================================= */

const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("message");
const sendButton = document.querySelector(".send");

const languageSelect =
  document.getElementById("atharvLanguage");

const fileInput =
  document.getElementById("fileInput");

const attachmentButton =
  document.getElementById("attachmentButton");

const attachmentPreview =
  document.getElementById("attachmentPreview");

/* =========================================================
   STATE
   ========================================================= */

let isThinking = false;
let currentController = null;

let selectedAttachment = null;

let speechRecognition = null;
let isListening = false;

let isSpeaking = false;
let currentSpeechUtterance = null;

let selectedVoiceLanguage = "en-IN";

/* =========================================================
   USER ID
   ========================================================= */

function getAtharvUserId() {
  try {
    let id =
      localStorage.getItem(
        ATHARV_USER_ID_KEY
      );

    if (id) return id;

    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      id = window.crypto.randomUUID();
    } else {
      id =
        "atharv_" +
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 12);
    }

    localStorage.setItem(
      ATHARV_USER_ID_KEY,
      id
    );

    return id;
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
        .slice(2, 12)
    );
  }
}

const ATHARV_USER_ID =
  getAtharvUserId();

console.log(
  "ATHARV USER ID:",
  ATHARV_USER_ID
);

/* =========================================================
   LANGUAGE
   ========================================================= */

const LANGUAGE_MAP = {
  auto: "Auto Detect",
  hi: "Hindi",
  en: "English",
  hinglish: "Hinglish",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese"
};

let selectedLanguage =
  localStorage.getItem(
    ATHARV_LANGUAGE_KEY
  ) || "auto";

if (languageSelect) {
  const exists = Array.from(
    languageSelect.options || []
  ).some(
    option =>
      option.value ===
      selectedLanguage
  );

  if (exists) {
    languageSelect.value =
      selectedLanguage;
  }

  languageSelect.addEventListener(
    "change",
    function () {
      selectedLanguage =
        this.value || "auto";

      localStorage.setItem(
        ATHARV_LANGUAGE_KEY,
        selectedLanguage
      );

      updateVoiceLanguageFromSelection();

      console.log(
        "ATHARV LANGUAGE:",
        selectedLanguage
      );
    }
  );
}

/* =========================================================
   LANGUAGE → VOICE
   ========================================================= */

function languageToVoiceCode(
  language
) {
  const map = {
    hi: "hi-IN",
    en: "en-IN",
    hinglish: "hi-IN",
    bn: "bn-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    ta: "ta-IN",
    te: "te-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    pa: "pa-IN",
    ur: "ur-PK",
    ar: "ar-SA",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    pt: "pt-BR",
    ru: "ru-RU",
    ja: "ja-JP",
    ko: "ko-KR",
    zh: "zh-CN"
  };

  return (
    map[language] ||
    "en-IN"
  );
}

function updateVoiceLanguageFromSelection() {
  if (
    selectedLanguage &&
    selectedLanguage !== "auto"
  ) {
    selectedVoiceLanguage =
      languageToVoiceCode(
        selectedLanguage
      );
  }
}

/* =========================================================
   VOICE LANGUAGE DETECTION
   ========================================================= */

function detectVoiceLanguage(text) {
  const value =
    String(text || "").trim();

  if (!value) {
    return "en-IN";
  }

  if (/[\u0900-\u097F]/.test(value))
    return "hi-IN";

  if (/[\u0980-\u09FF]/.test(value))
    return "bn-IN";

  if (/[\u0A00-\u0A7F]/.test(value))
    return "pa-IN";

  if (/[\u0A80-\u0AFF]/.test(value))
    return "gu-IN";

  if (/[\u0B80-\u0BFF]/.test(value))
    return "ta-IN";

  if (/[\u0C00-\u0C7F]/.test(value))
    return "te-IN";

  if (/[\u0C80-\u0CFF]/.test(value))
    return "kn-IN";

  if (/[\u0D00-\u0D7F]/.test(value))
    return "ml-IN";

  if (/[\u0600-\u06FF]/.test(value))
    return "ar-SA";

  if (/[\u0590-\u05FF]/.test(value))
    return "he-IL";

  if (/[\u0400-\u04FF]/.test(value))
    return "ru-RU";

  if (/[\u0370-\u03FF]/.test(value))
    return "el-GR";

  if (/[\u0E00-\u0E7F]/.test(value))
    return "th-TH";

  if (/[\u3040-\u30FF]/.test(value))
    return "ja-JP";

  if (/[\uAC00-\uD7AF]/.test(value))
    return "ko-KR";

  if (/[\u4E00-\u9FFF]/.test(value))
    return "zh-CN";

  const lower =
    value.toLowerCase();

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

  hindiWords.forEach(
    word => {
      if (
        new RegExp(
          "\\b" +
            word +
            "\\b",
          "i"
        ).test(lower)
      ) {
        matches++;
      }
    }
  );

  if (matches >= 2) {
    return "hi-IN";
  }

  return "en-IN";
}

/* =========================================================
   VOICE SUPPORT
   ========================================================= */

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
    "SpeechSynthesisUtterance" in
      window
  );
}

/* =========================================================
   VOICE UI
   ========================================================= */

function getVoiceControls() {
  return {
    area:
      document.getElementById(
        "atharvVoiceArea"
      ),

    micButton:
      document.getElementById(
        "atharvMicButton"
      ),

    stopButton:
      document.getElementById(
        "atharvStopVoiceButton"
      ),

    status:
      document.getElementById(
        "atharvVoiceStatus"
      )
  };
}

function updateVoiceStatus(text) {
  const controls =
    getVoiceControls();

  if (controls.status) {
    controls.status.textContent =
      text;
  }
}

/* =========================================================
   CREATE VOICE CONTROL
   ========================================================= */

function createVoiceControls() {
  if (!messageInput) return;

  const controls =
    getVoiceControls();

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

  const micButton =
    document.createElement(
      "button"
    );

  micButton.type = "button";
  micButton.id =
    "atharvMicButton";
  micButton.className =
    "voice-input-button";
  micButton.textContent =
    "🎙️";
  micButton.title =
    "Bolkar poochhein";

  if (
    sendButton &&
    sendButton.parentElement
  ) {
    sendButton.parentElement.insertBefore(
      micButton,
      sendButton
    );
  } else if (
    messageInput.parentElement
  ) {
    messageInput.parentElement.appendChild(
      micButton
    );
  }

  let status =
    document.getElementById(
      "atharvVoiceStatus"
    );

  if (!status) {
    status =
      document.createElement(
        "div"
      );

    status.id =
      "atharvVoiceStatus";

    status.className =
      "voice-status";

    status.textContent =
      "Voice ready";

    if (
      messageInput.parentElement &&
      messageInput.parentElement
        .parentElement
    ) {
      messageInput.parentElement.parentElement.appendChild(
        status
      );
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

/* =========================================================
   VOICE BUTTONS
   ========================================================= */

function bindVoiceButtons(
  micButton,
  stopButton,
  status
) {
  if (!micButton || !status)
    return;

  if (
    micButton.dataset
      .atharvBound ===
    "true"
  ) {
    return;
  }

  micButton.dataset.atharvBound =
    "true";

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

/* =========================================================
   SPEECH RECOGNITION
   ========================================================= */

function setupSpeechRecognition(
  micButton,
  status
) {
  const RecognitionClass =
    getSpeechRecognitionClass();

  if (!micButton || !status)
    return;

  if (!RecognitionClass) {
    micButton.disabled = true;
    micButton.style.opacity =
      "0.4";

    status.textContent =
      "Is browser mein voice input available nahi hai.";

    return;
  }

  if (speechRecognition)
    return;

  speechRecognition =
    new RecognitionClass();

  speechRecognition.continuous =
    false;

  speechRecognition.interimResults =
    true;

  speechRecognition.maxAlternatives =
    1;

  speechRecognition.lang =
    selectedVoiceLanguage;

  speechRecognition.onstart =
    function () {
      isListening = true;

      micButton.textContent =
        "🛑";

      micButton.title =
        "Listening...";

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
        let i =
          event.resultIndex;
        i <
        event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0]
            .transcript;

        if (
          event.results[i]
            .isFinal
        ) {
          finalText +=
            transcript;
        } else {
          interimText +=
            transcript;
        }
      }

      if (interimText) {
        messageInput.value =
          interimText;
      }

      if (
        finalText.trim()
      ) {
        const cleaned =
          finalText.trim();

        messageInput.value =
          cleaned;

        if (
          selectedLanguage ===
          "auto"
        ) {
          selectedVoiceLanguage =
            detectVoiceLanguage(
              cleaned
            );
        }

        speechRecognition.lang =
          selectedVoiceLanguage;

        setTimeout(
          function () {
            if (
              messageInput.value.trim() &&
              !isThinking
            ) {
              sendMessage();
            }
          },
          200
        );
      }
    };

  speechRecognition.onerror =
    function (event) {
      console.error(
        "SPEECH RECOGNITION ERROR:",
        event.error
      );

      isListening = false;

      micButton.textContent =
        "🎙️";

      micButton.classList.remove(
        "listening"
      );

      if (
        event.error ===
        "not-allowed"
      ) {
        status.textContent =
          "🎙️ Microphone permission allow karein.";
      } else if (
        event.error ===
        "no-speech"
      ) {
        status.textContent =
          "Kuch sunai nahi diya.";
      } else {
        status.textContent =
          "Voice input error.";
      }
    };

  speechRecognition.onend =
    function () {
      isListening = false;

      micButton.textContent =
        "🎙️";

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

/* =========================================================
   TOGGLE VOICE INPUT
   ========================================================= */

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
        "STOP LISTENING:",
        error
      );
    }

    return;
  }

  if (isSpeaking) {
    stopVoiceOutput();
  }

  if (
    selectedLanguage !==
    "auto"
  ) {
    selectedVoiceLanguage =
      languageToVoiceCode(
        selectedLanguage
      );
  } else {
    selectedVoiceLanguage =
      detectVoiceLanguage(
        messageInput.value
      );
  }

  speechRecognition.lang =
    selectedVoiceLanguage;

  try {
    speechRecognition.start();
  } catch (error) {
    console.warn(
      "START LISTENING:",
      error
    );

    status.textContent =
      "Mic start nahi ho paaya.";
  }
}

/* =========================================================
   SPEECH OUTPUT
   ========================================================= */

function findBestSpeechVoice(
  language
) {
  if (!isVoiceOutputSupported())
    return null;

  const voices =
    window.speechSynthesis.getVoices();

  if (
    !voices ||
    !voices.length
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
    voices.find(
      item =>
        item.lang &&
        item.lang.toLowerCase() ===
          target
    );

  if (voice) return voice;

  voice =
    voices.find(
      item =>
        item.lang &&
        item.lang
          .toLowerCase()
          .startsWith(
            base + "-"
          )
    );

  if (voice) return voice;

  return (
    voices.find(
      item =>
        item.lang &&
        item.lang
          .toLowerCase()
          .startsWith(base)
    ) || null
  );
}

function speakText(
  text,
  button = null
) {
  if (!isVoiceOutputSupported())
    return;

  const cleanText =
    String(text || "").trim();

  if (!cleanText) return;

  stopVoiceOutput();

  let language;

  if (
    selectedLanguage !==
    "auto"
  ) {
    language =
      languageToVoiceCode(
        selectedLanguage
      );
  } else {
    language =
      detectVoiceLanguage(
        cleanText
      );
  }

  selectedVoiceLanguage =
    language;

  const utterance =
    new SpeechSynthesisUtterance(
      cleanText
    );

  utterance.lang =
    language;

  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice =
    findBestSpeechVoice(
      language
    );

  if (voice) {
    utterance.voice =
      voice;
  }

  utterance.onstart =
    function () {
      isSpeaking = true;

      if (button) {
        button.textContent =
          "⏹️";

        button.classList.add(
          "speaking"
        );
      }
    };

  utterance.onend =
    function () {
      isSpeaking = false;
      currentSpeechUtterance =
        null;

      if (button) {
        button.textContent =
          "🔊";

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
      currentSpeechUtterance =
        null;

      if (button) {
        button.textContent =
          "🔊";

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

function stopVoiceOutput() {
  if (isVoiceOutputSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.warn(
        "SPEECH CANCEL:",
        error
      );
    }
  }

  isSpeaking = false;
  currentSpeechUtterance =
    null;

  document
    .querySelectorAll(
      ".atharv-message-voice"
    )
    .forEach(button => {
      button.textContent =
        "🔊";

      button.classList.remove(
        "speaking"
      );
    });
}

/* =========================================================
   MESSAGE VOICE BUTTON
   ========================================================= */

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

  voiceButton.type =
    "button";

  voiceButton.className =
    "atharv-message-voice";

  voiceButton.textContent =
    "🔊";

  voiceButton.title =
    "Atharv ka jawab sunen";

  voiceButton.addEventListener(
    "click",
    function () {
      if (isSpeaking) {
        stopVoiceOutput();
      } else {
        speakText(
          text,
          voiceButton
        );
      }
    }
  );

  messageElement.appendChild(
    voiceButton
  );
}

/* =========================================================
   MESSAGE RENDER
   ========================================================= */

function addMessage(
  text,
  type,
  options = {}
) {
  if (!chatBox) return null;

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

  if (
    type === "ai" &&
    options.voice !== false
  ) {
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

/* =========================================================
   SOURCES
   ========================================================= */

function renderSources(
  sources
) {
  if (
    !Array.isArray(sources) ||
    !sources.length ||
    !chatBox
  ) {
    return;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "atharv-sources";

  const title =
    document.createElement(
      "div"
    );

  title.textContent =
    "🌐 Sources";

  title.className =
    "atharv-sources-title";

  wrapper.appendChild(
    title
  );

  sources
    .slice(0, 6)
    .forEach(source => {
      if (!source) return;

      const link =
        document.createElement(
          "a"
        );

      link.target = "_blank";
      link.rel =
        "noopener noreferrer";

      link.href =
        source.url ||
        "#";

      link.textContent =
        source.title ||
        source.name ||
        source.url ||
        "Source";

      wrapper.appendChild(
        link
      );
    });

  chatBox.appendChild(
    wrapper
  );

  wrapper.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });
}

/* =========================================================
   HISTORY
   ========================================================= */

function saveChatHistory() {
  try {
    if (!chatBox) return;

    const messages = [];

    chatBox
      .querySelectorAll(
        ".message"
      )
      .forEach(message => {
        if (
          message.id ===
          "thinkingMessage"
        ) {
          return;
        }

        const text =
          message.dataset
            .messageText ||
          message.textContent ||
          "";

        messages.push({
          text,
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
      JSON.stringify(
        messages.slice(-100)
      )
    );
  } catch (error) {
    console.error(
      "HISTORY SAVE ERROR:",
      error
    );
  }
}

function getChatHistory() {
  try {
    const saved =
      localStorage.getItem(
        ATHARV_HISTORY_KEY
      );

    if (!saved) return [];

    const messages =
      JSON.parse(saved);

    return Array.isArray(messages)
      ? messages
      : [];
  } catch (error) {
    console.error(
      "HISTORY READ ERROR:",
      error
    );

    return [];
  }
}

function loadChatHistory() {
  if (!chatBox) return;

  const messages =
    getChatHistory();

  if (!messages.length)
    return;

  chatBox.innerHTML = "";

  messages.forEach(item => {
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
}

function clearChatHistory() {
  stopVoiceOutput();

  localStorage.removeItem(
    ATHARV_HISTORY_KEY
  );

  if (chatBox) {
    chatBox.innerHTML = "";
  }
}

/* =========================================================
   THINKING
   ========================================================= */

function showThinking() {
  removeThinking();

  if (!chatBox) return;

  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message ai thinking";

  message.id =
    "thinkingMessage";

  message.innerHTML =
    "Atharv <span class=\"atharv-dots\">● ● ●</span>";

  chatBox.appendChild(
    message
  );

  message.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });
}

function removeThinking() {
  const item =
    document.getElementById(
      "thinkingMessage"
    );

  if (item) item.remove();
}

/* =========================================================
   SERVER ANSWER
   ========================================================= */

function getServerAnswer(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return "";
  }

  const possible = [
    data.answer,
    data.response,
    data.reply,
    data.text,
    data.content
  ];

  for (const value of possible) {
    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

/* =========================================================
   ATTACHMENTS
   ========================================================= */

function clearAttachment() {
  selectedAttachment =
    null;

  if (fileInput) {
    fileInput.value = "";
  }

  if (attachmentPreview) {
    attachmentPreview.innerHTML =
      "";

    attachmentPreview.hidden =
      true;
  }
}

function renderAttachmentPreview(
  file
) {
  if (!attachmentPreview)
    return;

  attachmentPreview.innerHTML =
    "";

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "attachment-item";

  const name =
    document.createElement(
      "span"
    );

  const sizeKB =
    Math.max(
      1,
      Math.round(
        file.size / 1024
      )
    );

  name.textContent =
    "📎 " +
    file.name +
    " (" +
    sizeKB +
    " KB)";

  const remove =
    document.createElement(
      "button"
    );

  remove.type =
    "button";

  remove.textContent =
    "✕";

  remove.addEventListener(
    "click",
    clearAttachment
  );

  wrapper.appendChild(name);
  wrapper.appendChild(remove);

  attachmentPreview.appendChild(
    wrapper
  );

  attachmentPreview.hidden =
    false;
}

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
}

if (fileInput) {
  fileInput.addEventListener(
    "change",
    function () {
      const file =
        this.files &&
        this.files[0];

      if (!file) return;

      const maxSize =
        10 * 1024 * 1024;

      if (file.size > maxSize) {
        alert(
          "File 10 MB se chhoti honi chahiye."
        );

        clearAttachment();
        return;
      }

      selectedAttachment =
        file;

      renderAttachmentPreview(
        file
      );
    }
  );
}

/* =========================================================
   TEXT FILE READER
   ========================================================= */

async function readTextFile(
  file
) {
  const type =
    file.type || "";

  const name =
    file.name.toLowerCase();

  const isText =
    type.startsWith(
      "text/"
    ) ||
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".md") ||
    name.endsWith(".json") ||
    name.endsWith(".xml") ||
    name.endsWith(".log");

  if (!isText) {
    return null;
  }

  try {
    return await file.text();
  } catch (error) {
    console.error(
      "FILE READ ERROR:",
      error
    );

    return null;
  }
}

/* =========================================================
   ATTACHMENT DESCRIPTION
   ========================================================= */

function getAttachmentDescription(
  file
) {
  if (!file) return "";

  const type =
    file.type || "";

  const name =
    file.name.toLowerCase();

  if (
    type.startsWith(
      "image/"
    )
  ) {
    return (
      "User attached an image named " +
      file.name +
      ". Image analysis is requested."
    );
  }

  if (
    type ===
      "application/pdf" ||
    name.endsWith(".pdf")
  ) {
    return (
      "User attached a PDF named " +
      file.name +
      ". PDF analysis is requested."
    );
  }

  return (
    "User attached file: " +
    file.name
  );
}

/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {
  if (!messageInput)
    return;

  const message =
    messageInput.value.trim();

  if (
    !message ||
    isThinking
  ) {
    return;
  }

  stopVoiceOutput();

  const attachment =
    selectedAttachment;

  let attachmentText =
    null;

  if (attachment) {
    attachmentText =
      await readTextFile(
        attachment
      );
  }

  addMessage(
    message,
    "user"
  );

  saveChatHistory();

  messageInput.value = "";
  messageInput.style.height =
    "auto";

  isThinking = true;

  if (sendButton) {
    sendButton.disabled =
      true;

    sendButton.style.opacity =
      "0.5";
  }

  showThinking();

  currentController =
    new AbortController();

  const timeoutId =
    setTimeout(
      function () {
        if (
          currentController
        ) {
          currentController.abort();
        }
      },
      90000
    );

  try {
    const fullHistory =
      getChatHistory();

    const recentHistory =
      fullHistory.slice(
        -12
      );

    const timeZone =
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "Asia/Kolkata";

    const body = {
      message,

      history:
        recentHistory,

      timeZone,

      userId:
        ATHARV_USER_ID,

      language:
        selectedLanguage,

      languageName:
        LANGUAGE_MAP[
          selectedLanguage
        ] ||
        "Auto Detect"
    };

    if (attachment) {
      body.attachment = {
        name:
          attachment.name,

        type:
          attachment.type,

        size:
          attachment.size
      };

      body.attachmentDescription =
        getAttachmentDescription(
          attachment
        );

      if (attachmentText) {
        body.attachmentText =
          attachmentText.slice(
            0,
            50000
          );
      }
    }

    const response =
      await fetch(
        API_BASE +
          "/api/chat",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          body:
            JSON.stringify(
              body
            ),

          signal:
            currentController.signal
        }
      );

    const responseText =
      await response.text();

    let data = {};

    try {
      data =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};
    } catch (error) {
      throw new Error(
        "Server ne valid JSON response nahi diya."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          "Server error (" +
            response.status +
            ")"
      );
    }

    const reply =
      getServerAnswer(data);

    if (!reply) {
      throw new Error(
        "Atharv server ne empty response diya."
      );
    }

    removeThinking();

    addMessage(
      reply,
      "ai"
    );

    if (
      Array.isArray(
        data.sources
      )
    ) {
      renderSources(
        data.sources
      );
    }

    saveChatHistory();

    clearAttachment();

  } catch (error) {
    removeThinking();

    console.error(
      "ATHARV ERROR:",
      error
    );

    let errorMessage =
      "⚠️ Atharv response nahi la paaya.";

    if (
      error.name ===
      "AbortError"
    ) {
      errorMessage +=
        "\n\n⏳ Response mein zyada time lag raha hai. Please dobara try karein.";
    } else {
      errorMessage +=
        "\n\nReason: " +
        (
          error.message ||
          "Unknown error"
        );
    }

    addMessage(
      errorMessage,
      "ai"
    );

    saveChatHistory();

  } finally {
    clearTimeout(
      timeoutId
    );

    currentController =
      null;

    isThinking = false;

    if (sendButton) {
      sendButton.disabled =
        false;

      sendButton.style.opacity =
        "1";
    }

    if (messageInput) {
      messageInput.focus();
    }
  }
}

/* =========================================================
   QUICK ASK
   ========================================================= */

function quickAsk(text) {
  if (
    isThinking ||
    !messageInput
  ) {
    return;
  }

  showChatScreen();

  messageInput.value =
    text;

  messageInput.dispatchEvent(
    new Event("input")
  );

  sendMessage();
}

/* =========================================================
   INPUT
   ========================================================= */

if (messageInput) {
  messageInput.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key ===
          "Enter" &&
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
      this.style.height =
        "auto";

      this.style.height =
        Math.min(
          this.scrollHeight,
          120
        ) + "px";
    }
  );
}

/* =========================================================
   PROFILE / MEMORY
   ========================================================= */

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

const marketScreen =
  document.getElementById(
    "marketScreen"
  );

const alertsScreen =
  document.getElementById(
    "alertsScreen"
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

function hideAllScreens() {
  if (chatScreen)
    chatScreen.hidden =
      true;

  if (profileScreen)
    profileScreen.hidden =
      true;

  if (marketScreen)
    marketScreen.hidden =
      true;

  if (alertsScreen)
    alertsScreen.hidden =
      true;
}

function showChatScreen() {
  hideAllScreens();

  if (chatScreen) {
    chatScreen.hidden =
      false;
  }

  updateNavActive(
    "chat"
  );
}

function showProfileScreen() {
  hideAllScreens();

  if (profileScreen) {
    profileScreen.hidden =
      false;
  }

  updateNavActive(
    "profile"
  );

  loadMemories();
}

function updateNavActive(
  name
) {
  document
    .querySelectorAll(
      ".bottom-nav button"
    )
    .forEach(button => {
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
    });
}

/* =========================================================
   MEMORY RENDER
   ========================================================= */

function renderMemories(
  memories
) {
  if (!memoryList)
    return;

  memoryList.innerHTML =
    "";

  if (
    !Array.isArray(
      memories
    ) ||
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
    memory => {
      if (
        !memory ||
        typeof memory !==
          "object"
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

/* =========================================================
   LOAD MEMORY
   ========================================================= */

async function loadMemories() {
  if (!memoryList)
    return;

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
            Accept:
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
      data.memories ||
        []
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

/* =========================================================
   DELETE MEMORY
   ========================================================= */

async function deleteSingleMemory(
  key
) {
  const label =
    memoryLabels[key] ||
    key;

  if (
    !window.confirm(
      `Kya aap "${label}" memory ko bhoolna chahte hain?`
    )
  ) {
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

            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              userId:
                ATHARV_USER_ID,

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
      data.memories ||
        []
    );
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

/* =========================================================
   DELETE ALL MEMORY
   ========================================================= */

async function deleteAllMemories() {
  if (
    !window.confirm(
      "Kya aap Atharv ki SAARI memories delete karna chahte hain?\n\nYe action undo nahi kiya ja sakta."
    )
  ) {
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

            Accept:
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

/* =========================================================
   PROFILE EVENTS
   ========================================================= */

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

/* =========================================================
   MARKET
   ========================================================= */

function showMarketScreen() {
  if (!marketScreen) {
    quickAsk(
      "Give me the latest Indian stock market update including NIFTY, SENSEX, major gainers, losers and important market news."
    );

    return;
  }

  hideAllScreens();

  marketScreen.hidden =
    false;

  updateNavActive(
    "market"
  );
}

function askMarketUpdate() {
  quickAsk(
    "Give me the latest Indian stock market update. Include NIFTY, SENSEX, major market-moving news, sectors and important stocks. Use current live information and clearly mention the date/time of the data."
  );
}

/* =========================================================
   ALERTS
   ========================================================= */

function showAlertsScreen() {
  if (!alertsScreen) {
    quickAsk(
      "What are the most important breaking news and alerts in India and the world right now?"
    );

    return;
  }

  hideAllScreens();

  alertsScreen.hidden =
    false;

  updateNavActive(
    "alerts"
  );
}

function askLatestAlerts() {
  quickAsk(
    "What are the most important breaking news, alerts and major developments in India and the world right now? Use current live information."
  );
}

/* =========================================================
   BOTTOM NAV
   ========================================================= */

document
  .querySelectorAll(
    ".bottom-nav button"
  )
  .forEach(button => {
    if (
      button.dataset
        .atharvBound ===
      "true"
    ) {
      return;
    }

    button.dataset.atharvBound =
      "true";

    button.addEventListener(
      "click",
      function () {
        const nav =
          button.dataset.nav;

        if (nav === "chat") {
          showChatScreen();
          return;
        }

        if (
          nav ===
          "profile"
        ) {
          showProfileScreen();
          return;
        }

        if (
          nav ===
          "market"
        ) {
          showMarketScreen();
          return;
        }

        if (
          nav ===
          "alerts"
        ) {
          showAlertsScreen();
          return;
        }
      }
    );
  });

/* =========================================================
   QUICK BUTTONS
   ========================================================= */

document
  .querySelectorAll(
    "[data-quick]"
  )
  .forEach(button => {
    if (
      button.dataset
        .atharvQuickBound ===
      "true"
    ) {
      return;
    }

    button.dataset
      .atharvQuickBound =
      "true";

    button.addEventListener(
      "click",
      function () {
        const text =
          button.dataset
            .quick;

        if (text) {
          quickAsk(text);
        }
      }
    );
  });

/* =========================================================
   EXTRA MARKET / ALERT BUTTONS
   ========================================================= */

document
  .querySelectorAll(
    "[data-action]"
  )
  .forEach(button => {
    if (
      button.dataset
        .atharvActionBound ===
      "true"
    ) {
      return;
    }

    button.dataset
      .atharvActionBound =
      "true";

    button.addEventListener(
      "click",
      function () {
        const action =
          button.dataset
            .action;

        if (
          action ===
          "market"
        ) {
          askMarketUpdate();
        }

        if (
          action ===
          "alerts"
        ) {
          askLatestAlerts();
        }

        if (
          action ===
          "chat"
        ) {
          showChatScreen();
        }
      }
    );
  });

/* =========================================================
   VOICE INITIALIZATION
   ========================================================= */

function initializeAtharvVoice() {
  updateVoiceLanguageFromSelection();

  createVoiceControls();

  if (
    isVoiceOutputSupported()
  ) {
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
    "Voice input:",
    isVoiceInputSupported()
  );

  console.log(
    "Voice output:",
    isVoiceOutputSupported()
  );
}

/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

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

window.showProfileScreen =
  showProfileScreen;

window.showChatScreen =
  showChatScreen;

window.showMarketScreen =
  showMarketScreen;

window.showAlertsScreen =
  showAlertsScreen;

window.loadMemories =
  loadMemories;

window.askMarketUpdate =
  askMarketUpdate;

window.askLatestAlerts =
  askLatestAlerts;

window.clearAttachment =
  clearAttachment;

/* =========================================================
   STARTUP
   ========================================================= */

console.log(
  "========================================"
);

console.log(
  "ATHARV AI FRONTEND 8.0 LOADED 🤖"
);

console.log(
  "Permanent User ID: ENABLED"
);

console.log(
  "Chat History: ENABLED"
);

console.log(
  "Permanent Memory: ENABLED"
);

console.log(
  "Multilingual UI: ENABLED"
);

console.log(
  "Voice Input: ENABLED"
);

console.log(
  "Voice Output: ENABLED"
);

console.log(
  "Text File Reading: ENABLED"
);

console.log(
  "Attachment Metadata: ENABLED"
);

console.log(
  "Live Sources UI: ENABLED"
);

console.log(
  "Market UI: ENABLED"
);

console.log(
  "Alerts UI: ENABLED"
);

console.log(
  "========================================"
);

/* =========================================================
   INITIAL LOAD
   ========================================================= */

loadChatHistory();

initializeAtharvVoice();
