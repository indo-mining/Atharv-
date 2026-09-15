require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const DEFAULT_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5
});

/* =========================================================
   ATHARV AI
   Backend Version 8.0
   ========================================================= */

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

Your purpose is not only to answer questions but to help the user
complete useful tasks.

CORE RULES:

1. Always answer the user's actual request directly.
2. Do not unnecessarily ask clarification questions.
3. Never invent current facts, prices, news, weather, events or statistics.
4. When live web context is provided, use it carefully and distinguish
   verified information from uncertainty.
5. Respect the user's selected language.
6. If the user selects a language, answer primarily in that language.
7. If Hinglish is selected, use natural Roman Hindi/Hinglish.
8. If Hindi is selected, prefer Devanagari Hindi unless the user clearly
   writes in Roman Hindi and the context suggests otherwise.
9. If Auto Detect is selected, detect the user's language naturally.
10. Preserve the user's tone and communication style.
11. Do not start every answer with the user's name.
12. Use remembered information naturally when relevant.
13. Never reveal API keys, passwords, tokens, database URLs or secrets.
14. Never claim to have performed an action that was not actually performed.
15. For financial information, clearly mention uncertainty and risk.
16. Never promise guaranteed stock returns, option profits or exam questions.
17. For study/exam questions, prioritize concepts and questions based on
    available evidence rather than claiming certainty.
18. For uploaded documents, answer from the supplied document content.
19. For coding questions, explain clearly and provide working code when useful.
20. For professional tasks, produce practical, usable output.
21. Keep responses reasonably concise unless the user asks for detail.
22. Use headings, bullets and tables when they improve readability.
23. For current information, do not pretend that old knowledge is current.
24. If live search context is unavailable for a question that clearly needs
    current information, say that live verification could not be completed.
25. Support multilingual conversations across major world languages whenever
    the model can reliably respond.
`;

/* =========================================================
   HELPERS
   ========================================================= */

function safeString(value, max = 10000) {
  if (value === undefined || value === null) return "";
  return String(value).slice(0, max);
}

function limitText(value, max = 50000) {
  return safeString(value, max);
}

function countMatches(text, words) {
  const value = String(text || "").toLowerCase();

  return words.reduce((count, word) => {
    return count + (value.includes(word.toLowerCase()) ? 1 : 0);
  }, 0);
}

/* =========================================================
   USER ID
   ========================================================= */

function getUserId(req, body = {}) {
  const raw =
    body.userId ||
    req.headers["x-atharv-user-id"] ||
    req.query.userId ||
    req.ip ||
    "anonymous";

  return crypto
    .createHash("sha256")
    .update(String(raw))
    .digest("hex");
}

/* =========================================================
   USER DATE/TIME
   ========================================================= */

function getUserDateTime(timeZone) {
  try {
    const tz =
      timeZone ||
      "Asia/Kolkata";

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "long"
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

/* =========================================================
   LANGUAGE
   ========================================================= */

const LANGUAGE_NAMES = {
  auto: "Auto Detect",
  hi: "Hindi",
  en: "English",
  hinglish: "Hinglish",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese"
};

function normalizeLanguagePreference(language) {
  const value =
    String(language || "")
      .trim()
      .toLowerCase();

  if (!value) return "auto";

  if (LANGUAGE_NAMES[value]) {
    return value;
  }

  const aliases = {
    hindi: "hi",
    english: "en",
    hinglish: "hinglish",
    bengali: "bn",
    bangla: "bn",
    marathi: "mr",
    gujarati: "gu",
    tamil: "ta",
    telugu: "te",
    kannada: "kn",
    malayalam: "ml",
    punjabi: "pa",
    urdu: "ur",
    arabic: "ar",
    spanish: "es",
    french: "fr",
    german: "de",
    portuguese: "pt",
    russian: "ru",
    japanese: "ja",
    korean: "ko",
    chinese: "zh"
  };

  return aliases[value] || "auto";
}

function detectLanguageProfile(text) {
  const value = String(text || "");

  if (/[\u0900-\u097F]/.test(value)) {
    return "hi";
  }

  if (/[\u0980-\u09FF]/.test(value)) {
    return "bn";
  }

  if (/[\u0A00-\u0A7F]/.test(value)) {
    return "pa";
  }

  if (/[\u0A80-\u0AFF]/.test(value)) {
    return "gu";
  }

  if (/[\u0B00-\u0B7F]/.test(value)) {
    return "ta";
  }

  if (/[\u0C00-\u0C7F]/.test(value)) {
    return "te";
  }

  if (/[\u0C80-\u0CFF]/.test(value)) {
    return "kn";
  }

  if (/[\u0D00-\u0D7F]/.test(value)) {
    return "ml";
  }

  if (/[\u0600-\u06FF]/.test(value)) {
    return "ur";
  }

  if (/[\u3040-\u30FF]/.test(value)) {
    return "ja";
  }

  if (/[\uAC00-\uD7AF]/.test(value)) {
    return "ko";
  }

  if (/[\u4E00-\u9FFF]/.test(value)) {
    return "zh";
  }

  const hinglishWords = [
    "mera",
    "meri",
    "mujhe",
    "aap",
    "apko",
    "kya",
    "kaise",
    "batao",
    "hai",
    "hain",
    "karna",
    "karo",
    "chahiye",
    "nahi",
    "kyun",
    "acha",
    "accha",
    "theek",
    "thik"
  ];

  const lower = value.toLowerCase();

  if (
    hinglishWords.filter(x => lower.includes(x)).length >= 2
  ) {
    return "hinglish";
  }

  return "en";
}

function getLanguageInstruction(language, languageName, message) {
  const selected =
    normalizeLanguagePreference(language);

  if (selected === "auto") {
    const detected = detectLanguageProfile(message);

    if (detected === "hinglish") {
      return `
Language preference: Auto Detect.
Detected style: Hinglish.
Reply naturally in Roman Hindi/Hinglish unless the user clearly changes language.
`;
    }

    return `
Language preference: Auto Detect.
Detected language: ${LANGUAGE_NAMES[detected] || detected}.
Reply in the user's detected language.
`;
  }

  if (selected === "hinglish") {
    return `
MANDATORY RESPONSE LANGUAGE:
Hinglish / Roman Hindi.
Use natural Roman Hindi mixed with English where appropriate.
Do not switch to Devanagari unless the user explicitly asks.
`;
  }

  return `
MANDATORY RESPONSE LANGUAGE:
${languageName || LANGUAGE_NAMES[selected] || selected}.

Answer primarily in this language.
Do not unnecessarily switch to English.
Technical names, code, URLs and proper nouns may remain in their original form.
`;
}

/* =========================================================
   MEMORY
   ========================================================= */

async function ensureMemoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_memories (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      memory_key TEXT NOT NULL,
      memory_value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, memory_key)
    );

    CREATE INDEX IF NOT EXISTS user_memories_user_id_idx
    ON public.user_memories(user_id);
  `);
}

const SECRET_PATTERNS = [
  /api[_ -]?key/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /otp/i,
  /one[- ]time password/i,
  /cvv/i,
  /card number/i,
  /private key/i,
  /seed phrase/i,
  /recovery phrase/i
];

function containsSecret(value) {
  const text = String(value || "");

  return SECRET_PATTERNS.some(
    pattern => pattern.test(text)
  );
}

function isInvalidName(name) {
  if (!name) return true;

  const value = String(name).trim();

  if (value.length < 2 || value.length > 80) {
    return true;
  }

  if (containsSecret(value)) {
    return true;
  }

  return false;
}

