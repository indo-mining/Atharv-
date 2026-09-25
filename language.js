/**
 * Lightweight language/script detection.
 *
 * This is only used to give the backend/frontend
 * useful context. The backend remains responsible
 * for the final language behavior.
 */


/**
 * @param {string} text
 * @returns {string}
 */
export function detectLanguage(text) {

  const value = String(text || "");

  if (/[\u0900-\u097F]/.test(value)) {
    return "Hindi (Devanagari)";
  }

  if (/[\u0980-\u09FF]/.test(value)) {
    return "Bengali";
  }

  if (/[\u0A00-\u0A7F]/.test(value)) {
    return "Punjabi";
  }

  if (/[\u0A80-\u0AFF]/.test(value)) {
    return "Gujarati";
  }

  if (/[\u0B00-\u0B7F]/.test(value)) {
    return "Odia";
  }

  if (/[\u0B80-\u0BFF]/.test(value)) {
    return "Tamil";
  }

  if (/[\u0C00-\u0C7F]/.test(value)) {
    return "Telugu";
  }

  if (/[\u0C80-\u0CFF]/.test(value)) {
    return "Kannada";
  }

  if (/[\u0D00-\u0D7F]/.test(value)) {
    return "Malayalam";
  }

  if (/[\u0900-\u097F]/.test(value)) {
    return "Hindi";
  }

  const lower = value.toLowerCase();

  const romanHindiWords = [
    "hai",
    "hain",
    "kaise",
    "kaisa",
    "kya",
    "kyu",
    "kyon",
    "mujhe",
    "mera",
    "meri",
    "mere",
    "aap",
    "tum",
    "batao",
    "bata",
    "kitna",
    "kitne",
    "hota",
    "hoti",
    "karna",
    "karo",
    "chahiye"
  ];

  const romanHindiCount =
    romanHindiWords.filter(word =>
      new RegExp(`\\b${word}\\b`, "i").test(lower)
    ).length;

  if (romanHindiCount >= 2) {
    return "Roman Hindi / Hinglish";
  }

  return "English";
}


/**
 * @param {string} text
 * @returns {string}
 */
export function getLanguageInstruction(text) {

  const language = detectLanguage(text);

  switch (language) {

    case "Roman Hindi / Hinglish":
      return "Reply in natural Roman Hindi/Hinglish.";

    case "Hindi (Devanagari)":
      return "Reply in Hindi using Devanagari script.";

    case "Bengali":
      return "Reply in Bengali.";

    case "Punjabi":
      return "Reply in Punjabi.";

    case "Gujarati":
      return "Reply in Gujarati.";

    case "Tamil":
      return "Reply in Tamil.";

    case "Telugu":
      return "Reply in Telugu.";

    case "Kannada":
      return "Reply in Kannada.";

    case "Malayalam":
      return "Reply in Malayalam.";

    case "Odia":
      return "Reply in Odia.";

    default:
      return "Reply in English.";
  }
}
