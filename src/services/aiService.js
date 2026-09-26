"use strict";

const config = require("../config");

const {
  cleanText,
  compressHistory,
  detectLanguage
} = require("../utils/text");

const {
  detectIntent
} = require("../utils/intent");

const {
  safeCalculate
} = require("../utils/calculate");

const {
  searchTavily
} = require("./tavilyService");

const {
  callGroqWithFallback
} = require("./groqService");

function buildSystemPrompt({
  language,
  intent,
  memories = []
}) {
  let languageInstruction =
    "Reply naturally in English.";

  if (language === "hi") {
    languageInstruction =
      "Reply naturally in Hindi using Devanagari script.";
  }

  if (language === "hinglish") {
    languageInstruction =
      "Reply in natural Roman Hindi/Hinglish. Do not unnecessarily switch to Devanagari.";
  }

  const memoryText =
    memories.length > 0
      ? memories
          .map((item) => `- ${item.memory}`)
          .join("\n")
      : "No saved memories.";

  return `
You are Atharv AI.

Your identity:
- Name: Atharv AI
- Helpful, accurate, friendly and practical.
- You support multiple languages.
- Follow the user's language and writing style.

Language:
${languageInstruction}

Current intent:
${intent}

Important behavior:
- Answer directly.
- Avoid unnecessary repetition.
- Do not repeatedly say "Atharv soch raha hai".
- If information is uncertain, say so clearly.
- For current/live information, use supplied research context when available.
- Do not invent sources or facts.
- For coding, provide working code and explain briefly.
- For study questions, teach step-by-step when useful.
- Keep answers readable on mobile.
- Use headings and bullets when they improve clarity.

Saved user memories:
${memoryText}
`.trim();
}

function extractTavilyContext(data) {
  if (!data || !Array.isArray(data.results)) {
    return "";
  }

  return data.results
    .slice(0, 5)
    .map((item, index) => {
      return [
        `SOURCE ${index + 1}`,
        `Title: ${item.title || ""}`,
        `URL: ${item.url || ""}`,
        `Content: ${item.content || ""}`
      ].join("\n");
    })
    .join("\n\n");
}

async function getResearchContext(message, intent) {
  if (
    ![
      "live",
      "news",
      "study"
    ].includes(intent)
  ) {
    return {
      context: "",
      sources: []
    };
  }

  try {
    const data = await searchTavily(
      message,
      {
        searchDepth:
          intent === "news"
            ? "advanced"
            : "basic",

        topic:
          intent === "news"
            ? "news"
            : "general",

        maxResults: 5
      }
    );

    return {
      context: extractTavilyContext(data),
      sources: data.results || []
    };
  } catch (error) {
    console.error(
      "TAVILY RESEARCH ERROR:",
      error.message
    );

    return {
      context: "",
      sources: []
    };
  }
}

async function generateAnswer({
  message,
  history = [],
  memories = []
}) {
  const userMessage = cleanText(message);

  if (!userMessage) {
    throw new Error(
      "Message cannot be empty."
    );
  }

  const language =
    detectLanguage(userMessage);

  const intent =
    detectIntent(userMessage);

  if (intent === "calculator") {
    const result =
      safeCalculate(userMessage);

    if (result !== null) {
      return {
        answer: String(result),
        language,
        intent,
        sources: []
      };
    }
  }

  const research =
    await getResearchContext(
      userMessage,
      intent
    );

  const systemPrompt =
    buildSystemPrompt({
      language,
      intent,
      memories
    });

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },

    ...compressHistory(history),

    {
      role: "user",
      content: research.context
        ? `${userMessage}

Use this research context where relevant:

${research.context}`
        : userMessage
    }
  ];

  const response =
    await callGroqWithFallback({
      messages,
      temperature:
        intent === "coding"
          ? 0.2
          : 0.4,

      maxTokens: 2500,

      stream: false
    });

  const data =
    await response.json();

  const answer =
    data?.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error(
      "AI returned an empty response."
    );
  }

  return {
    answer: answer.trim(),
    language,
    intent,
    sources: research.sources
  };
}

async function generateStream({
  message,
  history = [],
  memories = []
}) {
  const userMessage = cleanText(message);

  if (!userMessage) {
    throw new Error(
      "Message cannot be empty."
    );
  }

  const language =
    detectLanguage(userMessage);

  const intent =
    detectIntent(userMessage);

  const research =
    await getResearchContext(
      userMessage,
      intent
    );

  const systemPrompt =
    buildSystemPrompt({
      language,
      intent,
      memories
    });

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },

    ...compressHistory(history),

    {
      role: "user",
      content: research.context
        ? `${userMessage}

Research context:

${research.context}`
        : userMessage
    }
  ];

  return callGroqWithFallback({
    messages,

    temperature:
      intent === "coding"
        ? 0.2
        : 0.4,

    maxTokens: 2500,

    stream: true
  });
}

async function researchQuery(query) {
  return searchTavily(query, {
    searchDepth: "advanced",
    topic: "general",
    maxResults: 8
  });
}

module.exports = {
  buildSystemPrompt,
  generateAnswer,
  generateStream,
  researchQuery
};
