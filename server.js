"use strict";

/*
=========================================================
 ATHARV AI SERVER
 Version 15.1.0 FINAL
 --------------------------------------------------------
 Groq GPT-OSS 120B
 Tavily Live Research
 GDELT News
 Open-Meteo Weather
 PostgreSQL Memory
 Multilingual AI
 Hindi / Hinglish / English
 World Languages
 Study Engine
 Official PYQ Routing
 Programming / Python
 Built-in Browser Search
 Built-in Python Code Execution
 Streaming
 Attachments
 Response Protection
 Health Monitoring
 Render Compatible
 --------------------------------------------------------
 IMPORTANT:
 - groq/compound REMOVED
 - groq/compound-mini REMOVED
=========================================================
*/

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();

/* ======================================================
   CONFIG
====================================================== */

const PORT = Number(process.env.PORT) || 10000;

const SERVER_VERSION = "15.1.0";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

/*
   Current Groq production model.

   Do NOT use:
   groq/compound
   groq/compound-mini
*/
const GENERAL_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const LIVE_MODEL =
  process.env.GROQ_LIVE_MODEL || "openai/gpt-oss-120b";

const FALLBACK_MODEL =
  process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const TAVILY_URL =
  "https://api.tavily.com/search";

const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc";

const GEO_URL =
  "https://geocoding-api.open-meteo.com/v1/search";

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast";

const MAX_BODY_SIZE = "10mb";

const REQUEST_TIMEOUT = 30000;

const AI_TIMEOUT = 60000;

/* ======================================================
   EXPRESS
====================================================== */

app.disable("x-powered-by");

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: MAX_BODY_SIZE
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: MAX_BODY_SIZE
  })
);

/* ======================================================
   DATABASE
====================================================== */

let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,

    ssl: {
      rejectUnauthorized: false
    },

    max: 5,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
  });

  pool.on("error", (err) => {
    console.error(
      "POSTGRES POOL ERROR:",
      err.message
    );
  });
}

/* ======================================================
   BASIC HELPERS
====================================================== */

function safeString(value, fallback = "") {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value).trim();
}

function limitText(value, max = 12000) {
  const text = safeString(value);

  if (text.length <= max) {
    return text;
  }

  return text.slice(0, max) + "...";
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* ======================================================
   FETCH WITH TIMEOUT
====================================================== */

async function fetchWithTimeout(
  url,
  options = {},
  timeout = REQUEST_TIMEOUT
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

/* ======================================================
   MODEL CHECK
====================================================== */

function isGPTOSS(model) {
  return (
    model === "openai/gpt-oss-120b" ||
    model === "openai/gpt-oss-20b"
  );
}

/* ======================================================
   USER ID
====================================================== */

function getUserId(req) {
  const raw =
    safeString(req.body?.userId) ||
    safeString(req.headers["x-atharv-user-id"]) ||
    safeString(req.query?.userId) ||
    safeString(req.ip) ||
    "anonymous";

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");
}

/* ======================================================
   INDIA DATE / TIME
====================================================== */

function getIndiaDateTime() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "long"
    }
  ).formatToParts(now);

  const result = {};

  for (const part of parts) {
    result[part.type] = part.value;
  }

  return {
    formatted: new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        dateStyle: "full",
        timeStyle: "long"
      }
    ).format(now),

    date:
      `${parts.find(p => p.type === "day")?.value || ""}-` +
      `${parts.find(p => p.type === "month")?.value || ""}-` +
      `${parts.find(p => p.type === "year")?.value || ""}`
  };
}

/* ======================================================
   LANGUAGE DETECTION
====================================================== */

function detectLanguage(text) {
  const input = safeString(text);

  if (!input) {
    return "English";
  }

  if (/[\u0900-\u097F]/.test(input)) {
    return "Hindi";
  }

  if (/[\u0980-\u09FF]/.test(input)) {
    return "Bengali";
  }

  if (/[\u0A00-\u0A7F]/.test(input)) {
    return "Punjabi";
  }

  if (/[\u0A80-\u0AFF]/.test(input)) {
    return "Gujarati";
  }

  if (/[\u0B00-\u0B7F]/.test(input)) {
    return "Odia";
  }

  if (/[\u0B80-\u0BFF]/.test(input)) {
    return "Tamil";
  }

  if (/[\u0C00-\u0C7F]/.test(input)) {
    return "Telugu";
  }

  if (/[\u0C80-\u0CFF]/.test(input)) {
    return "Kannada";
  }

  if (/[\u0D00-\u0D7F]/.test(input)) {
    return "Malayalam";
  }

  if (/[\u0600-\u06FF]/.test(input)) {
    return "Urdu/Arabic";
  }

  if (/[\u3040-\u30FF]/.test(input)) {
    return "Japanese";
  }

  if (/[\uAC00-\uD7AF]/.test(input)) {
    return "Korean";
  }

  if (/[\u4E00-\u9FFF]/.test(input)) {
    return "Chinese";
  }

  if (/[\u0400-\u04FF]/.test(input)) {
    return "Russian";
  }

  const hinglishWords = [
    "kya",
    "kaise",
    "kaisa",
    "mujhe",
    "mera",
    "meri",
    "mere",
    "tum",
    "aap",
    "hai",
    "hain",
    "tha",
    "thi",
    "the",
    "karna",
    "karo",
    "batao",
    "bata",
    "chahiye",
    "kyun",
    "kyunki",
    "kab",
    "kahan",
    "kitna",
    "kitne",
    "acha",
    "accha",
    "nahi",
    "haan",
    "abhi",
    "kal",
    "aaj",
    "pura",
    "poora"
  ];

  const lower = input.toLowerCase();

  const matches = hinglishWords.filter(
    word =>
      new RegExp(`\\b${word}\\b`, "i").test(lower)
  ).length;

  if (matches >= 1) {
    return "Hinglish";
  }

  return "English";
}

/* ======================================================
   CATEGORY ROUTER
====================================================== */

