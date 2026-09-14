require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// =====================================================
// ATHARV AI
// Language Intelligence 1.0
// Memory 2.0
// Tavily Live Search
// Groq AI
// =====================================================

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

const DEFAULT_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// =====================================================
// BASIC ATHARV INSTRUCTIONS
// =====================================================

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

Identity:
- Your name is Atharv.
- You are a helpful, intelligent, respectful and practical AI assistant.
- Your goal is not only to answer questions, but to help the user complete their task.

Core behavior:
1. Understand the user's actual intent before answering.
2. Give useful answers directly.
3. Avoid unnecessary clarification questions.
4. Never pretend to know something you do not know.
5. For current/live information, use the supplied web-search context when available.
6. Never invent live news, prices, statistics, sources or events.
7. Keep answers natural and easy to understand.
8. If the user asks for a step-by-step solution, give clear numbered steps.
9. If the user asks for code, provide complete working code whenever practical.
10. Protect private information such as passwords, OTPs, API keys, tokens and card details.

Conversation:
- Remember useful user preferences and facts when they are explicitly provided.
- Use available memory naturally.
- Do not repeatedly ask for information that is already known.
- If the user corrects something, follow the latest information.
`;

// =====================================================
// TEXT HELPERS
// =====================================================

function limitText(value, max = 12000) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max) : text;
}

function safeString(value) {
  return String(value || "").trim();
}

// =====================================================
// USER ID
// =====================================================

function getUserId(req) {
  const supplied =
    req.body?.userId ||
    req.query?.userId ||
    req.headers["x-atharv-user-id"];

  if (supplied) {
    return crypto
      .createHash("sha256")
      .update(String(supplied))
      .digest("hex");
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  return crypto
    .createHash("sha256")
    .update(String(ip))
    .digest("hex");
}

// =====================================================
// USER DATE / TIME
// =====================================================

function getUserDateTime(req) {
  const timeZone =
    req.body?.timeZone ||
    req.headers["x-time-zone"] ||
    "UTC";

  let now;

  try {
    now = new Intl.DateTimeFormat("en-US", {
      timeZone,
      dateStyle: "full",
      timeStyle: "long"
    }).format(new Date());
  } catch {
    now = new Date().toISOString();
  }

  return {
    timeZone,
    now
  };
}

// =====================================================
// LANGUAGE INTELLIGENCE 1.0
// =====================================================

function countMatches(text, regex) {
  return (String(text || "").match(regex) || []).length;
}

function detectLanguageProfile(text) {
  const value = String(text || "").trim();

  if (!value) {
    return {
      language: "unknown",
      script: "unknown",
      style: "natural",
      confidence: 0
    };
  }

  const devanagari = countMatches(value, /[\u0900-\u097F]/g);
  const bengali = countMatches(value, /[\u0980-\u09FF]/g);
  const gurmukhi = countMatches(value, /[\u0A00-\u0A7F]/g);
  const gujarati = countMatches(value, /[\u0A80-\u0AFF]/g);
  const tamil = countMatches(value, /[\u0B80-\u0BFF]/g);
  const telugu = countMatches(value, /[\u0C00-\u0C7F]/g);
  const kannada = countMatches(value, /[\u0C80-\u0CFF]/g);
  const malayalam = countMatches(value, /[\u0D00-\u0D7F]/g);

  const arabic = countMatches(value, /[\u0600-\u06FF]/g);
  const hebrew = countMatches(value, /[\u0590-\u05FF]/g);
  const cyrillic = countMatches(value, /[\u0400-\u04FF]/g);
  const greek = countMatches(value, /[\u0370-\u03FF]/g);
  const thai = countMatches(value, /[\u0E00-\u0E7F]/g);
  const armenian = countMatches(value, /[\u0530-\u058F]/g);
  const georgian = countMatches(value, /[\u10A0-\u10FF]/g);
  const hangul = countMatches(value, /[\uAC00-\uD7AF]/g);
  const hiragana = countMatches(value, /[\u3040-\u309F]/g);
  const katakana = countMatches(value, /[\u30A0-\u30FF]/g);
  const han = countMatches(value, /[\u4E00-\u9FFF]/g);

  const latin = countMatches(value, /[A-Za-z]/g);

  // Romanized Hindi / Hinglish signals
  const hinglishWords =
    /\b(mera|meri|mere|mujhe|mujhse|aap|aapka|aapki|kaise|kya|hai|hain|batao|chahiye|karna|karunga|karungi|bhai|yaar|acha|accha|theek|thik|kyu|kyon|abhi|aaj|kal|mein|me|mujko|rakhna|samjhao|samjha|banao|karo|dikhao|chalo|haan|nahi|nahin|iska|uska|apna|apne|apni|kab|kahan|kyon)\b/i;

  const englishWords =
    /\b(the|is|are|was|were|what|why|how|please|can|could|would|should|explain|tell|give|show|today|latest|current|help|need|want|make|create|build|write|where|when|which|who)\b/i;

  let language = "unknown";
  let script = "unknown";
  let confidence = 0.35;

  // Script-first detection
  if (devanagari > 0) {
    language = "Hindi / Devanagari";
    script = "Devanagari";
    confidence = 0.98;
  } else if (bengali > 0) {
    language = "Bengali";
    script = "Bengali";
    confidence = 0.98;
  } else if (gurmukhi > 0) {
    language = "Punjabi";
    script = "Gurmukhi";
    confidence = 0.98;
  } else if (gujarati > 0) {
    language = "Gujarati";
    script = "Gujarati";
    confidence = 0.98;
  } else if (tamil > 0) {
    language = "Tamil";
    script = "Tamil";
    confidence = 0.98;
  } else if (telugu > 0) {
    language = "Telugu";
    script = "Telugu";
    confidence = 0.98;
  } else if (kannada > 0) {
    language = "Kannada";
    script = "Kannada";
    confidence = 0.98;
  } else if (malayalam > 0) {
    language = "Malayalam";
    script = "Malayalam";
    confidence = 0.98;
  } else if (arabic > 0) {
    language = "Arabic";
    script = "Arabic";
    confidence = 0.98;
  } else if (hebrew > 0) {
    language = "Hebrew";
    script = "Hebrew";
    confidence = 0.98;
  } else if (cyrillic > 0) {
    language = "Cyrillic-language text";
    script = "Cyrillic";
    confidence = 0.95;
  } else if (greek > 0) {
    language = "Greek";
    script = "Greek";
    confidence = 0.98;
  } else if (thai > 0) {
    language = "Thai";
    script = "Thai";
    confidence = 0.98;
  } else if (armenian > 0) {
    language = "Armenian";
    script = "Armenian";
    confidence = 0.98;
  } else if (georgian > 0) {
    language = "Georgian";
    script = "Georgian";
    confidence = 0.98;
  } else if (hangul > 0) {
    language = "Korean";
    script = "Hangul";
    confidence = 0.98;
  } else if (hiragana > 0 || katakana > 0) {
    language = "Japanese";
    script = "Japanese";
    confidence = 0.98;
  } else if (han > 0) {
    language = "Chinese";
    script = "Han";
    confidence = 0.90;
  } else if (latin > 0) {
    if (hinglishWords.test(value)) {
      language = "Hinglish / Roman Hindi";
      script = "Latin";
      confidence = 0.88;
    } else if (englishWords.test(value)) {
      language = "English";
      script = "Latin";
      confidence = 0.90;
    } else {
      language = "Latin-script language";
      script = "Latin";
      confidence = 0.50;
    }
  }

  return {
    language,
    script,
    style: detectResponseStyle(value),
    confidence
  };
}

// =====================================================
// RESPONSE STYLE
// =====================================================

function detectResponseStyle(text) {
  const value = String(text || "").trim();

  if (
    /(simple|easy|aasaan|asan|सरल|आसान|easy language|simple language)/i.test(
      value
    )
  ) {
    return "simple";
  }

  if (
    /(professional|formal|official|business|professionally|औपचारिक)/i.test(
      value
    )
  ) {
    return "professional";
  }

  if (
    /(short|brief|short mein|short me|संक्षेप|कम शब्द)/i.test(value)
  ) {
    return "short";
  }

  if (
    /(detail|detailed|deep|deeply|विस्तार|विस्तार से|पूरी जानकारी)/i.test(
      value
    )
  ) {
    return "detailed";
  }

  if (
    /(learn|practice|speaking|english practice|spoken english|सीखना)/i.test(
      value
    )
  ) {
    return "learning";
  }

  if (
    /(casual|friendly|bhai|yaar|दोस्त)/i.test(value)
  ) {
    return "casual";
  }

  return "natural";
}

// =====================================================
// MEMORY SECURITY
// =====================================================

const SECRET_PATTERNS = [
  /password/i,
  /passcode/i,
  /\botp\b/i,
  /api[_ -]?key/i,
  /secret[_ -]?key/i,
  /access[_ -]?token/i,
  /refresh[_ -]?token/i,
  /bearer\s+[a-z0-9._-]+/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /credit\s*card/i,
  /debit\s*card/i,
  /bank\s*account/i,
  /account\s*number/i,
  /ifsc/i,
  /private\s*key/i
];

const BLOCKED_NAME_WORDS = new Set([
  "kya",
  "what",
  "who",
  "why",
  "how",
  "when",
  "where",
  "which",
  "hai",
  "h",
  "ho",
  "please",
  "yaad",
  "rakhna",
  "rakho",
  "remember",
  "name",
  "naam",
  "my",
  "mera",
  "meraa",
  "क्या",
  "कौन",
  "क्यों",
  "कैसे",
  "कब",
  "कहाँ",
  "है",
  "हैं",
  "ह",
  "नाम",
  "मेरा",
  "मेरी",
  "याद",
  "रखना",
  "रखो"
]);

function containsSecret(text) {
  const value = String(text || "");
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function isInvalidName(value) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!name) return true;

  if (name.length < 2 || name.length > 80) return true;

  const lower = name.toLowerCase();

  if (BLOCKED_NAME_WORDS.has(lower)) {
    return true;
  }

  const parts = lower.split(/\s+/);

  if (parts.some((part) => BLOCKED_NAME_WORDS.has(part))) {
    return true;
  }

  if (!/[A-Za-z\u0900-\u097F]/.test(name)) {
    return true;
  }

  return false;
}

// =====================================================
// MEMORY TABLE
// =====================================================

let memoryReady = false;

async function ensureMemoryTable() {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.user_memories (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        memory_key TEXT NOT NULL,
        memory_value TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, memory_key)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS user_memories_user_id_idx
      ON public.user_memories(user_id)
    `);

    memoryReady = true;
    return true;
  } catch (error) {
    console.error(
      "MEMORY TABLE ERROR:",
      error?.message || error
    );

    memoryReady = false;
    return false;
  }
}

// =====================================================
// SAVE MEMORY
// =====================================================

async function saveMemory(userId, key, value) {
  if (!userId || !key || !value) return false;

  if (containsSecret(value)) {
    console.log("MEMORY BLOCKED: sensitive data");
    return false;
  }

  if (key === "name" && isInvalidName(value)) {
    console.log("MEMORY BLOCKED: invalid name");
    return false;
  }

  if (!memoryReady) {
    await ensureMemoryTable();
  }

  if (!memoryReady) return false;

  try {
    await pool.query(
      `
      INSERT INTO public.user_memories
        (user_id, memory_key, memory_value)
      VALUES
        ($1, $2, $3)
      ON CONFLICT (user_id, memory_key)
      DO UPDATE SET
        memory_value = EXCLUDED.memory_value,
        updated_at = NOW()
      `,
      [userId, key, limitText(value, 1000)]
    );

    return true;
  } catch (error) {
    console.error(
      "MEMORY SAVE ERROR:",
      error?.message || error
    );

    return false;
  }
}

// =====================================================
// GET MEMORIES
// =====================================================

async function getMemories(userId) {
  if (!userId) return [];

  if (!memoryReady) {
    await ensureMemoryTable();
  }

  if (!memoryReady) return [];

  try {
    const result = await pool.query(
      `
      SELECT memory_key, memory_value, updated_at
      FROM public.user_memories
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 100
      `,
      [userId]
    );

    return result.rows.filter((row) => {
      if (
        row.memory_key === "name" &&
        isInvalidName(row.memory_value)
      ) {
        return false;
      }

      return true;
    });
  } catch (error) {
    console.error(
      "MEMORY LOAD ERROR:",
      error?.message || error
    );

    return [];
  }
}

