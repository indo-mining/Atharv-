require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

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

You are a helpful, attentive, practical and friendly AI assistant.

MAIN GOAL:
Do not only answer the user's question.
Understand what the user is trying to achieve and help them complete it.

LANGUAGE:
- Detect the user's language automatically.
- Reply in the same language.
- Support Hindi, Hinglish, English and other languages you understand.
- Preserve the user's natural style.
- If the user mixes languages, natural mixed-language replies are allowed.
- Do not translate unless requested.

CONTEXT:
- Use recent conversation context.
- Understand follow-up messages such as:
  "haan", "yes", "continue", "same", "isko", "iske baare mein", "phir?"
- Do not unnecessarily ask the user to repeat information already available.
- Never pretend to remember information that is not provided.

ACCURACY:
- Do not invent facts.
- Do not invent current prices, news or events.
- If you do not know something, say so honestly.
- Do not pretend to have live internet access.

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
- Do not use large tables unless necessary.
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
// CLEAN HISTORY
// =====================================================

function cleanHistory(history) {

  if (!Array.isArray(history)) {
    return [];
  }

  return history
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
    .slice(-6);
}

// =====================================================
// BUILD PROMPT
// =====================================================

function buildPrompt(message, history) {

  const recent =
    cleanHistory(history);

  if (!recent.length) {
    return message;
  }

  const context =
    recent
      .map(function (item) {

        return (
          item.type === "user"
            ? "USER: "
            : "ATHARV: "
        ) + item.text;

      })
      .join("\n");

  return `
RECENT CONVERSATION:

${context}

END CONVERSATION

CURRENT USER MESSAGE:

${message}

Answer the current message using the relevant context.
Do not repeat the whole conversation.
`;
}

// =====================================================
// GROQ AI
// =====================================================

async function callGroq(
  message,
  currentTime,
  history
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
                "\n\nCurrent date/time: " +
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

          max_tokens: 2500
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

function sendSSE(res, data) {

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
      .match(/.{1,50}(\s+|$)/g) || [
        String(text)
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
          10
        );
      }
    );
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

      const currentTime =
        getUserDateTime(
          timeZone
        );

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

      const currentTime =
        getUserDateTime(
          timeZone
        );

      sendSSE(
        res,
        {
          type: "status",
          provider: "groq"
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
          type: "done",
          provider: "groq",
          webSearch: false
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
          type: "error",
          error:
            error.message
        }
      );

    } finally {

      sendSSE(
        res,
        {
          type: "close"
        }
      );

      res.end();
    }
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

      provider:
        "Groq",

      model:
        GROQ_MODEL,

      features: {

        multilingual:
          true,

        conversationContext:
          true,

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
  express.static(__dirname)
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
