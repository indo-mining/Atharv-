import {
  $,
  renderText,
  escapeHtml
} from "./utils.js";


/**
 * @param {boolean} show
 */
export function showWelcome(show) {

  const welcome = $("welcome");
  const chat = $("chatContainer");

  if (show) {
    welcome?.classList.remove("hidden");
    chat?.classList.add("hidden");
  } else {
    welcome?.classList.add("hidden");
    chat?.classList.remove("hidden");
  }
}


/**
 * @param {string} role
 * @param {string} content
 * @returns {HTMLElement}
 */
export function createMessageElement(
  role,
  content = ""
) {

  const row =
    document.createElement("div");

  row.className =
    `message-row ${role}`;

  const message =
    document.createElement("div");

  message.className = "message";

  const roleLabel =
    document.createElement("div");

  roleLabel.className = "message-role";

  roleLabel.textContent =
    role === "user"
      ? "You"
      : "Atharv";

  const contentElement =
    document.createElement("div");

  contentElement.className =
    "message-content";

  contentElement.innerHTML =
    renderText(content);

  message.append(
    roleLabel,
    contentElement
  );

  row.appendChild(message);

  return row;
}


/**
 * @param {string} role
 * @param {string} content
 * @returns {HTMLElement}
 */
export function appendMessage(
  role,
  content
) {

  showWelcome(false);

  const chat =
    $("chatContainer");

  const element =
    createMessageElement(
      role,
      content
    );

  chat.appendChild(element);

  scrollToBottom();

  return element;
}


/**
 * @param {HTMLElement} element
 * @param {string} content
 */
export function updateMessage(
  element,
  content
) {

  const target =
    element.querySelector(
      ".message-content"
    );

  if (!target) {
    return;
  }

  target.innerHTML =
    renderText(content);

  scrollToBottom();
}


/**
 * @returns {HTMLElement}
 */
export function appendTyping() {

  showWelcome(false);

  const chat =
    $("chatContainer");

  const row =
    document.createElement("div");

  row.className =
    "message-row assistant";

  const message =
    document.createElement("div");

  message.className =
    "message";

  const role =
    document.createElement("div");

  role.className =
    "message-role";

  role.textContent =
    "Atharv";

  const typing =
    document.createElement("div");

  typing.className =
    "typing";

  typing.innerHTML =
    "<span></span><span></span><span></span>";

  message.append(
    role,
    typing
  );

  row.appendChild(message);

  chat.appendChild(row);

  scrollToBottom();

  return row;
}


/**
 * @param {string} message
 */
export function showError(message) {

  const box =
    $("errorBox");

  if (!box) {
    return;
  }

  box.textContent =
    message || "Something went wrong.";

  box.classList.remove("hidden");
}


/**
 * Hide error box.
 */
export function hideError() {

  $("errorBox")?.classList.add(
    "hidden"
  );
}


/**
 * @param {boolean} loading
 */
export function setLoading(loading) {

  const send =
    $("sendBtn");

  const input =
    $("messageInput");

  if (send) {
    send.disabled = loading;
  }

  if (input) {
    input.disabled = loading;
  }
}


/**
 * Scroll chat to bottom.
 */
export function scrollToBottom() {

  requestAnimationFrame(() => {

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    });

  });
}


/**
 * @param {Array} history
 */
export function renderHistory(history) {

  const chat =
    $("chatContainer");

  if (!chat) {
    return;
  }

  chat.innerHTML = "";

  if (!history.length) {
    showWelcome(true);
    return;
  }

  showWelcome(false);

  history.forEach(item => {

    if (
      !item ||
      !["user", "assistant"].includes(
        item.role
      )
    ) {
      return;
    }

    chat.appendChild(
      createMessageElement(
        item.role,
        item.content || ""
      )
    );

  });

  scrollToBottom();
}


/**
 * @param {string} filename
 * @param {number} size
 */
export function showAttachment(
  filename,
  size
) {

  const preview =
    $("attachmentPreview");

  if (!preview) {
    return;
  }

  const kb =
    Math.round(size / 1024);

  preview.innerHTML = `
    📎 <strong>${escapeHtml(filename)}</strong>
    <span>(${kb} KB)</span>
  `;

  preview.classList.remove("hidden");
}


/**
 * Hide attachment preview.
 */
export function hideAttachment() {

  $("attachmentPreview")
    ?.classList.add("hidden");
}
