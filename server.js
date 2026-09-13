require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

// =====================================================
// CONFIG
// =====================================================

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

// =====================================================
// APP
// =====================================================

app.use(cors());

app.use(
  express.json({
    limit: "2mb"
  })
);

// =====================================================
// ATHARV CORE INSTRUCTIONS
// =====================================================

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

IDENTITY
- Your name is Atharv.
- You are a helpful, attentive, practical and multilingual AI assistant.
- Your goal is to help the user complete the task, not merely give a generic answer.

LANGUAGE
- Automatically detect the user's language.
- Reply in the same language and script/style whenever possible.
- Support Hindi, Hinglish, English, Bengali, Urdu, Tamil, Telugu,
  Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese,
  Arabic, Chinese, Japanese, Korean, Spanish, French, German,
  Italian, Portuguese, Russian, Turkish, Indonesian, Vietnamese,
  Thai and other languages you understand.
- Mixed-language questions should receive natural mixed-language answers when appropriate.
- Do not translate unless the user asks for translation.

ATTENTION AND CONTEXT
- Use the supplied recent conversation context.
- Understand follow-up questions.
- If the user says "haan", "yes", "continue", "same", "isko", "iske baare mein",
  "then what", etc., use the previous context.
- Do not unnecessarily ask the user to repeat information already supplied.
- Never claim to remember information that is not actually available.

ACCURACY
- Never invent facts, prices, events, statistics or sources.
- If live/current information is needed, use available web search.
- If live data could not be verified, clearly say that it could not be verified.
- Never present old information as today's information.

CURRENT INFORMATION
- Latest, today, current, now, recent, breaking, live, news,
  current price, current market, weather, results and similar requests
  require current information.
- Hindi equivalents such as आज, अभी, ताजा, नवीनतम, खबर, समाचार,
  वर्तमान, शेयर भाव, बाजार आदि also indicate current information.

NEWS
- For news, give important developments first.
- Mention the date/time when useful.
- Prefer reliable sources.
- Separate confirmed information from speculation.
- Never fabricate breaking news.

FINANCE AND MARKET
- You can analyze stocks, indices, sectors, mutual funds, ETFs and derivatives.
- For current market questions use current web information.
- Never guarantee profit.
- Never claim certainty about future prices.
- Predictions must be probability/scenario based.
- Clearly identify assumptions and invalidation conditions.
- If exact option-chain/OI/IV/Greeks data is unavailable, do not invent it.
- When discussing options, explain risk and avoid presenting a setup as guaranteed.

MARKET ANALYSIS
When the user asks about a stock/index/market:
1. Current trend
2. Important support
3. Important resistance
4. Momentum
5. Volume if available
6. Sector strength if available
7. News/sentiment
8. Global/market context when relevant
9. Bullish scenario
10. Bearish scenario
11. No-trade/uncertain scenario
12. Probability/confidence
13. Risk/invalidation
14. For options, CE/PE conditions rather than guaranteed calls

If exact live numbers are unavailable, explicitly label them as unavailable rather than guessing.