function detectCategory(text) {
  const input = safeString(text).toLowerCase();

  if (
    /(weather|temperature|rain|humidity|forecast|mausam|baarish|barish|garmi|thand)/i.test(
      input
    )
  ) {
    return "weather";
  }

  if (
    /(share price|stock|stocks|nifty|sensex|market|crypto|bitcoin|btc|ethereum|gold price|silver price|ipo)/i.test(
      input
    )
  ) {
    return "market";
  }

  if (
    /(news|breaking|latest news|headlines|samachar|khabar|taaza khabar)/i.test(
      input
    )
  ) {
    return "news";
  }

  if (
    /(cricket|football|soccer|ipl|match|score|sports|tennis|olympics)/i.test(
      input
    )
  ) {
    return "sports";
  }

  if (
    /(python|javascript|typescript|node|nodejs|react|html|css|sql|postgres|programming|coding|code|bug|debug|error|api|server|express|github)/i.test(
      input
    )
  ) {
    return "programming";
  }

  if (
    /(upsc|ssc|railway|rrb|ibps|sbi po|sbi clerk|ctet|neet|jee|cuet|gate|nda|cds|exam|pyq|previous year|question paper|mock test|mcq|class 1|class 2|class 3|class 4|class 5|class 6|class 7|class 8|class 9|class 10|class 11|class 12|cbse|icse|board)/i.test(
      input
    )
  ) {
    return "exam";
  }

  if (
    /(study|study plan|revision|homework|notes|explain chapter|doubt|flashcard|important questions|answer writing|mains|padhai|padhao|samjhao)/i.test(
      input
    )
  ) {
    return "study";
  }

  if (
    /(remember|memory|yaad rakho|yaad rakhna|bhoolna mat|mera naam|my name|delete memory|forget)/i.test(
      input
    )
  ) {
    return "memory";
  }

  return "general";
}

/* ======================================================
   LIVE INTENT
====================================================== */

function needsLiveResearch(text) {
  const input = safeString(text).toLowerCase();

  return /(today|todays|latest|current|right now|now|recent|breaking|live|this week|this month|2026|aaj|abhi|taaza|vartaman|haal hi|current affairs|latest update|recent update|price today|score today|result today)/i.test(
    input
  );
}

/* ======================================================
   STUDY INTENT
====================================================== */

function detectStudyIntent(text) {
  const input = safeString(text).toLowerCase();

  if (
    /(official pyq|official previous year|previous year question paper|previous year paper|pyq|question paper)/i.test(
      input
    )
  ) {
    return "official_pyq";
  }

  if (
    /(current affairs|current affair)/i.test(
      input
    )
  ) {
    return "current_affairs";
  }

  if (
    /(mains answer|answer writing|10 marker|15 marker|250 words|150 words)/i.test(
      input
    )
  ) {
    return "mains";
  }

  if (
    /(mock test|practice test|test me|quiz me)/i.test(
      input
    )
  ) {
    return "mock_test";
  }

  if (
    /(flashcard|flash cards)/i.test(
      input
    )
  ) {
    return "flashcards";
  }

  if (
    /(revision|revise|revision plan)/i.test(
      input
    )
  ) {
    return "revision";
  }

  if (
    /(mcq|multiple choice|objective questions)/i.test(
      input
    )
  ) {
    return "mcq";
  }

  if (
    /(important questions|important question)/i.test(
      input
    )
  ) {
    return "important_questions";
  }

  if (
    /(study plan|timetable|time table|schedule for study)/i.test(
      input
    )
  ) {
    return "study_plan";
  }

  if (
    /(homework|assignment)/i.test(
      input
    )
  ) {
    return "homework";
  }

  if (
    /(evaluate my answer|check my answer|answer evaluation)/i.test(
      input
    )
  ) {
    return "evaluation";
  }

  if (
    /(explain|samjhao|samjha do|doubt|concept)/i.test(
      input
    )
  ) {
    return "explain";
  }

  return "";
}

/* ======================================================
   STUDY CONTEXT
====================================================== */

function getStudyContext(text) {
  const input = safeString(text);

  const classMatch = input.match(
    /\bclass\s*(1[0-2]|[1-9])\b/i
  );

  const yearMatch = input.match(
    /\b(19|20)\d{2}\b/
  );

  let board = "";

  if (/cbse/i.test(input)) {
    board = "CBSE";
  } else if (/icse/i.test(input)) {
    board = "ICSE";
  } else if (/state board/i.test(input)) {
    board = "State Board";
  }

  let exam = "";

  const exams = [
    "UPSC",
    "SSC",
    "RRB",
    "Railway",
    "IBPS",
    "SBI PO",
    "SBI Clerk",
    "CTET",
    "NEET",
    "JEE",
    "CUET",
    "GATE",
    "NDA",
    "CDS"
  ];

  for (const item of exams) {
    if (
      input.toLowerCase().includes(
        item.toLowerCase()
      )
    ) {
      exam = item;
      break;
    }
  }

  return {
    className: classMatch
      ? classMatch[1]
      : "",

    year: yearMatch
      ? yearMatch[0]
      : "",

    board,

    exam
  };
}

/* ======================================================
   OFFICIAL DOMAINS
====================================================== */

function getOfficialDomain(text) {
  const input = safeString(text).toLowerCase();

  if (/upsc/.test(input)) {
    return "upsc.gov.in";
  }

  if (/ssc/.test(input)) {
    return "ssc.gov.in";
  }

  if (/railway|rrb/.test(input)) {
    return "indianrailways.gov.in";
  }

  if (/ibps/.test(input)) {
    return "ibps.in";
  }

  if (/sbi/.test(input)) {
    return "sbi.co.in";
  }

  if (/ctet|tet/.test(input)) {
    return "ctet.nic.in";
  }

  return "";
}

/* ======================================================
   MEMORY TABLE
====================================================== */

