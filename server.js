require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// =========================================
// CONFIG
// =========================================

const PORT = process.env.PORT || 10000;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "";

const GROQ_API_KEY =
  process.env.GROQ_API_KEY || "";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash";

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

// =========================================
// ATHARV INSTRUCTIONS
// =========================================

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

Identity:
You are a helpful, intelligent and attentive AI assistant.

Core principle:
Do not only answer the user. Help the user complete their task.

Language:
- Automatically understand the user's language.
- Reply in the same language and style.
- Support Hindi, Hinglish, English and other languages.
- If the user mixes languages, naturally mix languages too.
- Do not translate unless the user asks for translation.

Communication:
- Be natural, friendly and clear.
- Understand context from the current conversation.
- Do not ask unnecessary clarification questions.
- If enough information is available, directly perform the task.
- If something is genuinely missing, ask only the necessary question.
- Prefer practical answers and step-by-step instructions when useful.

Accuracy:
- Never invent facts.
- If information may be current or changing, use web search when available.
- Clearly say when something cannot be verified.
- For finance, stocks and investments, never guarantee profit.

Current information:
When the user asks about today's news, latest events, current prices,
weather, recent announcements, current companies or other changing
information, use available web search tools.

Style:
- Keep simple questions concise.
- Give more detail when the task requires it.
- Use headings and bullets when they improve readability.
- For Hindi/Hinglish users, use natural Hindi/Hinglish.
- Do not repeatedly say "Atharv soch raha hai".

You are Atharv.
`;

// =========================================
// DATE / TIME
// =========================================

function getUserDateTime(timeZone) {
  try {
    const zone =
      typeof timeZone === "string" &&
      timeZone.length < 100
        ? timeZone
        : "Asia/Kolkata";

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone: zone,
        dateStyle: "full",
        timeStyle: "long"
      }
    ).format(new Date());

  } catch (error) {
    return new Date().toISOString();
  }
}

// =========================================
// CURRENT / LIVE QUESTION DETECTION
// =========================================

function needsWebSearch(text) {
  const query =
    String(text || "").toLowerCase();

  const keywords = [
    "today",
    "tonight",
    "right now",
    "currently",
    "current",
    "latest",
    "recent",
    "news",
    "breaking",
    "this week",
    "this month",
    "yesterday",
    "tomorrow",
    "live",
    "price",
    "stock price",
    "share price",
    "market today",
    "weather",
    "temperature",
    "score",
    "result",
    "election",
    "president",
    "prime minister",
    "minister",
    "bitcoin",
    "crypto price",
    "gold price",
    "silver price",
    "petrol price",
    "diesel price",
    "exchange rate",
    "usd",
    "inr",
    "nifty",
    "sensex",
    "ipo"
  ];

  return keywords.some(function (word) {
    return query.includes(word);
  });
}

// =========================================
// FETCH WITH TIMEOUT
// =========================================

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 25000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      function () {
        controller.abort();
      },
      timeout
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

// =========================================
// GEMINI
// =========================================

async function callGemini(
  userMessage,
  timeZone,
  useWebSearch
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  const currentDateTime =
    getUserDateTime(timeZone);

  const instructions =
    ATHARV_INSTRUCTIONS +
    `

User's current date/time:
${currentDateTime}
`;

  const body = {
    systemInstruction: {
      parts: [
        {
          text: instructions
        }
      ]
    },

    contents: [
      {
        role: "user",
        parts: [
          {
            text: userMessage
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1200
    }
  };

  // Google Search for current information.
  if (useWebSearch) {
    body.tools = [
      {
        google_search: {}
      }
    ];
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(GEMINI_MODEL) +
    ":generateContent";

  const response =
    await fetchWithTimeout(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          "x-goog-api-key":
            GEMINI_API_KEY
        },

        body:
          JSON.stringify(body)
      },
      25000
    );

  const data =
    await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      "Gemini API error";

    throw new Error(
      `Gemini ${response.status}: ${message}`
    );
  }

  const parts =
    data?.candidates?.[0]?.content?.parts ||
    [];

  const reply =
    parts
      .map(function (part) {
        return part.text || "";
      })
      .join("")
      .trim();

  if (!reply) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return reply;
}

// =========================================
// GROQ FALLBACK
// =========================================

async function callGroq(
  userMessage,
  timeZone
) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const currentDateTime =
    getUserDateTime(timeZone);

  const systemMessage =
    ATHARV_INSTRUCTIONS +
    `

