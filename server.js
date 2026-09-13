require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const OpenAI = require("openai");

const app = express();

const PORT =
  process.env.PORT || 10000;

const AI_MODEL =
  process.env.AI_MODEL || "gpt-5.6-luna";

// =====================================================
// OPENAI
// =====================================================

const openai =
  process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY
      })
    : null;


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.static(__dirname)
);


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
});


// =====================================================
// HEALTH
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Atharv AI",
    version: "5.0.0",
    model: AI_MODEL
  });
});


// =====================================================
// USER DATE / TIME
// =====================================================

function getUserDateTime(timeZone) {

  try {

    const tz =
      typeof timeZone === "string" &&
      timeZone.trim()
        ? timeZone.trim()
        : "UTC";

    const now =
      new Date();

    const date =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).format(now);

    const time =
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }
      ).format(now);

    return {
      date: date,
      time: time,
      timeZone: tz
    };

  } catch (error) {

    return {
      date:
        new Date()
          .toISOString()
          .slice(0, 10),

      time: "unknown",

      timeZone: "UTC"
    };
  }
}


// =====================================================
// SMART WEB SEARCH
// =====================================================

function needsWebSearch(message) {

  const text =
    String(message || "")
      .toLowerCase()
      .trim();

  const keywords = [

    // English
    "today",
    "today's",
    "todays",
    "latest",
    "current",
    "recent",
    "right now",
    "breaking",
    "live",
    "news",
    "happening now",

    // Hindi / Hinglish
    "aaj",
    "aaj ka",
    "aaj ki",
    "aaj ke",
    "abhi",
    "taaza",
    "taza",
    "khabar",
    "khabrein",
    "samachar",
    "abhi kya ho raha",

    // Weather
    "weather",
    "temperature",
    "forecast",
    "rain",
    "barish",
    "mausam",

    // Finance
    "stock price",
    "share price",
    "stock market today",
    "share market today",
    "latest price",
    "current price",
    "stock today",
    "share today",
    "nifty",
    "sensex",
    "bank nifty",
    "nasdaq",
    "dow jones",

    // Crypto
    "bitcoin price",
    "bitcoin today",
    "crypto price",
    "ethereum price",

    // Commodities
    "gold price",
    "gold rate",
    "silver price",
    "petrol price",
    "diesel price",

    // Horoscope
    "rashifal",
    "horoscope",
    "aaj ka rashifal",
    "aaj ki rashifal",

    // Sports
    "match today",
    "match score",
    "live score",
    "score today",
    "standings",
    "ipl",
    "cricket score",
    "football score",

    // Politics / public information
    "current president",
    "current prime minister",
    "prime minister",
    "president of",
    "election result",
    "election results",

    // Results / changing information
    "result",
    "results",
    "latest result",
    "current result"
  ];

  return keywords.some(
    function (keyword) {
      return text.includes(keyword);
    }
  );
}


// =====================================================
// CLEAN / BUILD RECENT CONVERSATION
// =====================================================

function buildConversationContext(history) {

  if (!Array.isArray(history)) {
    return "";
  }

  const recentHistory =
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
      .slice(-8);

  if (
    recentHistory.length === 0
  ) {
    return "";
  }

  return recentHistory
    .map(function (item) {

      const role =
        item.type === "user"
          ? "User"
          : "Atharv";

      return (
        role +
        ": " +
        item.text
      );
    })
    .join("\n");
}


// =====================================================
// ATHARV PERSONALITY
// =====================================================

const ATHARV_INSTRUCTIONS = `

You are Atharv AI.

Identity:
