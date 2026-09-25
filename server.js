"use strict";

/*
=========================================================
 ATHARV AI SERVER
 Version 16.0.0
 --------------------------------------------------------
 Fast AI + Smart Router + Compact Context

 FEATURES
 --------------------------------------------------------
 ✓ Groq GPT-OSS
 ✓ 8K TPM protection
 ✓ Prompt compression
 ✓ Smart intent routing
 ✓ General AI
 ✓ Hindi / Hinglish / English
 ✓ Multilingual
 ✓ Live web research via Tavily (optional)
 ✓ News research
 ✓ Weather via Open-Meteo
 ✓ Study engine
 ✓ Competitive exams
 ✓ Coding / debugging
 ✓ Calculator
 ✓ PostgreSQL memory (optional)
 ✓ Conversation history trimming
 ✓ Streaming
 ✓ Error recovery
 ✓ Health monitoring
 ✓ Minimal environment variables

 REQUIRED
 --------------------------------------------------------
 GROQ_API_KEY

 OPTIONAL
 --------------------------------------------------------
 DATABASE_URL
 TAVILY_API_KEY
 PORT

=========================================================
*/

const express = require("express");
const cors = require("cors");
const path = require("path");

let Pool = null;

try {
  Pool = require("pg").Pool;
} catch (err) {
  console.warn("pg package not available. Database disabled.");
}

const app = express();

const PORT = Number(process.env.PORT || 10000);

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

/*
=========================================================
 MODELS
=========================================================
*/

const PRIMARY_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const FALLBACK_MODEL =
  process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";

/*
=========================================================
 LIMITS
=========================================================
*/

/*
Groq organization currently reports an 8000 TPM limit.

We deliberately keep our own request budget below that.
The purpose is to prevent a normal request from becoming
a 9K+ token request like the previous version.
*/

const MAX_INPUT_CHARS = 22000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 9000;
const MAX_MEMORY_ITEMS = 6;
const MAX_MEMORY_CHARS = 5000;
const MAX_RESEARCH_CHARS = 7000;

const SIMPLE_OUTPUT_TOKENS = 500;
const NORMAL_OUTPUT_TOKENS = 1000;
const COMPLEX_OUTPUT_TOKENS = 1800;

/*
=========================================================
 MIDDLEWARE
=========================================================
*/

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

/*
=========================================================
 DATABASE
=========================================================
*/

let pool = null;

if (Pool && DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000
    });

    pool.on("error", err => {
      console.error("DATABASE POOL ERROR:", err.message);
    });

    console.log("PostgreSQL: ENABLED");
  } catch (err) {
    console.error("DATABASE INIT ERROR:", err.message);
    pool = null;
  }
} else {
  console.log("PostgreSQL: OPTIONAL / DISABLED");
}

