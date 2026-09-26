"use strict";

function hasAny(text, words) {
  const value = String(text || "").toLowerCase();

  return words.some((word) =>
    value.includes(word)
  );
}

function detectIntent(text) {
  const value = String(text || "").toLowerCase();

  if (
    hasAny(value, [
      "python",
      "javascript",
      "java code",
      "programming",
      "program code",
      "coding",
      "debug",
      "bug in code",
      "html",
      "css",
      "node.js",
      "nodejs",
      "api code"
    ])
  ) {
    return "coding";
  }

  if (
    hasAny(value, [
      "exam",
      "study",
      "homework",
      "class 1",
      "class 2",
      "class 3",
      "class 4",
      "class 5",
      "class 6",
      "class 7",
      "class 8",
      "class 9",
      "class 10",
      "class 11",
      "class 12",
      "upsc",
      "ssc",
      "jee",
      "neet",
      "pyq",
      "question paper"
    ])
  ) {
    return "study";
  }

  if (
    hasAny(value, [
      "weather",
      "temperature",
      "rain today",
      "forecast"
    ])
  ) {
    return "weather";
  }

  if (
    hasAny(value, [
      "news",
      "latest news",
      "breaking news",
      "today news"
    ])
  ) {
    return "news";
  }

  if (
    hasAny(value, [
      "remember this",
      "remember that",
      "save this",
      "save that",
      "yaad rakhna"
    ])
  ) {
    return "memory";
  }

  if (
    hasAny(value, [
      "calculate",
      "solve",
      "percentage",
      "%",
      "multiply",
      "divide"
    ])
  ) {
    return "calculator";
  }

  if (
    hasAny(value, [
      "latest",
      "current",
      "today",
      "right now",
      "live",
      "recent"
    ])
  ) {
    return "live";
  }

  return "general";
}

module.exports = {
  hasAny,
  detectIntent
};
