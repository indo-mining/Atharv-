"use strict";

import {
  $,
  escapeHtml,
  truncate,
  scrollToBottom
} from "./utils.js";

export function showError(message) {
  const element = $("#errorMessage");

  if (!element) return;

  element.textContent = message || "Something went wrong.";
  element.classList.add("visible");
}

export function hideError() {
  const element = $("#errorMessage");

  if (!element) return;

  element.textContent = "";
  element.classList.remove("visible");
}

export function setSending(isSending) {
  const sendButton = $("#sendButton");
  const input = $("#messageInput");

  if (sendButton) {
    sendButton.disabled = isSending;
  }

  if (input) {
    input.disabled = isSending;
  }
}

export function showWelcome(show = true) {
  const welcome = $("#welcomeSection");
  const suggestions = $("#suggestions");

  if (welcome) {
    welcome.style.display = show ? "" : "none";
  }

  if (suggestions) {
    suggestions.style.display = show ? "" : "none";
  }
}

function createMessageElement(role, content = "") {
  const row = document.createElement("div");

  row.className =
    role === "user"
      ? "message-row user"
      : "message-row assistant";

  const message = document.createElement("div");

  message.className =
    role === "user"
      ? "message user-message"
      : "message assistant-message";

  message.dataset.role = role;

  message.innerHTML =
    role === "user"
      ? escapeHtml(content).replace(/\n/g, "<br>")
      : formatAssistantText(content);

  row.appendChild(message);

  return row;
}

export function appendUserMessage(content) {
  const messages = $("#messages");

  if (!messages) return null;

  const element = createMessageElement("user", content);

  messages.appendChild(element);

  showWelcome(false);
  scrollToBottom($("#chatContainer"));

  return element;
}

export function appendAssistantMessage(content = "") {
  const messages = $("#messages");

  if (!messages) return null;

  const element = createMessageElement(
    "assistant",
    content
  );

  messages.appendChild(element);

  showWelcome(false);
  scrollToBottom($("#chatContainer"));

  return element.querySelector(".message");
}

export function updateAssistantMessage(element, content) {
  if (!element) return;

  element.innerHTML = formatAssistantText(content);

  scrollToBottom($("#chatContainer"));
}

export function showThinking() {
  const messages = $("#messages");

  if (!messages) return null;

  const row = document.createElement("div");

  row.className = "message-row assistant";
  row.dataset.thinking = "true";

  row.innerHTML = `
    <div class="thinking-message">
      <span>Atharv is thinking</span>
      <span class="thinking-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </div>
  `;

  messages.appendChild(row);

  showWelcome(false);
  scrollToBottom($("#chatContainer"));

  return row;
}

export function removeThinking(element) {
  if (element?.remove) {
    element.remove();
  }
}

export function clearMessages() {
  const messages = $("#messages");

  if (messages) {
    messages.innerHTML = "";
  }

  showWelcome(true);
}

export function renderHistory(history = [], activeId = null) {
  const container = $("#history");
  const empty = $("#emptyHistory");

  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(history) || history.length === 0) {
    if (empty) {
      empty.style.display = "";
    }

    return;
  }

  if (empty) {
    empty.style.display = "none";
  }

  history.forEach((item) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "history-item";

    if (item.id === activeId) {
      button.classList.add("active");
    }

    button.dataset.historyId = item.id;

    button.textContent =
      truncate(item.title || item.message || "New chat", 55);

    container.appendChild(button);
  });
}

export function showAttachment(file) {
  const container = $("#attachment");

  if (!container) return;

  if (!file) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="attachment-chip">
      <span>📎</span>
      <span>${escapeHtml(file.name)}</span>
      <button
        type="button"
        class="attachment-remove"
        data-action="remove-attachment"
        aria-label="Remove attachment"
      >×</button>
    </div>
  `;
}

export function hideAttachment() {
  const container = $("#attachment");

  if (container) {
    container.innerHTML = "";
  }
}

function escapeCode(code) {
  return escapeHtml(code);
}

function formatAssistantText(text = "") {
  let value = String(text);

  /*
   * First escape HTML so model output cannot inject arbitrary HTML.
   */
  value = escapeHtml(value);

  /*
   * Code blocks.
   */
  value = value.replace(
    /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g,
    (_, language, code) => {
      const label = language || "code";

      return `
        <div class="code-wrapper">
          <div class="code-header">
            <span>${escapeHtml(label)}</span>
            <button
              type="button"
              class="copy-code"
              data-code="${encodeURIComponent(code)}"
            >
              Copy
            </button>
          </div>
          <pre><code>${escapeCode(code)}</code></pre>
        </div>
      `;
    }
  );

  /*
   * Inline code.
   */
  value = value.replace(
    /`([^`\n]+)`/g,
    '<span class="inline-code">$1</span>'
  );

  /*
   * Basic markdown headings.
   */
  value = value.replace(
    /^### (.+)$/gm,
    "<h3>$1</h3>"
  );

  value = value.replace(
    /^## (.+)$/gm,
    "<h2>$1</h2>"
  );

  value = value.replace(
    /^# (.+)$/gm,
    "<h1>$1</h1>"
  );

  /*
   * Bold and italic.
   */
  value = value.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  value = value.replace(
    /\*([^*\n]+)\*/g,
    "<em>$1</em>"
  );

  /*
   * Links.
   */
  value = value.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  /*
   * Lists.
   */
  value = value.replace(
    /^\s*[-•]\s+(.+)$/gm,
    "<li>$1</li>"
  );

  value = value.replace(
    /(<li>.*<\/li>\n?)+/g,
    (block) => `<ul>${block}</ul>`
  );

  /*
   * Paragraphs / new lines.
   */
  value = value.replace(
    /\n{2,}/g,
    "</p><p>"
  );

  value = value.replace(
    /\n/g,
    "<br>"
  );

  if (!value.startsWith("<h") && !value.startsWith("<div")) {
    value = `<p>${value}</p>`;
  }

  return value;
}