User's current date/time:
${currentDateTime}
`;

  const response =
    await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            "Bearer " +
            GROQ_API_KEY
        },

        body:
          JSON.stringify({
            model: GROQ_MODEL,

            messages: [
              {
                role: "system",
                content: systemMessage
              },
              {
                role: "user",
                content: userMessage
              }
            ],

            temperature: 0.7,

            max_completion_tokens: 1200
          })
      },
      25000
    );

  const data =
    await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      "Groq API error";

    throw new Error(
      `Groq ${response.status}: ${message}`
    );
  }

  const reply =
    data?.choices?.[0]?.message?.content
      ?.trim();

  if (!reply) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  return reply;
}

// =========================================
// HEALTH
// =========================================

app.get(
  "/health",
  function (req, res) {
    res.json({
      ok: true,
      service: "Atharv AI",

      providers: {
        gemini:
          Boolean(GEMINI_API_KEY),
        groq:
          Boolean(GROQ_API_KEY)
      },

      models: {
        gemini: GEMINI_MODEL,
        groq: GROQ_MODEL
      },

      historyToAI:
        false,

      time:
        new Date().toISOString()
    });
  }
);

// =========================================
// CHAT API
// =========================================

app.post(
  "/api/chat",
  async function (req, res) {
    const started =
      Date.now();

    try {
      const message =
        typeof req.body?.message ===
        "string"
          ? req.body.message.trim()
          : "";

      const timeZone =
        req.body?.timeZone ||
        "Asia/Kolkata";

      if (!message) {
        return res
          .status(400)
          .json({
            error:
              "Message required."
          });
      }

      console.log(
        "================================"
      );

      console.log(
        "ATHARV REQUEST"
      );

      console.log(
        "Message:",
        message.slice(0, 200)
      );

      console.log(
        "Gemini:",
        Boolean(GEMINI_API_KEY)
      );

      console.log(
        "Groq:",
        Boolean(GROQ_API_KEY)
      );

      // IMPORTANT:
      // Browser history is NOT sent to AI.
      // This saves tokens and keeps old chat
      // only in the user's browser.

      const useWebSearch =
        needsWebSearch(message);

      console.log(
        "Web search:",
        useWebSearch
      );

      // =====================================
      // 1. GEMINI PRIMARY
      // =====================================

      if (GEMINI_API_KEY) {
        try {
          console.log(
            "ATHARV: Trying Gemini..."
          );

          const reply =
            await callGemini(
              message,
              timeZone,
              useWebSearch
            );

          console.log(
            "ATHARV: Gemini SUCCESS"
          );

          console.log(
            "Time:",
            Date.now() -
              started,
            "ms"
          );

          return res.json({
            reply,
            provider: "gemini",
            webSearch:
              useWebSearch
          });

        } catch (geminiError) {
          console.error(
            "GEMINI ERROR:",
            geminiError.message
          );

          console.log(
            "ATHARV: Switching to Groq..."
          );
        }
      }

      // =====================================
      // 2. GROQ FALLBACK
      // =====================================

      if (GROQ_API_KEY) {
        try {
          console.log(
            "ATHARV: Trying Groq..."
          );

          // For current/live questions, do not
          // silently pretend Groq is live-search
          // capable in this fallback.
          if (useWebSearch) {
            return res.status(503).json({
              error:
                "Live information service is temporarily unavailable. Please try again shortly."
            });
          }

          const reply =
            await callGroq(
              message,
              timeZone
            );

          console.log(
            "ATHARV: Groq SUCCESS"
          );

          console.log(
            "Time:",
            Date.now() -
              started,
            "ms"
          );

          return res.json({
            reply,
            provider: "groq",
            webSearch: false
          });

        } catch (groqError) {
          console.error(
            "GROQ ERROR:",
            groqError.message
          );
        }
      }

      // =====================================
      // NO PROVIDER
      // =====================================

      return res.status(503).json({
        error:
          "Atharv AI providers are temporarily unavailable. Please try again shortly."
      });

    } catch (error) {
      console.error(
        "ATHARV SERVER ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Atharv server error. Please try again."
      });
    }
  }
);

// =========================================
// FRONTEND
// =========================================

app.use(
  express.static(
    path.join(
      __dirname
    )
  )
);

app.get(
  "*",
  function (req, res) {
    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);

// =========================================
// START SERVER
// =========================================

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
      "Port:",
      PORT
    );

    console.log(
      "Gemini:",
      GEMINI_API_KEY
        ? "ENABLED"
        : "NOT CONFIGURED"
    );

    console.log(
      "Groq:",
      GROQ_API_KEY
        ? "ENABLED"
        : "NOT CONFIGURED"
    );

    console.log(
      "Gemini model:",
      GEMINI_MODEL
    );

    console.log(
      "Groq model:",
      GROQ_MODEL
    );

    console.log(
      "Browser history sent to AI: NO"
    );

    console.log(
      "================================"
    );
  }
);
