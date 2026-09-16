/* =========================================================
   ATHARV AI
   FRONTEND CONTROLLER
   Version 10.0.0

   Features
   ---------------------------------------------------------
   • Multi-chat history
   • New / Open / Rename / Delete chat
   • Automatic chat titles
   • Markdown rendering
   • Code blocks + Copy button
   • Voice input
   • Text-to-speech
   • File / image attachments
   • Multilingual UI
   • Responsive sidebar
   • Local chat persistence
   • Same-origin Render backend
   • Robust loading / error handling
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const ATHARV_VERSION = "10.0.0";

const API_BASE =
  window.ATHARV_API_BASE !== undefined
    ? window.ATHARV_API_BASE
    : "";

const CHAT_ENDPOINT = `${API_BASE}/api/chat`;

const STORAGE_KEY = "atharv_chats_v10";
const ACTIVE_CHAT_KEY = "atharv_active_chat_v10";
const SETTINGS_KEY = "atharv_settings_v10";

const MAX_HISTORY_MESSAGES = 100;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/* =========================================================
   STATE
   ========================================================= */

const state = {
  chats: [],
  activeChatId: null,

  isSending: false,
  isListening: false,
  isSpeaking: false,

  recognition: null,
  speechSupported: false,

  selectedFiles: [],

  settings: {
    language: "auto",
    voiceEnabled: true
  }
};

/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

function firstElement(selectors) {
  for (const selector of selectors) {
    const element = $(selector);
    if (element) return element;
  }

  return null;
}

/* =========================================================
   COMMON ELEMENTS
   ========================================================= */

let elements = {};

function cacheElements() {
  elements = {
    sidebar: firstElement([
      "#sidebar",
      ".sidebar",
      "[data-sidebar]"
    ]),

    sidebarOverlay: firstElement([
      "#sidebarOverlay",
      ".sidebar-overlay",
      "[data-sidebar-overlay]"
    ]),

    newChat: firstElement([
      "#newChat",
      "#new-chat",
      "[data-new-chat]"
    ]),

    chatHistory: firstElement([
      "#chatHistory",
      "#chat-history",
      "[data-chat-history]"
    ]),

    chatList: firstElement([
      "#chatList",
      "#chat-list",
      "[data-chat-list]"
    ]),

    messages: firstElement([
      "#messages",
      "#chatMessages",
      "#messageList",
      ".messages",
      ".chat-messages",
      "[data-messages]"
    ]),

    messageInput: firstElement([
      "#messageInput",
      "#chatInput",
      "#prompt",
      "#userInput",
      "textarea[name='message']",
      "textarea"
    ]),

    sendButton: firstElement([
      "#sendButton",
      "#send-btn",
      "#sendBtn",
      "[data-send]"
    ]),

    attachButton: firstElement([
      "#attachButton",
      "#attach-btn",
      "#fileButton",
      "[data-attach]"
    ]),

    fileInput: firstElement([
      "#fileInput",
      "#file-input",
      "input[type='file']"
    ]),

    attachmentPreview: firstElement([
      "#attachmentPreview",
      "#attachments",
      ".attachment-preview",
      "[data-attachments]"
    ]),

    voiceButton: firstElement([
      "#voiceButton",
      "#voice-btn",
      "#micButton",
      "[data-voice]"
    ]),

    stopVoiceButton: firstElement([
      "#stopVoice",
      "#stop-voice",
      "[data-stop-voice]"
    ]),

    menuButton: firstElement([
      "#menuButton",
      "#menu-btn",
      "#sidebarButton",
      "#hamburger",
      "[data-menu]"
    ]),

    chatTitle: firstElement([
      "#chatTitle",
      "#chat-title",
      ".chat-title",
      "[data-chat-title]"
    ]),

    welcome: firstElement([
      "#welcome",
      ".welcome",
      "[data-welcome]"
    ])
  };
}

/* =========================================================
   ID / TEXT HELPERS
   ========================================================= */

