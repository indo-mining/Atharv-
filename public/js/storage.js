"use strict";


const HISTORY_KEY =
  "atharv_chat_history_v17";

const OLD_HISTORY_KEYS = [
  "atharv_chat_history",
  "atharv_history",
  "chat_history"
];


const DRAFT_KEY =
  "atharv_chat_draft_v17";


function safeParse(
  value,
  fallback
) {

  try {

    return JSON.parse(value);

  } catch {

    return fallback;
  }
}


export function getHistory() {

  try {

    const current =
      localStorage.getItem(
        HISTORY_KEY
      );


    if (current) {

      const parsed =
        safeParse(
          current,
          []
        );


      return Array.isArray(
        parsed
      )
        ? parsed
        : [];
    }


    for (
      const key
      of OLD_HISTORY_KEYS
    ) {

      const old =
        localStorage.getItem(
          key
        );


      if (!old) {
        continue;
      }


      const parsed =
        safeParse(
          old,
          []
        );


      if (
        Array.isArray(parsed)
      ) {

        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify(parsed)
        );


        return parsed;
      }
    }


    return [];

  } catch (error) {

    console.warn(
      "History read failed:",
      error
    );

    return [];
  }
}


export function saveHistory(
  history
) {

  try {

    const safe =
      Array.isArray(history)
        ? history
        : [];


    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(safe)
    );

  } catch (error) {

    console.warn(
      "History save failed:",
      error
    );
  }
}


export function clearHistory() {

  try {

    localStorage.removeItem(
      HISTORY_KEY
    );

    /*
     * Purposely DO NOT delete
     * memory keys here.
     *
     * Chat history and Atharv
     * Memory are separate.
     */

  } catch (error) {

    console.warn(
      "History clear failed:",
      error
    );
  }
}


export function getDraft() {

  try {

    return (
      localStorage.getItem(
        DRAFT_KEY
      ) || ""
    );

  } catch {

    return "";
  }
}


export function saveDraft(
  value
) {

  try {

    if (
      String(value || "").trim()
    ) {

      localStorage.setItem(
        DRAFT_KEY,
        String(value)
      );

    } else {

      localStorage.removeItem(
        DRAFT_KEY
      );
    }

  } catch (error) {

    console.warn(
      "Draft save failed:",
      error
    );
  }
}


export function clearDraft() {

  try {

    localStorage.removeItem(
      DRAFT_KEY
    );

  } catch {}
}
