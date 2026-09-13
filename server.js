require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

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
// APP
// =========================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// =========================================
// ATHARV SYSTEM INSTRUCTIONS
// =========================================

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

Identity:
- Your name is Atharv.
- You are a helpful, attentive, multilingual AI assistant.
- Your goal is not only to answer questions, but to help the user complete their task.

LANGUAGE:
- Automatically understand the user's language.
- Reply in the same language and writing style as the user.
- Support Hindi, Hinglish, English, Bengali, Urdu, Tamil, Telugu,
  Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese,
  Arabic, Chinese, Japanese, Korean, Spanish, French, German,
  Italian, Portuguese, Russian, Turkish, Indonesian, Vietnamese,
  Thai and other languages you understand.
- If the user mixes languages, naturally understand and respond naturally.
- Do NOT translate unless the user asks for translation.

ACCURACY:
- Never invent facts.
- If information is uncertain, clearly say so.
- For current/live questions, use the available web-search capability.
- Never pretend that old knowledge is today's information.

CURRENT INFORMATION:
- Questions containing latest, today, current, now, news, recent,
  live, price, weather, result, score, market update, etc. require
  current information.
- Hindi equivalents such as आज, अभी, ताजा, नवीनतम, खबर, समाचार,
  वर्तमान, शेयर भाव आदि should also be treated as current requests.

NEWS:
- For news, give concise important headlines first.
- Mention dates when useful.
- Prefer reliable sources.
- Do not fabricate breaking news.

FINANCE:
- Explain stocks, markets, mutual funds, ETFs and finance clearly.
- For current prices or market information, use web search.
- Never guarantee profit.
- Clearly explain risk when discussing investments.

STYLE:
- Be clear and useful.
- Avoid unnecessary disclaimers.
- Do not repeatedly say "I am just an AI".
- For simple questions, answer simply.
- For complex questions, structure the answer with headings and bullets.
- Match the user's language and tone.