function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function truncate(text, length = 42) {
  const value = cleanText(text);

  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length).trim()}…`;
}

function generateChatTitle(message) {
  const text = cleanText(message)
    .replace(/\s+/g, " ");

  if (!text) {
    return "New Chat";
  }

  return truncate(text, 42);
}

function now() {
  return Date.now();
}

/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state.chats)
    );

    if (state.activeChatId) {
      localStorage.setItem(
        ACTIVE_CHAT_KEY,
        state.activeChatId
      );
    }

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(state.settings)
    );
  } catch (error) {
    console.warn("Atharv storage error:", error);
  }
}

function loadState() {
  try {
    const storedChats =
      localStorage.getItem(STORAGE_KEY);

    if (storedChats) {
      const parsed = JSON.parse(storedChats);

      if (Array.isArray(parsed)) {
        state.chats = parsed;
      }
    }

    const active =
      localStorage.getItem(ACTIVE_CHAT_KEY);

    if (active) {
      state.activeChatId = active;
    }

    const settings =
      localStorage.getItem(SETTINGS_KEY);

    if (settings) {
      const parsedSettings = JSON.parse(settings);

      if (
        parsedSettings &&
        typeof parsedSettings === "object"
      ) {
        state.settings = {
          ...state.settings,
          ...parsedSettings
        };
      }
    }
  } catch (error) {
    console.warn("Atharv load error:", error);

    state.chats = [];
    state.activeChatId = null;
  }
}

/* =========================================================
   CHAT MODEL
   ========================================================= */

function createChat() {
  return {
    id: createId("chat"),
    title: "New Chat",

    createdAt: now(),
    updatedAt: now(),

    messages: [],

    responseId: null
  };
}

function getActiveChat() {
  return state.chats.find(
    chat => chat.id === state.activeChatId
  );
}

function ensureChat() {
  let chat = getActiveChat();

  if (!chat) {
    chat = createChat();

    state.chats.unshift(chat);
    state.activeChatId = chat.id;

    saveState();
  }

  return chat;
}

/* =========================================================
   NEW CHAT
   ========================================================= */

function createNewChat(openImmediately = true) {
  stopSpeaking();

  const chat = createChat();

  state.chats.unshift(chat);
  state.activeChatId = chat.id;

  state.selectedFiles = [];

  saveState();

  renderHistory();
  renderActiveChat();

  if (openImmediately) {
    closeSidebar();
  }

  focusInput();

  return chat;
}

/* =========================================================
   OPEN CHAT
   ========================================================= */

function openChat(chatId) {
  const chat = state.chats.find(
    item => item.id === chatId
  );

  if (!chat) return;

  stopSpeaking();

  state.activeChatId = chatId;
  state.selectedFiles = [];

  saveState();

  renderHistory();
  renderActiveChat();

  closeSidebar();
  focusInput();
}

/* =========================================================
   RENAME CHAT
   ========================================================= */

function renameChat(chatId) {
  const chat = state.chats.find(
    item => item.id === chatId
  );

  if (!chat) return;

  const newTitle = window.prompt(
    "Rename chat",
    chat.title || "New Chat"
  );

  if (newTitle === null) {
    return;
  }

  const title = cleanText(newTitle);

  if (!title) {
    return;
  }

  chat.title = truncate(title, 80);
  chat.updatedAt = now();

  saveState();

  renderHistory();
  updateChatHeader();
}

/* =========================================================
   DELETE CHAT
   ========================================================= */

function deleteChat(chatId) {
  const chat = state.chats.find(
    item => item.id === chatId
  );

  if (!chat) return;

  const confirmed = window.confirm(
    `Delete "${chat.title || "New Chat"}"?`
  );

  if (!confirmed) return;

  const wasActive =
    state.activeChatId === chatId;

  state.chats = state.chats.filter(
    item => item.id !== chatId
  );

  if (wasActive) {
    const nextChat = state.chats[0];

    if (nextChat) {
      state.activeChatId = nextChat.id;
    } else {
      const fresh = createChat();

      state.chats = [fresh];
      state.activeChatId = fresh.id;
    }
  }

  saveState();

  renderHistory();
  renderActiveChat();
}

/* =========================================================
   SORT CHATS
   ========================================================= */

function sortChats() {
  state.chats.sort(
    (a, b) =>
      (b.updatedAt || b.createdAt || 0) -
      (a.updatedAt || a.createdAt || 0)
  );
}

/* =========================================================
   HISTORY RENDER
   ========================================================= */

function renderHistory() {
  sortChats();

  const container =
    elements.chatList ||
    elements.chatHistory;

  if (!container) return;

  if (!state.chats.length) {
    container.innerHTML = `
      <div class="atharv-empty-history">
        No chats yet
      </div>
    `;

    return;
  }

  container.innerHTML = state.chats
    .map(chat => {
      const active =
        chat.id === state.activeChatId;

      return `
        <div
          class="atharv-chat-item ${active ? "active" : ""}"
          data-chat-id="${escapeHTML(chat.id)}"
        >
          <button
            type="button"
            class="atharv-chat-open"
            data-action="open-chat"
            data-chat-id="${escapeHTML(chat.id)}"
          >
            <span class="atharv-chat-icon">💬</span>

            <span class="atharv-chat-info">
              <span class="atharv-chat-name">
                ${escapeHTML(chat.title || "New Chat")}
              </span>

              <span class="atharv-chat-date">
                ${formatChatDate(chat.updatedAt)}
              </span>
            </span>
          </button>

          <button
            type="button"
            class="atharv-chat-more"
            data-action="chat-menu"
            data-chat-id="${escapeHTML(chat.id)}"
            aria-label="Chat options"
          >
            ⋯
          </button>
        </div>
      `;
    })
    .join("");
}

function formatChatDate(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);

  const today = new Date();

  const sameDay =
    date.toDateString() === today.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short"
  });
}

/* =========================================================
   CHAT MENU
   ========================================================= */

function showChatMenu(chatId, anchor) {
  closeChatMenus();

  const menu = document.createElement("div");

  menu.className = "atharv-chat-menu";

  menu.innerHTML = `
    <button
      type="button"
      data-action="rename-chat"
      data-chat-id="${escapeHTML(chatId)}"
    >
      ✏️ Rename
    </button>

    <button
      type="button"
      data-action="delete-chat"
      data-chat-id="${escapeHTML(chatId)}"
    >
      🗑️ Delete
    </button>
  `;

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();

  menu.style.position = "fixed";
  menu.style.top =
    `${Math.min(rect.bottom + 4, window.innerHeight - 100)}px`;

  menu.style.left =
    `${Math.max(8, rect.right - 150)}px`;

  setTimeout(() => {
    document.addEventListener(
      "click",
      handleOutsideChatMenu,
      { once: true }
    );
  }, 0);
}

function handleOutsideChatMenu(event) {
  if (
    !event.target.closest(".atharv-chat-menu")
  ) {
    closeChatMenus();
  }
}

function closeChatMenus() {
  $$(".atharv-chat-menu").forEach(
    element => element.remove()
  );
}

/* =========================================================
   ACTIVE CHAT RENDER
   ========================================================= */

function renderActiveChat() {
  const chat = ensureChat();

  updateChatHeader();

  if (!elements.messages) return;

  if (!chat.messages.length) {
    renderWelcome();
    return;
  }

  elements.messages.innerHTML =
    chat.messages
      .map(message => renderMessage(message))
      .join("");

  scrollMessagesToBottom();
}

function updateChatHeader() {
  const chat = getActiveChat();

  if (!chat) return;

  if (elements.chatTitle) {
    elements.chatTitle.textContent =
      chat.title || "Atharv AI";
  }

  document.title =
    chat.title && chat.title !== "New Chat"
      ? `${chat.title} — Atharv AI`
      : "Atharv AI";
}

/* =========================================================
   WELCOME
   ========================================================= */

function renderWelcome() {
  if (!elements.messages) return;

  elements.messages.innerHTML = `
    <div class="atharv-welcome-message">
      <div class="atharv-welcome-logo">A</div>

      <h1>Namaste 👋</h1>

      <p>
        Main Atharv hoon. Aap mujhse
        kisi bhi language mein sawaal pooch sakte hain.
      </p>

      <p class="atharv-welcome-subtitle">
        Your AI. Every Language. Every Question.
      </p>
    </div>
  `;

  if (elements.welcome) {
    elements.welcome.style.display = "";
  }
}

/* =========================================================
   MESSAGE RENDER
   ========================================================= */

function renderMessage(message) {
  const role =
    message.role === "user"
      ? "user"
      : "assistant";

  const text = message.content || "";

  const attachmentHTML =
    Array.isArray(message.attachments)
      ? renderAttachments(
          message.attachments,
          true
        )
      : "";

  return `
    <article
      class="atharv-message atharv-message-${role}"
      data-message-id="${escapeHTML(message.id || "")}"
    >
      <div class="atharv-message-avatar">
        ${
          role === "user"
            ? "👤"
            : "A"
        }
      </div>

      <div class="atharv-message-content">
        <div class="atharv-message-name">
          ${
            role === "user"
              ? "You"
              : "Atharv"
          }
        </div>

        ${
          attachmentHTML
        }

        <div class="atharv-message-text">
          ${
            role === "assistant"
              ? renderMarkdown(text)
              : escapeHTML(text).replace(
                  /\n/g,
                  "<br>"
                )
          }
        </div>

        ${
          role === "assistant"
            ? `
              <div class="atharv-message-actions">
                <button
                  type="button"
                  data-action="copy-message"
                  data-message-id="${escapeHTML(message.id || "")}"
                  title="Copy"
                >
                  📋
                </button>

                <button
                  type="button"
                  data-action="speak-message"
                  data-message-id="${escapeHTML(message.id || "")}"
                  title="Read aloud"
                >
                  🔊
                </button>
              </div>
            `
            : ""
        }
      </div>
    </article>
  `;
}

/* =========================================================
   MARKDOWN RENDERER
   ========================================================= */

function renderMarkdown(input) {
  let text = String(input ?? "");

  if (!text) return "";

  /*
   * Protect fenced code blocks first.
   */

  const codeBlocks = [];

  text = text.replace(
    /```([\w+-]*)\n?([\s\S]*?)```/g,
    (_, language, code) => {
      const id =
        `ATHARV_CODE_${codeBlocks.length}`;

      codeBlocks.push({
        id,
        language: language || "",
        code: code.replace(/\n$/, "")
      });

      return `\n${id}\n`;
    }
  );

  /*
   * Escape HTML.
   */

  text = escapeHTML(text);

  /*
   * Inline code.
   */

  text = text.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  /*
   * Headings.
   */

  text = text.replace(
    /^###### (.+)$/gm,
    "<h6>$1</h6>"
  );

  text = text.replace(
    /^##### (.+)$/gm,
    "<h5>$1</h5>"
  );

  text = text.replace(
    /^#### (.+)$/gm,
    "<h4>$1</h4>"
  );

  text = text.replace(
    /^### (.+)$/gm,
    "<h3>$1</h3>"
  );

  text = text.replace(
    /^## (.+)$/gm,
    "<h2>$1</h2>"
  );

  text = text.replace(
    /^# (.+)$/gm,
    "<h1>$1</h1>"
  );

  /*
   * Bold / italic.
   */

  text = text.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /__(.+?)__/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    "<em>$1</em>"
  );

  /*
   * Links.
   */

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  /*
   * Blockquotes.
   */

  text = text.replace(
    /^&gt; (.+)$/gm,
    "<blockquote>$1</blockquote>"
  );

  /*
   * Unordered lists.
   */

  text = text.replace(
    /^(?:[-*]) (.+)$/gm,
    "<li>$1</li>"
  );

  text = text.replace(
    /(<li>.*<\/li>\n?)+/g,
    match => `<ul>${match}</ul>`
  );

  /*
   * Ordered lists.
   */

  text = text.replace(
    /^\d+\.\s(.+)$/gm,
    "<li>$1</li>"
  );

  /*
   * Line breaks.
   */

  text = text.replace(
    /\n{2,}/g,
    "</p><p>"
  );

  text = text.replace(
    /\n/g,
    "<br>"
  );

  text = `<p>${text}</p>`;

  /*
   * Restore code blocks.
   */

  codeBlocks.forEach(block => {
    const safeCode =
      escapeHTML(block.code);

    const language =
      escapeHTML(block.language);

    const html = `
      <div class="atharv-code-block">
        <div class="atharv-code-header">
          <span>
            ${language || "code"}
          </span>

          <button
            type="button"
            data-action="copy-code"
            data-code="${escapeHTML(block.code)}"
          >
            Copy
          </button>
        </div>

        <pre><code>${safeCode}</code></pre>
      </div>
    `;

    text = text.replace(
      `<p>${block.id}</p>`,
      html
    );

    text = text.replace(
      block.id,
      html
    );
  });

  return text;
}

/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(
  role,
  content,
  attachments = []
) {
  const chat = ensureChat();

  const message = {
    id: createId("msg"),
    role,
    content: String(content ?? ""),
    attachments: attachments || [],
    createdAt: now()
  };

  chat.messages.push(message);

  if (
    chat.messages.length >
    MAX_HISTORY_MESSAGES
  ) {
    chat.messages =
      chat.messages.slice(
        -MAX_HISTORY_MESSAGES
      );
  }

  if (
    role === "user" &&
    chat.messages.filter(
      item => item.role === "user"
    ).length === 1
  ) {
    chat.title =
      generateChatTitle(content);
  }

  chat.updatedAt = now();

  saveState();

  return message;
}

/* =========================================================
   UPDATE MESSAGE
   ========================================================= */

function updateMessage(messageId, content) {
  const chat = getActiveChat();

  if (!chat) return;

  const message = chat.messages.find(
    item => item.id === messageId
  );

  if (!message) return;

  message.content =
    String(content ?? "");

  message.updatedAt = now();

  chat.updatedAt = now();

  saveState();
}

/* =========================================================
   TYPING INDICATOR
   ========================================================= */

function showTyping() {
  removeTyping();

  if (!elements.messages) return;

  const typing =
    document.createElement("div");

  typing.className =
    "atharv-message atharv-message-assistant atharv-typing";

  typing.innerHTML = `
    <div class="atharv-message-avatar">
      A
    </div>

    <div class="atharv-message-content">
      <div class="atharv-message-name">
        Atharv
      </div>

      <div class="atharv-typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

  elements.messages.appendChild(typing);

  scrollMessagesToBottom();
}

