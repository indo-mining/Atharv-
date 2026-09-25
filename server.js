"use strict";

/*
=========================================================
 ATHARV AI SERVER
 Version 16.1.0
 --------------------------------------------------------
 FAST + LOW TOKEN + GROQ GPT-OSS

 FEATURES
 --------------------------------------------------------
 ✓ Groq GPT-OSS 120B
 ✓ GPT-OSS 20B fallback
 ✓ HARD 8K TPM REQUEST PROTECTION
 ✓ Direct calculator
 ✓ Smart intent router
 ✓ Hindi / Hinglish / English
 ✓ Multilingual
 ✓ Live research via Tavily (optional)
 ✓ News research
 ✓ Weather via Open-Meteo
 ✓ Study / Class 1-12 / Exams
 ✓ Coding / Debugging
 ✓ PostgreSQL memory (optional)
 ✓ Conversation history compression
 ✓ Streaming
 ✓ Error recovery
 ✓ Health monitoring
 ✓ Minimal environment variables
 ✓ Render compatible
 ✓ Express 5 compatible SPA fallback

 REQUIRED ENV
 --------------------------------------------------------
 GROQ_API_KEY

 OPTIONAL ENV
 --------------------------------------------------------
 DATABASE_URL
 TAVILY_API_KEY
 GROQ_MODEL
 GROQ_FALLBACK_MODEL
 PORT

=========================================================
*/

const express = require("express");
const cors = require("cors");
const path = require("path");

/*
=========================================================
 OPTIONAL POSTGRES
=========================================================
*/

let Pool = null;

try {
  Pool = require("pg").Pool;
} catch (err) {
  console.warn("pg package not available. Database disabled.");
}

/*
=========================================================
 APP
=========================================================
*/

const app = express();

const PORT = Number(process.env.PORT || 10000);

const GROQ_API_KEY =
  String(process.env.GROQ_API_KEY || "").trim();

const DATABASE_URL =
  String(process.env.DATABASE_URL || "").trim();

const TAVILY_API_KEY =
  String(process.env.TAVILY_API_KEY || "").trim();

/*
=========================================================
 MODELS
=========================================================
*/

const PRIMARY_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-120b";

const FALLBACK_MODEL =
  process.env.GROQ_FALLBACK_MODEL ||
  "openai/gpt-oss-20b";

/*
=========================================================
 TOKEN / CONTEXT LIMITS
=========================================================

 IMPORTANT:

 Groq account can return:
 Limit 8000 TPM

 Therefore we intentionally keep our own request
 significantly below 8000.

 The request token calculation includes:
 - system prompt
 - memory
 - history
 - research
 - user message
 - requested output

 We do NOT allow a normal request to approach 8000.
=========================================================
*/

const HARD_INPUT_CHARS = 14000;

const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CHARS = 5000;

const MAX_MEMORY_ITEMS = 4;
const MAX_MEMORY_CHARS = 2500;

const MAX_RESEARCH_CHARS = 4500;

const MAX_INPUT_ESTIMATED_TOKENS = 3200;

const SIMPLE_OUTPUT_TOKENS = 300;
const NORMAL_OUTPUT_TOKENS = 600;
const COMPLEX_OUTPUT_TOKENS = 900;

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

app.use(
  express.json({
    limit: "8mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "8mb"
  })
);

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
      console.error(
        "DATABASE POOL ERROR:",
        err.message
      );
    });

    console.log("PostgreSQL: ENABLED");
  } catch (err) {
    console.error(
      "DATABASE INIT ERROR:",
      err.message
    );

    pool = null;
  }
} else {
  console.log(
    "PostgreSQL: OPTIONAL / DISABLED"
  );
}

/*
=========================================================
 DATABASE INITIALIZATION
=========================================================
*/

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

    console.log(
      "Database initialized successfully."
    );
  } catch (err) {
    console.error(
      "DATABASE INIT ERROR:",
      err.message
    );
  }
}

/*
=========================================================
 SAFE HELPERS
=========================================================
*/

