"use strict";

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function truncate(value = "", max = 80) {
  const text = String(value);

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}…`;
}

export function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function debounce(fn, delay = 250) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);

    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

export function scrollToBottom(element) {
  if (!element) return;

  requestAnimationFrame(() => {
    element.scrollTop = element.scrollHeight;
  });
}

export function formatDate(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function isMobile() {
  return window.matchMedia("(max-width: 900px)").matches;
}