function removeTyping() {
  $$(".atharv-typing").forEach(
    element => element.remove()
  );
}

/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage(customText = null) {
  if (state.isSending) {
    return;
  }

  const input =
    elements.messageInput;

  const text =
    customText !== null
      ? cleanText(customText)
      : cleanText(input?.value);

  const hasFiles =
    state.selectedFiles.length > 0;

  if (!text && !hasFiles) {
    focusInput();
    return;
  }

  state.isSending = true;

  updateSendState();

  const files =
    [...state.selectedFiles];

  const attachments =
    await prepareAttachments(files);

  addMessage(
    "user",
    text,
    attachments
  );

  if (input && customText === null) {
    input.value = "";
    autoResizeInput();
  }

  state.selectedFiles = [];

  renderAttachmentsPreview();

  renderActiveChat();

  showTyping();

  try {
    const payload =
      await buildChatPayload(
        text,
        files
      );

    const response =
      await fetch(CHAT_ENDPOINT, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)
      });

    const data =
      await parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        `Server error (${response.status})`
      );
    }

    removeTyping();

    const answer =
      extractAssistantResponse(data);

    if (!answer) {
      throw new Error(
        "Atharv returned an empty response."
      );
    }

    const assistantMessage =
      addMessage(
        "assistant",
        answer
      );

    /*
     * Keep server conversation id if backend provides it.
     */

    const chat = getActiveChat();

    if (chat) {
      chat.responseId =
        data.responseId ||
        data.response_id ||
        data.conversationId ||
        data.conversation_id ||
        chat.responseId ||
        null;

      chat.updatedAt = now();

      saveState();
    }

    renderActiveChat();

    if (
      state.settings.voiceEnabled &&
      shouldAutoSpeak()
    ) {
      speakText(answer);
    }

    return assistantMessage;
  } catch (error) {
    console.error(
      "ATHARV CHAT ERROR:",
      error
    );

    removeTyping();

    const errorText =
      getFriendlyError(error);

    addMessage(
      "assistant",
      errorText
    );

    renderActiveChat();
  } finally {
    state.isSending = false;

    updateSendState();

    focusInput();
  }
}

/* =========================================================
   BUILD API PAYLOAD
   ========================================================= */

async function buildChatPayload(
  text,
  files
) {
  const chat = ensureChat();

  /*
   * Only send useful recent history.
   * The backend remains responsible for
   * model-specific conversation handling.
   */

  const history =
    chat.messages
      .slice(-20)
      .map(message => ({
        role: message.role,
        content: message.content
      }));

  const payload = {
    message: text,

    prompt: text,

    language:
      detectLanguage(text),

    userLanguage:
      detectLanguage(text),

    chatId:
      chat.id,

    conversationId:
      chat.responseId || null,

    history,

    attachments: []
  };

  if (files.length) {
    payload.attachments =
      await prepareAPIFileData(files);
  }

  return payload;
}

/* =========================================================
   RESPONSE PARSER
   ========================================================= */

async function parseResponse(response) {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    return await response.json();
  }

  const text =
    await response.text();

  return {
    response: text,
    message: text
  };
}

function extractAssistantResponse(data) {
  if (!data) return "";

  if (typeof data === "string") {
    return data.trim();
  }

  const candidates = [
    data.reply,
    data.response,
    data.answer,
    data.message,
    data.output,
    data.text,
    data.content
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  /*
   * Some APIs return:
   * { output: [{ content: ... }] }
   */

  if (Array.isArray(data.output)) {
    const text = data.output
      .map(item => {
        if (typeof item === "string") {
          return item;
        }

        return (
          item?.content ||
          item?.text ||
          ""
        );
      })
      .filter(Boolean)
      .join("\n");

    if (text.trim()) {
      return text.trim();
    }
  }

  /*
   * OpenAI-style output.
   */

  if (Array.isArray(data.output_text)) {
    return data.output_text
      .join("\n")
      .trim();
  }

  if (
    typeof data.output_text === "string"
  ) {
    return data.output_text.trim();
  }

  return "";
}

/* =========================================================
   FRIENDLY ERROR
   ========================================================= */

function getFriendlyError(error) {
  const message =
    String(
      error?.message || error || ""
    );

  if (
    message.includes(
      "Failed to fetch"
    )
  ) {
    return (
      "⚠️ Atharv server se connection nahi ho paaya. " +
      "Internet connection check karke dobara try karein."
    );
  }

  if (
    message.includes("401") ||
    message.includes("403")
  ) {
    return (
      "⚠️ Atharv API authorization problem aa rahi hai. " +
      "Server configuration check karni hogi."
    );
  }

  if (
    message.includes("429")
  ) {
    return (
      "⚠️ Abhi requests zyada aa rahi hain. " +
      "Thodi der baad dobara try karein."
    );
  }

  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503")
  ) {
    return (
      "⚠️ Atharv server abhi available nahi hai. " +
      "Kuch seconds baad dobara try karein."
    );
  }

  return (
    "⚠️ Atharv se response nahi mil paaya.\n\n" +
    `Details: ${message}`
  );
}

