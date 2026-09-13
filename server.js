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

const GROQ_WEB_MODEL =
  process.env.GROQ_WEB_MODEL ||
  "groq/compound-mini";

// =========================================
// ATHARV INSTRUCTIONS
// =========================================

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

You are a helpful, intelligent, attentive and practical AI assistant.

CORE PRINCIPLE:
Do not only answer the user's question.
Help the user complete their task.

LANGUAGE:
- Automatically understand the user's language.
- Reply in the same language and style.
- Support Hindi, Hinglish, English and other languages.
- If the user mixes languages, naturally mix languages.
- Do not translate unless requested.
- Never unnecessarily change the user's language.

COMMUNICATION:
- Be natural, friendly and clear.
- Use the context available in the current request.
- Do not ask unnecessary questions.
- If enough information is available, directly answer.
- If something is genuinely missing, ask only the necessary question.
- Prefer practical and useful answers.
- Use step-by-step instructions when helpful.

ACCURACY:
- Never invent facts.
- For current or changing information, use web search.
- Clearly distinguish verified information from uncertainty.
- For finance, stocks and investments, never guarantee profit.

CURRENT INFORMATION:
For questions involving:
- today's news
- latest news
- breaking news
- current events
- current prices
- stock/share prices
- weather
- sports scores
- recent announcements
- current political information
- current company information
- anything that changes over time

use the available web search capability.

WEB SEARCH:
When web search is available, prefer recent and reliable sources.
Do not pretend old knowledge is current.

STYLE:
- Simple questions: concise answer.
- Complex questions: detailed answer.
- Use headings and bullets when useful.
- Hindi/Hinglish users should receive natural Hindi/Hinglish.
- English users should receive English.
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
    "todays",
    "today's",
    "tonight",
    "right now",
    "currently",
    "current",
    "latest",
    "lastest",
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
    "stock market",
    "market today",
    "weather",
    "temperature",
    "score",
    "scores",
    "result",
    "results",
    "election",
    "president",
    "prime minister",
    "minister",
    "bitcoin",
    "crypto",
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
    "ipo",

    // Hindi
    "आज",
    "आज की",
    "आज के",
    "आज का",
    "ताजा खबर",
    "ताज़ा खबर",
    "लेटेस्ट",
    "न्यूज़",
    "समाचार",
    "अभी",
    "वर्तमान",
    "मौसम",
    "भाव",
    "शेयर",
    "शेयर भाव",
    "सोने का भाव",
    "चांदी का भाव",
    "बिटकॉइन"
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

  // =====================================
  // GOOGLE SEARCH
  // =====================================

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
// GROQ NORMAL
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
                content:
                  systemMessage
              },
              {
                role: "user",
                content:
                  userMessage
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
// GROQ WEB SEARCH
// =========================================

async function callGroqWebSearch(
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

IMPORTANT:
This is a live/current-information request.

Use your built-in web search.
Search the web before answering.
Prefer recent and reliable sources.
If sources disagree, explain the difference.
Do not fabricate current information.

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
            GROQ_API_KEY,

          "Groq-Model-Version":
            "latest"
        },

        body:
          JSON.stringify({
            model:
              GROQ_WEB_MODEL,

            messages: [
              {
                role: "system",
                content:
                  systemMessage
              },
              {
                role: "user",
                content:
                  userMessage
              }
            ],

            citation_options:
              "enabled"
          })
      },

      30000
    );

  const data =
    await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      "Groq web search error";

    throw new Error(
      `Groq Web ${response.status}: ${message}`
    );
  }

  const reply =
    data?.choices?.[0]?.message?.content
      ?.trim();

  if (!reply) {
    throw new Error(
      "Groq web search returned an empty response."
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
        gemini:
          GEMINI_MODEL,

        groq:
          GROQ_MODEL,

        groqWeb:
          GROQ_WEB_MODEL
      },

      features: {
        googleSearch:
          Boolean(GEMINI_API_KEY),

        groqWebSearch:
          Boolean(GROQ_API_KEY),

        multilingual:
          true,

        localHistoryToAI:
          false
      },

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

      const useWebSearch =
        needsWebSearch(message);

      console.log(
        "Web search required:",
        useWebSearch
      );

      // =====================================
      // GEMINI
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

            provider:
              "gemini",

            webSearch:
              useWebSearch
          });

        } catch (geminiError) {
          console.error(
            "GEMINI ERROR:",
            geminiError.message
          );

          console.log(
            "ATHARV: Gemini failed."
          );
        }
      }

      // =====================================
      // LIVE QUESTION → GROQ WEB SEARCH
      // =====================================

      if (
        useWebSearch &&
        GROQ_API_KEY
      ) {
        try {
          console.log(
            "ATHARV: Trying Groq Web Search..."
          );

          const reply =
            await callGroqWebSearch(
              message,
              timeZone
            );

          console.log(
            "ATHARV: Groq Web Search SUCCESS"
          );

          console.log(
            "Time:",
            Date.now() -
              started,
            "ms"
          );

          return res.json({
            reply,

            provider:
              "groq-web",

            webSearch:
              true
          });

        } catch (groqWebError) {
          console.error(
            "GROQ WEB ERROR:",
            groqWebError.message
          );
        }
      }

      // =====================================
      // NORMAL GROQ
      // =====================================

      if (GROQ_API_KEY) {
        try {
          console.log(
            "ATHARV: Trying normal Groq..."
          );

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

            provider:
              "groq",

            webSearch:
              false
          });

        } catch (groqError) {
          console.error(
            "GROQ ERROR:",
            groqError.message
          );
        }
      }

      // =====================================
      // ALL PROVIDERS FAILED
      // =====================================

      return res.status(503).json({
        error:
          useWebSearch
            ? "Live search is temporarily unavailable. Please try again shortly."
            : "Atharv AI providers are temporarily unavailable. Please try again shortly."
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
    path.join(__dirname)
  )
);

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
      "Groq Web model:",
      GROQ_WEB_MODEL
    );

    console.log(
      "Browser history sent to AI: NO"
    );

    console.log(
      "================================"
    );
  }
);