// =====================================================
// DELETE MEMORY
// =====================================================

async function deleteMemory(userId, key) {
  if (!userId || !key) return false;

  if (!memoryReady) {
    await ensureMemoryTable();
  }

  if (!memoryReady) return false;

  try {
    await pool.query(
      `
      DELETE FROM public.user_memories
      WHERE user_id = $1
      AND memory_key = $2
      `,
      [userId, key]
    );

    return true;
  } catch (error) {
    console.error(
      "MEMORY DELETE ERROR:",
      error?.message || error
    );

    return false;
  }
}

// =====================================================
// CLEAR ALL MEMORY
// =====================================================

async function clearMemory(userId) {
  if (!userId) return false;

  if (!memoryReady) {
    await ensureMemoryTable();
  }

  if (!memoryReady) return false;

  try {
    await pool.query(
      `
      DELETE FROM public.user_memories
      WHERE user_id = $1
      `,
      [userId]
    );

    return true;
  } catch (error) {
    console.error(
      "MEMORY CLEAR ERROR:",
      error?.message || error
    );

    return false;
  }
}

// =====================================================
// NAME EXTRACTION
// =====================================================

function extractName(text) {
  const value = String(text || "").trim();

  const patterns = [
    /(?:mera|meraa)\s+naam\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F .'-]{1,60}?)(?:\s+hai|\s+h\b|[.!?,]|$)/i,

    /मेरा\s+नाम\s+([\u0900-\u097F A-Za-z.'-]{2,60}?)(?:\s+है|\s+ह\b|[।!?,]|$)/i,

    /my\s+name\s+is\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?:[.!?,]|$)/i,

    /i(?:'m| am)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?:[.!?,]|$)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      const name = match[1]
        .trim()
        .replace(/\s+/g, " ");

      if (!isInvalidName(name)) {
        return name;
      }
    }
  }

  return null;
}

// =====================================================
// MEMORY REQUEST PROCESSOR
// =====================================================

async function processMemoryRequest(userId, text) {
  const value = String(text || "").trim();

  if (!value) {
    return {
      handled: false,
      action: null
    };
  }

  const lower = value.toLowerCase();

  // ---------------------------------------------------
  // CLEAR ALL
  // ---------------------------------------------------

  if (
    /(forget|delete|remove|clear).*(all|everything).*(memory|memories)/i.test(
      value
    ) ||
    /(sab|saari|sari).*(memory|yaadein).*(delete|clear|bhool)/i.test(
      value
    )
  ) {
    await clearMemory(userId);

    return {
      handled: true,
      action: "clear_all"
    };
  }

  // ---------------------------------------------------
  // FORGET NAME
  // ---------------------------------------------------

  if (
    /(forget|delete|remove).*(my|mera|meri).*(name|naam)/i.test(
      value
    ) ||
    /(mera|meri).*(naam|name).*(bhool|delete|remove)/i.test(
      value
    )
  ) {
    await deleteMemory(userId, "name");

    return {
      handled: true,
      action: "delete_name"
    };
  }

  // ---------------------------------------------------
  // EXPLICIT NAME
  // ---------------------------------------------------

  const name = extractName(value);

  if (name) {
    await saveMemory(userId, "name", name);

    return {
      handled: false,
      action: "saved_name",
      name
    };
  }

  // ---------------------------------------------------
  // LANGUAGE PREFERENCE
  // ---------------------------------------------------

  const languageMatch =
    value.match(
      /(?:reply|respond|answer|batao|bolo|baat).*(?:in|mein|me)\s+([A-Za-z\u0900-\u097F -]{2,40})/i
    );

  if (
    languageMatch &&
    /(english|hindi|hinglish|tamil|telugu|bengali|punjabi|gujarati|marathi|kannada|malayalam|urdu|arabic|french|spanish|german|japanese|chinese)/i.test(
      languageMatch[1]
    )
  ) {
    const language = languageMatch[1].trim();

    await saveMemory(
      userId,
      "language_preference",
      language
    );

    return {
      handled: false,
      action: "saved_language",
      language
    };
  }

  return {
    handled: false,
    action: null
  };
}

// =====================================================
// MEMORY CONTEXT
// =====================================================

function buildMemoryContext(memories) {
  if (!memories || memories.length === 0) {
    return "No saved user memory is currently available.";
  }

  const lines = memories.map((memory) => {
    return `- ${memory.memory_key}: ${memory.memory_value}`;
  });

  return lines.join("\n");
}

// =====================================================
// CHAT HISTORY CLEANING
// =====================================================

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .map((item) => ({
      role:
        item?.role === "assistant"
          ? "assistant"
          : "user",
      content: limitText(item?.content || "", 5000)
    }))
    .filter((item) => item.content);
}

