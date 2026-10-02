export function languageInstruction(text=""){
  if(/[\u0900-\u097F]/.test(text)) return "Reply in Hindi using Devanagari script.";
  if(/^[\x00-\x7F]*$/.test(text) && /[A-Za-z]/.test(text)) return "Reply in clear English.";
  return "Reply in the same language and script as the user.";
}