/* =========================================================
   LANGUAGE DETECTION
   ========================================================= */

function detectLanguage(text) {
  const value =
    String(text || "").trim();

  if (!value) {
    return state.settings.language || "auto";
  }

  if (
    /[\u0900-\u097F]/.test(value)
  ) {
    return "hi";
  }

  if (
    /[\u0980-\u09FF]/.test(value)
  ) {
    return "bn";
  }

  if (
    /[\u0A00-\u0A7F]/.test(value)
  ) {
    return "pa";
  }

  if (
    /[\u0B80-\u0BFF]/.test(value)
  ) {
    return "ta";
  }

  if (
    /[\u0C00-\u0C7F]/.test(value)
  ) {
    return "te";
  }

  if (
    /[\u0C80-\u0CFF]/.test(value)
  ) {
    return "kn";
  }

  if (
    /[\u0D00-\u0D7F]/.test(value)
  ) {
    return "ml";
  }

  if (
    /[\u0600-\u06FF]/.test(value)
  ) {
    return "ar";
  }

  if (
    /[\u4E00-\u9FFF]/.test(value)
  ) {
    return "zh";
  }

  if (
    /[\u3040-\u30FF]/.test(value)
  ) {
    return "ja";
  }

  if (
    /[\uAC00-\uD7AF]/.test(value)
  ) {
    return "ko";
  }

  return "en";
}

/* =========================================================
   AUTO SPEAK
   ========================================================= */

function shouldAutoSpeak() {
  /*
   * Default false.
   * User can explicitly press the speaker button.
   */

  return false;
}

/* =========================================================
   TEXT TO SPEECH
   ========================================================= */

function speakText(text) {
  if (
    !("speechSynthesis" in window)
  ) {
    return;
  }

  const value =
    cleanText(text);

  if (!value) return;

  stopSpeaking();

  const utterance =
    new SpeechSynthesisUtterance(value);

  const language =
    detectLanguage(value);

  utterance.lang =
    languageToSpeechLocale(language);

  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    state.isSpeaking = true;
    updateVoiceUI();
  };

  utterance.onend = () => {
    state.isSpeaking = false;
    updateVoiceUI();
  };

  utterance.onerror = () => {
    state.isSpeaking = false;
    updateVoiceUI();
  };

  window.speechSynthesis.speak(
    utterance
  );
}

function stopSpeaking() {
  if (
    "speechSynthesis" in window
  ) {
    window.speechSynthesis.cancel();
  }

  state.isSpeaking = false;

  updateVoiceUI();
}

function languageToSpeechLocale(language) {
  const locales = {
    hi: "hi-IN",
    en: "en-IN",
    bn: "bn-IN",
    pa: "pa-IN",
    ta: "ta-IN",
    te: "te-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    ar: "ar-SA",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR"
  };

  return locales[language] || "en-IN";
}

/* =========================================================
   VOICE INPUT
   ========================================================= */

function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    state.speechSupported = false;

    if (elements.voiceButton) {
      elements.voiceButton.disabled = true;
      elements.voiceButton.title =
        "Voice input is not supported in this browser";
    }

    return;
  }

  state.speechSupported = true;

  const recognition =
    new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.lang =
    getRecognitionLanguage();

  recognition.onstart = () => {
    state.isListening = true;
    updateVoiceUI();
  };

  recognition.onresult = event => {
    let transcript = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      transcript +=
        event.results[i][0].transcript;
    }

    if (elements.messageInput) {
      elements.messageInput.value =
        transcript.trim();

      autoResizeInput();
    }
  };

  recognition.onerror = event => {
    console.warn(
      "Speech recognition:",
      event.error
    );

    state.isListening = false;

    updateVoiceUI();
  };

  recognition.onend = () => {
    state.isListening = false;
    updateVoiceUI();
  };

  state.recognition = recognition;
}

function getRecognitionLanguage() {
  const language =
    state.settings.language;

  if (language === "hi") {
    return "hi-IN";
  }

  if (language === "en") {
    return "en-IN";
  }

  return "hi-IN";
}

function toggleVoiceInput() {
  if (!state.speechSupported) {
    alert(
      "Voice input is not supported in this browser."
    );

    return;
  }

  if (state.isListening) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
}

