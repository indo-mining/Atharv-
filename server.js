require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 10000;

// =====================================================
// CONFIG
// =====================================================

const GROQ_API_KEY =
  process.env.GROQ_API_KEY || "";

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

const DATABASE_URL =
  process.env.DATABASE_URL || "";

// =====================================================
// DATABASE
// =====================================================

let pool = null;

if (DATABASE_URL) {

  pool = new Pool({

    connectionString:
      DATABASE_URL,

    ssl: {
      rejectUnauthorized: false
    },

    max: 5,

    idleTimeoutMillis:
      30000,

    connectionTimeoutMillis:
      10000

  });

  pool.on(
    "error",
    function (error) {

      console.error(
        "SUPABASE DATABASE ERROR:",
        error.message
      );

    }
  );
}

// =====================================================
// APP
// =====================================================

app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

// =====================================================
// ATHARV AI BRAIN
// =====================================================

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

Your name is Atharv.

You are a helpful, attentive, practical, friendly and personalized AI assistant.

MAIN GOAL:
Do not only answer the user's question.
Understand what the user is trying to achieve and help them complete it.

PERSONALIZATION:
- Use saved user memories when relevant.
- Memories represent information the user previously provided.
- Never invent memories.
- Never claim to remember something that is not available.
- Respect requests to forget information.
- Use preferences naturally without repeatedly mentioning that they are stored.
- Do not expose internal memory keys or database details unless specifically asked.

LANGUAGE:
- Detect the user's language automatically.
- Reply in the same language.
- Support Hindi, Hinglish, English and other languages you understand.
- Preserve the user's natural style.
- If the user mixes languages, natural mixed-language replies are allowed.
- If a saved language preference exists, use it when appropriate.
- Do not translate unless requested.

CONTEXT:
- Use recent conversation context.
- Understand follow-up messages such as:
  "haan", "yes", "continue", "same", "isko", "iske baare mein", "phir?"
- Do not unnecessarily ask the user to repeat information already available.

MEMORY BEHAVIOR:
- A saved name may be used naturally.
- Saved language preferences should influence response language.
- Saved style preferences should influence answer style.
- Saved learning preferences should influence explanations.
- Do not reveal unnecessary personal information.
- Do not mention all memories in every response.
- Only use memories that are relevant to the current request.

ACCURACY:
- Do not invent facts.
- Do not invent current prices, news or events.
- Do not pretend to have live internet access.
- If you do not know something, say so honestly.

TEACHING:
When explaining how to do something:
1. First explain what it is.
2. Explain why it matters.
3. Give a simple example when useful.
4. Give clear Step 1, Step 2, Step 3 instructions.
5. Keep each step simple.
6. Explain technical words in simple language.
7. For coding, tell the user exactly which file to open and what to change.
8. End practical instructions with a short Result section.

BEGINNER MODE:
- Assume the user may be a beginner unless they clearly show advanced knowledge.
- Avoid unnecessary jargon.
- If the user says "simple mein samjhao", make it even simpler.
- If the user says "step by step", give one action at a time.

STYLE:
- Be natural and helpful.
- Do not repeatedly say "I am an AI".
- Do not give unnecessarily long answers.
- Use headings and bullets when useful.
- Be patient and never blame the user.

FINANCE:
- Never guarantee profit.
- Never invent live market prices.
- Explain risk.
- Predictions must be scenarios, not certainty.