STYLE
- Simple questions: simple answers.
- Complex questions: headings and bullets.
- Avoid unnecessary disclaimers.
- Be concise but useful.
- Do not repeatedly say "I am an AI".
- Use emojis only when natural.
`;

STEP-BY-STEP TEACHING MODE:

- Jab user kisi kaam ko karne ka tareeka pooche...
- Pehle 1-2 lines mein simple language mein batao...
- Step 1, Step 2, Step 3...
- Har step mein kya click/type karna hai batao...
- Har important step ke baad Check batao...
- ...

...baaki existing instructions...
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
// CURRENT / WEB / MARKET DETECTION
// =====================================================

function needsWebSearch(message) {
  const text =
    String(message || "").toLowerCase();

  const currentWords = [
    "latest",
    "lastest",
    "today",
    "today's",
    "todays",
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
    "result",
    "results",
    "score",
    "match today",
    "tomorrow",
    "next session",

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
    "कल",
    "कल का",
    "कल की"
  ];

  const marketWords = [
    "stock price",
    "share price",
    "market price",
    "share",
    "stock",
    "stocks",
    "nifty",
    "bank nifty",
    "sensex",
    "fii",
    "dii",
    "option",
    "options",
    "call option",
    "put option",
    "call",
    "put",
    "ce",
    "pe",
    "open interest",
    "oi",
    "pcr",
    "iv",
    "implied volatility",
    "greeks",
    "support",
    "resistance",
    "breakout",
    "breakdown",
    "intraday",
    "swing",
    "target",
    "stop loss",
    "buy",
    "sell",
    "bullish",
    "bearish",

    "शेयर भाव",
    "शेयर प्राइस",
    "स्टॉक प्राइस",
    "शेयर",
    "स्टॉक",
    "बाजार",
    "बाज़ार",
    "निफ्टी",
    "बैंक निफ्टी",
    "सेंसेक्स",
    "ऑप्शन",
    "कॉल",
    "पुट",
    "सपोर्ट",
    "रेजिस्टेंस",
    "ब्रेकआउट",
    "ब्रेकडाउन",
    "खरीद",
    "बेच",
    "लक्ष्य"
  ];

  return (
    currentWords.some(function (word) {
      return text.includes(word);
    }) ||
    marketWords.some(function (word) {
      return text.includes(word);
    })
  );
}

// =====================================================
// FETCH WITH TIMEOUT
// =====================================================

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
        signal:
          controller.signal
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

// =====================================================
// CLEAN HISTORY
// =====================================================

function buildHistoryText(history) {
  if (!Array.isArray(history)) {
    return "";
  }

  const recent =
    history
      .filter(function (item) {
        return (
          item &&
          typeof item.text === "string" &&
          (
            item.type === "user" ||
            item.type === "ai"
          )
        );
      })
      .slice(-10);

  if (!recent.length) {
    return "";
  }

  return recent
    .map(function (item) {
      const role =
        item.type === "user"
          ? "USER"
          : "ATHARV";

      return (
        role +
        ": " +
        item.text
      );
    })
    .join("\n");
}

// =====================================================
// BUILD USER PROMPT
// =====================================================

function buildPrompt(
  message,
  history
) {
  const historyText =
    buildHistoryText(history);

  if (!historyText) {
    return message;
  }

  return `
RECENT CONVERSATION:

${historyText}

END RECENT CONVERSATION

CURRENT USER MESSAGE:

${message}

