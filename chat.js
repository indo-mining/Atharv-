import {
  chat,
  chatStream
} from "./api.js";

import {
  getHistory,
  addHistoryMessage,
  saveHistory
} from "./storage.js";

import {
  appendMessage,
  appendTyping,
  updateMessage,
  setLoading,
  showError,
  hideError
} from "./ui.js";

import {
  getLanguageInstruction
} from "./language.js";

import {
  cleanText
} from "./utils.js";


let sending = false;


/**
 * @returns {boolean}
 */
export function isSending() {
  return sending;
}


/**
 * Send a message to Atharv.
 *
 * @param {string} rawMessage
 * @returns {Promise<void>}
 */
export async function sendMessage(
  rawMessage
) {

  if (sending) {
    return;
  }

  const message =
    cleanText(rawMessage);

  if (!message) {
    return;
  }

  sending = true;

  hideError();
  setLoading(true);

  const previousHistory =
    getHistory();

  appendMessage(
    "user",
    message
  );

  addHistoryMessage({
    role: "user",
    content: message
  });

  const typing =
    appendTyping();

  try {

    const languageInstruction =
      getLanguageInstruction(message);

    let answer = "";

    try {

      await chatStream(
        message,
        previousHistory.slice(-6),
        languageInstruction,

        delta => {

          if (!answer) {
            typing.remove();

            const assistant =
              appendMessage(
                "assistant",
                ""
              );

            typing._assistant =
              assistant;
          }

          answer += delta;

          if (typing._assistant) {
            updateMessage(
              typing._assistant,
              answer
            );
          }

        },

        () => {}
      );

    } catch (streamError) {

      /*
       * If streaming is unavailable, use
       * normal /api/chat as a safe fallback.
       */

      if (typing.isConnected) {
        typing.remove();
      }

      const result =
        await chat(
          message,
          previousHistory.slice(-6),
          languageInstruction
        );

      answer =
        result?.answer ||
        result?.response ||
        result?.content ||
        "";

      if (!answer) {
        throw new Error(
          "Atharv could not generate a response."
        );
      }

      appendMessage(
        "assistant",
        answer
      );
    }

    if (!answer.trim()) {
      throw new Error(
        "Atharv returned an empty response."
      );
    }

    addHistoryMessage({
      role: "assistant",
      content: answer
    });

  } catch (error) {

    if (typing.isConnected) {
      typing.remove();
    }

    const messageText =
      error?.message ||
      "Atharv could not generate a response.";

    showError(
      `Atharv ⚠️ ${messageText}`
    );

  } finally {

    setLoading(false);

    sending = false;
  }
}


/**
 * Start a completely new local chat.
 */
export function startNewChat() {

  saveHistory([]);

  const chatContainer =
    document.getElementById(
      "chatContainer"
    );

  if (chatContainer) {
    chatContainer.innerHTML = "";
  }

  document
    .getElementById("welcome")
    ?.classList.remove("hidden");

  chatContainer
    ?.classList.add("hidden");

  document
    .getElementById("messageInput")
    ?.focus();
}