async function ensureMemoryTable() {
  if (!pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_memories (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      memory TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_memories_user_id
    ON public.user_memories(user_id)
  `);
}

/* ======================================================
   MEMORY SECURITY
====================================================== */

const sensitiveMemoryTerms = [
  "password",
  "passcode",
  "api key",
  "api_key",
  "secret key",
  "secret_key",
  "private key",
  "private_key",
  "seed phrase",
  "recovery phrase",
  "wallet seed",
  "otp",
  "credit card",
  "cvv",
  "debit card",
  "bank account",
  "atm pin",
  "pin number"
];

function containsSensitiveMemory(text) {
  const input = safeString(text).toLowerCase();

  return sensitiveMemoryTerms.some(
    term => input.includes(term)
  );
}

/* ======================================================
   MEMORY EXTRACTION
====================================================== */

function extractMemory(text) {
  const input = safeString(text);

  if (!input || containsSensitiveMemory(input)) {
    return "";
  }

  const patterns = [
    /remember that (.+)/i,
    /please remember (.+)/i,
    /yaad rakho (.+)/i,
    /yaad rakhna (.+)/i,
    /mera naam (.+) hai/i,
    /my name is (.+)/i,
    /i am (.+)/i,
    /i'm (.+)/i
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);

    if (match?.[1]) {
      return limitText(
        match[1].trim(),
        500
      );
    }
  }

  return "";
}

/* ======================================================
   SAVE MEMORY
====================================================== */

async function saveMemory(
  userId,
  memory
) {
  if (!pool || !memory) {
    return false;
  }

  if (containsSensitiveMemory(memory)) {
    return false;
  }

  await pool.query(
    `
      INSERT INTO public.user_memories
      (user_id, memory)
      VALUES ($1, $2)
    `,
    [
      userId,
      limitText(memory, 500)
    ]
  );

  return true;
}

/* ======================================================
   GET MEMORY
====================================================== */

async function getMemories(
  userId,
  limit = 20
) {
  if (!pool) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        id,
        memory,
        created_at,
        updated_at
      FROM public.user_memories
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `,
    [
      userId,
      limit
    ]
  );

  return result.rows;
}

/* ======================================================
   DELETE MEMORY
====================================================== */

async function deleteMemory(
  userId,
  id
) {
  if (!pool) {
    return false;
  }

  await pool.query(
    `
      DELETE FROM public.user_memories
      WHERE id = $1
      AND user_id = $2
    `,
    [
      id,
      userId
    ]
  );

  return true;
}

/* ======================================================
   CLEAR MEMORY
====================================================== */

async function clearMemory(
  userId
) {
  if (!pool) {
    return false;
  }

  await pool.query(
    `
      DELETE FROM public.user_memories
      WHERE user_id = $1
    `,
    [
      userId
    ]
  );

  return true;
}

/* ======================================================
   TAVILY SEARCH
====================================================== */

async function tavilySearch({
  query,
  includeDomains = [],
  maxResults = 6
}) {
  if (!TAVILY_API_KEY) {
    return {
      ok: false,
      results: [],
      answer: ""
    };
  }

  try {
    const response =
      await fetchWithTimeout(
        TAVILY_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${TAVILY_API_KEY}`
          },

          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: limitText(query, 1000),
            search_depth: "advanced",
            include_answer: true,
            include_raw_content: false,
            max_results: maxResults,

            ...(includeDomains.length
              ? {
                  include_domains:
                    includeDomains
                }
              }
              : {})
          })
        },
        25000
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "TAVILY ERROR:",
        response.status,
        JSON.stringify(data)
      );

      return {
        ok: false,
        results: [],
        answer: ""
      };
    }

    return {
      ok: true,
      answer:
        safeString(data.answer),

      results:
        Array.isArray(data.results)
          ? data.results
          : []
    };
  } catch (error) {
    console.error(
      "TAVILY REQUEST ERROR:",
      error.message
    );

    return {
      ok: false,
      results: [],
      answer: ""
    };
  }
}

/* ======================================================
   GDELT NEWS
====================================================== */

async function gdeltSearch(query) {
  try {
    const url =
      new URL(GDELT_URL);

    url.searchParams.set(
      "query",
      limitText(query, 500)
    );

    url.searchParams.set(
      "mode",
      "artlist"
    );

    url.searchParams.set(
      "maxrecords",
      "10"
    );

    url.searchParams.set(
      "format",
      "json"
    );

    url.searchParams.set(
      "sort",
      "HybridRel"
    );

    const response =
      await fetchWithTimeout(
        url.toString(),
        {},
        20000
      );

    const data =
      await response.json();

    if (!response.ok) {
      return [];
    }

    return Array.isArray(
      data.articles
    )
      ? data.articles
      : [];
  } catch (error) {
    console.error(
      "GDELT ERROR:",
      error.message
    );

    return [];
  }
}

/* ======================================================
   WEATHER
====================================================== */

async function getWeather(city) {
  try {
    const geoURL =
      new URL(GEO_URL);

    geoURL.searchParams.set(
      "name",
      city
    );

    geoURL.searchParams.set(
      "count",
      "1"
    );

    geoURL.searchParams.set(
      "language",
      "en"
    );

    geoURL.searchParams.set(
      "format",
      "json"
    );

    const geoResponse =
      await fetchWithTimeout(
        geoURL.toString(),
        {},
        15000
      );

    const geoData =
      await geoResponse.json();

    const location =
      geoData?.results?.[0];

    if (!location) {
      return {
        ok: false
      };
    }

    const weatherURL =
      new URL(WEATHER_URL);

    weatherURL.searchParams.set(
      "latitude",
      String(location.latitude)
    );

    weatherURL.searchParams.set(
      "longitude",
      String(location.longitude)
    );

    weatherURL.searchParams.set(
      "current",
      [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "weather_code",
        "wind_speed_10m"
      ].join(",")
    );

    weatherURL.searchParams.set(
      "daily",
      [
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max"
      ].join(",")
    );

    weatherURL.searchParams.set(
      "forecast_days",
      "3"
    );

    weatherURL.searchParams.set(
      "timezone",
      "Asia/Kolkata"
    );

    const weatherResponse =
      await fetchWithTimeout(
        weatherURL.toString(),
        {},
        15000
      );

    const weatherData =
      await weatherResponse.json();

    return {
      ok: true,

      location: {
        name:
          location.name,

        country:
          location.country,

        latitude:
          location.latitude,

        longitude:
          location.longitude
      },

      current:
        weatherData.current || {},

      daily:
        weatherData.daily || {}
    };
  } catch (error) {
    console.error(
      "WEATHER ERROR:",
      error.message
    );

    return {
      ok: false
    };
  }
}

/* ======================================================
   SEARCH QUERY BUILDER
====================================================== */

function buildSearchQuery(
  message,
  category,
  studyIntent
) {
  let query = safeString(message);

  if (
    studyIntent === "official_pyq"
  ) {
    query =
      `${query} official previous year question paper`;
  }

  if (
    studyIntent === "current_affairs"
  ) {
    query =
      `${query} latest current affairs`;
  }

  if (
    category === "news"
  ) {
    query =
      `${query} latest news`;
  }

  return limitText(
    query,
    1000
  );
}

/* ======================================================
   EXTERNAL RESEARCH
====================================================== */

async function performResearch({
  message,
  category,
  studyIntent
}) {
  const research = {
    weather: null,
    tavily: null,
    gdelt: [],
    query: ""
  };

  /* WEATHER */

  if (category === "weather") {
    const cityMatch =
      safeString(message).match(
        /(?:in|at|for|mein|me)\s+([a-zA-Z .'-]{2,50})/i
      );

    const city =
      cityMatch?.[1]
        ? cityMatch[1].trim()
        : "Delhi";

    research.weather =
      await getWeather(city);

    return research;
  }

  const shouldSearch =
    needsLiveResearch(message) ||
    category === "news" ||
    category === "market" ||
    category === "sports" ||
    category === "exam" ||
    category === "study" ||
    studyIntent === "official_pyq" ||
    studyIntent === "current_affairs";

  if (!shouldSearch) {
    return research;
  }

  research.query =
    buildSearchQuery(
      message,
      category,
      studyIntent
    );

  let includeDomains = [];

  if (
    studyIntent === "official_pyq"
  ) {
    const official =
      getOfficialDomain(message);

    if (official) {
      includeDomains = [
        official
      ];
    }
  }

  research.tavily =
    await tavilySearch({
      query:
        research.query,

      includeDomains,

      maxResults:
        studyIntent === "official_pyq"
          ? 8
          : 6
    });

  if (
    category === "news" ||
    category === "market" ||
    category === "sports" ||
    needsLiveResearch(message)
  ) {
    research.gdelt =
      await gdeltSearch(
        research.query
      );
  }

  return research;
}

/* ======================================================
   RESEARCH FORMATTER
====================================================== */

function formatResearch(
  research,
  studyIntent
) {
  if (!research) {
    return "";
  }

  const parts = [];

  /* WEATHER */

  if (
    research.weather?.ok
  ) {
    const w =
      research.weather;

    const current =
      w.current || {};

    parts.push(
      [
        "LIVE WEATHER DATA:",
        `Location: ${w.location.name}, ${w.location.country}`,
        `Temperature: ${current.temperature_2m ?? "N/A"}°C`,
        `Feels like: ${current.apparent_temperature ?? "N/A"}°C`,
        `Humidity: ${current.relative_humidity_2m ?? "N/A"}%`,
        `Rain/precipitation: ${current.precipitation ?? "N/A"} mm`,
        `Wind: ${current.wind_speed_10m ?? "N/A"} km/h`
      ].join("\n")
    );
  }

  /* TAVILY */

  if (
    research.tavily?.ok
  ) {
    if (
      research.tavily.answer
    ) {
      parts.push(
        [
          "LIVE WEB SEARCH SUMMARY:",
          limitText(
            research.tavily.answer,
            5000
          )
        ].join("\n")
      );
    }

    const results =
      research.tavily.results
        .slice(0, 8);

    if (results.length) {
      parts.push(
        [
          "WEB SOURCES:",
          ...results.map(
            (item, index) =>
              `${index + 1}. ${
                safeString(item.title)
              }\n` +
              `URL: ${
                safeString(item.url)
              }\n` +
              `Content: ${
                limitText(
                  item.content,
                  1000
                )
              }`
          )
        ].join("\n")
      );
    }
  }

  /* GDELT */

  if (
    Array.isArray(research.gdelt) &&
    research.gdelt.length
  ) {
    parts.push(
      [
        "NEWS SOURCES:",
        ...research.gdelt
          .slice(0, 8)
          .map(
            (item, index) =>
              `${index + 1}. ${
                safeString(
                  item.title
                )
              }\n` +
              `URL: ${
                safeString(
                  item.url
                )
              }\n` +
              `Date: ${
                safeString(
                  item.seendate
                )
              }`
          )
      ].join("\n")
    );
  }

  if (
    studyIntent ===
    "official_pyq"
  ) {
    parts.push(
      [
        "OFFICIAL PYQ RULE:",
        "Use official source material when available.",
        "Do not invent a previous-year paper.",
        "If the official paper could not be verified, clearly say so."
      ].join("\n")
    );
  }

  if (!parts.length) {
    return "";
  }

  return (
    "\n\n===== RESEARCH CONTEXT =====\n" +
    parts.join(
      "\n\n"
    ) +
    "\n===== END RESEARCH =====\n"
  );
}

/* ======================================================
   ATHARV SYSTEM INSTRUCTIONS
====================================================== */

function buildSystemInstructions({
  language,
  category,
  studyIntent,
  studyContext,
  currentDateTime
}) {
  return `
You are ATHARV AI.

Identity:
- Your name is Atharv AI.
- Tagline: "Your AI. Every Language. Every Question."

CURRENT DATE/TIME:
${currentDateTime}

USER LANGUAGE:
${language}

CATEGORY:
${category}

STUDY INTENT:
${studyIntent || "none"}

STUDY CONTEXT:
${JSON.stringify(studyContext)}

CORE BEHAVIOR:
1. Answer directly.
2. Do not say "Atharv is thinking".
3. Do not produce filler.
4. Do not unnecessarily repeat the user's question.
5. Do not repeat the same sentence or paragraph.
6. Match the user's language and style.
7. Roman Hindi/Hinglish input -> Roman Hindi/Hinglish response.
8. Hindi Devanagari input -> Hindi Devanagari response.
9. English input -> English response.
10. If another language is clearly used, answer in that language.
11. Keep the response natural and human-like.
12. Use simple language unless the user asks for technical depth.
13. Do not invent facts.
14. Do not invent citations or URLs.
15. Do not claim that you executed code unless an execution result is actually available.
16. For current/live questions, rely on supplied research/tool results.
17. Clearly distinguish verified facts from uncertainty.

LIVE INFORMATION:
- Current information may change.
- Use supplied live research when available.
- Never pretend old knowledge is current.
- If live research is unavailable, say that verification was unavailable.

WEATHER:
- Use supplied Open-Meteo weather data.
- Mention location.
- Do not invent weather conditions.

NEWS:
- Summarize rather than copy articles.
- Mention dates when useful.
- Do not present an old article as today's event.

MARKETS:
- Explain that market prices can change rapidly.
- Use supplied current data when available.
- Do not fabricate prices.

SPORTS:
- For current scores/results, use supplied current research.
- Never invent a live score.

STUDY ENGINE:
- Support Class 1 through Class 12.
- Support CBSE, ICSE and state-board style questions.
- Support UPSC, SSC, Railway/RRB, IBPS, SBI, CTET, NEET, JEE, CUET, GATE, NDA, CDS and similar exams.
- Explain concepts step-by-step.
- Create MCQs, mock tests, revision plans, notes and flashcards.
- For official PYQs, never fabricate a paper.
- When an official source is supplied, prioritize it.
- If official verification is unavailable, clearly state that.
- For UPSC, distinguish Prelims, Mains and Interview.

PROGRAMMING:
- Help with JavaScript, Python, Node.js, Express, React, HTML, CSS, SQL, PostgreSQL, APIs and debugging.
- Provide complete code when requested.
- Explain errors simply.
- Never claim successful execution unless actual execution output is supplied.
- Python code execution may be available through Groq's built-in tool.

MEMORY:
- Use only memory supplied in the prompt.
- Do not expose internal database details.
- Never store secrets, passwords, API keys, OTPs, bank information, card information or private keys.

PRIVACY:
- Do not ask for unnecessary sensitive personal information.

ATTACHMENTS:
- Use attachment content when supplied.
- Do not pretend to see an attachment that was not supplied.

ANSWER QUALITY:
- Be accurate.
- Be concise when the question is simple.
- Be detailed when the question requires teaching.
- Use headings and bullets where helpful.
- Avoid unnecessary repetition.
`;
}

/* ======================================================
   HISTORY NORMALIZATION
====================================================== */

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-12)
    .map(item => {
      const role =
        item?.role === "assistant"
          ? "assistant"
          : "user";

      const content =
        safeString(
          item?.content ??
          item?.message ??
          item?.text
        );

      if (!content) {
        return null;
      }

      return {
        role,
        content:
          limitText(
            content,
            8000
          )
      };
    })
    .filter(Boolean);
}

/* ======================================================
   ATTACHMENTS
====================================================== */

function normalizeAttachments(
  attachments
) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .slice(0, 5)
    .map(item => ({
      name:
        limitText(
          safeString(item?.name),
          200
        ),

      type:
        limitText(
          safeString(item?.type),
          100
        ),

      text:
        limitText(
          safeString(
            item?.text ??
            item?.content ??
            item?.extractedText
          ),
          12000
        ),

      url:
        limitText(
          safeString(item?.url),
          1000
        )
    }))
    .filter(
      item =>
        item.name ||
        item.text ||
        item.url
    );
}

/* ======================================================
   MESSAGE BUILDER
====================================================== */

function buildMessages({
  systemInstructions,
  history,
  userMessage,
  memories,
  attachments,
  research
}) {
  const messages = [];

  messages.push({
    role: "system",
    content:
      systemInstructions
  });

  if (
    Array.isArray(memories) &&
    memories.length
  ) {
    messages.push({
      role: "system",
      content:
        [
          "USER MEMORY CONTEXT:",
          ...memories.map(
            item =>
              `- ${item.memory}`
          )
        ].join("\n")
    });
  }

  if (
    Array.isArray(attachments) &&
    attachments.length
  ) {
    messages.push({
      role: "system",
      content:
        [
          "ATTACHMENT CONTEXT:",
          ...attachments.map(
            item =>
              [
                `File: ${item.name}`,
                `Type: ${item.type}`,
                item.text
                  ? `Text:\n${item.text}`
                  : "",
                item.url
                  ? `URL: ${item.url}`
                  : ""
              ]
                .filter(Boolean)
                .join("\n")
          )
        ].join("\n\n")
    });
  }

  if (research) {
    messages.push({
      role: "system",
      content:
        research
    });
  }

  messages.push(
    ...normalizeHistory(
      history
    )
  );

  messages.push({
    role: "user",
    content:
      limitText(
        userMessage,
        20000
      )
  });

  return messages;
}

/* ======================================================
   GROQ PAYLOAD
====================================================== */

function buildGroqPayload({
  model,
  messages,
  enableBrowserSearch,
  enableCode
}) {
  const payload = {
    model,

    messages,

    temperature: 0.2,

    max_tokens: 8192,

    stream: false
  };

  /*
   GPT-OSS built-in tools.

   Browser search:
   { type: "browser_search" }

   Python:
   { type: "code_interpreter" }
  */

  if (
    isGPTOSS(model)
  ) {
    const tools = [];

    if (enableBrowserSearch) {
      tools.push({
        type: "browser_search"
      });
    }

    if (enableCode) {
      tools.push({
        type: "code_interpreter"
      });
    }

    if (tools.length) {
      payload.tools = tools;
    }
  }

  return payload;
}

/* ======================================================
   GROQ COMPLETE
====================================================== */

async function callGroq({
  model,
  messages,
  enableBrowserSearch = false,
  enableCode = false
}) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is missing."
    );
  }

  const payload =
    buildGroqPayload({
      model,
      messages,
      enableBrowserSearch,
      enableCode
    });

  const response =
    await fetchWithTimeout(
      GROQ_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${GROQ_API_KEY}`,

          "Groq-Model-Version":
            "latest"
        },

        body:
          JSON.stringify(
            payload
          )
      },
      AI_TIMEOUT
    );

  const text =
    await response.text();

  let data = {};

  try {
    data =
      JSON.parse(text);
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      text ||
      `Groq HTTP ${response.status}`;

    console.error(
      "GROQ ERROR:",
      response.status,
      errorMessage
    );

    throw new Error(
      errorMessage
    );
  }

  const choice =
    data?.choices?.[0];

  const message =
    choice?.message;

  let content =
    safeString(
      message?.content
    );

  /*
    Some tool-enabled responses
    can contain tool calls while
    the final content is empty.
  */

  if (
    !content &&
    Array.isArray(
      message?.tool_calls
    )
  ) {
    content =
      "I could not generate the final response.";
  }

  return {
    text: content,
    raw: data,
    toolCalls:
      message?.tool_calls || []
  };
}

