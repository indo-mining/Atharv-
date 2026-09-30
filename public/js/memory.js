"use strict";

import {
  getMemories,
  deleteMemory
} from "./api.js";


export async function loadMemories(
  container
) {
  if (!container) {
    return;
  }

  container.textContent =
    "Loading...";

  try {

    const result =
      await getMemories();

    const memories =
      Array.isArray(result)
        ? result
        : Array.isArray(
            result?.memories
          )
          ? result.memories
          : Array.isArray(
              result?.data
            )
            ? result.data
            : [];

    renderMemories(
      container,
      memories
    );

  } catch (error) {

    console.error(
      "MEMORY LOAD ERROR:",
      error
    );

    container.innerHTML = `
      <div class="memory-empty">
        Memory load nahi ho paayi.
      </div>
    `;
  }
}


function renderMemories(
  container,
  memories
) {
  if (
    !Array.isArray(memories) ||
    memories.length === 0
  ) {
    container.innerHTML = `
      <div class="memory-empty">
        Abhi koi saved memory nahi hai.
      </div>
    `;

    return;
  }

  container.innerHTML =
    "";

  memories.forEach(
    memory => {

      const id =
        memory.id;

      const text =
        memory.memory ||
        memory.content ||
        memory.text ||
        "";

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "memory-item";

      item.textContent =
        text;

      if (id) {

        item.title =
          "Click to delete";

        item.style.cursor =
          "pointer";

        item.addEventListener(
          "click",
          async () => {

            const confirmed =
              window.confirm(
                "Is memory ko delete karna hai?"
              );

            if (!confirmed) {
              return;
            }

            try {

              await deleteMemory(
                id
              );

              item.remove();

            } catch (error) {

              console.error(
                error
              );

              alert(
                "Memory delete nahi ho paayi."
              );
            }
          }
        );
      }

      container.appendChild(
        item
      );
    }
  );
}
