"use strict";

const config = require("../config");

function cleanText(value, maxLength = config.maxMessageLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeUserId(value) {
  const id = cleanText(value, 100);

  if (!id) {
    return "guest";
  }

  return id;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item) => {
      return (
        item &&
        typeof item === "object" &&
        ["user", "assistant", "system"].includes(item.role) &&
        typeof item.content === "string"
      );
    })
    .map((item) => ({
      role: item.role,
      content: cleanText(
        item.content,
        config.maxMessageLength
      )
    }))
    .filter((item) => item.content);
}

function compressHistory(history) {
  const normalized = normalizeHistory(history);

  const limited = normalized.slice(
    -config.maxHistoryMessages
  );

  let totalChars = 0;
  const result = [];

  for (let i = limited.length - 1; i >= 0; i--) {
    const item = limited[i];

    if (
      totalChars + item.content.length >
      config.maxHistoryChars
    ) {
      break;
    }

    result.unshift(item);
    totalChars += item.content.length;
  }

  return result;
}

function detectLanguage(text) {
  const value = String(text || "");

  if (/[\u0900-\u097F]/.test(value)) {
    return "hi";
  }

  const lower = value.toLowerCase();

  const hinglishWords = [
    "hai",
    "hain",
    "kya",
    "kaise",
    "kyu",
    "kyon",
    "mujhe",
    "aap",
    "tum",
    "mera",
    "meri",
    "karna",
    "chahiye",
    "batao",
    "banao"
  ];

  const isHinglish = hinglishWords.some(
    (word) => lower.includes(` ${word} `) ||
      lower.startsWith(`${word} `) ||
      lower.endsWith(` ${word}`)
  );

  if (isHinglish) {
    return "hinglish";
  }

  return "en";
}

module.exports = {
  cleanText,
  normalizeUserId,
  normalizeHistory,
  compressHistory,
  detectLanguage
};
