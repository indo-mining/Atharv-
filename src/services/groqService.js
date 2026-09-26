"use strict";

const config = require("../config");

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

async function callGroq({
  messages,
  model,
  temperature = 0.3,
  maxTokens = 2000,
  stream = false
}) {
  if (!config.groqApiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`
    },

    body: JSON.stringify({
      model,

      messages,

      temperature,

      max_tokens: maxTokens,

      stream
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Groq API error ${response.status}: ${errorText.slice(0, 500)}`
    );
  }

  return response;
}

async function callGroqWithFallback(options) {
  try {
    return await callGroq({
      ...options,
      model:
        options.model ||
        config.groqPrimaryModel
    });
  } catch (primaryError) {
    console.error(
      "GROQ PRIMARY ERROR:",
      primaryError.message
    );

    return callGroq({
      ...options,
      model: config.groqFallbackModel
    });
  }
}

module.exports = {
  callGroq,
  callGroqWithFallback
};