/* ======================================================
   STREAMING
====================================================== */

async function streamGroq({
  model,
  messages,
  enableBrowserSearch = false,
  enableCode = false,
  onDelta
}) {
  /*
    Tool-enabled GPT-OSS requests are
    completed first so Groq can finish
    the browser/code tool workflow.

    We then stream the final answer
    to the frontend in small chunks.
  */

  const result =
    await callGroq({
      model,
      messages,
      enableBrowserSearch,
      enableCode
    });

  const text =
    safeString(
      result.text
    );

  const chunkSize = 80;

  for (
    let i = 0;
    i < text.length;
    i += chunkSize
  ) {
    const chunk =
      text.slice(
        i,
        i + chunkSize
      );

    await onDelta(
      chunk
    );

    await sleep(5);
  }

  return result;
}

/* ======================================================
   RESPONSE CLEANING
====================================================== */

function cleanResponse(text) {
  let output =
    safeString(text);

  if (!output) {
    return "";
  }

  output =
    output.replace(
      /\bAtharv is thinking\.{0,3}\b/gi,
      ""
    );

  output =
    output.replace(
      /\bAtharv soch raha hai\.{0,3}\b/gi,
      ""
    );

  output =
    output.replace(
      /\n{4,}/g,
      "\n\n"
    );

  return output.trim();
}