async function initializeDatabase() {
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_memories (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        memory TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_user
      ON user_memories(user_id)
    `);

    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("DATABASE INIT ERROR:", err.message);
  }
}

/*
=========================================================
 SAFE HELPERS
=========================================================
*/

function cleanText(value, max = MAX_INPUT_CHARS) {
  if (value === undefined || value === null) return "";

  return String(value)
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function getUserId(req) {
  return (
    req.headers["x-user-id"] ||
    req.headers["x-user"] ||
    req.body?.user_id ||
    req.body?.userId ||
    "anonymous"
  );
}

/*
=========================================================
 LANGUAGE DETECTION
=========================================================
*/

function detectLanguage(text) {
  const t = String(text || "");

  const devanagari = (t.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (t.match(/[A-Za-z]/g) || []).length;

  if (devanagari > latin * 0.25) {
    return "Hindi";
  }

  const lower = t.toLowerCase();

  const romanHindiWords = [
    "hai",
    "hain",
    "kya",
    "kaise",
    "kaisa",
    "kitna",
    "kitne",
    "batao",
    "btao",
    "chahiye",
    "mujhe",
    "mera",
    "meri",
    "aap",
    "tum",
    "kyun",
    "kyon",
    "kab",
    "kahan",
    "acha",
    "achha",
    "nahi",
    "nahin",
    "karna",
    "karo",
    "kaam",
    "paisa"
  ];

  let count = 0;

  for (const word of romanHindiWords) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower)) {
      count++;
    }
  }

  if (count >= 1 && latin > 0) {
    return "Roman Hindi / Hinglish";
  }

  return "English";
}

/*
=========================================================
 INTENT ROUTER
=========================================================
*/

function detectIntent(text) {
  const t = String(text || "").toLowerCase().trim();

  if (!t) return "general";

  /*
  Calculator
  */

  const calculatorPattern =
    /^[\d\s()+\-*/%.^=]+$/;

  if (
    calculatorPattern.test(t) ||
    /^(what is|calculate|solve)\s+[\d\s()+\-*/%.^]+$/i.test(t) ||
    /^(2\s*\+\s*2|10\s*\*\s*10)/i.test(t)
  ) {
    return "calculator";
  }

  /*
  Weather
  */

  if (
    /\b(weather|temperature|forecast|rain|baarish|barish|mausam|तापमान|मौसम)\b/i.test(
      t
    )
  ) {
    return "weather";
  }

  /*
  News
  */

  if (
    /\b(today news|latest news|breaking news|news today|aaj ki news|taaza khabar|latest update|recent news)\b/i.test(
      t
    )
  ) {
    return "news";
  }

  /*
  Live/current
  */

  if (
    /\b(today|tonight|now|currently|latest|recent|live|current|aaj|abhi|filhaal|ताज़ा|आज|अभी)\b/i.test(
      t
    )
  ) {
    return "live";
  }

  /*
  Programming
  */

  if (
    /\b(code|coding|programming|javascript|typescript|python|java|c\+\+|html|css|react|node|nodejs|sql|api|bug|debug|error|exception|function|class|variable)\b/i.test(
      t
    )
  ) {
    return "coding";
  }

  /*
  Study
  */

  if (
    /\b(class\s*[1-9]|class\s*10|class\s*11|class\s*12|cbse|icse|upsc|ssc|banking|railway|neet|jee|pyq|previous year|mcq|mock test|exam|homework|chapter|question paper|revision|flashcard)\b/i.test(
      t
    )
  ) {
    return "study";
  }

  /*
  Search/research
  */

  if (
    /\b(search|research|find|source|sources|reference|official website|official source|look up|lookup)\b/i.test(
      t
    )
  ) {
    return "research";
  }

  return "general";
}

/*
=========================================================
 SIMPLE CALCULATOR
=========================================================
*/

function calculateExpression(input) {
  let expression = String(input || "")
    .toLowerCase()
    .replace(/what is/g, "")
    .replace(/calculate/g, "")
    .replace(/solve/g, "")
    .replace(/kitna hota hai/g, "")
    .replace(/kitna hai/g, "")
    .replace(/hota hai/g, "")
    .replace(/=/g, "")
    .trim();

  /*
  Only allow mathematical characters.
  */

  if (!/^[0-9+\-*/().%\s^]+$/.test(expression)) {
    return null;
  }

  try {
    expression = expression.replace(/\^/g, "**");

    /*
    Avoid eval for arbitrary text.
    The whitelist above limits this to arithmetic.
    */

    const result = Function(
      `"use strict"; return (${expression})`
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

/*
=========================================================
 MEMORY
 ========================================================
*/

async function getMemories(userId) {
  if (!pool || !userId || userId === "anonymous") {
    return [];
  }

  try {
    const result = await pool.query(
      `
      SELECT memory
      FROM user_memories
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT $2
      `,
      [String(userId), MAX_MEMORY_ITEMS]
    );

    return result.rows
      .map(row => cleanText(row.memory, 900))
      .filter(Boolean);
  } catch (err) {
    /*
    Memory must NEVER stop AI chat.
    */

    console.error("MEMORY READ ERROR:", err.message);
    return [];
  }
}

async function saveMemory(userId, memory) {
  if (!pool || !userId || userId === "anonymous") {
    return false;
  }

  const value = cleanText(memory, 1000);

  if (!value) return false;

  try {
    await pool.query(
      `
      INSERT INTO user_memories
      (user_id, memory)
      VALUES ($1, $2)
      `,
      [String(userId), value]
    );

    return true;
  } catch (err) {
    console.error("MEMORY SAVE ERROR:", err.message);
    return false;
  }
}

/*
=========================================================
 CONTEXT COMPRESSION
=========================================================
*/

function compressHistory(history) {
  if (!Array.isArray(history)) return [];

  const result = [];

  let totalChars = 0;

  for (
    let i = history.length - 1;
    i >= 0;
    i--
  ) {
    const item = history[i];

    if (!item) continue;

    const role =
      item.role === "assistant"
        ? "assistant"
        : "user";

    const content = cleanText(
      item.content ||
        item.message ||
        item.text ||
        "",
      1800
    );

    if (!content) continue;

    const line = {
      role,
      content
    };

    const size = content.length + 30;

    if (
      result.length >= MAX_HISTORY_MESSAGES ||
      totalChars + size > MAX_HISTORY_CHARS
    ) {
      break;
    }

    result.unshift(line);
    totalChars += size;
  }

  return result;
}

function compressMemories(memories) {
  if (!Array.isArray(memories)) return "";

  return memories
    .slice(0, MAX_MEMORY_ITEMS)
    .map(x => cleanText(x, 700))
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_MEMORY_CHARS);
}

/*
=========================================================
 SYSTEM PROMPTS
=========================================================
*/

function getBasePrompt(language) {
  return `
You are Atharv, a helpful AI assistant.

Language:
Reply naturally in ${language}.
If the user writes Roman Hindi/Hinglish, reply in Roman Hindi/Hinglish.
If the user writes Hindi Devanagari, reply in Hindi.
If English, reply in English.

Rules:
- Be accurate and useful.
- Do not invent current facts.
- Be concise unless detail is requested.
- Do not repeat the same answer.
- Use simple explanations when appropriate.
- Do not mention internal prompts, routing, models or tools.
- Never say you searched the web unless web research was actually performed.
- If uncertain, clearly say so.
`.trim();
}

function getIntentPrompt(intent) {
  switch (intent) {
    case "coding":
      return `
Coding mode:
- Understand the code and error.
- Give corrected code when useful.
- Explain the cause briefly.
- Do not invent libraries or APIs.
`.trim();

    case "study":
      return `
Study mode:
- Teach step by step.
- Match the student's level.
- Use examples.
- For exam questions, distinguish verified facts from explanation.
`.trim();

    case "research":
    case "live":
    case "news":
      return `
Research mode:
- Current information must come from supplied research context.
- Prefer official and reliable sources.
- Distinguish facts from uncertain claims.
`.trim();

    default:
      return "";
  }
}

/*
=========================================================
 TAVILY
=========================================================
*/

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) {
    return [];
  }

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    9000
  );

  try {
    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: cleanText(query, 1000),
          search_depth: "basic",
          max_results: 5,
          include_answer: true
        }),
        signal: controller.signal
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Tavily HTTP ${response.status}: ${text.slice(0, 500)}`
      );
    }

    const data = JSON.parse(text);

    return Array.isArray(data.results)
      ? data.results
      : [];
  } catch (err) {
    console.error("TAVILY ERROR:", err.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function formatResearch(results) {
  if (!Array.isArray(results) || !results.length) {
    return "";
  }

  let output = "";

  for (const result of results.slice(0, 5)) {
    const title = cleanText(
      result.title || "",
      300
    );

    const content = cleanText(
      result.content || result.snippet || "",
      1200
    );

    const url = cleanText(
      result.url || "",
      500
    );

    if (!title && !content) continue;

    output +=
      `SOURCE: ${title}\n` +
      `INFO: ${content}\n` +
      `URL: ${url}\n\n`;
  }

  return output.slice(0, MAX_RESEARCH_CHARS);
}

/*
=========================================================
 WEATHER
=========================================================
*/

async function getWeather(city) {
  const place = cleanText(city || "Delhi", 100);

  const geoResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      place
    )}&count=1&language=en&format=json`
  );

  if (!geoResponse.ok) {
    throw new Error("Weather location lookup failed.");
  }

  const geo = await geoResponse.json();

  if (!geo.results || !geo.results.length) {
    throw new Error(
      `Weather location not found for ${place}.`
    );
  }

  const location = geo.results[0];

  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`
  );

  if (!weatherResponse.ok) {
    throw new Error("Weather API failed.");
  }

  const weather = await weatherResponse.json();

  return {
    city:
      location.name ||
      place,
    country:
      location.country || "",
    temperature:
      weather.current?.temperature_2m,
    feels_like:
      weather.current?.apparent_temperature,
    humidity:
      weather.current?.relative_humidity_2m,
    precipitation:
      weather.current?.precipitation,
    wind:
      weather.current?.wind_speed_10m,
    timezone:
      weather.timezone
  };
}

/*
=========================================================
 GROQ
=========================================================
*/

async function callGroq(model, messages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is missing in Render Environment Variables."
    );
  }

  const stream = Boolean(options.stream);

  /*
  IMPORTANT:
  Keep output small enough so input + output does not
  unnecessarily push requests beyond the TPM budget.
  */

  const maxTokens = Math.min(
    Number(
      options.max_completion_tokens ||
        NORMAL_OUTPUT_TOKENS
    ),
    COMPLEX_OUTPUT_TOKENS
  );

  const payload = {
    model,
    messages,
    temperature:
      typeof options.temperature === "number"
        ? options.temperature
        : 0.3,
    max_completion_tokens: maxTokens,
    stream,
    include_reasoning: false
  };

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    45000
  );

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `Groq HTTP ${response.status}: ${errorText.slice(
          0,
          1500
        )}`
      );
    }

    if (stream) {
      return response;
    }

    const data = await response.json();

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error(
        "Groq returned an empty response."
      );
    }

    return answer;
  } finally {
    clearTimeout(timeout);
  }
}

/*
=========================================================
 RESPONSE CLEANER
=========================================================
*/

function cleanResponse(text) {
  if (!text) return "";

  let output = String(text)
    .replace(/\r\n/g, "\n")
    .trim();

  /*
  Remove accidental internal labels.
  */

  output = output.replace(
    /^(assistant|atharv)\s*:\s*/i,
    ""
  );

  /*
  Avoid excessive repeated blank lines.
  */

  output = output
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  return output;
}

