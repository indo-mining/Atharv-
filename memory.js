import {
  getMemory,
  saveMemory
} from "./api.js";

import { $ } from "./utils.js";


/**
 * Open memory modal.
 */
export async function openMemory() {

  const modal =
    $("memoryModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("hidden");

  await loadMemory();
}


/**
 * Close memory modal.
 */
export function closeMemory() {

  $("memoryModal")
    ?.classList.add("hidden");
}


/**
 * Load memory from backend.
 */
export async function loadMemory() {

  const list =
    $("memoryList");

  if (!list) {
    return;
  }

  list.textContent =
    "Loading...";

  try {

    const result =
      await getMemory();

    const memories =
      Array.isArray(result)
        ? result
        : result?.memories || [];

    if (!memories.length) {

      list.innerHTML =
        "<div>No saved memories yet.</div>";

      return;
    }

    list.innerHTML = "";

    memories.forEach(memory => {

      const item =
        document.createElement("div");

      item.className =
        "memory-item";

      const text =
        document.createElement("span");

      text.textContent =
        memory.memory ||
        memory.text ||
        String(memory);

      item.appendChild(text);

      list.appendChild(item);
    });

  } catch (error) {

    list.textContent =
      error?.message ||
      "Memory is currently unavailable.";
  }
}


/**
 * Save a new memory.
 */
export async function addMemory() {

  const input =
    $("memoryInput");

  if (!input) {
    return;
  }

  const value =
    input.value.trim();

  if (!value) {
    return;
  }

  try {

    await saveMemory(value);

    input.value = "";

    await loadMemory();

  } catch (error) {

    alert(
      error?.message ||
      "Could not save memory."
    );
  }
}