/* ======================================================
   BAD RESPONSE CHECK
====================================================== */

function isBadResponse(text) {
  const value =
    cleanResponse(text);

  if (!value) {
    return true;
  }

  if (
    value.length < 2
  ) {
    return true;
  }

  const lower =
    value.toLowerCase();

  if (
    lower ===
    "i don't know"
  ) {
    return false;
  }

  const repeated =
    /(.)\1{100,}/.test(
      value
    );

  if (repeated) {
    return true;
  }

  const words =
    value
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length >= 20
  ) {
    const first =
      words
        .slice(0, 10)
        .join(" ")
        .toLowerCase();

    const second =
      words
        .slice(10, 20)
        .join(" ")
        .toLowerCase();

    if (
      first === second
    ) {
      return true;
    }
  }

  return false;
}

/* ======================================================
   GENERATE ATHARV RESPONSE
====================================================== */

async function generateAtharvResponse({
  message,
  userId,
  history = [],
  attachments = []
}) {
  const userMessage =
    safeString(message);

  if (!userMessage) {
    throw new Error(
      "Message is required."
    );
  }

  const language =
    detectLanguage(
      userMessage
    );

  const category =
    detectCategory(
      userMessage
    );

  const studyIntent =
    detectStudyIntent(
      userMessage
    );

  const studyContext =
    getStudyContext(
      userMessage
    );

  const currentDateTime =
    getIndiaDateTime();

  /* MEMORY */

  let memories = [];

  try {
    memories =
      await getMemories(
        userId,
        20
      );
  } catch (error) {
    console.error(
      "MEMORY READ ERROR:",
      error.message
    );
  }

  /* RESEARCH */

  let researchData = null;

  try {
    researchData =
      await performResearch({
        message:
          userMessage,

        category,

        studyIntent
      });
  } catch (error) {
    console.error(
      "RESEARCH ERROR:",
      error.message
    );
  }

  const researchText =
    formatResearch(
      researchData,
      studyIntent
    );

  /* SYSTEM */

  const systemInstructions =
    buildSystemInstructions({
      language,

      category,

      studyIntent,

      studyContext,

      currentDateTime:
        currentDateTime.formatted
    });

  /* MESSAGES */

  const messages =
    buildMessages({
      systemInstructions,

      history,

      userMessage,

      memories,

      attachments:

        normalizeAttachments(
          attachments
        ),

      research:
        researchText
    });

  /* LIVE / CODE */

  const liveNeeded =
    needsLiveResearch(
      userMessage
    ) ||
    category === "weather" ||
    category === "news" ||
    category === "market" ||
    category === "sports" ||
    studyIntent ===
      "official_pyq" ||
    studyIntent ===
      "current_affairs";

  const enableBrowserSearch =
    liveNeeded ||
    category === "news" ||
    category === "market" ||
    category === "sports";

  const enableCode =
    category === "programming" ||
    /(calculate|calculation|python|execute|run this code|run code|math)/i.test(
      userMessage
    );

  let preferredModel =
    liveNeeded
      ? LIVE_MODEL
      : GENERAL_MODEL;

  let result;

  /*
   ======================================================
   PRIMARY MODEL
  ======================================================
  */

  try {
    console.log(
      "GROQ PRIMARY MODEL:",
      preferredModel
    );

    result =
      await callGroq({
        model:
          preferredModel,

        messages,

        enableBrowserSearch,

        enableCode
      });
  } catch (primaryError) {
    console.error(
      "PRIMARY GROQ ERROR:",
      primaryError.message
    );

    /*
     ====================================================
     GENERAL MODEL FALLBACK
     ====================================================
    */

    if (
      preferredModel !==
      GENERAL_MODEL
    ) {
      try {
        console.log(
          "GROQ GENERAL FALLBACK:",
          GENERAL_MODEL
        );

        result =
          await callGroq({
            model:
              GENERAL_MODEL,

            messages,

            enableBrowserSearch,

            enableCode
          });
      } catch (generalError) {
        console.error(
          "GENERAL GROQ ERROR:",
          generalError.message
        );
      }
    }

    /*
     ====================================================
     FINAL FALLBACK
     ====================================================
    */

    if (!result) {
      try {
        console.log(
          "GROQ FINAL FALLBACK:",
          FALLBACK_MODEL
        );

        result =
          await callGroq({
            model:
              FALLBACK_MODEL,

            messages,

            enableBrowserSearch:
              false,

            enableCode:
              false
          });
      } catch (fallbackError) {
        console.error(
          "FALLBACK GROQ ERROR:",
          fallbackError.message
        );

        throw fallbackError;
      }
    }
  }

  let reply =
    cleanResponse(
      result?.text
    );

  if (
    isBadResponse(reply)
  ) {
    throw new Error(
      "AI returned an invalid or repetitive response."
    );
  }

  return {
    reply,

    response:
      reply,

    answer:
      reply,

    text:
      reply,

    metadata: {
      serverVersion:
        SERVER_VERSION,

      model:
        preferredModel,

      language,

      category,

      studyIntent,

      studyContext,

      liveResearch:
        Boolean(
          researchText
        ),

      memory:
        memories.length > 0,

      browserSearch:
        enableBrowserSearch,

      codeExecution:
        enableCode
    }
  };
}