/*
=========================================================
 BUILD MESSAGES
=========================================================
*/

async function buildMessages({
  userId,
  message,
  history,
  intent
}) {
  const language =
    detectLanguage(message);

  const memories =
    await getMemories(userId);

  const compactHistory =
    compressHistory(history);

  const memoryText =
    compressMemories(memories);

  const messages = [];

  /*
  Small base prompt.
  */

  messages.push({
    role: "system",
    content: getBasePrompt(language)
  });

  /*
  Only add intent instructions when needed.
  */

  const intentPrompt =
    getIntentPrompt(intent);

  if (intentPrompt) {
    messages.push({
      role: "system",
      content: intentPrompt
    });
  }

  /*
  Memory only if relevant.
  */

  if (memoryText) {
    messages.push({
      role: "system",
      content:
        `Relevant user memory:\n${memoryText}`
    });
  }

  /*
  History only if it actually exists.
  */

  for (const item of compactHistory) {
    messages.push(item);
  }

  messages.push({
    role: "user",
    content: cleanText(
      message,
      MAX_INPUT_CHARS
    )
  });

  return messages;
}

/*
=========================================================
 TOKEN SAFETY
=========================================================
*/

function estimateTokens(messages) {
  let chars = 0;

  for (const message of messages) {
    chars += String(
      message?.content || ""
    ).length;
  }

  /*
  Rough estimate:
  1 token ≈ 4 characters for mixed English text.
  This is intentionally conservative.
  */

  return Math.ceil(chars / 4);
}

function trimMessagesForBudget(messages) {
  const MAX_ESTIMATED_INPUT_TOKENS = 5500;

  let result = [...messages];

  while (
    estimateTokens(result) >
      MAX_ESTIMATED_INPUT_TOKENS &&
    result.length > 2
  ) {
    /*
    Remove oldest conversational message first.
    Keep system + final user message.
    */

    result.splice(1, 1);
  }

  /*
  If still too large, aggressively trim system context.
  */

  if (
    estimateTokens(result) >
    MAX_ESTIMATED_INPUT_TOKENS
  ) {
    result = result.map(
      (item, index) => {
        if (
          item.role === "system" &&
          index !== 0
        ) {
          return {
            ...item,
            content: cleanText(
              item.content,
              800
            )
          };
        }

        return item;
      }
    );
  }

  return result;
}