function extractName(message) {
  const text = String(message || "").trim();

  const patterns = [
    /(?:my name is)\s+([A-Za-z][A-Za-z .'-]{1,60})/i,
    /(?:mera naam)\s+([A-Za-z][A-Za-z .'-]{1,60})(?:\s+hai)?/i,
    /(?:मेरा नाम)\s+([^\n,.!?]{2,60})(?:\s+है)?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      const name = match[1]
        .trim()
        .replace(/[.!?,]+$/, "");

      if (!isInvalidName(name)) {
        return name;
      }
    }
  }

  return null;
}

async function saveMemory(
  userId,
  key,
  value
) {
  if (
    !userId ||
    !key ||
    !value ||
    containsSecret(value)
  ) {
    return false;
  }

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
    [
      userId,
      key,
      value
    ]
  );

  return true;
}

async function getMemories(userId) {
  const result = await pool.query(
    `
    SELECT memory_key, memory_value
    FROM public.user_memories
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT 50
    `,
    [userId]
  );

  return result.rows;
}

async function deleteMemory(
  userId,
  key
) {
  await pool.query(
    `
    DELETE FROM public.user_memories
    WHERE user_id = $1
    AND memory_key = $2
    `,
    [userId, key]
  );
}

async function clearMemory(userId) {
  await pool.query(
    `
    DELETE FROM public.user_memories
    WHERE user_id = $1
    `,
    [userId]
  );
}

function buildMemoryContext(memories) {
  if (!memories || !memories.length) {
    return "";
  }

  const lines = memories
    .slice(0, 30)
    .map(
      item =>
        `- ${item.memory_key}: ${item.memory_value}`
    );

  return `
USER MEMORY
Use this information naturally when relevant.
Do not mention the internal memory system.

${lines.join("\n")}
`;
}

async function processMemoryRequest(
  userId,
  message
) {
  const name = extractName(message);

  if (name) {
    await saveMemory(
      userId,
      "name",
      name
    );
  }

  const lower =
    String(message || "").toLowerCase();

  if (
    lower.includes("remember that") ||
    lower.includes("yaad rakhna") ||
    lower.includes("याद रखना")
  ) {
    if (!containsSecret(message)) {
      const cleaned = message
        .replace(
          /remember that/i,
          ""
        )
        .replace(
          /yaad rakhna/i,
          ""
        )
        .replace(
          /याद रखना/g,
          ""
        )
        .trim();

      if (cleaned.length > 2) {
        await saveMemory(
          userId,
          "user_note_" + Date.now(),
          cleaned.slice(0, 500)
        );
      }
    }
  }
}

/* =========================================================
   HISTORY
   ========================================================= */

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-20)
    .map(item => ({
      role:
        item.role === "assistant"
          ? "assistant"
          : "user",

      content:
        safeString(
          item.content ||
          item.text ||
          "",
          6000
        )
    }))
    .filter(item => item.content);
}

/* =========================================================
   LIVE SEARCH
   ========================================================= */

function needsLiveSearch(message) {
  const text =
    String(message || "").toLowerCase();

  const triggers = [
    "today",
    "latest",
    "current",
    "right now",
    "breaking",
    "news",
    "price",
    "share price",
    "stock price",
    "market",
    "nifty",
    "sensex",
    "weather",
    "forecast",
    "cricket",
    "match",
    "result",
    "election",
    "who is",
    "what happened",
    "happening",
    "live",
    "bitcoin",
    "crypto",
    "gold price",
    "silver price",

    "aaj",
    "abhi",
    "taaza",
    "taza",
    "latest news",
    "samachar",
    "khabar",
    "share bhav",
    "stock",
    "bazaar",
    "mausam",
    "sona",
    "chandi",
    "bitcoin",
    "crypto"
  ];

  return triggers.some(
    word => text.includes(word)
  );
}

function buildSearchQuery(
  message,
  languageName
) {
  let query =
    safeString(message, 1000)
      .replace(/\s+/g, " ")
      .trim();

  if (
    languageName &&
    languageName !== "Auto Detect"
  ) {
    query += ` (${languageName})`;
  }

  return query;
}

async function searchWeb(query) {
  if (!TAVILY_API_KEY) {
    return {
      ok: false,
      reason: "Tavily is not configured",
      results: []
    };
  }

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
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query,
            search_depth: "advanced",
            topic: "general",
            max_results: 8,
            include_answer: true,
            include_raw_content: false,
            include_images: false
          })
        }
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "TAVILY ERROR:",
        response.status,
        errorText
      );

      return {
        ok: false,
        reason: "Search provider error",
        results: []
      };
    }

    const data =
      await response.json();

    return {
      ok: true,
      answer:
        safeString(
          data.answer,
          6000
        ),
      results:
        Array.isArray(data.results)
          ? data.results.slice(0, 8)
          : []
    };
  } catch (error) {
    console.error(
      "TAVILY FETCH ERROR:",
      error
    );

    return {
      ok: false,
      reason: "Live search failed",
      results: []
    };
  }
}

function buildSearchContext(search) {
  if (!search || !search.ok) {
    return "";
  }

  const pieces = [];

  if (search.answer) {
    pieces.push(
      `SEARCH SUMMARY:\n${search.answer}`
    );
  }

  if (search.results.length) {
    const results =
      search.results.map(
        (item, index) => {
          return `
SOURCE ${index + 1}
Title: ${safeString(item.title, 300)}
URL: ${safeString(item.url, 500)}
Content: ${safeString(
            item.content,
            2500
          )}
`;
        }
      );

    pieces.push(
      results.join("\n")
    );
  }

  return `
LIVE WEB RESEARCH CONTEXT

Use the following web information to answer the user's question.

${pieces.join("\n")}
`;
}

