"use strict";


import {
  getMemories,
  addMemory as apiAddMemory,
  deleteMemory as apiDeleteMemory
} from "./api.js";


const LOCAL_MEMORY_KEY =
  "atharv_saved_memories_v1";


function getLocalMemories() {

  try {

    const value =
      localStorage.getItem(
        LOCAL_MEMORY_KEY
      );


    if (!value) {
      return [];
    }


    const data =
      JSON.parse(value);


    return Array.isArray(data)
      ? data
      : [];

  } catch {

    return [];
  }
}


function saveLocalMemories(
  memories
) {

  try {

    localStorage.setItem(
      LOCAL_MEMORY_KEY,
      JSON.stringify(memories)
    );

  } catch (error) {

    console.warn(
      "Local memory save failed:",
      error
    );
  }
}


function normalizeMemory(
  item,
  index
) {

  if (
    typeof item === "string"
  ) {

    return {
      id:
        `local-${index}`,

      memory:
        item,

      content:
        item
    };
  }


  return {

    ...item,

    id:
      item?.id ||
      item?._id ||
      `local-${index}`,

    memory:
      item?.memory ||
      item?.content ||
      item?.text ||
      ""

  };
}


function renderMemories(
  memories
) {

  const container =
    document.querySelector(
      "#memoryList"
    );


  if (!container) {
    return;
  }


  if (!memories.length) {

    container.innerHTML = `
      <div class="memory-empty">
        No saved memories yet.
      </div>
    `;

    return;
  }


  container.innerHTML =
    memories.map(
      item => {

        const text =
          escapeHtml(
            item.memory ||
            item.content ||
            ""
          );


        return `
          <div class="memory-item">
            <div class="memory-item-text">
              ${text}
            </div>

            <button
              type="button"
              class="memory-delete"
              data-memory-delete="${escapeHtml(String(item.id))}"
            >
              Delete
            </button>
          </div>
        `;

      }
    ).join("");
}


function escapeHtml(
  value
) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


export async function openMemory() {

  const modal =
    document.querySelector(
      "#memoryModal"
    );


  if (modal) {

    modal.hidden =
      false;
  }


  await loadMemories();
}


export function closeMemory() {

  const modal =
    document.querySelector(
      "#memoryModal"
    );


  if (modal) {

    modal.hidden =
      true;
  }
}


export async function loadMemories() {

  const container =
    document.querySelector(
      "#memoryList"
    );


  if (container) {

    container.innerHTML = `
      <div class="memory-loading">
        Loading memory...
      </div>
    `;
  }


  let memories = [];


  try {

    const response =
      await getMemories();


    const serverData =
      response?.memories ||
      response?.data ||
      response?.items ||
      [];


    if (
      Array.isArray(serverData)
    ) {

      memories =
        serverData.map(
          normalizeMemory
        );


      /*
       * Keep a local copy too.
       * This is a fallback only.
       */

      saveLocalMemories(
        memories
      );
    }


  } catch (error) {

    console.warn(
      "Server memory unavailable:",
      error
    );


    /*
     * Do not erase memory when
     * server is temporarily unavailable.
     */

    memories =
      getLocalMemories()
        .map(normalizeMemory);
  }


  renderMemories(
    memories
  );
}


export async function addMemory() {

  const input =
    document.querySelector(
      "#memoryInput"
    );


  if (!input) {
    return;
  }


  const text =
    input.value.trim();


  if (!text) {
    return;
  }


  try {

    const response =
      await apiAddMemory(
        text
      );


    const returned =
      response?.memory ||
      response?.data ||
      response?.item;


    let memories =
      getLocalMemories();


    if (returned) {

      memories.unshift(
        normalizeMemory(
          returned,
          0
        )
      );

    } else {

      memories.unshift({

        id:
          `local-${Date.now()}`,

        memory:
          text,

        content:
          text

      });
    }


    saveLocalMemories(
      memories
    );


    input.value = "";

    await loadMemories();


  } catch (error) {

    /*
     * Important:
     * If server temporarily fails,
     * memory is STILL preserved locally.
     */

    const memories =
      getLocalMemories();


    memories.unshift({

      id:
        `local-${Date.now()}`,

      memory:
        text,

      content:
        text
    });


    saveLocalMemories(
      memories
    );


    input.value = "";

    renderMemories(
      memories
    );


    console.warn(
      "Memory saved locally:",
      error
    );
  }
}


export async function deleteMemory(
  id
) {

  try {

    /*
     * Server ID delete.
     * Local-only IDs are ignored by server.
     */

    if (
      id &&
      !String(id).startsWith(
        "local-"
      )
    ) {

      await apiDeleteMemory(
        id
      );
    }

  } catch (error) {

    console.warn(
      "Server memory delete failed:",
      error
    );
  }


  const memories =
    getLocalMemories()
      .filter(
        item =>
          String(
            item.id
          ) !== String(id)
      );


  saveLocalMemories(
    memories
  );


  await loadMemories();
}