// =====================================================
// LIVE SEARCH DETECTION
// =====================================================

function needsLiveSearch(text) {
  const value = String(text || "").toLowerCase();

  const liveWords = [
    "today",
    "todays",
    "latest",
    "current",
    "right now",
    "now",
    "news",
    "breaking",
    "recent",
    "recently",
    "live",
    "price",
    "share price",
    "stock price",
    "market price",
    "weather",
    "forecast",
    "rain",
    "score",
    "match",
    "result",
    "election",
    "president",
    "prime minister",
    "ceo",
    "ipo",
    "bitcoin",
    "crypto",
    "gold price",
    "silver price",
    "petrol price",
    "diesel price",
    "exchange rate",
    "usd",
    "inr",
    "rashifal",
    "horoscope",
    "what happened",
    "what is happening",
    "who won",
    "who is winning"
  ];

  return liveWords.some((word) =>
    value.includes(word)
  );
}

// =====================================================
// SEARCH QUERY
// =====================================================

function buildSearchQuery(text) {
  const value = String(text || "").trim();

  return limitText(value, 500);
}

// =====================================================
// TAVILY SEARCH
// =====================================================

async function searchWeb(query) {
  if (!TAVILY_API_KEY) {
    return [];
  }

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
          query,
          search_depth: "advanced",
          topic: "general",
          max_results: 6,
          include_answer: true,
          include_raw_content: false
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "TAVILY ERROR:",
        response.status,
        errorText.slice(0, 500)
      );

      return [];
    }

    const data = await response.json();

    const results = Array.isArray(data.results)
      ? data.results
      : [];

    return results.map((item) => ({
      title: item.title || "",
      url: item.url || "",
      content: limitText(
        item.content || "",
        3000
      )
    }));
  } catch (error) {
    console.error(
      "TAVILY REQUEST ERROR:",
      error?.message || error
    );

    return [];
  }
}

