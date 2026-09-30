"use strict";


const messagesElement =
  document.getElementById(
    "messages"
  );

const welcomeElement =
  document.getElementById(
    "welcomeScreen"
  );

const chatContainer =
  document.getElementById(
    "chatContainer"
  );

const toastElement =
  document.getElementById(
    "toast"
  );


/* =====================================================
   ESCAPE
===================================================== */

function escapeHtml(value) {
  return String(
    value || ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =====================================================
   SHOW MESSAGE
===================================================== */

export function renderMessage(
  role,
  content
) {
  if (!messagesElement) {
    return;
  }

  if (welcomeElement) {
    welcomeElement.classList.add(
      "hidden"
    );
  }

  const row =
    document.createElement(
      "div"
    );

  row.className =
    `message-row ${role}`;

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "message-bubble";

  bubble.textContent =
    content;

  row.appendChild(
    bubble
  );

  messagesElement.appendChild(
    row
  );

  scrollToBottom();
}


export function renderHistory(
  history
) {
  if (!messagesElement) {
    return;
  }

  messagesElement.innerHTML =
    "";

  if (
    !Array.isArray(history) ||
    history.length === 0
  ) {
    if (welcomeElement) {
      welcomeElement.classList.remove(
        "hidden"
      );
    }

    return;
  }

  if (welcomeElement) {
    welcomeElement.classList.add(
      "hidden"
    );
  }

  history.forEach(item => {

    if (
      item.role !== "user" &&
      item.role !== "assistant"
    ) {
      return;
    }

    renderMessage(
      item.role,
      item.content
    );
  });
}


/* =====================================================
   THINKING
===================================================== */

export function showThinking() {

  removeThinking();

  const row =
    document.createElement(
      "div"
    );

  row.id =
    "thinkingMessage";

  row.className =
    "message-row assistant";

  row.innerHTML = `
    <div class="message-bubble">
      <div class="thinking">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

  messagesElement.appendChild(
    row
  );

  scrollToBottom();
}


export function removeThinking() {

  const element =
    document.getElementById(
      "thinkingMessage"
    );

  if (element) {
    element.remove();
  }
}


/* =====================================================
   SCROLL
===================================================== */

export function scrollToBottom() {
  if (!chatContainer) {
    return;
  }

  requestAnimationFrame(() => {
    chatContainer.scrollTop =
      chatContainer.scrollHeight;
  });
}


/* =====================================================
   SENDING UI
===================================================== */

export function setSending(
  sending
) {
  const button =
    document.getElementById(
      "sendButton"
    );

  const input =
    document.getElementById(
      "messageInput"
    );

  if (button) {
    button.disabled =
      Boolean(sending);

    button.textContent =
      sending
        ? "…"
        : "↑";
  }

  if (input) {
    input.disabled =
      Boolean(sending);
  }
}


/* =====================================================
   TOAST
===================================================== */

let toastTimer = null;

export function showToast(
  message
) {
  if (!toastElement) {
    return;
  }

  toastElement.textContent =
    message;

  toastElement.classList.add(
    "show"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(() => {
      toastElement.classList.remove(
        "show"
      );
    }, 3500);
}