/* ======================================================
   HEALTH
====================================================== */

app.get(
  "/health",
  async (req, res) => {
    let database = false;

    if (pool) {
      try {
        await pool.query(
          "SELECT 1"
        );

        database = true;
      } catch {
        database = false;
      }
    }

    res.json({
      ok: true,

      status:
        database || !DATABASE_URL
          ? "healthy"
          : "degraded",

      service:
        "Atharv AI",

      version:
        SERVER_VERSION,

      time:
        new Date().toISOString(),

      timezone:
        "Asia/Kolkata",

      providers: {
        groq:
          Boolean(
            GROQ_API_KEY
          ),

        tavily:
          Boolean(
            TAVILY_API_KEY
          ),

        gdelt:
          true,

        openMeteo:
          true,

        database
      },

      models: {
        general:
          GENERAL_MODEL,

        live:
          LIVE_MODEL,

        fallback:
          FALLBACK_MODEL
      },

      features: {
        multilingual:
          true,

        worldLanguages:
          true,

        intelligentRouter:
          true,

        liveWebResearch:
          true,

        browserSearch:
          isGPTOSS(
            GENERAL_MODEL
          ),

        weather:
          true,

        market:
          true,

        news:
          true,

        sports:
          true,

        studyEngine:
          true,

        officialPYQ:
          true,

        programming:
          true,

        pythonExecution:
          isGPTOSS(
            GENERAL_MODEL
          ),

        memory:
          Boolean(pool),

        attachments:
          true,

        streaming:
          true,

        frontend:
          true
      }
    });
  }
);

/* ======================================================
   DEPENDENCY HEALTH
====================================================== */