function cleanText(
  value,
  max = HARD_INPUT_CHARS
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
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

function isRetryableGroqError(error) {
  const message =
    String(error?.message || "");

  return (
    /Groq HTTP 429/i.test(message) ||
    /Groq HTTP 500/i.test(message) ||
    /Groq HTTP 502/i.test(message) ||
    /Groq HTTP 503/i.test(message) ||
    /Groq HTTP 504/i.test(message) ||
    /aborted/i.test(message) ||
    /timeout/i.test(message)
  );
}

function isTokenLimitError(error) {
  const message =
    String(error?.message || "");

  return (
    /HTTP 413/i.test(message) ||
    /Request too large/i.test(message) ||
    /TPM/i.test(message) ||
    /tokens per minute/i.test(message)
  );
}

/*
=========================================================
 LANGUAGE DETECTION
=========================================================
*/

function detectLanguage(text) {
  const t = String(text || "");

  const devanagari =
    (t.match(/[\u0900-\u097F]/g) || [])
      .length;

  const latin =
    (t.match(/[A-Za-z]/g) || [])
      .length;

  if (
    devanagari > 0 &&
    devanagari >= latin * 0.25
  ) {
    return "Hindi";
  }

  const lower =
    t.toLowerCase();

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
    "paisa",
    "bata",
    "samjhao",
    "samjha",
    "kyunki",
    "kaise",
    "kuch"
  ];

  let count = 0;

  for (
    const word of romanHindiWords
  ) {
    if (
      new RegExp(
        `\\b${word}\\b`,
        "i"
      ).test(lower)
    ) {
      count++;
    }
  }

  if (
    count >= 1 &&
    latin > 0
  ) {
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
  const t =
    String(text || "")
      .toLowerCase()
      .trim();

  if (!t) {
    return "general";
  }

  /*
  CALCULATOR
  */

  const calculatorPattern =
    /^[\d\s()+\-*/%.^=]+$/;

  if (
    calculatorPattern.test(t) ||
    /^(what is|calculate|solve)\s+[\d\s()+\-*/%.^=]+$/i.test(t) ||
    /^(2\s*\+\s*2|10\s*\*\s*10)/i.test(t) ||
    /^(what is|calculate|solve).*(\+|\-|\*|\/|%|\^)/i.test(t) ||
    /\b(kitna hota hai|kitna hai)\b.*[\d]+.*[\+\-\*\/%]/i.test(t)
  ) {
    return "calculator";
  }

  /*
  WEATHER
  */

  if (
    /\b(weather|temperature|forecast|rain|baarish|barish|mausam)\b/i.test(t) ||
    /मौसम|तापमान|बारिश|बरसात/i.test(t)
  ) {
    return "weather";
  }

  /*
  NEWS
  */

  if (
    /\b(today news|latest news|breaking news|news today|aaj ki news|taaza khabar|latest update|recent news|news)\b/i.test(t)
  ) {
    return "news";
  }

  /*
  LIVE
  */

  if (
    /\b(today|tonight|now|currently|latest|recent|live|current|aaj|abhi|filhaal)\b/i.test(t) ||
    /आज|अभी|ताज़ा|वर्तमान/i.test(t)
  ) {
    return "live";
  }

  /*
  PROGRAMMING
  */

  if (
    /\b(code|coding|programming|javascript|typescript|python|java|c\+\+|html|css|react|node|nodejs|sql|api|bug|debug|error|exception|function|class|variable|npm|github|json|regex)\b/i.test(t)
  ) {
    return "coding";
  }

  /*
  STUDY / EXAMS
  */

  if (
    /\b(class\s*[1-9]|class\s*10|class\s*11|class\s*12|cbse|icse|upsc|ssc|banking|railway|neet|jee|pyq|previous year|mcq|mock test|exam|homework|chapter|question paper|revision|flashcard|syllabus)\b/i.test(t)
  ) {
    return "study";
  }

  /*
  RESEARCH
  */

  if (
    /\b(search|research|find|source|sources|reference|official website|official source|look up|lookup|verify|verification)\b/i.test(t)
  ) {
    return "research";
  }

  return "general";
}

/*
=========================================================
 CALCULATOR
=========================================================
*/

function calculateExpression(input) {
  let expression =
    String(input || "")
      .toLowerCase()
      .replace(/what is/g, "")
      .replace(/calculate/g, "")
      .replace(/solve/g, "")
      .replace(/kitna hota hai/g, "")
      .replace(/kitna hai/g, "")
      .replace(/hota hai/g, "")
      .replace(/hai/g, "")
      .replace(/=/g, "")
      .trim();

  if (
    !/^[0-9+\-*/().%\s^]+$/.test(
      expression
    )
  ) {
    return null;
  }

  try {
    /*
    Protect against extremely long arithmetic.
    */

    if (
      expression.length > 300
    ) {
      return null;
    }

    expression =
      expression.replace(
        /\^/g,
        "**"
      );

    const result =
      Function(
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
=========================================================
*/

async function getMemories(
  userId
) {
  if (
    !pool ||
    !userId ||
    userId === "anonymous"
  ) {
    return [];
  }

  try {
    const result =
      await pool.query(
        `
        SELECT memory
        FROM user_memories
        WHERE user_id = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT $2
        `,
        [
          String(userId),
          MAX_MEMORY_ITEMS
        ]
      );

    return result.rows
      .map(row =>
        cleanText(
          row.memory,
          700
        )
      )
      .filter(Boolean);
  } catch (err) {
    console.error(
      "MEMORY READ ERROR:",
      err.message
    );

    return [];
  }
}

async function saveMemory(
  userId,
  memory
) {
  if (
    !pool ||
    !userId ||
    userId === "anonymous"
  ) {
    return false;
  }

  const value =
    cleanText(
      memory,
      1000
    );

  if (!value) {
    return false;
  }

  try {
    await pool.query(
      `
      INSERT INTO user_memories
      (user_id, memory)
      VALUES ($1, $2)
      `,
      [
        String(userId),
        value
      ]
    );

    return true;
  } catch (err) {
    console.error(
      "MEMORY SAVE ERROR:",
      err.message
    );

    return false;
  }
}

/*
=========================================================
 HISTORY COMPRESSION
=========================================================
*/

function compressHistory(
  history
) {
  if (
    !Array.isArray(history)
  ) {
    return [];
  }

  const result = [];

  let totalChars = 0;

  for (
    let i = history.length - 1;
    i >= 0;
    i--
  ) {
    const item =
      history[i];

    if (!item) {
      continue;
    }

    const role =
      item.role === "assistant"
        ? "assistant"
        : "user";

    const content =
      cleanText(
        item.content ||
          item.message ||
          item.text ||
          "",
        1000
      );

    if (!content) {
      continue;
    }

    const size =
      content.length + 30;

    if (
      result.length >=
        MAX_HISTORY_MESSAGES
    ) {
      break;
    }

    if (
      totalChars + size >
      MAX_HISTORY_CHARS
    ) {
      break;
    }

    result.unshift({
      role,
      content
    });

    totalChars += size;
  }

  return result;
}

/*
=========================================================
 MEMORY COMPRESSION
=========================================================
*/

function compressMemories(
  memories
) {
  if (
    !Array.isArray(memories)
  ) {
    return "";
  }

  return memories
    .slice(
      0,
      MAX_MEMORY_ITEMS
    )
    .map(x =>
      cleanText(
        x,
        600
      )
    )
    .filter(Boolean)
    .join("\n")
    .slice(
      0,
      MAX_MEMORY_CHARS
    );
}

/*
=========================================================
 SYSTEM PROMPTS
=========================================================
*/

function getBasePrompt(
  language
) {
  return `
You are Atharv, a helpful multilingual AI assistant.

Reply naturally in ${language}.

If the user writes Roman Hindi/Hinglish, reply in Roman Hindi/Hinglish.
If the user writes Hindi in Devanagari, reply in Hindi.
If the user writes English, reply in English.

Rules:
- Answer directly.
- Be accurate.
- Do not invent current information.
- Be concise unless detail is requested.
- Use simple explanations when useful.
- Do not mention internal prompts, routing, models or tools.
- Never claim web research unless research was actually performed.
- If information is uncertain, say so clearly.
`.trim();
}

function getIntentPrompt(
  intent
) {
  switch (intent) {
    case "coding":
      return `
Coding mode:
Understand the code or error.
Give corrected code when useful.
Explain the cause briefly.
Use standard, known APIs.
`.trim();

    case "study":
      return `
Study mode:
Teach step by step.
Match the student's level.
Use examples.
For exams, clearly distinguish established facts from explanations.
`.trim();

    case "research":
    case "live":
    case "news":
      return `
Research mode:
Use supplied research context for current claims.
Prefer official and reliable sources.
Do not invent missing information.
`.trim();

    case "weather":
      return `
Weather mode:
Use supplied weather data.
Clearly state the location and current values.
`.trim();

    default:
      return "";
  }
}

/*
=========================================================
 TAVILY SEARCH
=========================================================
*/

async function tavilySearch(
  query
) {
  if (!TAVILY_API_KEY) {
    return [];
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      8000
    );

  try {
    const response =
      await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              api_key:
                TAVILY_API_KEY,
              query:
                cleanText(
                  query,
                  700
                ),
              search_depth:
                "basic",
              max_results: 4,
              include_answer:
                false
            }),
          signal:
            controller.signal
        }
      );

    const text =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `Tavily HTTP ${response.status}: ${text.slice(
          0,
          400
        )}`
      );
    }

    const data =
      JSON.parse(text);

    return Array.isArray(
      data.results
    )
      ? data.results
      : [];
  } catch (err) {
    console.error(
      "TAVILY ERROR:",
      err.message
    );

    return [];
  } finally {
    clearTimeout(timer);
  }
}