function startVoiceInput() {
  if (!state.recognition) {
    setupSpeechRecognition();
  }

  if (!state.recognition) return;

  try {
    state.recognition.lang =
      getRecognitionLanguage();

    state.recognition.start();
  } catch (error) {
    console.warn(
      "Voice start error:",
      error
    );
  }
}

function stopVoiceInput() {
  if (!state.recognition) return;

  try {
    state.recognition.stop();
  } catch {
    // Already stopped.
  }

  state.isListening = false;

  updateVoiceUI();
}

function updateVoiceUI() {
  if (!elements.voiceButton) {
    return;
  }

  if (state.isListening) {
    elements.voiceButton.classList.add(
      "active"
    );

    elements.voiceButton.setAttribute(
      "aria-label",
      "Stop voice input"
    );

    elements.voiceButton.title =
      "Stop listening";

    elements.voiceButton.textContent =
      "⏹️";
  } else {
    elements.voiceButton.classList.remove(
      "active"
    );

    elements.voiceButton.setAttribute(
      "aria-label",
      "Voice input"
    );

    elements.voiceButton.title =
      "Voice input";

    elements.voiceButton.textContent =
      "🎤";
  }
}

/* =========================================================
   FILE / ATTACHMENTS
   ========================================================= */

function setupFileInput() {
  if (!elements.fileInput) return;

  elements.fileInput.addEventListener(
    "change",
    event => {
      const files =
        Array.from(
          event.target.files || []
        );

      addFiles(files);

      /*
       * Reset input so selecting the same
       * file again triggers change.
       */

      event.target.value = "";
    }
  );
}

function addFiles(files) {
  for (const file of files) {
    if (
      file.size >
      MAX_ATTACHMENT_SIZE
    ) {
      alert(
        `${file.name} is larger than 10 MB.`
      );

      continue;
    }

    const exists =
      state.selectedFiles.some(
        item =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified ===
            file.lastModified
      );

    if (exists) continue;

    state.selectedFiles.push(file);
  }

  renderAttachmentsPreview();
}

function removeSelectedFile(index) {
  state.selectedFiles.splice(
    index,
    1
  );

  renderAttachmentsPreview();
}

function renderAttachmentsPreview() {
  const container =
    elements.attachmentPreview;

  if (!container) return;

  if (!state.selectedFiles.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;

  container.innerHTML =
    state.selectedFiles
      .map((file, index) => {
        const isImage =
          file.type.startsWith("image/");

        const url =
          isImage
            ? URL.createObjectURL(file)
            : "";

        return `
          <div class="atharv-attachment-item">

            ${
              isImage
                ? `
                  <img
                    src="${url}"
                    alt="${escapeHTML(file.name)}"
                  >
                `
                : `
                  <div class="atharv-file-icon">
                    📄
                  </div>
                `
            }

            <div class="atharv-attachment-name">
              ${escapeHTML(file.name)}
            </div>

            <button
              type="button"
              data-action="remove-file"
              data-file-index="${index}"
              aria-label="Remove file"
            >
              ×
            </button>

          </div>
        `;
      })
      .join("");
}

/* =========================================================
   ATTACHMENT DATA
   ========================================================= */

async function prepareAttachments(files) {
  return files.map(file => ({
    name: file.name,
    type: file.type,
    size: file.size
  }));
}

async function prepareAPIFileData(files) {
  /*
   * Convert small files to base64.
   *
   * This keeps the frontend ready for a backend
   * that accepts attachment data.
   *
   * The server should validate file type/size.
   */

  const result = [];

  for (const file of files) {
    try {
      const base64 =
        await fileToBase64(file);

      result.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64
      });
    } catch (error) {
      console.warn(
        "Attachment conversion failed:",
        error
      );
    }
  }

  return result;
}

function fileToBase64(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve(
          reader.result
        );
      };

      reader.onerror =
        reject;

      reader.readAsDataURL(file);
    }
  );
}

function renderAttachments(
  attachments,
  readonly = false
) {
  if (!Array.isArray(attachments)) {
    return "";
  }

  return `
    <div class="atharv-message-attachments">
      ${attachments
        .map(item => {
          if (
            item.type &&
            item.type.startsWith("image/") &&
            item.data
          ) {
            return `
              <img
                class="atharv-message-image"
                src="${escapeHTML(item.data)}"
                alt="${escapeHTML(item.name || "image")}"
              >
            `;
          }

          return `
            <div class="atharv-message-file">
              📎 ${escapeHTML(
                item.name || "Attachment"
              )}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

/* =========================================================
   COPY
   ========================================================= */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(
      text
    );

    showToast("Copied");
  } catch {
    /*
     * Fallback
     */

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value = text;

    textarea.style.position =
      "fixed";

    textarea.style.opacity = "0";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    try {
      document.execCommand(
        "copy"
      );

      showToast("Copied");
    } catch {
      showToast(
        "Copy failed"
      );
    }

    textarea.remove();
  }
}

function copyMessage(messageId) {
  const chat =
    getActiveChat();

  if (!chat) return;

  const message =
    chat.messages.find(
      item =>
        item.id === messageId
    );

  if (!message) return;

  copyText(message.content);
}

function copyCode(code) {
  copyText(code);
}

