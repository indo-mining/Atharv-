"use strict";


export function autoResizeTextarea(
  textarea
) {
  if (!textarea) {
    return;
  }

  textarea.style.height =
    "auto";

  textarea.style.height =
    `${Math.min(
      textarea.scrollHeight,
      160
    )}px`;
}


export function getSelectedFile(
  input
) {
  if (
    !input ||
    !input.files ||
    !input.files.length
  ) {
    return null;
  }

  return input.files[0];
}