function buildSources(search) {
  if (
    !search ||
    !search.ok ||
    !Array.isArray(search.results)
  ) {
    return [];
  }

  return search.results
    .slice(0, 6)
    .map(item => ({
      title:
        safeString(
          item.title,
          150
        ),
      url:
        safeString(
          item.url,
          500
        )
    }))
    .filter(item => item.url);
}

/* =========================================================
   ATTACHMENTS
   ========================================================= */

function buildAttachmentContext(body) {
  const description =
    safeString(
      body.attachmentDescription,
      3000
    );

  const text =
    limitText(
      body.attachmentText,
      50000
    );

  if (!description && !text) {
    return "";
  }

  let output = `
USER ATTACHMENT

${description}
`;

  if (text) {
    output += `
ATTACHMENT TEXT:

${text}
`;
  }

  return output;
}

/* =========================================================
   GROQ
   ========================================================= */

function getGroqModel() {
  const model =
    process.env.GROQ_MODEL ||
    DEFAULT_MODEL;

  if (
    model === "groq/compound-mini" ||
    model === "groq/compound"
  ) {
    return "openai/gpt-oss-120b";
  }

  return model;
}

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured"
    );
  }

  const response =
    await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: getGroqModel(),
          messages,
          temperature: 0.35,
          max_tokens: 4096
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "GROQ ERROR:",
      data
    );

    throw new Error(
      data?.error?.message ||
      "AI provider error"
    );
  }

  return (
    data?.choices?.[0]?.message?.content ||
    "I could not generate a response."
  );
}

function friendlyError(error) {
  const message =
    String(
      error?.message ||
      error ||
      ""
    );

  if (
    message.includes(
      "GROQ_API_KEY"
    )
  ) {
    return "Atharv AI is not configured correctly on the server.";
  }

  if (
    message.includes(
      "rate"
    )
  ) {
    return "Atharv is temporarily busy. Please try again in a moment.";
  }

  if (
    message.includes(
      "timeout"
    )
  ) {
    return "The request took too long. Please try again.";
  }

  return "Something went wrong while processing your request. Please try again.";
}

/* =========================================================
   MAIN RESPONSE GENERATOR
   ========================================================= */

async function generateAtharvResponse({
  message,
  history,
  userId,
  timeZone,
  language,
  languageName,
  attachmentDescription,
  attachmentText
}) {
  const cleanMessage =
    safeString(
      message,
      12000
    ).trim();

  if (!cleanMessage) {
    return {
      answer:
        "Please tell me what you'd like help with.",
      sources: []
    };
  }

  await processMemoryRequest(
    userId,
    cleanMessage
  );

  const memories =
    await getMemories(userId);

  const memoryContext =
    buildMemoryContext(
      memories
    );

  const languageContext =
    getLanguageInstruction(
      language,
      languageName,
      cleanMessage
    );

  const currentDateTime =
    getUserDateTime(
      timeZone
    );

  let search = null;

  if (
    needsLiveSearch(
      cleanMessage
    )
  ) {
    const query =
      buildSearchQuery(
        cleanMessage,
        languageName
      );

    search =
      await searchWeb(query);
  }

  const liveContext =
    buildSearchContext(search);

  const attachmentContext =
    buildAttachmentContext({
      attachmentDescription,
      attachmentText
    });

  const systemPrompt = `
${ATHARV_INSTRUCTIONS}

CURRENT USER DATE/TIME:
${currentDateTime}

${languageContext}

${memoryContext}

${liveContext}

${attachmentContext}
`;

  const cleanHistoryItems =
    cleanHistory(history);

  /*
    Prevent the current user message from being duplicated
    when the frontend already included it in history.
  */
  const filteredHistory =
    cleanHistoryItems.filter(
      item =>
        !(
          item.role === "user" &&
          item.content === cleanMessage
        )
    );

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },

    ...filteredHistory,

    {
      role: "user",
      content: cleanMessage
    }
  ];

  const answer =
    await callGroq(messages);

  return {
    answer,
    sources:
      buildSources(search)
  };
}

/* =========================================================
   CHAT
   ========================================================= */

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const message =
        safeString(
          body.message,
          12000
        ).trim();

      if (!message) {
        return res
          .status(400)
          .json({
            error:
              "Message is required"
          });
      }

      const userId =
        getUserId(
          req,
          body
        );

      const result =
        await generateAtharvResponse({
          message,
          history:
            body.history,
          userId,
          timeZone:
            body.timeZone,
          language:
            body.language,
          languageName:
            body.languageName,
          attachmentDescription:
            body.attachmentDescription,
          attachmentText:
            body.attachmentText
        });

      return res.json({
        answer:
          result.answer,
        sources:
          result.sources,
        model:
          getGroqModel(),
        language:
          normalizeLanguagePreference(
            body.language
          )
      });

    } catch (error) {
      console.error(
        "CHAT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            friendlyError(error)
        });
    }
  }
);