MEMORY:
- Use the conversation information supplied in the current request.
- Do not claim to remember information that has not actually been provided.
`;

// =========================================
// DATE / TIME
// =========================================

function getUserDateTime(timeZone) {
  try {
    const zone =
      typeof timeZone === "string" &&
      timeZone.length > 0
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

// =========================================
// LIVE / WEB SEARCH DETECTION
// =========================================

function needsWebSearch(message) {
  const text =
    String(message || "").toLowerCase();

  const keywords = [
    // English
    "latest",
    "lastest",
    "today",
    "todays",
    "today's",
    "current",
    "currently",
    "right now",
    "now",
    "recent",
    "recently",
    "breaking",
    "news",
    "headline",
    "headlines",
    "live",
    "update",
    "updates",
    "what happened",
    "what is happening",
    "happening in the world",
    "weather",
    "temperature",
    "stock price",
    "share price",
    "market price",
    "nifty",
    "sensex",
    "crypto price",
    "bitcoin price",
    "gold price",
    "silver price",
    "exchange rate",
    "usd inr",
    "result",
    "results",
    "score",
    "match today",

    // Hindi
    "आज",
    "अभी",
    "आज की",
    "आज का",
    "आज के",
    "ताजा",
    "ताज़ा",
    "नवीनतम",
    "लेटेस्ट",
    "न्यूज़",
    "न्यूज",
    "खबर",
    "खबरें",
    "समाचार",
    "वर्तमान",
    "हाल की",
    "हालिया",
    "लाइव",
    "अपडेट",
    "मौसम",
    "तापमान",
    "शेयर भाव",
    "शेयर प्राइस",
    "स्टॉक प्राइस",
    "बाजार",
    "बाज़ार",
    "निफ्टी",
    "सेंसेक्स",
    "सोना",
    "चांदी",
    "नतीजा",
    "रिजल्ट"
  ];

  return keywords.some(function (keyword) {
    return text.includes(keyword);
  });
}

// =========================================
// FETCH WITH TIMEOUT
// =========================================

async function fetchWithTimeout(
  url,
  options,
  timeoutMs = 30000
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(function () {
      controller.abort();
    }, timeoutMs);

  try {
    return await fetch(
      url,
      {
        ...options,
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

// =========================================
// GEMINI
// =========================================

async function callGemini(
  message,
  currentTime,
  useWebSearch
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(GEMINI_MODEL) +
    ":generateContent";

  const body = {
    systemInstruction: {
      parts: [
        {
          text:
            ATHARV_INSTRUCTIONS +
            "\n\nCurrent user date/time: " +
            currentTime
        }
      ]
    },

    contents: [
      {
        role: "user",
        parts: [
          {
            text: message
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048
    }
  };

  // Gemini Google Search grounding
  if (useWebSearch) {
    body.tools = [
      {
        google_search: {}
      }
    ];
  }

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
      30000
    );

  const data =
    await response.json();

  if (!response.ok) {
    const errorMessage =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Unknown Gemini error";

    throw new Error(
      "Gemini " +
        response.status +
        ": " +
        errorMessage
    );
  }

  const reply =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts
      ? data.candidates[0].content.parts
          .map(function (part) {
            return part.text || "";
          })
          .join("")
          .trim()
      : "";

  if (!reply) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return reply;
}

// =========================================
// NORMAL GROQ
// =========================================

async function callGroq(
  message,
  currentTime
) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "Groq API key is not configured."
    );
  }

  const url =
    "https://api.groq.com/openai/v1/chat/completions";

  const response =
    await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            "Bearer " +
            GROQ_API_KEY
        },
        body: JSON.stringify({
          model: GROQ_MODEL,

          messages: [
            {
              role: "system",
              content:
                ATHARV_INSTRUCTIONS +
                "\n\nCurrent user date/time: " +
                currentTime
            },
            {
              role: "user",
              content: message
            }
          ],

          temperature: 0.4,
          max_tokens: 2048
        })
      },
      30000
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

// =========================================
// GROQ WEB SEARCH
// =========================================

async function callGroqWebSearch(
  message,
  currentTime
) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "Groq API key is not configured."
    );
  }

  const url =
    "https://api.groq.com/openai/v1/chat/completions";

  const response =
    await fetchWithTimeout(
      url,
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

        body: JSON.stringify({
          model: GROQ_WEB_MODEL,

          messages: [
            {
              role: "system",
              content:
                ATHARV_INSTRUCTIONS +
                "\n\nCurrent user date/time: " +
                currentTime +
                "\n\nIMPORTANT: This is a live-information request. Use web search and base the answer on current information."
            },
            {
              role: "user",
              content: message
            }
          ],

          // IMPORTANT:
          // Do NOT send citation_options here.
          // Compound Web Search automatically handles citations.

          search_settings: {
            country: "IN"
          },

          temperature: 0.3,
          max_tokens: 2048
        })
      },
      45000
    );

  const data =
    await response.json();

  if (!response.ok) {
    const errorMessage =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Unknown Groq Web Search error";

    throw new Error(
      "Groq Web " +
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
      "Groq Web Search returned an empty response."
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

        multilingual: true,

        localHistoryToAI: false
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
    const message =
      typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

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

    const currentTime =
      getUserDateTime(timeZone);

    const useWebSearch =
      needsWebSearch(message);

    console.log(
      "================================"
    );

    console.log(
      "ATHARV REQUEST"
    );

    console.log(
      "Message:",
      message
    );

    console.log(
      "Web search required:",
      useWebSearch
    );

    console.log(
      "Gemini:",
      Boolean(GEMINI_API_KEY)
    );

    console.log(
      "Groq:",
      Boolean(GROQ_API_KEY)
    );

    // -----------------------------------------
    // 1. GEMINI
    // -----------------------------------------

    if (GEMINI_API_KEY) {
      try {
        console.log(
          "ATHARV: Trying Gemini..."
        );

        const reply =
          await callGemini(
            message,
            currentTime,
            useWebSearch
          );

        console.log(
          "ATHARV: Gemini SUCCESS"
        );

        return res.json({
          reply,
          provider: "gemini",
          webSearch:
            useWebSearch
        });

      } catch (error) {
        console.error(
          "GEMINI ERROR:",
          error.message
        );
      }
    }

    // -----------------------------------------
    // 2. GROQ WEB SEARCH
    // Only for current/live questions
    // -----------------------------------------

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
            currentTime
          );

        console.log(
          "ATHARV: Groq Web Search SUCCESS"
        );

        return res.json({
          reply,
          provider:
            "groq-compound-mini",
          webSearch: true
        });

      } catch (error) {
        console.error(
          "GROQ WEB ERROR:",
          error.message
        );
      }
    }

    // -----------------------------------------
    // 3. NORMAL GROQ FALLBACK
    // -----------------------------------------

    if (GROQ_API_KEY) {
      try {
        console.log(
          "ATHARV: Trying normal Groq..."
        );

        const reply =
          await callGroq(
            message,
            currentTime
          );

        console.log(
          "ATHARV: Normal Groq SUCCESS"
        );

        return res.json({
          reply,
          provider: "groq",
          webSearch: false
        });

      } catch (error) {
        console.error(
          "GROQ ERROR:",
          error.message
        );
      }
    }

    // -----------------------------------------
    // ALL PROVIDERS FAILED
    // -----------------------------------------

    return res.status(503).json({
      error:
        "Atharv ke AI services abhi unavailable hain. Please thodi der baad dobara try karein."
    });
  }
);

// =========================================
// STATIC FRONTEND
// =========================================

app.use(
  express.static(__dirname)
);

// =========================================
// EXPRESS 5 CATCH-ALL
// =========================================

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
      GEMINI_MODEL
    );

    console.log(
      "Groq:",
      GROQ_MODEL
    );

    console.log(
      "Groq Web:",
      GROQ_WEB_MODEL
    );

    console.log(
      "Google Search:",
      Boolean(GEMINI_API_KEY)
    );

    console.log(
      "Groq Web Search:",
      Boolean(GROQ_API_KEY)
    );

    console.log(
      "================================"
    );
  }
);
