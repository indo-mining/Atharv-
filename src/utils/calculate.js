"use strict";

function safeCalculate(expression) {
  if (typeof expression !== "string") {
    return null;
  }

  let value = expression
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "");

  if (!value) {
    return null;
  }

  value = value
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");

  if (!/^[0-9+\-*/().%]+$/.test(value)) {
    return null;
  }

  if (
    value.includes("++") ||
    value.includes("--") ||
    value.includes("**") ||
    value.includes("//")
  ) {
    return null;
  }

  try {
    const result = Function(
      `"use strict"; return (${value});`
    )();

    if (
      typeof result !== "number" ||
      !Number.isFinite(result)
    ) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

module.exports = {
  safeCalculate
};