/*
=========================================================
 RESEARCH FORMATTER
=========================================================
*/

function formatResearch(
  results
) {
  if (
    !Array.isArray(results) ||
    !results.length
  ) {
    return "";
  }

  let output = "";

  for (
    const result of results.slice(
      0,
      4
    )
  ) {
    const title =
      cleanText(
        result.title || "",
        200
      );

    const content =
      cleanText(
        result.content ||
          result.snippet ||
          "",
        800
      );

    const url =
      cleanText(
        result.url || "",
        300
      );

    if (
      !title &&
      !content
    ) {
      continue;
    }

    output +=
      `SOURCE: ${title}\n` +
      `INFO: ${content}\n` +
      `URL: ${url}\n\n`;
  }

  return output.slice(
    0,
    MAX_RESEARCH_CHARS
  );
}

/*
=========================================================
 WEATHER
=========================================================
*/

async function getWeather(
  city
) {
  const place =
    cleanText(
      city || "Delhi",
      100
    );

  const geoResponse =
    await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        place
      )}&count=1&language=en&format=json`
    );

  if (
    !geoResponse.ok
  ) {
    throw new Error(
      "Weather location lookup failed."
    );
  }

  const geo =
    await geoResponse.json();

  if (
    !geo.results ||
    !geo.results.length
  ) {
    throw new Error(
      `Weather location not found for ${place}.`
    );
  }

  const location =
    geo.results[0];

  const weatherResponse =
    await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`
    );

  if (
    !weatherResponse.ok
  ) {
    throw new Error(
      "Weather API failed."
    );
  }

  const weather =
    await weatherResponse.json();

  return {
    city:
      location.name ||
      place,

    country:
      location.country || "",

    temperature:
      weather.current
        ?.temperature_2m,

    feels_like:
      weather.current
        ?.apparent_temperature,

    humidity:
      weather.current
        ?.relative_humidity_2m,

    precipitation:
      weather.current
        ?.precipitation,

    wind:
      weather.current
        ?.wind_speed_10m,

    weather_code:
      weather.current
        ?.weather_code,

    timezone:
      weather.timezone
  };
}