Answer the current message using the relevant conversation context.
Do not unnecessarily repeat the entire conversation.
`;
}

// =====================================================
// GEMINI NORMAL / WEB
// =====================================================

async function callGemini(
  message,
  currentTime,
  useWebSearch,
  history
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(
      GEMINI_MODEL
    ) +
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
            text:
              buildPrompt(
                message,
                history
              )
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096
    }
  };

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

// =====================================================
// GEMINI STREAM
// =====================================================

async function streamGemini(
  message,
  currentTime,
  useWebSearch,
  history,
  onChunk
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(
      GEMINI_MODEL
    ) +
    ":streamGenerateContent?alt=sse";

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
            text:
              buildPrompt(
                message,
                history
              )
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096
    }
  };

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
            GEMINI_API_KEY,

          Accept:
            "text/event-stream"
        },

        body:
          JSON.stringify(body)
      },
      45000
    );

  if (!response.ok) {
    let data = {};

    try {
      data =
        await response.json();
    } catch (_) {}

    const errorMessage =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Gemini stream failed.";

    throw new Error(
      "Gemini " +
        response.status +
        ": " +
        errorMessage
    );
  }

  if (!response.body) {
    throw new Error(
      "Gemini streaming body unavailable."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";
  let fullText = "";

  while (true) {
    const result =
      await reader.read();

    if (result.done) {
      break;
    }

    buffer += decoder.decode(
      result.value,
      {
        stream: true
      }
    );

    const lines =
      buffer.split("\n");

    buffer =
      lines.pop() || "";

    for (
      const line of lines
    ) {
      const trimmed =
        line.trim();

      if (
        !trimmed ||
        !trimmed.startsWith("data:")
      ) {
        continue;
      }

      const raw =
        trimmed
          .slice(5)
          .trim();

      if (
        !raw ||
        raw === "[DONE]"
      ) {
        continue;
      }

      try {
        const json =
          JSON.parse(raw);

        const parts =
          json &&
          json.candidates &&
          json.candidates[0] &&
          json.candidates[0].content &&
          json.candidates[0].content.parts
            ? json.candidates[0].content.parts
            : [];

        const text =
          parts
            .map(function (part) {
              return part.text || "";
            })
            .join("");

        if (text) {
          fullText += text;
          onChunk(text);
        }

      } catch (error) {
        // Ignore incomplete SSE JSON fragments.
      }
    }
  }

  if (!fullText.trim()) {
    throw new Error(
      "Gemini returned an empty stream."
    );
  }

  return fullText.trim();
}

// =====================================================
// NORMAL GROQ
// =====================================================

async function callGroq(
  message,
  currentTime,
  history
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
          model:
            GROQ_MODEL,

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
              content:
                buildPrompt(
                  message,
                  history
                )
            }
          ],

          temperature: 0.4,
          max_tokens: 4096
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

// =====================================================
// GROQ WEB SEARCH
// =====================================================

async function callGroqWebSearch(
  message,
  currentTime,
  history
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
          model:
            GROQ_WEB_MODEL,

          messages: [
            {
              role: "system",
              content:
                ATHARV_INSTRUCTIONS +
                "\n\nCurrent user date/time: " +
                currentTime +
                "\n\nThis is a live-information request. Use the built-in web search. Prefer reliable/current sources. Do not invent missing market values."
            },

            {
              role: "user",
              content:
                buildPrompt(
                  message,
                  history
                )
            }
          ],

          search_settings: {
            country: "IN"
          },

          temperature: 0.3,
          max_tokens: 4096
        })
      },
      60000
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

// =====================================================
// PROGRESSIVE FALLBACK STREAM
// =====================================================

async function sendArtificialStream(
  res,
  text
) {
  const chunks =
    String(text || "")
      .match(/.{1,45}(\s+|$)/g) || [
        String(text || "")
      ];

  for (
    const chunk of chunks
  ) {
    sendSSE(
      res,
      {
        type: "chunk",
        text: chunk
      }
    );

    await new Promise(
      function (resolve) {
        setTimeout(
          resolve,
          12
        );
      }
    );
  }
}

// =====================================================
// SSE HELPER
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
// STREAM CHAT
// =====================================================

app.post(
  "/api/chat/stream",
  async function (req, res) {

    const message =
      typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

    const timeZone =
      typeof req.body.timeZone === "string"
        ? req.body.timeZone
        : "UTC";

    const history =
      Array.isArray(req.body.history)
        ? req.body.history
        : [];

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

    const currentTime =
      getUserDateTime(timeZone);

    const useWebSearch =
      needsWebSearch(message);

    let completed = false;

    try {

      // =================================================
      // 1. GEMINI STREAM
      // =================================================

      if (GEMINI_API_KEY) {
        try {

          console.log(
            "ATHARV STREAM: Gemini"
          );

          sendSSE(
            res,
            {
              type:
                "status",
              provider:
                "gemini"
            }
          );

          await streamGemini(
            message,
            currentTime,
            useWebSearch,
            history,
            function (text) {
              sendSSE(
                res,
                {
                  type:
                    "chunk",
                  text:
                    text
                }
              );
            }
          );

          sendSSE(
            res,
            {
              type:
                "done",
              provider:
                "gemini",
              webSearch:
                useWebSearch
            }
          );

          completed = true;

        } catch (error) {

          console.error(
            "GEMINI STREAM ERROR:",
            error.message
          );

          sendSSE(
            res,
            {
              type:
                "provider_error",
              provider:
                "gemini"
            }
          );
        }
      }

      // =================================================
      // 2. GROQ WEB
      // =================================================

      if (
        !completed &&
        useWebSearch &&
        GROQ_API_KEY
      ) {
        try {

          console.log(
            "ATHARV STREAM: Groq Web Search"
          );

          sendSSE(
            res,
            {
              type:
                "status",
              provider:
                "groq-web"
            }
          );

          const reply =
            await callGroqWebSearch(
              message,
              currentTime,
              history
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
                "groq-compound-mini",
              webSearch:
                true
            }
          );

          completed = true;

        } catch (error) {

          console.error(
            "GROQ WEB STREAM ERROR:",
            error.message
          );
        }
      }

      // =================================================
      // 3. NORMAL GROQ
      // =================================================

      if (
        !completed &&
        GROQ_API_KEY
      ) {
        try {

          console.log(
            "ATHARV STREAM: Normal Groq"
          );

          sendSSE(
            res,
            {
              type:
                "status",
              provider:
                "groq"
            }
          );

          const reply =
            await callGroq(
              message,
              currentTime,
              history
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
              webSearch:
                false
            }
          );

          completed = true;

        } catch (error) {

          console.error(
            "GROQ STREAM ERROR:",
            error.message
          );
        }
      }

      // =================================================
      // ALL FAILED
      // =================================================

      if (!completed) {

        sendSSE(
          res,
          {
            type:
              "error",
            error:
              "Atharv ki AI services abhi unavailable hain. Please thodi der baad try karein."
          }
        );
      }

    } catch (error) {

      console.error(
        "STREAM FATAL ERROR:",
        error
      );

      sendSSE(
        res,
        {
          type:
            "error",
          error:
            "Atharv response generate nahi kar paaya."
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
// NORMAL CHAT API
// =====================================================

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

    const history =
      Array.isArray(req.body.history)
        ? req.body.history
        : [];

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

    // =================================================
    // GEMINI
    // =================================================

    if (GEMINI_API_KEY) {
      try {

        const reply =
          await callGemini(
            message,
            currentTime,
            useWebSearch,
            history
          );

        return res.json({
          reply,
          provider:
            "gemini",
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

    // =================================================
    // GROQ WEB
    // =================================================

    if (
      useWebSearch &&
      GROQ_API_KEY
    ) {
      try {

        const reply =
          await callGroqWebSearch(
            message,
            currentTime,
            history
          );

        return res.json({
          reply,
          provider:
            "groq-compound-mini",
          webSearch:
            true
        });

      } catch (error) {

        console.error(
          "GROQ WEB ERROR:",
          error.message
        );
      }
    }

    // =================================================
    // GROQ NORMAL
    // =================================================

    if (GROQ_API_KEY) {
      try {

        const reply =
          await callGroq(
            message,
            currentTime,
            history
          );

        return res.json({
          reply,
          provider:
            "groq",
          webSearch:
            false
        });

      } catch (error) {

        console.error(
          "GROQ ERROR:",
          error.message
        );
      }
    }

    return res.status(503).json({
      error:
        "Atharv ke AI services abhi unavailable hain."
    });
  }
);

// =====================================================
// HEALTH
// =====================================================

app.get(
  "/health",
  function (req, res) {

    res.json({
      ok: true,

      service:
        "Atharv AI",

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
        streaming:
          true,

        googleSearch:
          Boolean(GEMINI_API_KEY),

        groqWebSearch:
          Boolean(GROQ_API_KEY),

        multilingual:
          true,

        marketIntelligence:
          true,

        conversationContext:
          true
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
  express.static(__dirname)
);

// =====================================================
// EXPRESS 5 CATCH-ALL
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
// START
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
      "Streaming: ENABLED"
    );

    console.log(
      "Market Intelligence: ENABLED"
    );

    console.log(
      "================================"
    );
  }
);
