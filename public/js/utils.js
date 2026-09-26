/**
 * General utility functions.
 */

/**
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}


/**
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/**
 * Basic Markdown-like rendering.
 * It intentionally avoids a third-party Markdown dependency.
 *
 * @param {string} text
 * @returns {string}
 */
export function renderText(text) {
  if (!text) {
    return "";
  }

  const escaped = escapeHtml(text);

  const parts = escaped.split("```");

  let output = "";

  for (let i = 0; i < parts.length; i++) {

    if (i % 2 === 1) {
      let code = parts[i];

      code = code.replace(/^[a-zA-Z0-9_-]+\n/, "");

      output += `
        <div class="code-block">
          <button class="copy-code" type="button">Copy</button>
          <code>${code}</code>
        </div>
      `;

      continue;
    }

    let normal = parts[i];

    normal = normal
      .replace(/\*\*(.*?)\*\*/gs, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/gs, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

    const paragraphs = normal
      .split(/\n{2,}/)
      .map(part => `<p>${part.replace(/\n/g, "<br>")}</p>`)
      .join("");

    output += paragraphs;
  }

  return output;
}


/**
 * @returns {string}
 */
export function createId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}


/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * @param {string} text
 * @returns {boolean}
 */
export function isProbablyEmpty(text) {
  return !String(text ?? "").trim();
}


/**
 * @param {string} text
 * @returns {string}
 */
export function cleanText(text) {
  return String(text ?? "")
    .replace(/\u0000/g, "")
    .trim();
}


/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