app.get(
  "/health/dependencies",
  async (req, res) => {
    const result = {
      groq: {
        configured:
          Boolean(
            GROQ_API_KEY
          ),

        model:
          GENERAL_MODEL
      },

      tavily: {
        configured:
          Boolean(
            TAVILY_API_KEY
          )
      },

      database: {
        configured:
          Boolean(
            DATABASE_URL
          ),

        connected:
          false
      },

      gdelt: {
        enabled:
          true
      },

      openMeteo: {
        enabled:
          true
      }
    };

    if (pool) {
      try {
        await pool.query(
          "SELECT 1"
        );

        result.database.connected =
          true;
      } catch (error) {
        result.database.error =
          error.message;
      }
    }

    res.json(result);
  }
);

/* ======================================================
   CHAT
====================================================== */

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const message =
        safeString(
          req.body?.message ??
          req.body?.text
        );

      if (!message) {
        return res.status(400).json({
          ok: false,

          error:
            "Message is required."
        });
      }

      const userId =
        getUserId(req);

      /*
       MEMORY REQUEST
      */

      const memory =
        extractMemory(
          message
        );

      if (memory) {
        try {
          await saveMemory(
            userId,
            memory
          );
        } catch (error) {
          console.error(
            "MEMORY SAVE ERROR:",
            error.message
          );
        }
      }

      /*
       CLEAR MEMORY
      */

      if (
        /(forget everything|forget all memories|delete all memories|clear memory|clear all memory|sab yaad bhool jao)/i.test(
          message
        )
      ) {
        try {
          await clearMemory(
            userId
          );
        } catch (error) {
          console.error(
            "MEMORY CLEAR ERROR:",
            error.message
          );
        }
      }

      /*
       GENERATE
      */

      const result =
        await generateAtharvResponse({
          message,

          userId,

          history:
            req.body?.history,

          attachments:
            req.body?.attachments
        });

      res.json({
        ok: true,

        ...result
      });
    } catch (error) {
      console.error(
        "CHAT ERROR:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Atharv response generate nahi kar paaya.",

        details:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : error.message
      });
    }
  }
);

/* ======================================================
   CHAT STREAM
====================================================== */

app.post(
  "/api/chat/stream",
  async (req, res) => {
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

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    const sendEvent =
      (event, data) => {
        res.write(
          `event: ${event}\n`
        );

        res.write(
          `data: ${JSON.stringify(
            data
          )}\n\n`
        );
      };

    try {
      const message =
        safeString(
          req.body?.message ??
          req.body?.text
        );

      if (!message) {
        sendEvent(
          "error",
          {
            error:
              "Message is required."
          }
        );

        return res.end();
      }

      const userId =
        getUserId(req);

      const language =
        detectLanguage(
          message
        );

      const category =
        detectCategory(
          message
        );

      const studyIntent =
        detectStudyIntent(
          message
        );

      const studyContext =
        getStudyContext(
          message
        );

      const currentDateTime =
        getIndiaDateTime();

      let memories = [];

      try {
        memories =
          await getMemories(
            userId,
            20
          );
      } catch (error) {
        console.error(
          "STREAM MEMORY ERROR:",
          error.message
        );
      }

      let researchData = null;

      try {
        researchData =
          await performResearch({
            message,

            category,

            studyIntent
          });
      } catch (error) {
        console.error(
          "STREAM RESEARCH ERROR:",
          error.message
        );
      }

      const researchText =
        formatResearch(
          researchData,
          studyIntent
        );

      const systemInstructions =
        buildSystemInstructions({
          language,

          category,

          studyIntent,

          studyContext,

          currentDateTime:
            currentDateTime.formatted
        });

      const messages =
        buildMessages({
          systemInstructions,

          history:
            req.body?.history,

          userMessage:
            message,

          memories,

          attachments:
            normalizeAttachments(
              req.body?.attachments
            ),

          research:
            researchText
        });

      const liveNeeded =
        needsLiveResearch(
          message
        ) ||
        category === "weather" ||
        category === "news" ||
        category === "market" ||
        category === "sports" ||
        studyIntent ===
          "official_pyq" ||
        studyIntent ===
          "current_affairs";

      const enableBrowserSearch =
        liveNeeded ||
        category === "news" ||
        category === "market" ||
        category === "sports";

      const enableCode =
        category ===
          "programming" ||
        /(calculate|calculation|python|execute|run code|math)/i.test(
          message
        );

      const preferredModel =
        liveNeeded
          ? LIVE_MODEL
          : GENERAL_MODEL;

      sendEvent(
        "meta",
        {
          serverVersion:
            SERVER_VERSION,

          model:
            preferredModel,

          language,

          category,

          studyIntent,

          liveResearch:
            Boolean(
              researchText
            )
        }
      );

      let result = null;

      try {
        result =
          await streamGroq({
            model:
              preferredModel,

            messages,

            enableBrowserSearch,

            enableCode,

            onDelta:
              async (delta) => {
                sendEvent(
                  "delta",
                  {
                    text:
                      delta
                  }
                );
              }
          });
      } catch (primaryError) {
        console.error(
          "STREAM PRIMARY ERROR:",
          primaryError.message
        );

        try {
          result =
            await streamGroq({
              model:
                GENERAL_MODEL,

              messages,

              enableBrowserSearch,

              enableCode,

              onDelta:
                async (delta) => {
                  sendEvent(
                    "delta",
                    {
                      text:
                        delta
                    }
                  );
                }
            });
        } catch (generalError) {
          console.error(
            "STREAM GENERAL ERROR:",
            generalError.message
          );

          result =
            await streamGroq({
              model:
                FALLBACK_MODEL,

              messages,

              enableBrowserSearch:
                false,

              enableCode:
                false,

              onDelta:
                async (delta) => {
                  sendEvent(
                    "delta",
                    {
                      text:
                        delta
                    }
                  );
                }
            });
        }
      }

      sendEvent(
        "done",
        {
          ok: true,

          answer:
            cleanResponse(
              result?.text
            ),

          metadata: {
            serverVersion:
              SERVER_VERSION,

            model:
              preferredModel,

            language,

            category,

            studyIntent
          }
        }
      );

      res.end();
    } catch (error) {
      console.error(
        "STREAM CHAT ERROR:",
        error
      );

      sendEvent(
        "error",
        {
          error:
            "Atharv response generate nahi kar paaya."
        }
      );

      res.end();
    }
  }
);

/* ======================================================
   MEMORY GET
====================================================== */

app.get(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memories =
        await getMemories(
          userId,
          100
        );

      res.json({
        ok: true,

        memories
      });
    } catch (error) {
      console.error(
        "MEMORY GET ERROR:",
        error.message
      );

      res.status(500).json({
        ok: false,

        error:
          "Memory load failed."
      });
    }
  }
);