IDENTITY:
You are Atharv.
Atharv has its own identity and personality.
Do not claim to be ChatGPT.
`;

// =====================================================
// DATE / TIME
// =====================================================

function getUserDateTime(timeZone) {

  try {

    const zone =
      typeof timeZone === "string" &&
      timeZone.trim()
        ? timeZone
        : "UTC";

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: zone
      }
    ).format(new Date());

  } catch (error) {

    return new Date().toISOString();

  }

}

// =====================================================
// USER ID
// =====================================================

function getUserId(req) {

  const bodyUserId =
    req.body &&
    typeof req.body.userId === "string"
      ? req.body.userId.trim()
      : "";

  const queryUserId =
    req.query &&
    typeof req.query.userId === "string"
      ? req.query.userId.trim()
      : "";

  const suppliedId =
    bodyUserId ||
    queryUserId ||
    "";

  if (suppliedId) {

    return crypto
      .createHash("sha256")
      .update(suppliedId)
      .digest("hex")
      .slice(0, 64);

  }

  const forwarded =
    req.headers["x-forwarded-for"];

  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.socket.remoteAddress ||
        "unknown";

  return crypto
    .createHash("sha256")
    .update(ip)
    .digest("hex")
    .slice(0, 64);

}

  if (suppliedId) {

    return crypto
      .createHash("sha256")
      .update(suppliedId)
      .digest("hex")
      .slice(0, 64);

  }

  const forwarded =
    req.headers["x-forwarded-for"];

  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.socket.remoteAddress ||
        "unknown";

  return crypto
    .createHash("sha256")
    .update(ip)
    .digest("hex")
    .slice(0, 64);

}

// =====================================================
// MEMORY DATABASE HELPERS
// =====================================================

async function getMemories(userId) {

  if (!pool) {
    return [];
  }

  try {

    const result =
      await pool.query(
        `
        SELECT
          memory_key,
          memory_value
        FROM public.user_memories
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 30
        `,
        [userId]
      );

    return result.rows;

  } catch (error) {

    console.error(
      "MEMORY READ ERROR:",
      error.message
    );

    return [];

  }

}

// =====================================================
// SAVE MEMORY
// =====================================================

async function saveMemory(
  userId,
  key,
  value
) {

  if (!pool) {
    return false;
  }

  try {

    await pool.query(
      `
      INSERT INTO public.user_memories
        (
          user_id,
          memory_key,
          memory_value
        )
      VALUES
        ($1, $2, $3)
      ON CONFLICT
        (user_id, memory_key)
      DO UPDATE SET
        memory_value =
          EXCLUDED.memory_value,
        updated_at =
          NOW()
      `,
      [
        userId,
        key,
        value
      ]
    );

    return true;

  } catch (error) {

    console.error(
      "MEMORY SAVE ERROR:",
      error.message
    );

    return false;

  }

}

// =====================================================
// DELETE MEMORY
// =====================================================

async function deleteMemory(
  userId,
  key
) {

  if (!pool) {
    return false;
  }

  try {

    await pool.query(
      `
      DELETE FROM public.user_memories
      WHERE user_id = $1
      AND memory_key = $2
      `,
      [
        userId,
        key
      ]
    );

    return true;

  } catch (error) {

    console.error(
      "MEMORY DELETE ERROR:",
      error.message
    );

    return false;

  }

}

// =====================================================
// DELETE ALL MEMORIES
// =====================================================

async function deleteAllMemories(userId) {

  if (!pool) {
    return false;
  }

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
      "DELETE ALL MEMORY ERROR:",
      error.message
    );

    return false;

  }

}

// =====================================================
// SENSITIVE DATA PROTECTION
// =====================================================

function containsSensitiveData(text) {

  const value =
    String(text || "");

  const patterns = [

    /password\s*[:=]/i,

    /passcode\s*[:=]/i,

    /otp\s*[:=]/i,

    /one[- ]time password/i,

    /api[_ -]?key\s*[:=]/i,

    /secret\s*[:=]/i,

    /token\s*[:=]/i,

    /cvv\s*[:=]/i,

    /card\s*number\s*[:=]/i,

    /\b\d{13,19}\b/

  ];

  return patterns.some(
    function (pattern) {

      return pattern.test(value);

    }
  );

}

// =====================================================
// MEMORY COMMAND DETECTION
// =====================================================

function isForgetRequest(message) {

  const text =
    String(message || "")
      .toLowerCase();

  return (

    text.includes("bhool jao") ||

    text.includes("bhul jao") ||

    text.includes("forget") ||

    text.includes("forget it") ||

    text.includes("delete my memory") ||

    text.includes("meri memory delete") ||

    text.includes("yaad mat rakho") ||

    text.includes("yaad se hata") ||

    text.includes("sab bhool jao") ||

    text.includes("everything forget")

  );

}

function isRememberRequest(message) {

  const text =
    String(message || "")
      .toLowerCase();

  return (

    text.includes("yaad rakho") ||

    text.includes("yaad rakhna") ||

    text.includes("remember this") ||

    text.includes("remember that") ||

    text.includes("remember me")

  );

}

// =====================================================
// EXTRACT INTELLIGENT MEMORIES
// =====================================================

function extractMemories(message) {

  const text =
    String(message || "")
      .trim();

  const memories = [];

  if (!text) {
    return memories;
  }

  // ===================================================
  // NAME
  // ===================================================

  const namePatterns = [

    /(?:mera|my)\s+naam\s+(?:hai|is)\s+([a-zA-Z][a-zA-Z .'-]{1,60})/i,

    /(?:mera naam)\s+([a-zA-Z][a-zA-Z .'-]{1,60})/i,

    /(?:my name is)\s+([a-zA-Z][a-zA-Z .'-]{1,60})/i,

    /(?:i am|i'm)\s+([a-zA-Z][a-zA-Z .'-]{1,40})/i

  ];

  for (
    const pattern of namePatterns
  ) {

    const match =
      text.match(pattern);

    if (
      match &&
      match[1]
    ) {

      let name =
        match[1]
          .trim()
          .replace(
            /[.!?,]+$/,
            ""
          );

      name =
        name
          .split(
            /\s+(?:aur|and|mujhe|please|i|main)\s+/i
          )[0]
          .trim();

      if (
        name.length >= 2 &&
        name.length <= 60
      ) {

        memories.push({

          key:
            "name",

          value:
            name

        });

        break;

      }

    }

  }

  // ===================================================
  // LANGUAGE PREFERENCE
  // ===================================================

  if (
    /(mujhe|mujhse|please).*(hindi|english|hinglish).*(mein|me|language|jawab|reply|answer)/i
      .test(text) ||

    /(reply|answer|respond).*(in hindi|in english|in hinglish)/i
      .test(text)
  ) {

    let language =
      null;

    if (/hinglish/i.test(text)) {
      language = "Hinglish";
    }
    else if (/hindi/i.test(text)) {
      language = "Hindi";
    }
    else if (/english/i.test(text)) {
      language = "English";
    }

    if (language) {

      memories.push({

        key:
          "language_preference",

        value:
          language

      });

    }

  }

  // ===================================================
  // SIMPLE LANGUAGE
  // ===================================================

  if (
    /(?:simple|easy|aasaan).*(language|mein|me|samjha|samjhana|explain)/i
      .test(text) ||

    /(?:simple mein|simple me|aasaan bhasha mein)/i
      .test(text)
  ) {

    memories.push({

      key:
        "response_style",

      value:
        "Use simple and easy-to-understand language."

    });

  }

  // ===================================================
  // SHORT ANSWERS
  // ===================================================

  if (
    /(?:short|chhota|chhote|brief).*(answer|reply|response|jawab)/i
      .test(text) ||

    /(?:answers|replies|responses).*(short|brief)/i
      .test(text)
  ) {

    memories.push({

      key:
        "answer_length",

      value:
        "Prefer short and concise answers."

    });

  }

  // ===================================================
  // DETAILED ANSWERS
  // ===================================================

  if (
    /(?:detailed|detail mein|detail me|deeply|thorough).*(answer|reply|explain|samjha)/i
      .test(text)
  ) {

    memories.push({

      key:
        "answer_length",

      value:
        "Prefer detailed explanations."

    });

  }

  // ===================================================
  // STEP BY STEP
  // ===================================================

  if (
    /(?:step by step|step-by-step|ek ek karke|one by one)/i
      .test(text)
  ) {

    memories.push({

      key:
        "teaching_style",

      value:
        "Prefer step-by-step instructions."

    });

  }

  // ===================================================
  // ENGLISH LEARNING
  // ===================================================

  if (
    /(?:english|angrezi).*(seekh|learn|practice|speaking|bolna)/i
      .test(text) ||

    /(?:seekhna|learn).*(english|angrezi)/i
      .test(text)
  ) {

    memories.push({

      key:
        "learning_goal",

      value:
        "Interested in learning or practicing English."

    });

  }

  // ===================================================
  // EXPLICIT REMEMBER
  // ===================================================

  if (
    isRememberRequest(text) &&
    !containsSensitiveData(text)
  ) {

    const cleaned =
      text
        .replace(
          /(?:mujhe|please|plz|can you|could you|you can|you should)/gi,
          ""
        )
        .replace(
          /(?:yaad rakho|yaad rakhna|remember this|remember that|remember me)/gi,
          ""
        )
        .replace(
          /^[\s,:-]+/,
          ""
        )
        .trim();

    // Only create generic note when
    // no specific memory was detected.

    if (
      memories.length === 0 &&
      cleaned.length >= 3 &&
      cleaned.length <= 200
    ) {

      memories.push({

        key:
          "user_note",

        value:
          cleaned

      });

    }

  }

  // ===================================================
  // REMOVE DUPLICATE MEMORY KEYS
  // ===================================================

  const unique =
    new Map();

  memories.forEach(
    function (memory) {

      unique.set(
        memory.key,
        memory
      );

    }
  );

  return Array.from(
    unique.values()
  );

}

// =====================================================
// MEMORY TEXT
// =====================================================

function buildMemoryText(memories) {

  if (
    !Array.isArray(memories) ||
    memories.length === 0
  ) {

    return "No saved user memories.";

  }

  return memories
    .map(
      function (memory) {

        return (
          "- " +
          memory.memory_key +
          ": " +
          memory.memory_value
        );

      }
    )
    .join("\n");

}

// =====================================================
// CLEAN HISTORY
// =====================================================

function cleanHistory(history) {

  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      function (item) {

        return (

          item &&

          typeof item.text ===
            "string" &&

          (
            item.type === "user" ||
            item.type === "ai"
          )

        );

      }
    )
    .slice(-6);

}

// =====================================================
// BUILD PROMPT
// =====================================================

function buildPrompt(
  message,
  history,
  memories
) {

  const recent =
    cleanHistory(history);

  let context = "";

  if (recent.length) {

    context =
      recent
        .map(
          function (item) {

            return (

              item.type === "user"
                ? "USER: "
                : "ATHARV: "

            ) + item.text;

          }
        )
        .join("\n");

  }

  const memoryText =
    buildMemoryText(memories);

  return `