/*
=========================================================
 CITY EXTRACTION
=========================================================
*/

function extractWeatherCity(
  message
) {
  const text =
    String(message || "")
      .trim();

  const patterns = [
    /weather\s+(?:in|of|for)\s+(.+)/i,
    /temperature\s+(?:in|of|for)\s+(.+)/i,
    /forecast\s+(?:in|of|for)\s+(.+)/i,
    /mausam\s+(.+)/i,
    /मौसम\s+(.+)/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      text.match(pattern);

    if (
      match &&
      match[1]
    ) {
      return cleanText(
        match[1],
        80
      )
        .replace(/[?.!]+$/g, "")
        .trim();
    }
  }

  return "Delhi";
}

/*
=========================================================
 GROQ REQUEST
=========================================================
*/

async function callGroq(
  model,
  messages,
  options = {}
) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is missing in Render Environment Variables."
    );
  }

  const stream =
    Boolean(
      options.stream
    );

  let maxTokens =
    Number(
      options.max_completion_tokens ||
        NORMAL_OUTPUT_TOKENS
    );

  /*
  HARD OUTPUT CAP
  */

  maxTokens =
    Math.max(
      100,
      Math.min(
        maxTokens,
        COMPLEX_OUTPUT_TOKENS
      )
    );

  /*
  FINAL TOKEN SAFETY
  */

  const estimatedInput =
    estimateTokens(
      messages
    );

  /*
  We intentionally keep total request
  far below 8000.

  If input is already large,
  reduce output automatically.
  */

  if (
    estimatedInput > 2800
  ) {
    maxTokens =
      Math.min(
        maxTokens,
        450
      );
  }

  if (
    estimatedInput > 3100
  ) {
    maxTokens =
      Math.min(
        maxTokens,
        300
      );
  }

  const payload = {
    model,
    messages,

    temperature:
      typeof options.temperature ===
      "number"
        ? options.temperature
        : 0.2,

    max_completion_tokens:
      maxTokens,

    stream,

    include_reasoning:
      false
  };

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      35000
    );

  try {
    const response =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${GROQ_API_KEY}`,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            controller.signal
        }
      );

    if (
      !response.ok
    ) {
      const errorText =
        await response.text();

      throw new Error(
        `Groq HTTP ${response.status}: ${errorText.slice(
          0,
          1200
        )}`
      );
    }

    if (stream) {
      return response;
    }

    const data =
      await response.json();

    const answer =
      data?.choices?.[0]
        ?.message?.content;

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
 TOKEN ESTIMATION
=========================================================
*/

function estimateTokens(
  messages
) {
  let chars = 0;

  for (
    const message of messages
  ) {
    chars += String(
      message?.content || ""
    ).length;
  }

  /*
  Conservative estimate.
  */

  return Math.ceil(
    chars / 4
  );
}

/*
=========================================================
 HARD CONTEXT TRIMMER
=========================================================
*/

function trimMessagesForBudget(
  messages
) {
  let result =
    Array.isArray(messages)
      ? [...messages]
      : [];

  /*
  Preserve:
  - first system prompt
  - final user message

  Remove old context before removing
  the essential prompt.
  */

  while (
    estimateTokens(result) >
      MAX_INPUT_ESTIMATED_TOKENS &&
    result.length > 2
  ) {
    /*
    Find the oldest non-system
    message after the first item.
    */

    let removeIndex = -1;

    for (
      let i = 1;
      i < result.length - 1;
      i++
    ) {
      if (
        result[i]?.role !==
        "system"
      ) {
        removeIndex = i;
        break;
      }
    }

    /*
    If no conversational message
    exists, remove secondary system
    context.
    */

    if (
      removeIndex === -1
    ) {
      removeIndex = 1;
    }

    result.splice(
      removeIndex,
      1
    );
  }

  /*
  If still too large,
  aggressively shorten every
  context item except final user.
  */

  if (
    estimateTokens(result) >
    MAX_INPUT_ESTIMATED_TOKENS
  ) {
    for (
      let i = 0;
      i < result.length - 1;
      i++
    ) {
      if (
        result[i]?.content
      ) {
        result[i].content =
          String(
            result[i].content
          ).slice(
            0,
            700
          );
      }
    }
  }

  /*
  Last safety:
  final user message itself.
  */

  if (
    result.length
  ) {
    const last =
      result[result.length - 1];

    if (
      last.role === "user"
    ) {
      last.content =
        cleanText(
          last.content,
          6000
        );
    }
  }

  /*
  If somehow still above limit,
  preserve only the first system
  + final user.
  */

  if (
    estimateTokens(result) >
    MAX_INPUT_ESTIMATED_TOKENS
  ) {
    const firstSystem =
      result.find(
        x =>
          x.role ===
          "system"
      );

    const lastUser =
      [...result]
        .reverse()
        .find(
          x =>
            x.role ===
            "user"
        );

    result = [];

    if (firstSystem) {
      result.push({
        role: "system",
        content:
          String(
            firstSystem.content ||
              ""
          ).slice(
            0,
            900
          )
      });
    }

    if (lastUser) {
      result.push({
        role: "user",
        content:
          cleanText(
            lastUser.content,
            5000
          )
      });
    }
  }

  return result;
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
  intent,
  research,
  weather
}) {
  const language =
    detectLanguage(
      message
    );

  const memories =
    await getMemories(
      userId
    );

  const compactHistory =
    compressHistory(
      history
    );

  const memoryText =
    compressMemories(
      memories
    );

  const messages = [];

  /*
  BASE
  */

  messages.push({
    role: "system",
    content:
      getBasePrompt(
        language
      )
  });

  /*
  INTENT
  */

  const intentPrompt =
    getIntentPrompt(
      intent
    );

  if (
    intentPrompt
  ) {
    messages.push({
      role: "system",
      content:
        intentPrompt
    });
  }

  /*
  MEMORY
  */

  if (
    memoryText &&
    intent !== "calculator"
  ) {
    messages.push({
      role: "system",
      content:
        `Relevant user memory:\n${memoryText}`
    });
  }

  /*
  RESEARCH
  */

  if (
    research
  ) {
    messages.push({
      role: "system",
      content:
        `Verified research context:\n${cleanText(
          research,
          MAX_RESEARCH_CHARS
        )}`
    });
  }

  /*
  WEATHER
  */

  if (
    weather
  ) {
    messages.push({
      role: "system",
      content:
        `Current weather data:\n${safeWeatherText(
          weather
        )}`
    });
  }

  /*
  HISTORY
  */

  for (
    const item of compactHistory
  ) {
    messages.push(item);
  }

  /*
  USER
  */

  messages.push({
    role: "user",
    content:
      cleanText(
        message,
        HARD_INPUT_CHARS
      )
  });

  return trimMessagesForBudget(
    messages
  );
}

/*
=========================================================
 WEATHER TEXT
=========================================================
*/

function safeWeatherText(
  weather
) {
  try {
    return JSON.stringify(
      weather
    ).slice(
      0,
      1800
    );
  } catch {
    return "";
  }
}

/*
=========================================================
 RESPONSE CLEANER
=========================================================
*/

function cleanResponse(
  text
) {
  if (!text) {
    return "";
  }

  let output =
    String(text)
      .replace(
        /\r\n/g,
        "\n"
      )
      .trim();

  output =
    output.replace(
      /^(assistant|atharv)\s*:\s*/i,
      ""
    );

  output =
    output.replace(
      /\n{4,}/g,
      "\n\n\n"
    );

  return output.trim();
}

/*
=========================================================
 DIRECT CALCULATOR RESPONSE
=========================================================
*/

function directCalculator(
  message
) {
  const result =
    calculateExpression(
      message
    );

  if (
    result === null
  ) {
    return null;
  }

  const language =
    detectLanguage(
      message
    );

  if (
    language ===
    "Roman Hindi / Hinglish"
  ) {
    return `${result}`;
  }

  if (
    language ===
    "Hindi"
  ) {
    return `${result}`;
  }

  return `${result}`;
}

/*
=========================================================
 SIMPLE RESPONSE CLASSIFICATION
=========================================================
*/

function getOutputTokens(
  intent,
  message
) {
  const length =
    String(message || "")
      .length;

  if (
    intent ===
      "calculator" ||
    length < 80
  ) {
    return SIMPLE_OUTPUT_TOKENS;
  }

  if (
    intent === "coding" ||
    intent === "study" ||
    intent === "research" ||
    intent === "live" ||
    intent === "news"
  ) {
    return COMPLEX_OUTPUT_TOKENS;
  }

  return NORMAL_OUTPUT_TOKENS;
}

/*
=========================================================
 GENERATE ATHARV RESPONSE
=========================================================
*/

async function generateAtharvResponse({
  userId,
  message,
  history,
  intent
}) {
  /*
  ===============================================
  DIRECT CALCULATOR
  ===============================================
  */

  if (
    intent ===
    "calculator"
  ) {
    const answer =
      directCalculator(
        message
      );

    if (
      answer !== null
    ) {
      return {
        answer,
        source:
          "calculator",
        intent
      };
    }
  }

  /*
  ===============================================
  WEATHER
  ===============================================
  */

  let weather = null;

  if (
    intent === "weather"
  ) {
    try {
      const city =
        extractWeatherCity(
          message
        );

      weather =
        await getWeather(
          city
        );
    } catch (err) {
      console.error(
        "WEATHER ERROR:",
        err.message
      );
    }
  }

  /*
  ===============================================
  LIVE / NEWS / RESEARCH
  ===============================================
  */

  let research = "";

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

    research =
      formatResearch(
        results
      );
  }

  /*
  ===============================================
  BUILD
  ===============================================
  */

  let messages =
    await buildMessages({
      userId,
      message,
      history,
      intent,
      research,
      weather
    });

  /*
  ===============================================
  FINAL INPUT SAFETY
  ===============================================
  */

  messages =
    trimMessagesForBudget(
      messages
    );

  const outputTokens =
    getOutputTokens(
      intent,
      message
    );

  /*
  ===============================================
  PRIMARY MODEL
  ===============================================
  */

  try {
    const answer =
      await callGroq(
        PRIMARY_MODEL,
        messages,
        {
          max_completion_tokens:
            outputTokens
        }
      );

    return {
      answer:
        cleanResponse(
          answer
        ),

      source:
        research
          ? "web+groq"
          : weather
          ? "weather+groq"
          : "groq",

      intent
    };
  } catch (primaryError) {
    console.error(
      "PRIMARY GROQ ERROR:",
      primaryError.message
    );

    /*
    =============================================
    IF 413 / TOKEN LIMIT:
    DO NOT SEND SAME REQUEST AGAIN.
    Shrink it first.
    =============================================
    */

    if (
      isTokenLimitError(
        primaryError
      )
    ) {
      messages =
        makeEmergencyCompactMessages(
          message,
          intent
        );

      try {
        const answer =
          await callGroq(
            FALLBACK_MODEL,
            messages,
            {
              max_completion_tokens:
                250
            }
          );

        return {
          answer:
            cleanResponse(
              answer
            ),

          source:
            "fallback-compact",

          intent
        };
      } catch (compactError) {
        console.error(
          "COMPACT FALLBACK ERROR:",
          compactError.message
        );

        throw compactError;
      }
    }

    /*
    =============================================
    FALLBACK ONLY FOR RETRYABLE ERRORS
    =============================================
    */

    if (
      isRetryableGroqError(
        primaryError
      )
    ) {
      try {
        const answer =
          await callGroq(
            FALLBACK_MODEL,
            messages,
            {
              max_completion_tokens:
                Math.min(
                  outputTokens,
                  500
                )
            }
          );

        return {
          answer:
            cleanResponse(
              answer
            ),

          source:
            "fallback",

          intent
        };
      } catch (fallbackError) {
        console.error(
          "FALLBACK GROQ ERROR:",
          fallbackError.message
        );

        throw fallbackError;
      }
    }

    throw primaryError;
  }
}

/*
=========================================================
 EMERGENCY COMPACT REQUEST
=========================================================
*/

function makeEmergencyCompactMessages(
  message,
  intent
) {
  const language =
    detectLanguage(
      message
    );

  const base =
    getBasePrompt(
      language
    );

  const intentPrompt =
    getIntentPrompt(
      intent
    );

  const systemParts =
    [base];

  if (
    intentPrompt
  ) {
    systemParts.push(
      intentPrompt
    );
  }

  return [
    {
      role: "system",
      content:
        systemParts.join(
          "\n"
        ).slice(
          0,
          1200
        )
    },

    {
      role: "user",
      content:
        cleanText(
          message,
          5000
        )
    }
  ];
}

/*
=========================================================
 MEMORY EXTRACTION
=========================================================
*/

function detectMemoryRequest(
  message
) {
  const text =
    String(message || "")
      .trim();

  if (!text) {
    return null;
  }

  /*
  Examples:
  remember my name is Rajiv
  remember that I like Python
  mera naam Rajiv hai
  */

  const patterns = [
    /remember\s+(?:that\s+)?(.+)/i,

    /please\s+remember\s+(.+)/i,

    /save\s+(?:this|that)\s+(.+)/i,

    /mera naam\s+(.+?)\s+hai/i,

    /my name is\s+(.+)/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (
      match &&
      match[1]
    ) {
      const value =
        cleanText(
          match[1],
          700
        );

      if (
        value.length >= 2
      ) {
        return value;
      }
    }
  }

  return null;
}

/*
=========================================================
 API: CHAT
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
            "",
          HARD_INPUT_CHARS
        );

      const history =
        req.body?.history;

      const userId =
        getUserId(req);

      if (!message) {
        return res.status(400).json({
          ok: false,
          error:
            "Message is required."
        });
      }

      const intent =
        detectIntent(
          message
        );

      /*
      ==========================================
      DIRECT CALCULATOR
      ==========================================
      */

      if (
        intent ===
        "calculator"
      ) {
        const direct =
          directCalculator(
            message
          );

        if (
          direct !== null
        ) {
          return res.json({
            ok: true,
            answer: direct,
            response: direct,
            message: direct,
            source:
              "calculator",
            intent
          });
        }
      }

      /*
      ==========================================
      MEMORY SAVE
      ==========================================
      */

      const memory =
        detectMemoryRequest(
          message
        );

      if (
        memory &&
        userId !==
          "anonymous"
      ) {
        await saveMemory(
          userId,
          memory
        );
      }

      /*
      ==========================================
      AI
      ==========================================
      */

      const result =
        await generateAtharvResponse({
          userId,
          message,
          history,
          intent
        });

      const answer =
        cleanResponse(
          result.answer
        );

      return res.json({
        ok: true,

        answer,

        response: answer,

        message: answer,

        source:
          result.source,

        intent:
          result.intent
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
 API: STREAM
=========================================================
*/

app.post(
  "/api/chat/stream",
  async (req, res) => {
    /*
    SSE HEADERS
    */

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

    const send = data => {
      res.write(
        `data: ${JSON.stringify(
          data
        )}\n\n`
      );
    };

    try {
      const message =
        cleanText(
          req.body?.message ||
            req.body?.prompt ||
            "",
          HARD_INPUT_CHARS
        );

      const history =
        req.body?.history;

      const userId =
        getUserId(req);

      if (!message) {
        send({
          type: "error",
          error:
            "Message is required."
        });

        res.end();
        return;
      }

      const intent =
        detectIntent(
          message
        );

      /*
      ==========================================
      DIRECT CALCULATOR
      ==========================================
      */

      if (
        intent ===
        "calculator"
      ) {
        const direct =
          directCalculator(
            message
          );

        if (
          direct !== null
        ) {
          send({
            type:
              "delta",
            content:
              direct
          });

          send({
            type:
              "done",
            source:
              "calculator",
            intent
          });

          res.end();
          return;
        }
      }

      /*
      ==========================================
      MEMORY
      ==========================================
      */

      const memory =
        detectMemoryRequest(
          message
        );

      if (
        memory &&
        userId !==
          "anonymous"
      ) {
        await saveMemory(
          userId,
          memory
        );
      }

      /*
      ==========================================
      WEATHER
      ==========================================
      */

      let weather = null;

      if (
        intent ===
        "weather"
      ) {
        try {
          const city =
            extractWeatherCity(
              message
            );

          weather =
            await getWeather(
              city
            );
        } catch (err) {
          console.error(
            "STREAM WEATHER ERROR:",
            err.message
          );
        }
      }

      /*
      ==========================================
      RESEARCH
      ==========================================
      */

      let research = "";

      if (
        (
          intent ===
            "live" ||
          intent ===
            "news" ||
          intent ===
            "research"
        ) &&
        TAVILY_API_KEY
      ) {
        const results =
          await tavilySearch(
            message
          );

        research =
          formatResearch(
            results
          );
      }

      let messages =
        await buildMessages({
          userId,
          message,
          history,
          intent,
          research,
          weather
        });

      messages =
        trimMessagesForBudget(
          messages
        );

      /*
      ==========================================
      GROQ STREAM
      ==========================================
      */

      let response;

      try {
        response =
          await callGroq(
            PRIMARY_MODEL,
            messages,
            {
              stream: true,

              max_completion_tokens:
                getOutputTokens(
                  intent,
                  message
                )
            }
          );
      } catch (primaryError) {
        console.error(
          "STREAM PRIMARY ERROR:",
          primaryError.message
        );

        /*
        Compact retry for 413.
        */

        if (
          isTokenLimitError(
            primaryError
          )
        ) {
          messages =
            makeEmergencyCompactMessages(
              message,
              intent
            );

          response =
            await callGroq(
              FALLBACK_MODEL,
              messages,
              {
                stream: true,
                max_completion_tokens:
                  250
              }
            );
        } else if (
          isRetryableGroqError(
            primaryError
          )
        ) {
          response =
            await callGroq(
              FALLBACK_MODEL,
              messages,
              {
                stream: true,
                max_completion_tokens:
                  500
              }
            );
        } else {
          throw primaryError;
        }
      }

      /*
      ==========================================
      READ SSE
      ==========================================
      */

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const {
          done,
          value
        } =
          await reader.read();

        if (done) {
          break;
        }

        buffer +=
          decoder.decode(
            value,
            {
              stream: true
            }
          );

        const lines =
          buffer.split(
            "\n"
          );

        buffer =
          lines.pop() || "";

        for (
          const line of lines
        ) {
          const trimmed =
            line.trim();

          if (
            !trimmed ||
            !trimmed.startsWith(
              "data:"
            )
          ) {
            continue;
          }

          const payload =
            trimmed
              .slice(5)
              .trim();

          if (
            payload ===
            "[DONE]"
          ) {
            continue;
          }

          try {
            const parsed =
              JSON.parse(
                payload
              );

            const delta =
              parsed?.choices?.[0]
                ?.delta
                ?.content;

            if (delta) {
              send({
                type:
                  "delta",
                content:
                  delta
              });
            }
          } catch {
            /*
            Ignore malformed
            partial SSE chunks.
            */
          }
        }
      }

      send({
        type:
          "done",
        intent
      });

      res.end();
    } catch (err) {
      console.error(
        "STREAM ERROR:",
        err
      );

      send({
        type:
          "error",
        error:
          "Atharv could not generate a response.",
        details:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : err.message
      });

      res.end();
    }
  }
);

/*
=========================================================
 API: MEMORY GET
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

      return res.json({
        ok: true,
        memories
      });
    } catch (err) {
      console.error(
        "MEMORY API ERROR:",
        err.message
      );

      return res.json({
        ok: true,
        memories: []
      });
    }
  }
);

/*
=========================================================
 API: MEMORY SAVE
=========================================================
*/

app.post(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memory =
        cleanText(
          req.body?.memory ||
            "",
          1000
        );

      if (!memory) {
        return res.status(400).json({
          ok: false,
          error:
            "Memory is required."
        });
      }

      if (
        userId ===
        "anonymous"
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "User ID is required for memory."
        });
      }

      const saved =
        await saveMemory(
          userId,
          memory
        );

      return res.json({
        ok: saved
      });
    } catch (err) {
      console.error(
        "MEMORY SAVE API ERROR:",
        err.message
      );

      return res.status(500).json({
        ok: false,
        error:
          "Memory could not be saved."
      });
    }
  }
);

/*
=========================================================
 API: SEARCH
=========================================================
*/

app.get(
  "/api/search",
  async (req, res) => {
    try {
      const query =
        cleanText(
          req.query?.q ||
            req.query?.query ||
            "",
          700
        );

      if (!query) {
        return res.status(400).json({
          ok: false,
          error:
            "Search query is required."
        });
      }

      if (
        !TAVILY_API_KEY
      ) {
        return res.json({
          ok: true,
          results: [],
          message:
            "TAVILY_API_KEY is not configured."
        });
      }

      const results =
        await tavilySearch(
          query
        );

      return res.json({
        ok: true,
        results
      });
    } catch (err) {
      console.error(
        "SEARCH API ERROR:",
        err.message
      );

      return res.status(500).json({
        ok: false,
        error:
          "Search failed."
      });
    }
  }
);

/*
=========================================================
 API: WEATHER
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

      return res.json({
        ok: true,
        weather
      });
    } catch (err) {
      console.error(
        "WEATHER API ERROR:",
        err.message
      );

      return res.status(500).json({
        ok: false,
        error:
          err.message
      });
    }
  }
);

/*
=========================================================
 API: VERSION
=========================================================
*/

app.get(
  "/api/version",
  (req, res) => {
    res.json({
      ok: true,

      app:
        "Atharv AI",

      version:
        "16.1.0",

      primary_model:
        PRIMARY_MODEL,

      fallback_model:
        FALLBACK_MODEL,

      features: [
        "groq",
        "gpt-oss",
        "token-protection",
        "calculator",
        "smart-router",
        "multilingual",
        "tavily",
        "weather",
        "study",
        "coding",
        "memory",
        "streaming",
        "fallback"
      ]
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
  (req, res) => {
    res.json({
      ok: true,

      service:
        "Atharv AI",

      version:
        "16.1.0",

      uptime:
        Math.round(
          process.uptime()
        ),

      groq:
        Boolean(
          GROQ_API_KEY
        ),

      database:
        Boolean(pool),

      tavily:
        Boolean(
          TAVILY_API_KEY
        ),

      primary_model:
        PRIMARY_MODEL,

      fallback_model:
        FALLBACK_MODEL
    });
  }
);

/*
=========================================================
 HEALTH DEPENDENCIES
=========================================================
*/

app.get(
  "/health/dependencies",
  async (req, res) => {
    const result = {
      ok: true,

      groq:
        Boolean(
          GROQ_API_KEY
        ),

      database:
        Boolean(pool),

      tavily:
        Boolean(
          TAVILY_API_KEY
        ),

      weather:
        true
    };

    /*
    DATABASE TEST
    */

    if (pool) {
      try {
        await pool.query(
          "SELECT 1"
        );

        result.database_status =
          "healthy";
      } catch (err) {
        result.database_status =
          "error";
      }
    } else {
      result.database_status =
        "disabled";
    }

    /*
    GROQ KEY
    */

    result.groq_status =
      GROQ_API_KEY
        ? "configured"
        : "missing";

    /*
    TAVILY
    */

    result.tavily_status =
      TAVILY_API_KEY
        ? "configured"
        : "optional-disabled";

    res.json(
      result
    );
  }
);

/*
=========================================================
 ROOT
=========================================================
*/

app.get(
  "/",
  (req, res) => {
    res.json({
      ok: true,
      service:
        "Atharv AI",
      version:
        "16.1.0",
      message:
        "Atharv AI server is running."
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
 EXPRESS 5 SPA FALLBACK
=========================================================

 IMPORTANT:
 Express 5 does NOT accept:
 app.get("*")

 Use:
 /{*splat}
=========================================================
*/

app.get(
  "/{*splat}",
  (req, res, next) => {
    if (
      req.path.startsWith(
        "/api/"
      ) ||
      req.path.startsWith(
        "/health"
      )
    ) {
      return next();
    }

    const indexFile =
      path.join(
        publicPath,
        "index.html"
      );

    res.sendFile(
      indexFile,
      err => {
        if (err) {
          next();
        }
      }
    );
  }
);

/*
=========================================================
 404
=========================================================
*/

app.use(
  (req, res) => {
    res.status(404).json({
      ok: false,
      error:
        "Route not found."
    });
  }
);

/*
=========================================================
 GLOBAL ERROR HANDLER
=========================================================
*/

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "GLOBAL ERROR:",
      err
    );

    if (
      res.headersSent
    ) {
      return next(err);
    }

    res.status(500).json({
      ok: false,
      error:
        "Internal server error."
    });
  }
);

/*
=========================================================
 START SERVER
=========================================================
*/

async function startServer() {
  await initializeDatabase();

  app.listen(
    PORT,
    () => {
      console.log(
        "================================================="
      );

      console.log(
        " ATHARV AI SERVER"
      );

      console.log(
        " Version: 16.1.0"
      );

      console.log(
        ` Port: ${PORT}`
      );

      console.log(
        ` Primary Model: ${PRIMARY_MODEL}`
      );

      console.log(
        ` Fallback Model: ${FALLBACK_MODEL}`
      );

      console.log(
        ` Groq: ${
          GROQ_API_KEY
            ? "CONFIGURED"
            : "MISSING"
        }`
      );

      console.log(
        ` PostgreSQL: ${
          pool
            ? "ENABLED"
            : "DISABLED"
        }`
      );

      console.log(
        ` Tavily: ${
          TAVILY_API_KEY
            ? "ENABLED"
            : "DISABLED"
        }`
      );

      console.log(
        " Token Protection: ENABLED"
      );

      console.log(
        " Direct Calculator: ENABLED"
      );

      console.log(
        " Streaming: ENABLED"
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
      "SERVER START ERROR:",
      err
    );

    process.exit(1);
  }
);