/* ======================================================
   MEMORY POST
====================================================== */

app.post(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memory =
        safeString(
          req.body?.memory
        );

      if (!memory) {
        return res.status(400).json({
          ok: false,

          error:
            "Memory is required."
        });
      }

      if (
        containsSensitiveMemory(
          memory
        )
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Sensitive information cannot be stored."
        });
      }

      await saveMemory(
        userId,
        memory
      );

      res.json({
        ok: true,

        message:
          "Memory saved."
      });
    } catch (error) {
      console.error(
        "MEMORY POST ERROR:",
        error.message
      );

      res.status(500).json({
        ok: false,

        error:
          "Memory save failed."
      });
    }
  }
);

/* ======================================================
   MEMORY DELETE ALL
====================================================== */

app.delete(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      await clearMemory(
        userId
      );

      res.json({
        ok: true,

        message:
          "All memories deleted."
      });
    } catch (error) {
      console.error(
        "MEMORY DELETE ERROR:",
        error.message
      );

      res.status(500).json({
        ok: false,

        error:
          "Memory delete failed."
      });
    }
  }
);

/* ======================================================
   MEMORY DELETE ONE
====================================================== */

app.delete(
  "/api/memory/:id",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id)
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Invalid memory ID."
        });
      }

      await deleteMemory(
        userId,
        id
      );

      res.json({
        ok: true,

        message:
          "Memory deleted."
      });
    } catch (error) {
      console.error(
        "MEMORY DELETE ONE ERROR:",
        error.message
      );

      res.status(500).json({
        ok: false,

        error:
          "Memory delete failed."
      });
    }
  }
);

/* ======================================================
   API INFO
====================================================== */

app.get(
  "/api",
  (req, res) => {
    res.json({
      ok: true,

      service:
        "Atharv AI",

      version:
        SERVER_VERSION,

      message:
        "Atharv AI API is running.",

      endpoints: [
        "POST /api/chat",
        "POST /api/chat/stream",
        "GET /api/memory",
        "POST /api/memory",
        "DELETE /api/memory",
        "DELETE /api/memory/:id",
        "GET /health",
        "GET /health/dependencies"
      ]
    });
  }
);

/* ======================================================
   STATIC FRONTEND
====================================================== */

const publicPath =
  __dirname;

app.use(
  express.static(
    publicPath,
    {
      extensions: [
        "html"
      ]
    }
  )
);

/* ======================================================
   ROOT
====================================================== */

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        publicPath,
        "index.html"
      )
    );
  }
);

/* ======================================================
   SPA FALLBACK
====================================================== */

app.get(
  "*splat",
  (req, res, next) => {
    if (
      req.path.startsWith(
        "/api/"
      )
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        publicPath,
        "index.html"
      )
    );
  }
);

/* ======================================================
   API 404
====================================================== */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      ok: false,

      error:
        "API endpoint not found."
    });
  }
);

/* ======================================================
   GLOBAL ERROR
====================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "GLOBAL ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      ok: false,

      error:
        "Internal server error."
    });
  }
);

/* ======================================================
   STARTUP
====================================================== */

async function startServer() {
  console.log(
    "=================================================="
  );

  console.log(
    "ATHARV AI SERVER STARTING..."
  );

  console.log(
    "Version:",
    SERVER_VERSION
  );

  console.log(
    "General Model:",
    GENERAL_MODEL
  );

  console.log(
    "Live Model:",
    LIVE_MODEL
  );

  console.log(
    "Fallback Model:",
    FALLBACK_MODEL
  );

  console.log(
    "=================================================="
  );

  /*
   DATABASE
  */

  if (pool) {
    try {
      await pool.query(
        "SELECT 1"
      );

      console.log(
        "PostgreSQL:",
        "CONNECTED"
      );

      await ensureMemoryTable();

      console.log(
        "Memory table:",
        "READY"
      );
    } catch (error) {
      console.error(
        "DATABASE STARTUP ERROR:",
        error.message
      );

      console.log(
        "Server will continue in degraded database mode."
      );
    }
  } else {
    console.log(
      "PostgreSQL:",
      "NOT CONFIGURED"
    );
  }

  /*
   FEATURE STATUS
  */

  console.log(
    "Groq:",
    GROQ_API_KEY
      ? "ENABLED"
      : "DISABLED"
  );

  console.log(
    "Tavily:",
    TAVILY_API_KEY
      ? "ENABLED"
      : "DISABLED"
  );

  console.log(
    "News Routing:",
    "ENABLED"
  );

  console.log(
    "Market Routing:",
    "ENABLED"
  );

  console.log(
    "Weather:",
    "ENABLED"
  );

  console.log(
    "Sports:",
    "ENABLED"
  );

  console.log(
    "Streaming:",
    "ENABLED"
  );

  console.log(
    "Memory:",
    pool
      ? "ENABLED"
      : "DISABLED"
  );

  console.log(
    "Programming Engine:",
    "ENABLED"
  );

  console.log(
    "Python Execution:",
    isGPTOSS(
      GENERAL_MODEL
    )
      ? "AVAILABLE"
      : "UNAVAILABLE"
  );

  console.log(
    "Study Engine:",
    "ENABLED"
  );

  console.log(
    "Official PYQ Routing:",
    "ENABLED"
  );

  console.log(
    "Live Web Research:",
    "ENABLED"
  );

  console.log(
    "Browser Search:",
    isGPTOSS(
      GENERAL_MODEL
    )
      ? "ENABLED"
      : "DISABLED"
  );

  console.log(
    "Intelligent Router:",
    "ENABLED"
  );

  console.log(
    "World Languages:",
    "ENABLED"
  );

  console.log(
    "Multilingual AI:",
    "ENABLED"
  );

  console.log(
    "Frontend:",
    "ENABLED"
  );

  app.listen(
    PORT,
    () => {
      console.log(
        "=================================================="
      );

      console.log(
        `ATHARV AI v${SERVER_VERSION}`
      );

      console.log(
        `Server running on port ${PORT}`
      );

      console.log(
        "=================================================="
      );
    }
  );
}

/* ======================================================
   START
====================================================== */

startServer()
  .catch((error) => {
    console.error(
      "FATAL STARTUP ERROR:",
      error
    );

    /*
      Don't crash Render unnecessarily.
      Start the HTTP server even if
      optional initialization fails.
    */

    app.listen(
      PORT,
      () => {
        console.log(
          `ATHARV AI degraded server running on port ${PORT}`
        );
      }
    );
  });