/* =========================================================
   STREAM ENDPOINT
   ========================================================= */

app.post(
  "/api/chat/stream",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const message =
        safeString(
          body.message,
          12000
        ).trim();

      if (!message) {
        return res
          .status(400)
          .json({
            error:
              "Message is required"
          });
      }

      const userId =
        getUserId(
          req,
          body
        );

      const result =
        await generateAtharvResponse({
          message,
          history:
            body.history,
          userId,
          timeZone:
            body.timeZone,
          language:
            body.language,
          languageName:
            body.languageName,
          attachmentDescription:
            body.attachmentDescription,
          attachmentText:
            body.attachmentText
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

      res.write(
        `data: ${JSON.stringify({
          type: "answer",
          answer:
            result.answer
        })}\n\n`
      );

      res.write(
        `data: ${JSON.stringify({
          type: "sources",
          sources:
            result.sources
        })}\n\n`
      );

      res.write(
        `data: ${JSON.stringify({
          type: "done"
        })}\n\n`
      );

      res.end();

    } catch (error) {
      console.error(
        "STREAM ERROR:",
        error
      );

      if (!res.headersSent) {
        return res
          .status(500)
          .json({
            error:
              friendlyError(error)
          });
      }

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            friendlyError(error)
        })}\n\n`
      );

      res.end();
    }
  }
);

/* =========================================================
   MEMORY GET
   ========================================================= */

app.get(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(
          req,
          req.query
        );

      const memories =
        await getMemories(
          userId
        );

      return res.json({
        memories
      });

    } catch (error) {
      console.error(
        "MEMORY GET ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Could not load memory"
        });
    }
  }
);

/* =========================================================
   MEMORY DELETE
   ========================================================= */

app.post(
  "/api/memory/delete",
  async (req, res) => {
    try {
      const userId =
        getUserId(
          req,
          req.body || {}
        );

      const key =
        safeString(
          req.body?.key,
          200
        ).trim();

      if (!key) {
        return res
          .status(400)
          .json({
            error:
              "Memory key is required"
          });
      }

      await deleteMemory(
        userId,
        key
      );

      return res.json({
        ok: true
      });

    } catch (error) {
      console.error(
        "MEMORY DELETE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Could not delete memory"
        });
    }
  }
);

/* =========================================================
   MEMORY CLEAR
   ========================================================= */

app.post(
  "/api/memory/clear",
  async (req, res) => {
    try {
      const userId =
        getUserId(
          req,
          req.body || {}
        );

      await clearMemory(
        userId
      );

      return res.json({
        ok: true
      });

    } catch (error) {
      console.error(
        "MEMORY CLEAR ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Could not clear memory"
        });
    }
  }
);

/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/health",
  async (req, res) => {
    let database = false;

    try {
      await pool.query(
        "SELECT 1"
      );

      database = true;
    } catch (error) {
      console.error(
        "HEALTH DB ERROR:",
        error.message
      );
    }

    res.json({
      service:
        "Atharv AI",

      status:
        "ok",

      version:
        "8.0.0",

      universalLanguage:
        true,

      languageIntelligence:
        true,

      memory:
        "v4",

      liveSearch:
        Boolean(
          TAVILY_API_KEY
        ),

      groq:
        Boolean(
          GROQ_API_KEY
        ),

      database,

      model:
        getGroqModel(),

      currentTime:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   STATIC FRONTEND
   ========================================================= */

// Atharv frontend files are in the repository root,
// not inside a public folder.

const frontendPath = __dirname;

app.use(
  express.static(frontendPath)
);

/*
  Express 5 compatible catch-all.
  Sends root index.html for frontend routes.
*/
app.get(
  "*splat",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );
  }
);

/* =========================================================
   START
   ========================================================= */

async function startServer() {
  try {
    await ensureMemoryTable();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Atharv AI running on port ${PORT}`
        );

        console.log(
          `Model: ${getGroqModel()}`
        );

        console.log(
          `Live Search: ${
            TAVILY_API_KEY
              ? "enabled"
              : "disabled"
          }`
        );

        console.log(
          `Memory: enabled`
        );
      }
    );
  } catch (error) {
    console.error(
      "STARTUP ERROR:",
      error
    );

    process.exit(1);
  }
}

startServer();