SAVED USER MEMORIES:

${memoryText}

RECENT CONVERSATION:

${context || "No recent conversation."}

END CONTEXT

CURRENT USER MESSAGE:

${message}

Answer the current message naturally.

Use saved memories only when relevant.

If a language preference is saved,
follow it unless the current user message
clearly uses another language and indicates
they want that language.

If a response-style preference is saved,
follow it naturally.

Do not mention the memory system
unless the user asks about it.

Do not repeat the whole conversation.
`;

}

// =====================================================
// GROQ AI
// =====================================================

async function callGroq(
  message,
  currentTime,
  history,
  memories
) {

  if (!GROQ_API_KEY) {

    throw new Error(
      "GROQ_API_KEY is not configured."
    );

  }

  const response =
    await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          Authorization:
            "Bearer " +
            GROQ_API_KEY

        },

        body:
          JSON.stringify({

            model:
              GROQ_MODEL,

            messages: [

              {

                role:
                  "system",

                content:
                  ATHARV_INSTRUCTIONS +
                  "\n\nCurrent date/time: " +
                  currentTime

              },

              {

                role:
                  "user",

                content:
                  buildPrompt(
                    message,
                    history,
                    memories
                  )

              }

            ],

            temperature:
              0.4,

            max_tokens:
              2500

          })

      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    const errorMessage =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Unknown Groq error";

    throw new Error(
      "Groq " +
      response.status +
      ": " +
      errorMessage
    );

  }

  const reply =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content.trim()
      : "";

  if (!reply) {

    throw new Error(
      "Groq returned an empty response."
    );

  }

  return reply;

}

// =====================================================
// SSE
// =====================================================

function sendSSE(
  res,
  data
) {

  res.write(
    "data: " +
    JSON.stringify(data) +
    "\n\n"
  );

}

// =====================================================
// ARTIFICIAL STREAM
// =====================================================

async function sendArtificialStream(
  res,
  text
) {

  const chunks =
    String(text)
      .match(
        /.{1,50}(\s+|$)/g
      ) || [
        String(text)
      ];

  for (
    const chunk of chunks
  ) {

    sendSSE(
      res,
      {
        type:
          "chunk",

        text:
          chunk
      }
    );

    await new Promise(
      function (resolve) {

        setTimeout(
          resolve,
          10
        );

      }
    );

  }

}

// =====================================================
// CHAT USER ID
// =====================================================

function getChatUserId(req) {

  return getUserId(req);

}

// =====================================================
// PROCESS MEMORY
// =====================================================

async function processMemory(
  userId,
  message
) {

  if (!pool) {
    return;
  }

  // -----------------------------------------------
  // FORGET EVERYTHING
  // -----------------------------------------------

  if (
    isForgetRequest(message) &&
    /sab|everything|all|meri memory/i.test(message)
  ) {

    await deleteAllMemories(
      userId
    );

    return;

  }

  // -----------------------------------------------
  // FORGET COMMAND
  // -----------------------------------------------

  if (
    isForgetRequest(message)
  ) {

    await deleteMemory(
      userId,
      "user_note"
    );

    if (
      /naam|name/i.test(message)
    ) {

      await deleteMemory(
        userId,
        "name"
      );

    }

    if (
      /language|bhasha|hindi|english|hinglish/i.test(message)
    ) {

      await deleteMemory(
        userId,
        "language_preference"
      );

    }

    if (
      /simple|style|answer|reply|response/i.test(message)
    ) {

      await deleteMemory(
        userId,
        "response_style"
      );

      await deleteMemory(
        userId,
        "answer_length"
      );

      await deleteMemory(
        userId,
        "teaching_style"
      );

    }

  }

  // -----------------------------------------------
  // SAVE NEW MEMORIES
  // -----------------------------------------------

  const extracted =
    extractMemories(message);

  if (
    extracted.length &&
    !containsSensitiveData(message)
  ) {

    for (
      const memory of extracted
    ) {

      await saveMemory(
        userId,
        memory.key,
        memory.value
      );

    }

  }

}

// =====================================================
// NORMAL CHAT
// =====================================================

app.post(
  "/api/chat",
  async function (req, res) {

    const message =
      typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

    const history =
      Array.isArray(req.body.history)
        ? req.body.history
        : [];

    const timeZone =
      typeof req.body.timeZone === "string"
        ? req.body.timeZone
        : "UTC";

    if (!message) {

      return res.status(400).json({

        error:
          "Message is required."

      });

    }

    try {

      const userId =
        getChatUserId(req);

      await processMemory(
        userId,
        message
      );

      const memories =
        await getMemories(
          userId
        );

      const currentTime =
        getUserDateTime(
          timeZone
        );

      const reply =
        await callGroq(
          message,
          currentTime,
          history,
          memories
        );

      return res.json({

        reply,

        provider:
          "groq",

        memory:
          true,

        webSearch:
          false

      });

    } catch (error) {

      console.error(
        "ATHARV GROQ ERROR:",
        error.message
      );

      return res.status(503).json({

        error:
          "Atharv AI abhi response generate nahi kar pa raha: " +
          error.message

      });

    }

  }
);

// =====================================================
// STREAM CHAT
// =====================================================

app.post(
  "/api/chat/stream",
  async function (req, res) {

    const message =
      typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

    const history =
      Array.isArray(req.body.history)
        ? req.body.history
        : [];

    const timeZone =
      typeof req.body.timeZone === "string"
        ? req.body.timeZone
        : "UTC";

    if (!message) {

      return res.status(400).json({

        error:
          "Message is required."

      });

    }

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

    if (
      typeof res.flushHeaders ===
      "function"
    ) {

      res.flushHeaders();

    }

    try {

      const userId =
        getChatUserId(req);

      await processMemory(
        userId,
        message
      );

      const memories =
        await getMemories(
          userId
        );

      const currentTime =
        getUserDateTime(
          timeZone
        );

      sendSSE(
        res,
        {

          type:
            "status",

          provider:
            "groq",

          memory:
            true

        }
      );

      const reply =
        await callGroq(
          message,
          currentTime,
          history,
          memories
        );

      await sendArtificialStream(
        res,
        reply
      );

      sendSSE(
        res,
        {

          type:
            "done",

          provider:
            "groq",

          memory:
            true,

          webSearch:
            false

        }
      );

    } catch (error) {

      console.error(
        "ATHARV STREAM ERROR:",
        error.message
      );

      sendSSE(
        res,
        {

          type:
            "error",

          error:
            error.message

        }
      );

    } finally {

      sendSSE(
        res,
        {
          type:
            "close"
        }
      );

      res.end();

    }

  }
);

// =====================================================
// MEMORY TEST API
// =====================================================

app.get(
  "/api/memory",
  async function (req, res) {

    try {

      const userId =
        getUserId(req);

      const memories =
        await getMemories(
          userId
        );

      return res.json({

        ok:
          true,

        memories

      });

    } catch (error) {

      return res.status(500).json({

        ok:
          false,

        error:
          error.message

      });

    }

  }
);

// =====================================================
// DELETE SINGLE MEMORY
// =====================================================

app.post(
  "/api/memory/delete",
  async function (req, res) {

    try {

      const userId =
        getUserId(req);

      const key =
        typeof req.body.key === "string"
          ? req.body.key.trim()
          : "";

      const allowedKeys = [
        "name",
        "language_preference",
        "response_style",
        "answer_length",
        "teaching_style",
        "learning_goal",
        "user_note"
      ];

      if (!key) {

        return res.status(400).json({

          ok: false,

          error:
            "Memory key is required."

        });

      }

      if (
        !allowedKeys.includes(key)
      ) {

        return res.status(400).json({

          ok: false,

          error:
            "Invalid memory key."

        });

      }

      const deleted =
        await deleteMemory(
          userId,
          key
        );

      if (!deleted) {

        return res.status(500).json({

          ok: false,

          error:
            "Memory delete nahi ho paayi."

        });

      }

      const memories =
        await getMemories(
          userId
        );

      return res.json({

        ok: true,

        message:
          "Memory deleted.",

        memories

      });

    } catch (error) {

      console.error(
        "MEMORY DELETE API ERROR:",
        error.message
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message

      });

    }

  }
);


// =====================================================
// DELETE ALL MEMORIES API
// =====================================================

app.post(
  "/api/memory/clear",
  async function (req, res) {

    try {

      const userId =
        getUserId(req);

      const deleted =
        await deleteAllMemories(
          userId
        );

      if (!deleted) {

        return res.status(500).json({

          ok: false,

          error:
            "Memories clear nahi ho paayi."

        });

      }

      return res.json({

        ok: true,

        message:
          "All memories deleted.",

        memories: []

      });

    } catch (error) {

      console.error(
        "MEMORY CLEAR API ERROR:",
        error.message
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message

      });

    }

  }
);

// =====================================================
// HEALTH
// =====================================================

app.get(
  "/health",
  async function (req, res) {

    let database =
      false;

    if (pool) {

      try {

        await pool.query(
          "SELECT 1"
        );

        database =
          true;

      } catch (error) {

        database =
          false;

      }

    }

    res.json({

      ok:
        true,

      service:
        "Atharv AI",

      provider:
        "Groq",

      model:
        GROQ_MODEL,

      database:
        database,

      features: {

        multilingual:
          true,

        conversationContext:
          true,

        permanentMemory:
          database,

        intelligentMemory:
          database,

        memorySave:
          database,

        memoryRecall:
          database,

        stepByStepTeaching:
          true,

        beginnerFriendly:
          true,

        streaming:
          true,

        webSearch:
          false,

        marketLiveData:
          false

      },

      time:
        new Date().toISOString()

    });

  }
);

// =====================================================
// STATIC FRONTEND
// =====================================================

app.use(
  express.static(
    __dirname
  )
);

// =====================================================
// CATCH ALL
// =====================================================

app.use(
  function (req, res) {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  function () {

    console.log(
      "================================"
    );

    console.log(
      "ATHARV AI SERVER STARTED 🤖"
    );

    console.log(
      "Provider: Groq"
    );

    console.log(
      "Model:",
      GROQ_MODEL
    );

    console.log(
      "Supabase Memory:",
      pool
        ? "ENABLED"
        : "DISABLED"
    );

    console.log(
      "Intelligent Memory: ENABLED"
    );

    console.log(
      "Streaming: ENABLED"
    );

    console.log(
      "Conversation Context: ENABLED"
    );

    console.log(
      "Step-by-Step Teaching: ENABLED"
    );

    console.log(
      "Live Web Search: TEMPORARILY OFF"
    );

    console.log(
      "================================"
    );

  }
);