/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(message) {
  let toast =
    $("#atharvToast");

  if (!toast) {
    toast =
      document.createElement(
        "div"
      );

    toast.id =
      "atharvToast";

    toast.className =
      "atharv-toast";

    document.body.appendChild(
      toast
    );
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
    setTimeout(() => {
      toast.classList.remove(
        "show"
      );
    }, 1800);
}

/* =========================================================
   INPUT
   ========================================================= */

function focusInput() {
  if (!elements.messageInput) {
    return;
  }

  setTimeout(() => {
    elements.messageInput.focus();
  }, 50);
}

function autoResizeInput() {
  const input =
    elements.messageInput;

  if (!input) return;

  input.style.height = "auto";

  const maxHeight = 180;

  input.style.height =
    `${Math.min(
      input.scrollHeight,
      maxHeight
    )}px`;
}

function handleInputKeydown(event) {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();

    sendMessage();
  }
}

function updateSendState() {
  if (!elements.sendButton) {
    return;
  }

  elements.sendButton.disabled =
    state.isSending;

  if (state.isSending) {
    elements.sendButton.classList.add(
      "loading"
    );
  } else {
    elements.sendButton.classList.remove(
      "loading"
    );
  }
}

/* =========================================================
   SCROLL
   ========================================================= */

function scrollMessagesToBottom() {
  if (!elements.messages) return;

  requestAnimationFrame(() => {
    elements.messages.scrollTop =
      elements.messages.scrollHeight;
  });
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {
  if (!elements.sidebar) return;

  elements.sidebar.classList.add(
    "open"
  );

  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.classList.add(
      "show"
    );
  }

  document.body.classList.add(
    "sidebar-open"
  );
}

function closeSidebar() {
  if (!elements.sidebar) return;

  elements.sidebar.classList.remove(
    "open"
  );

  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.classList.remove(
      "show"
    );
  }

  document.body.classList.remove(
    "sidebar-open"
  );
}

function toggleSidebar() {
  if (
    elements.sidebar?.classList.contains(
      "open"
    )
  ) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

/* =========================================================
   QUICK PROMPTS
   ========================================================= */

function setupQuickPrompts() {
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-prompt]"
        );

      if (!button) return;

      const prompt =
        button.dataset.prompt;

      if (!prompt) return;

      sendMessage(prompt);
    }
  );
}

/* =========================================================
   EVENT DELEGATION
   ========================================================= */

function setupGlobalEvents() {
  document.addEventListener(
    "click",
    event => {
      const target =
        event.target.closest(
          "[data-action]"
        );

      if (!target) return;

      const action =
        target.dataset.action;

      const chatId =
        target.dataset.chatId;

      switch (action) {
        case "open-chat":
          openChat(chatId);
          break;

        case "rename-chat":
          renameChat(chatId);
          closeChatMenus();
          break;

        case "delete-chat":
          deleteChat(chatId);
          closeChatMenus();
          break;

        case "chat-menu":
          event.stopPropagation();

          showChatMenu(
            chatId,
            target
          );

          break;

        case "copy-message":
          copyMessage(
            target.dataset.messageId
          );

          break;

        case "speak-message":
          speakMessage(
            target.dataset.messageId
          );

          break;

        case "copy-code":
          copyCode(
            target.dataset.code || ""
          );

          break;

        case "remove-file":
          removeSelectedFile(
            Number(
              target.dataset.fileIndex
            )
          );

          break;

        default:
          break;
      }
    }
  );
}

/* =========================================================
   SPEAK MESSAGE
   ========================================================= */

function speakMessage(messageId) {
  const chat =
    getActiveChat();

  if (!chat) return;

  const message =
    chat.messages.find(
      item =>
        item.id === messageId
    );

  if (!message) return;

  if (state.isSpeaking) {
    stopSpeaking();
    return;
  }

  speakText(
    message.content
  );
}

/* =========================================================
   SETTINGS
   ========================================================= */

function setLanguage(language) {
  state.settings.language =
    language || "auto";

  saveState();

  if (state.recognition) {
    state.recognition.lang =
      getRecognitionLanguage();
  }
}

function toggleVoiceEnabled() {
  state.settings.voiceEnabled =
    !state.settings.voiceEnabled;

  if (
    !state.settings.voiceEnabled
  ) {
    stopSpeaking();
  }

  saveState();
}

/* =========================================================
   INIT DEFAULT CHAT
   ========================================================= */

function initializeChats() {
  if (!state.chats.length) {
    createNewChat(false);

    return;
  }

  if (
    !state.activeChatId ||
    !state.chats.some(
      chat =>
        chat.id ===
        state.activeChatId
    )
  ) {
    state.activeChatId =
      state.chats[0].id;
  }

  saveState();
}

/* =========================================================
   BIND UI
   ========================================================= */

function bindUI() {
  /*
   * New Chat
   */

  if (elements.newChat) {
    elements.newChat.addEventListener(
      "click",
      () => createNewChat()
    );
  }

  /*
   * Send
   */

  if (elements.sendButton) {
    elements.sendButton.addEventListener(
      "click",
      () => sendMessage()
    );
  }

  /*
   * Input
   */

  if (elements.messageInput) {
    elements.messageInput.addEventListener(
      "keydown",
      handleInputKeydown
    );

    elements.messageInput.addEventListener(
      "input",
      autoResizeInput
    );
  }

  /*
   * Attach
   */

  if (elements.attachButton) {
    elements.attachButton.addEventListener(
      "click",
      () => {
        elements.fileInput?.click();
      }
    );
  }

  /*
   * Voice
   */

  if (elements.voiceButton) {
    elements.voiceButton.addEventListener(
      "click",
      toggleVoiceInput
    );
  }

  /*
   * Stop voice / speech
   */

  if (elements.stopVoiceButton) {
    elements.stopVoiceButton.addEventListener(
      "click",
      () => {
        stopVoiceInput();
        stopSpeaking();
      }
    );
  }

  /*
   * Mobile menu
   */

  if (elements.menuButton) {
    elements.menuButton.addEventListener(
      "click",
      toggleSidebar
    );
  }

  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.addEventListener(
      "click",
      closeSidebar
    );
  }

  /*
   * Escape
   */

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        closeSidebar();
        closeChatMenus();
      }
    }
  );
}