// =====================================================
// SEARCH CONTEXT
// =====================================================

function buildSearchContext(results) {
  if (!results || results.length === 0) {
    return "No live web results were available.";
  }

  return results
    .map((item, index) => {
      return `
SOURCE ${index + 1}
Title: ${item.title}
URL: ${item.url}
Content:
${item.content}
`;
    })
    .join("\n");
}

// =====================================================
// SOURCES
// =====================================================

function buildSourcesText(results) {
  if (!results || results.length === 0) {
    return [];
  }

  return results.slice(0, 6).map((item) => ({
    title: item.title,
    url: item.url
  }));
}

// =====================================================
// NUMBERED FORMATTING
// =====================================================

function normalizeNumberedFormatting(text) {
  if (!text) return "";

  return String(text)
    .replace(/\s+(\d+\.)\s+/g, "\n$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// =====================================================
// BUILD PROMPT
// =====================================================

function buildPrompt({
  message,
  history,
  memoryContext,
  languageProfile,
  searchContext,
  currentDateTime
}) {
  return `
${ATHARV_INSTRUCTIONS}

====================================================
CURRENT USER DATE / TIME
====================================================

Time zone: ${currentDateTime.timeZone}
Current local date/time: ${currentDateTime.now}

====================================================
USER LANGUAGE PROFILE
====================================================

Language:
${languageProfile.language}

Script:
${languageProfile.script}

Style:
${languageProfile.style}

Confidence:
${languageProfile.confidence}

LANGUAGE RULES:
1. Reply in the user's latest detected language unless the user explicitly asks for another language.
2. Preserve the user's script.
3. If the user writes Hindi in Devanagari, reply in Devanagari Hindi.
4. If the user writes Roman Hindi/Hinglish, reply naturally in Roman Hindi/Hinglish.
5. If the user writes English, reply in English.
6. If the user writes another language, answer in that language whenever possible.
7. If the user mixes languages, naturally preserve the same mix.
8. If the user changes language during the conversation, switch immediately.
9. Do not translate the user's question unless they ask for translation.
10. For very short messages where language detection is uncertain, follow the language used in the latest clear message.
11. Respect requested style such as simple, professional, short, detailed or learning mode.

====================================================
USER MEMORY
====================================================

${memoryContext}

Use memory naturally.

Do NOT mention the internal memory system unless the user asks about it.

====================================================
LIVE WEB INFORMATION
====================================================

${searchContext}

If live web information is supplied:
- Use it for current facts.
- Do not invent missing information.
- Prefer the supplied sources over your old knowledge.
- Clearly distinguish confirmed information from uncertainty.
- When useful, mention source names naturally.

====================================================
RECENT CONVERSATION
====================================================

${history
  .map(
    (item) =>
      `${item.role.toUpperCase()}: ${item.content}`
  )
  .join("\n\n")}

====================================================
LATEST USER MESSAGE
====================================================

${message}

====================================================
ANSWER
====================================================

Answer the latest user message directly.

Important:
- Do not say "I am just an AI" unless relevant.
- Do not unnecessarily apologize.
- Do not ask a clarification question if a reasonable interpretation is possible.
- If the user wants an action/solution, give the actionable solution.
- If the user asks for code, make it copy-paste ready when possible.
`;
}

// =====================================================
// GROQ MODEL
// =====================================================

function getGroqModel() {
  const configured =
    process.env.GROQ_MODEL?.trim();

  if (!configured) {
    return DEFAULT_MODEL;
  }

  if (
    configured === "groq/compound-mini" ||
    configured === "groq/compound" ||
    configured === ""
  ) {
    return "openai/gpt-oss-120b";
  }

  return configured;
}

// =====================================================
// CALL GROQ
// =====================================================

async function callGroq(messages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const model =
    options.model || getGroqModel();

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
        max_tokens: 4096
      })
    }
  );

  const rawText = await response.text();

  let data;

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Groq returned invalid response: ${rawText.slice(
        0,
        500
      )}`
    );
  }

  if (!response.ok) {
    console.error(
      "GROQ ERROR:",
      response.status,
      JSON.stringify(data).slice(0, 1000)
    );

    throw new Error(
      data?.error?.message ||
        `Groq request failed with status ${response.status}`
    );
  }

  const answer =
    data?.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error(
      "Groq returned an empty answer."
    );
  }

  return answer;
}

// =====================================================
// FRIENDLY ERROR
// =====================================================

function friendlyError(error) {
  const message =
    error?.message ||
    "Unknown server error";

  if (/GROQ_API_KEY/i.test(message)) {
    return "Atharv AI server configuration mein problem hai. Please try again shortly.";
  }

  if (/rate limit|429/i.test(message)) {
    return "Abhi AI service par thoda load hai. Kuch seconds baad dobara try karein.";
  }

  if (/timeout|timed out/i.test(message)) {
    return "Response lene mein zyada time lag gaya. Please dobara try karein.";
  }

  if (/Tavily/i.test(message)) {
    return "Live information service temporarily unavailable hai.";
  }

  return "Atharv ko response generate karne mein problem hui. Please dobara try karein.";
}

// =====================================================
// MAIN CHAT ENGINE
// =====================================================

async function generateAtharvResponse({
  req,
  message,
  history,
  userId
}) {
  const userMessage = safeString(message);

  if (!userMessage) {
    throw new Error("Message is required.");
  }

  const cleanUserId = userId || getUserId(req);

  // ---------------------------------------------------
  // MEMORY REQUEST
  // ---------------------------------------------------

  const memoryAction =
    await processMemoryRequest(
      cleanUserId,
      userMessage
    );

  // ---------------------------------------------------
  // LOAD MEMORY
  // ---------------------------------------------------

  const memories =
    await getMemories(cleanUserId);

  const memoryContext =
    buildMemoryContext(memories);

  // ---------------------------------------------------
  // LANGUAGE
  // ---------------------------------------------------

  const languageProfile =
    detectLanguageProfile(userMessage);

  // ---------------------------------------------------
  // TIME
  // ---------------------------------------------------

  const currentDateTime =
    getUserDateTime(req);

  // ---------------------------------------------------
  // LIVE SEARCH
  // ---------------------------------------------------

  let searchResults = [];

  if (needsLiveSearch(userMessage)) {
    const query =
      buildSearchQuery(userMessage);

    console.log(
      "LIVE SEARCH:",
      query
    );

    searchResults =
      await searchWeb(query);
  }

  const searchContext =
    buildSearchContext(searchResults);

  // ---------------------------------------------------
  // HISTORY
  // ---------------------------------------------------

  const cleanChatHistory =
    cleanHistory(history);

  // ---------------------------------------------------
  // PROMPT
  // ---------------------------------------------------

  const prompt = buildPrompt({
    message: userMessage,
    history: cleanChatHistory,
    memoryContext,
    languageProfile,
    searchContext,
    currentDateTime
  });

  // ---------------------------------------------------
  // GROQ
  // ---------------------------------------------------

  const messages = [
    {
      role: "system",
      content: prompt
    }
  ];

  const answer =
    await callGroq(messages);

  return {
    answer: normalizeNumberedFormatting(answer),
    sources: buildSourcesText(searchResults),
    search: searchResults.length > 0,
    language: languageProfile,
    memoryAction
  };
}

// =====================================================
// CHAT API
// =====================================================

app.post("/api/chat", async (req, res) => {
  const started = Date.now();

  try {
    const message =
      safeString(req.body?.message);

    if (!message) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const userId =
      getUserId(req);

    const result =
      await generateAtharvResponse({
        req,
        message,
        history: req.body?.history || [],
        userId
      });

    console.log(
      `CHAT completed in ${
        Date.now() - started
      }ms | search=${result.search} | sources=${result.sources.length}`
    );

    return res.json({
      success: true,
      answer: result.answer,
      response: result.answer,
      sources: result.sources,
      search: result.search,
      language: result.language,
      memoryAction: result.memoryAction
    });
  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error?.stack || error
    );

    return res.status(500).json({
      success: false,
      error: friendlyError(error)
    });
  }
});

// =====================================================
// STREAM API
// =====================================================

app.post("/api/chat/stream", async (req, res) => {
  try {
    const message =
      safeString(req.body?.message);

    if (!message) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const userId =
      getUserId(req);

    const result =
      await generateAtharvResponse({
        req,
        message,
        history: req.body?.history || [],
        userId
      });

    res.setHeader(
      "Content-Type",
      "text/event-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.flushHeaders?.();

    const answer = result.answer;

    // Send answer in small chunks.
    const chunkSize = 80;

    for (
      let i = 0;
      i < answer.length;
      i += chunkSize
    ) {
      const chunk =
        answer.slice(i, i + chunkSize);

      res.write(
        `data: ${JSON.stringify({
          type: "token",
          content: chunk
        })}\n\n`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 5)
      );
    }

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        sources: result.sources,
        search: result.search,
        language: result.language,
        memoryAction: result.memoryAction
      })}\n\n`
    );

    res.end();
  } catch (error) {
    console.error(
      "STREAM ERROR:",
      error?.stack || error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: friendlyError(error)
      });
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: friendlyError(error)
      })}\n\n`
    );

    res.end();
  }
});

// =====================================================
// MEMORY API
// =====================================================

app.get("/api/memory", async (req, res) => {
  try {
    const userId =
      getUserId(req);

    const memories =
      await getMemories(userId);

    return res.json({
      success: true,
      memories
    });
  } catch (error) {
    console.error(
      "MEMORY API ERROR:",
      error?.message || error
    );

    return res.status(500).json({
      success: false,
      error: "Unable to load memory."
    });
  }
});

// =====================================================
// DELETE ONE MEMORY
// =====================================================

app.delete(
  "/api/memory/delete",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const key =
        safeString(req.body?.key);

      if (!key) {
        return res.status(400).json({
          success: false,
          error: "Memory key is required."
        });
      }

      await deleteMemory(
        userId,
        key
      );

      return res.json({
        success: true
      });
    } catch (error) {
      console.error(
        "MEMORY DELETE API ERROR:",
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error: "Unable to delete memory."
      });
    }
  }
);

// =====================================================
// CLEAR MEMORY
// =====================================================

app.delete(
  "/api/memory/clear",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      await clearMemory(userId);

      return res.json({
        success: true
      });
    } catch (error) {
      console.error(
        "MEMORY CLEAR API ERROR:",
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error: "Unable to clear memory."
      });
    }
  }
);

// =====================================================
// HEALTH
// =====================================================

app.get("/health", async (req, res) => {
  let database = "not-configured";

  if (process.env.DATABASE_URL) {
    try {
      await pool.query("SELECT 1");
      database = "ok";
    } catch (error) {
      database = "error";
    }
  }

  return res.json({
    success: true,
    service: "Atharv AI",
    status: "ok",
    version: "6.1.0",
    languageIntelligence: true,
    memory2: true,
    liveSearch: Boolean(TAVILY_API_KEY),
    groq: Boolean(GROQ_API_KEY),
    database,
    model: getGroqModel(),
    time: new Date().toISOString()
  });
});

// =====================================================
// STATIC FRONTEND
// =====================================================

const publicPath = path.join(
  __dirname
);

app.use(
  express.static(publicPath)
);

// =====================================================
// EXPRESS 5 CATCH-ALL
// =====================================================

app.get(
  "*splat",
  (req, res) => {
    res.sendFile(
      path.join(
        publicPath,
        "index.html"
      )
    );
  }
);

// =====================================================
// START SERVER
// =====================================================

async function startServer() {
  await ensureMemoryTable();

  app.listen(
    PORT,
    () => {
      console.log(
        `Atharv AI running on port ${PORT}`
      );

      console.log(
        `Model: ${getGroqModel()}`
      );

      console.log(
        `Memory: ${memoryReady ? "ready" : "unavailable"}`
      );

      console.log(
        `Tavily: ${TAVILY_API_KEY ? "configured" : "not configured"}`
      );

      console.log(
        `Language Intelligence: enabled`
      );
    }
  );
}

startServer().catch((error) => {
  console.error(
    "SERVER START ERROR:",
    error?.stack || error
  );

  process.exit(1);
});