/*
=========================================================
 GENERATE RESPONSE
=========================================================
*/

async function generateAtharvResponse({
  userId,
  message,
  history = []
}) {
  const cleanMessage =
    cleanText(message);

  if (!cleanMessage) {
    return "Please ask me something.";
  }

  const intent =
    detectIntent(cleanMessage);

  /*
  ========================================================
  CALCULATOR
  ========================================================
  */

  if (intent === "calculator") {
    const result =
      calculateExpression(
        cleanMessage
      );

    if (result !== null) {
      const language =
        detectLanguage(cleanMessage);

      if (
        language ===
        "Roman Hindi / Hinglish"
      ) {
        return `Answer: ${result}`;
      }

      if (language === "Hindi") {
        return `उत्तर: ${result}`;
      }

      return `Answer: ${result}`;
    }
  }

  /*
  ========================================================
  WEATHER
  ========================================================
  */

  if (intent === "weather") {
    /*
    Try to identify a city from common phrasing.
    If not found, Delhi is used as a safe default.
    */

    const cityMatch =
      cleanMessage.match(
        /(?:in|at|near|mein|me|ka|ki)\s+([A-Za-z][A-Za-z .-]{1,50})/i
      );

    const city =
      cityMatch?.[1]?.trim() ||
      "Delhi";

    try {
      const weather =
        await getWeather(city);

      const language =
        detectLanguage(
          cleanMessage
        );

      if (
        language ===
        "Roman Hindi / Hinglish"
      ) {
        return (
          `${weather.city} ka current temperature ` +
          `${weather.temperature}°C hai. ` +
          `Feels like ${weather.feels_like}°C, ` +
          `humidity ${weather.humidity}% hai.`
        );
      }

      if (language === "Hindi") {
        return (
          `${weather.city} में अभी तापमान ` +
          `${weather.temperature}°C है। ` +
          `महसूस होने वाला तापमान ${weather.feels_like}°C ` +
          `और humidity ${weather.humidity}% है।`
        );
      }

      return (
        `Current temperature in ${weather.city} is ` +
        `${weather.temperature}°C. ` +
        `Feels like ${weather.feels_like}°C, ` +
        `humidity is ${weather.humidity}%.`
      );
    } catch (err) {
      console.error(
        "WEATHER ERROR:",
        err.message
      );

      /*
      Fall through to AI.
      */
    }
  }

  /*
  ========================================================
  LIVE / NEWS / RESEARCH
  ========================================================
  */

  let researchContext = "";

  if (
    intent === "live" ||
    intent === "news" ||
    intent === "research"
  ) {
    if (TAVILY_API_KEY) {
      const results =
        await tavilySearch(
          cleanMessage
        );

      researchContext =
        formatResearch(results);
    }
  }

  /*
  ========================================================
  BUILD COMPACT AI REQUEST
  ========================================================
  */

  let messages =
    await buildMessages({
      userId,
      message: cleanMessage,
      history,
      intent
    });

  /*
  Add research only when needed.
  */

  if (researchContext) {
    messages.splice(
      messages.length - 1,
      0,
      {
        role: "system",
        content:
          `Verified research context:\n${researchContext}`
      }
    );
  }

  messages =
    trimMessagesForBudget(
      messages
    );

  const estimatedInput =
    estimateTokens(messages);

  console.log(
    `ATHARV ROUTE: ${intent} | ` +
    `Language: ${detectLanguage(cleanMessage)} | ` +
    `Estimated input tokens: ${estimatedInput}`
  );

  /*
  ========================================================
  OUTPUT SIZE
  ========================================================
  */

  let outputTokens =
    NORMAL_OUTPUT_TOKENS;

  if (intent === "calculator") {
    outputTokens =
      SIMPLE_OUTPUT_TOKENS;
  } else if (
    intent === "coding" ||
    intent === "study" ||
    intent === "research" ||
    intent === "live" ||
    intent === "news"
  ) {
    outputTokens =
      COMPLEX_OUTPUT_TOKENS;
  }

  /*
  ========================================================
  PRIMARY MODEL
  ========================================================
  */

  try {
    const answer =
      await callGroq(
        PRIMARY_MODEL,
        messages,
        {
          max_completion_tokens:
            outputTokens,
          temperature:
            intent === "coding"
              ? 0.15
              : 0.3
        }
      );

    return cleanResponse(
      answer
    );
  } catch (primaryError) {
    console.error(
      "PRIMARY GROQ ERROR:",
      primaryError.message
    );

    /*
    ======================================================
    FALLBACK
    ======================================================
    */

    try {
      console.log(
        `Trying fallback model: ${FALLBACK_MODEL}`
      );

      const fallbackAnswer =
        await callGroq(
          FALLBACK_MODEL,
          messages,
          {
            max_completion_tokens:
              Math.min(
                outputTokens,
                NORMAL_OUTPUT_TOKENS
              ),
            temperature: 0.3
          }
        );

      return cleanResponse(
        fallbackAnswer
      );
    } catch (fallbackError) {
      console.error(
        "FALLBACK GROQ ERROR:",
        fallbackError.message
      );

      throw fallbackError;
    }
  }
}

/*
=========================================================
 CHAT API
=========================================================
*/

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const message =
        cleanText(
          req.body?.message ||
          req.body?.prompt ||
          req.body?.text
        );

      const history =
        Array.isArray(
          req.body?.history
        )
          ? req.body.history
          : [];

      const userId =
        getUserId(req);

      if (!message) {
        return res.status(400).json({
          ok: false,
          error:
            "Message is required."
        });
      }

      const answer =
        await generateAtharvResponse({
          userId,
          message,
          history
        });

      return res.json({
        ok: true,
        answer,
        response: answer,
        message: answer,
        intent:
          detectIntent(message),
        language:
          detectLanguage(message)
      });
    } catch (err) {
      console.error(
        "CHAT ERROR:",
        err
      );

      return res.status(500).json({
        ok: false,
        error:
          "Atharv could not generate a response.",
        details:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : err.message
      });
    }
  }
);

/*
=========================================================
 STREAM API
=========================================================
*/

app.post(
  "/api/chat/stream",
  async (req, res) => {
    try {
      const message =
        cleanText(
          req.body?.message ||
          req.body?.prompt ||
          req.body?.text
        );

      const history =
        Array.isArray(
          req.body?.history
        )
          ? req.body.history
          : [];

      const userId =
        getUserId(req);

      if (!message) {
        return res.status(400).json({
          ok: false,
          error:
            "Message is required."
        });
      }

      /*
      Calculator/weather can be returned
      as one SSE message.
      */

      const intent =
        detectIntent(message);

      if (
        intent === "calculator" ||
        intent === "weather"
      ) {
        const answer =
          await generateAtharvResponse({
            userId,
            message,
            history
          });

        res.setHeader(
          "Content-Type",
          "text/event-stream"
        );

        res.setHeader(
          "Cache-Control",
          "no-cache, no-transform"
        );

        res.setHeader(
          "Connection",
          "keep-alive"
        );

        res.write(
          `data: ${JSON.stringify({
            type: "delta",
            content: answer
          })}\n\n`
        );

        res.write(
          `data: ${JSON.stringify({
            type: "done"
          })}\n\n`
        );

        return res.end();
      }

      let messages =
        await buildMessages({
          userId,
          message,
          history,
          intent
        });

      messages =
        trimMessagesForBudget(
          messages
        );

      /*
      Live research.
      */

      if (
        (
          intent === "live" ||
          intent === "news" ||
          intent === "research"
        ) &&
        TAVILY_API_KEY
      ) {
        const results =
          await tavilySearch(
            message
          );

        const research =
          formatResearch(
            results
          );

        if (research) {
          messages.splice(
            messages.length - 1,
            0,
            {
              role: "system",
              content:
                `Research context:\n${research}`
            }
          );

          messages =
            trimMessagesForBudget(
              messages
            );
        }
      }

      const response =
        await callGroq(
          PRIMARY_MODEL,
          messages,
          {
            stream: true,
            max_completion_tokens:
              intent === "coding" ||
              intent === "study"
                ? NORMAL_OUTPUT_TOKENS
                : NORMAL_OUTPUT_TOKENS
          }
        );

      res.status(200);

      res.setHeader(
        "Content-Type",
        "text/event-stream"
      );

      res.setHeader(
        "Cache-Control",
        "no-cache, no-transform"
      );

      res.setHeader(
        "Connection",
        "keep-alive"
      );

      res.flushHeaders?.();

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      try {
        while (true) {
          const {
            done,
            value
          } =
            await reader.read();

          if (done) break;

          const chunk =
            decoder.decode(
              value,
              {
                stream: true
              }
            );

          const lines =
            chunk.split("\n");

          for (const line of lines) {
            if (
              !line.startsWith(
                "data:"
              )
            ) {
              continue;
            }

            const data =
              line
                .slice(5)
                .trim();

            if (
              !data ||
              data === "[DONE]"
            ) {
              continue;
            }

            try {
              const json =
                JSON.parse(data);

              const content =
                json?.choices?.[0]
                  ?.delta?.content;

              if (content) {
                res.write(
                  `data: ${JSON.stringify({
                    type: "delta",
                    content
                  })}\n\n`
                );
              }
            } catch {
              /*
              Ignore malformed partial
              SSE chunks.
              */
            }
          }
        }
      } finally {
        res.write(
          `data: ${JSON.stringify({
            type: "done"
          })}\n\n`
        );

        res.end();
      }
    } catch (err) {
      console.error(
        "STREAM ERROR:",
        err.message
      );

      if (!res.headersSent) {
        return res.status(500).json({
          ok: false,
          error:
            "Atharv could not generate a response.",
          details:
            process.env.NODE_ENV ===
            "production"
              ? undefined
              : err.message
        });
      }

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            "Atharv could not generate a response."
        })}\n\n`
      );

      res.end();
    }
  }
);

/*
=========================================================
 MEMORY API
=========================================================
*/

app.get(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memories =
        await getMemories(
          userId
        );

      res.json({
        ok: true,
        memories
      });
    } catch (err) {
      res.json({
        ok: true,
        memories: []
      });
    }
  }
);

app.post(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memory =
        cleanText(
          req.body?.memory ||
          req.body?.text,
          1000
        );

      if (!memory) {
        return res.status(400).json({
          ok: false,
          error:
            "Memory is required."
        });
      }

      const saved =
        await saveMemory(
          userId,
          memory
        );

      res.json({
        ok: saved,
        saved
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error:
          "Could not save memory."
      });
    }
  }
);

/*
=========================================================
 SEARCH API
=========================================================
*/

app.get(
  "/api/search",
  async (req, res) => {
    try {
      const query =
        cleanText(
          req.query?.q ||
          req.query?.query
        );

      if (!query) {
        return res.status(400).json({
          ok: false,
          error:
            "Search query is required."
        });
      }

      if (!TAVILY_API_KEY) {
        return res.json({
          ok: true,
          enabled: false,
          results: []
        });
      }

      const results =
        await tavilySearch(
          query
        );

      res.json({
        ok: true,
        enabled: true,
        results
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error:
          "Search failed."
      });
    }
  }
);

/*
=========================================================
 WEATHER API
=========================================================
*/

app.get(
  "/api/weather",
  async (req, res) => {
    try {
      const city =
        cleanText(
          req.query?.city ||
          "Delhi",
          100
        );

      const weather =
        await getWeather(
          city
        );

      res.json({
        ok: true,
        weather
      });
    } catch (err) {
      console.error(
        "WEATHER API ERROR:",
        err.message
      );

      res.status(500).json({
        ok: false,
        error:
          err.message
      });
    }
  }
);

/*
=========================================================
 VERSION
=========================================================
*/

app.get(
  "/api/version",
  (req, res) => {
    res.json({
      ok: true,
      name: "Atharv AI",
      version: "16.0.0",
      primaryModel:
        PRIMARY_MODEL,
      fallbackModel:
        FALLBACK_MODEL,
      features: {
        smartRouter: true,
        compactContext: true,
        tpmProtection: true,
        multilingual: true,
        liveResearch:
          Boolean(
            TAVILY_API_KEY
          ),
        weather: true,
        calculator: true,
        study: true,
        coding: true,
        memory:
          Boolean(pool),
        streaming: true
      }
    });
  }
);

/*
=========================================================
 HEALTH
=========================================================
*/

app.get(
  "/health",
  async (req, res) => {
    let database = false;

    if (pool) {
      try {
        await pool.query(
          "SELECT 1"
        );

        database = true;
      } catch {
        database = false;
      }
    }

    res.json({
      ok: true,
      service:
        "Atharv AI",
      version:
        "16.0.0",
      status:
        "healthy",
      database,
      groq:
        Boolean(
          GROQ_API_KEY
        ),
      tavily:
        Boolean(
          TAVILY_API_KEY
        ),
      timestamp:
        new Date().toISOString()
    });
  }
);

/*
=========================================================
 DEPENDENCY HEALTH
=========================================================
*/

app.get(
  "/health/dependencies",
  async (req, res) => {
    const result = {
      groq: {
        configured:
          Boolean(
            GROQ_API_KEY
          )
      },
      database: {
        configured:
          Boolean(
            DATABASE_URL
          ),
        connected: false
      },
      tavily: {
        configured:
          Boolean(
            TAVILY_API_KEY
          )
      },
      weather: {
        available: true
      }
    };

    if (pool) {
      try {
        await pool.query(
          "SELECT 1"
        );

        result.database.connected =
          true;
      } catch {
        result.database.connected =
          false;
      }
    }

    res.json({
      ok: true,
      dependencies:
        result
    });
  }
);

/*
=========================================================
 STATIC FRONTEND
=========================================================
*/

const publicPath =
  path.join(
    __dirname,
    "public"
  );

app.use(
  express.static(
    publicPath
  )
);

/*
=========================================================
 SPA FALLBACK
 Express 5 compatible.
=========================================================
*/

app.get(
  "/{*splat}",
  (req, res) => {
    if (
      req.path.startsWith(
        "/api/"
      ) ||
      req.path.startsWith(
        "/health"
      )
    ) {
      return res.status(404).json({
        ok: false,
        error:
          "Endpoint not found."
      });
    }

    res.sendFile(
      path.join(
        publicPath,
        "index.html"
      ),
      err => {
        if (err) {
          res.status(404).send(
            "Atharv AI"
          );
        }
      }
    );
  }
);

/*
=========================================================
 START
=========================================================
*/

async function startServer() {
  await initializeDatabase();

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        "================================================="
      );

      console.log(
        "ATHARV AI v16.0.0"
      );

      console.log(
        `Server running on port ${PORT}`
      );

      console.log(
        `Primary Model: ${PRIMARY_MODEL}`
      );

      console.log(
        `Fallback Model: ${FALLBACK_MODEL}`
      );

      console.log(
        "Smart Router: ENABLED"
      );

      console.log(
        "Compact Context: ENABLED"
      );

      console.log(
        "TPM Protection: ENABLED"
      );

      console.log(
        "Calculator: ENABLED"
      );

      console.log(
        "Weather: ENABLED"
      );

      console.log(
        `Live Web Research: ${
          TAVILY_API_KEY
            ? "ENABLED"
            : "OPTIONAL / DISABLED"
        }`
      );

      console.log(
        `Memory: ${
          pool
            ? "ENABLED"
            : "OPTIONAL / DISABLED"
        }`
      );

      console.log(
        "Streaming: ENABLED"
      );

      console.log(
        "Multilingual AI: ENABLED"
      );

      console.log(
        "================================================="
      );
    }
  );
}

startServer().catch(
  err => {
    console.error(
      "STARTUP ERROR:",
      err
    );

    process.exit(1);
  }
);

process.on(
  "unhandledRejection",
  err => {
    console.error(
      "UNHANDLED REJECTION:",
      err
    );
  }
);

process.on(
  "uncaughtException",
  err => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      err
    );
  }
);