/* =========================================================
   PWA / INSTALL SUPPORT
   ========================================================= */

let deferredInstallPrompt = null;

function setupInstallPrompt() {
  window.addEventListener(
    "beforeinstallprompt",
    event => {
      event.preventDefault();

      deferredInstallPrompt =
        event;

      showInstallButton();
    }
  );

  window.addEventListener(
    "appinstalled",
    () => {
      deferredInstallPrompt =
        null;

      hideInstallButton();

      showToast(
        "Atharv AI installed"
      );
    }
  );
}

function showInstallButton() {
  const buttons =
    $$(
      "[data-install], #installApp, #installButton"
    );

  buttons.forEach(button => {
    button.hidden = false;

    button.onclick =
      installApp;
  });
}

function hideInstallButton() {
  const buttons =
    $$(
      "[data-install], #installApp, #installButton"
    );

  buttons.forEach(button => {
    button.hidden = true;
  });
}

async function installApp() {
  if (!deferredInstallPrompt) {
    showToast(
      "Install option browser menu se available ho sakta hai."
    );

    return;
  }

  deferredInstallPrompt.prompt();

  await deferredInstallPrompt.userChoice;

  deferredInstallPrompt =
    null;

  hideInstallButton();
}

/* =========================================================
   SERVICE WORKER
   ========================================================= */

function setupServiceWorker() {
  if (
    "serviceWorker" in navigator &&
    location.protocol === "https:"
  ) {
    navigator.serviceWorker
      .register(
        "/service-worker.js"
      )
      .catch(error => {
        console.warn(
          "Service worker:",
          error
        );
      });
  }
}

/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function setupConnectionStatus() {
  window.addEventListener(
    "online",
    () => {
      showToast(
        "Internet connected"
      );
    }
  );

  window.addEventListener(
    "offline",
    () => {
      showToast(
        "Internet connection lost"
      );
    }
  );
}

/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

function setupVisibilityHandling() {
  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden
      ) {
        /*
         * Don't destroy chat state.
         * Just persist current state.
         */

        saveState();
      }
    }
  );
}

/* =========================================================
   CLEAN OLD STORAGE
   ========================================================= */

function migrateOldHistory() {
  /*
   * Previous Atharv versions may have stored:
   * atharv_chat_history
   *
   * We do a safe one-time migration.
   */

  if (
    localStorage.getItem(
      STORAGE_KEY
    )
  ) {
    return;
  }

  const oldHistory =
    localStorage.getItem(
      "atharv_chat_history"
    );

  if (!oldHistory) {
    return;
  }

  try {
    const old =
      JSON.parse(oldHistory);

    if (!Array.isArray(old)) {
      return;
    }

    const chat =
      createChat();

    chat.title =
      "Previous Chat";

    chat.messages =
      old
        .filter(
          item =>
            item &&
            (
              item.role === "user" ||
              item.role === "assistant"
            )
        )
        .map(item => ({
          id: createId("msg"),
          role: item.role,
          content:
            item.content ||
            item.text ||
            "",
          attachments: [],
          createdAt: now()
        }));

    chat.updatedAt =
      now();

    state.chats = [chat];

    state.activeChatId =
      chat.id;

    saveState();

    console.info(
      "Atharv: old chat history migrated."
    );
  } catch (error) {
    console.warn(
      "Old history migration failed:",
      error
    );
  }
}

/* =========================================================
   SECURITY HELPERS
   ========================================================= */

function sanitizeURL(url) {
  try {
    const parsed =
      new URL(
        url,
        window.location.origin
      );

    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {
      return parsed.href;
    }

    return "#";
  } catch {
    return "#";
  }
}

/* =========================================================
   DEBUG API
   ========================================================= */

window.Atharv = {
  version:
    ATHARV_VERSION,

  state,

  newChat:
    createNewChat,

  openChat,

  renameChat,

  deleteChat,

  send:
    sendMessage,

  speak:
    speakText,

  stopSpeaking,

  listen:
    startVoiceInput,

  stopListening:
    stopVoiceInput,

  clearHistory() {
    const confirmed =
      window.confirm(
        "Delete all Atharv chat history?"
      );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(
      STORAGE_KEY
    );

    localStorage.removeItem(
      ACTIVE_CHAT_KEY
    );

    state.chats = [];

    state.activeChatId =
      null;

    initializeChats();

    renderHistory();

    renderActiveChat();

    showToast(
      "Chat history cleared"
    );
  }
};

/* =========================================================
   APPLICATION INIT
   ========================================================= */

function initAtharv() {
  console.log(
    `Atharv AI v${ATHARV_VERSION} starting...`
  );

  cacheElements();

  migrateOldHistory();

  loadState();

  initializeChats();

  renderHistory();

  renderActiveChat();

  bindUI();

  setupGlobalEvents();

  setupQuickPrompts();

  setupFileInput();

  setupSpeechRecognition();

  setupInstallPrompt();

  setupServiceWorker();

  setupConnectionStatus();

  setupVisibilityHandling();

  updateVoiceUI();

  updateSendState();

  renderAttachmentsPreview();

  autoResizeInput();

  console.log(
    `Atharv AI v${ATHARV_VERSION} ready.`
  );
}

/* =========================================================
   DOM READY
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initAtharv
  );
} else {
  initAtharv();
}
