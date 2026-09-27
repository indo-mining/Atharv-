"use strict";

import {
  getMemories,
  addMemory as apiAddMemory,
  deleteMemory as apiDeleteMemory
} from "./api.js";

import {
  $,
  escapeHtml
} from "./utils.js";

let memories = [];

export function openMemory() {
  const modal = $("#memoryModal");

  if (!modal) return;

  modal.hidden = false;

  document.body.classList.add("modal-open");

  loadMemories();

  setTimeout(() => {
    $("#memoryInput")?.focus();
  }, 50);
}

export function closeMemory() {
  const modal = $("#memoryModal");

  if (!modal) return;

  modal.hidden = true;

  document.body.classList.remove("modal-open");
}

export async function loadMemories() {
  const list = $("#memoryList");

  if (!list) return;

  list.innerHTML = `
    <div class="memory-loading">
      Loading memory...
    </div>
  `;

  try {
    const data = await getMemories();

    memories =
      data?.memories ||
      data?.data?.memories ||
      data?.items ||
      data?.data ||
      [];

    if (!Array.isArray(memories)) {
      memories = [];
    }

    renderMemories();

  } catch (error) {
    console.error("MEMORY LOAD ERROR:", error);

    list.innerHTML = `
      <div class="memory-empty">
        Memory could not be loaded right now.
      </div>
    `;
  }
}

function getMemoryId(item) {
  return (
    item.id ??
    item.memory_id ??
    item.memoryId
  );
}

function getMemoryText(item) {
  return (
    item.memory ||
    item.content ||
    item.text ||
    item.value ||
    ""
  );
}

function renderMemories() {
  const list = $("#memoryList");

  if (!list) return;

  if (!memories.length) {
    list.innerHTML = `
      <div class="memory-empty">
        No saved memories yet.
      </div>
    `;

    return;
  }

  list.innerHTML = memories
    .map((item) => {
      const id = getMemoryId(item);
      const text = getMemoryText(item);

      return `
        <div class="memory-item">
          <div class="memory-text">
            ${escapeHtml(text)}
          </div>

          <button
            type="button"
            class="memory-delete"
            data-memory-delete="${escapeHtml(String(id))}"
          >
            Delete
          </button>
        </div>
      `;
    })
    .join("");
}

export async function addMemory() {
  const input = $("#memoryInput");

  if (!input) return;

  const text = input.value.trim();

  if (!text) {
    return;
  }

  if (text.length > 1000) {
    return;
  }

  const button = $("#addMemoryButton");

  if (button) {
    button.disabled = true;
  }

  try {
    await apiAddMemory(text);

    input.value = "";

    await loadMemories();

  } catch (error) {
    console.error("MEMORY ADD ERROR:", error);

    alert(
      error?.message ||
      "Memory save nahi ho paayi."
    );

  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

export async function deleteMemory(id) {
  if (!id) return;

  try {
    await apiDeleteMemory(id);

    await loadMemories();

  } catch (error) {
    console.error("MEMORY DELETE ERROR:", error);

    alert(
      error?.message ||
      "Memory delete nahi ho paayi."
    );
  }
}
