"use strict";

/*
=========================================================
 ATHARV AI SERVER
 Version 15.1.1 FINAL
 --------------------------------------------------------
 - Current Groq GPT-OSS models
 - Automatic general Q&A
 - Reasoning / problem solving
 - Hindi / Hinglish / English / Indian languages
 - World language support
 - Live web research
 - Tavily search
 - GDELT news fallback
 - Open-Meteo weather
 - Market / news / sports routing
 - Official exam / PYQ research
 - Class 1-12 study engine
 - Competitive exams
 - Programming / coding / debugging
 - PostgreSQL memory
 - Attachments context
 - Real streaming
 - Response cleaning
 - Health monitoring
 - Render compatible
 - Neon PostgreSQL compatible
 - Old Compound model protection

 IMPORTANT:
 groq/compound
 groq/compound-mini

 are NOT used anywhere.
=========================================================
*/

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

/* ======================================================
   APP CONFIG
====================================================== */

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const SERVER_VERSION = "15.1.1";

/*
 * Current Groq defaults.
 * Old Compound models are intentionally blocked.
 */
const DEFAULT_GENERAL_MODEL = "openai/gpt-oss-120b";
const DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-20b";

const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();

const TAVILY_API_KEY = String(process.env.TAVILY_API_KEY || "").trim();

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

/*
 * If an old Render environment variable still contains
 * groq/compound-mini, automatically replace it.
 */
function resolveModel(envName, fallback) {
  const value = String(process.env[envName] || "").trim();

  if (!value) return fallback;

  if (
    value === "groq/compound" ||
    value === "groq/compound-mini"
  ) {
    console.warn(
      `${envName} contains deprecated Compound model. Using ${fallback}.`
    );

    return fallback;
  }

  return value;
}

const GENERAL_MODEL = resolveModel(
  "GROQ_MODEL",
  DEFAULT_GENERAL_MODEL
);

const LIVE_MODEL = resolveModel(
  "GROQ_LIVE_MODEL",
  GENERAL_MODEL
);

const FALLBACK_MODEL = resolveModel(
  "GROQ_FALLBACK_MODEL",
  DEFAULT_FALLBACK_MODEL
);

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

const REQUEST_TIMEOUT_MS = 45000;

const MAX_HISTORY = 16;

const MAX_ATTACHMENTS = 5;

const MAX_MEMORY_ITEMS = 20;

/* ======================================================
   MIDDLEWARE
====================================================== */

app.disable("x-powered-by");

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-atharv-user-id",
      "x-user-id"
    ]
  })
);

app.use(express.json({ limit: MAX_BODY_SIZE }));

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
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on("error", (error) => {
    console.error("POSTGRES POOL ERROR:", error.message);
  });
}

/* ======================================================
   BASIC HELPERS
====================================================== */

function safeText(value, max = 12000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .slice(0, max)
    .trim();
}

function jsonSafe(value, fallback = null) {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function hashText(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || "anonymous"))
    .digest("hex");
}

function getUserId(req) {
  const raw =
    req.body?.userId ||
    req.headers["x-atharv-user-id"] ||
    req.headers["x-user-id"] ||
    req.query?.userId ||
    "anonymous";

  return hashText(raw);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutSignal(ms) {
  return AbortSignal.timeout(ms);
}

/* ======================================================
   INDIA DATE / TIME
====================================================== */

function getIndiaDateTime() {
  const now = new Date();

  const date = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);

  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(now);

  return {
    date,
    time,
    iso: now.toISOString()
  };
}

/* ======================================================
   LANGUAGE DETECTION
====================================================== */

function detectLanguage(text) {
  const value = safeText(text, 5000);

  if (!value) return "English";

  if (/[\u0900-\u097F]/.test(value)) {
    return "Hindi";
  }

  if (/[\u0980-\u09FF]/.test(value)) {
    return "Bengali";
  }

  if (/[\u0A00-\u0A7F]/.test(value)) {
    return "Punjabi/Gurmukhi";
  }

  if (/[\u0A80-\u0AFF]/.test(value)) {
    return "Gujarati";
  }

  if (/[\u0B00-\u0B7F]/.test(value)) {
    return "Odia";
  }

  if (/[\u0B80-\u0BFF]/.test(value)) {
    return "Tamil";
  }

  if (/[\u0C00-\u0C7F]/.test(value)) {
    return "Telugu";
  }

  if (/[\u0C80-\u0CFF]/.test(value)) {
    return "Kannada";
  }

  if (/[\u0D00-\u0D7F]/.test(value)) {
    return "Malayalam";
  }

  if (/[\u0600-\u06FF]/.test(value)) {
    return "Urdu/Arabic";
  }

  if (/[\u3040-\u30FF]/.test(value)) {
    return "Japanese";
  }

  if (/[\uAC00-\uD7AF]/.test(value)) {
    return "Korean";
  }

  if (/[\u4E00-\u9FFF]/.test(value)) {
    return "Chinese";
  }

  if (/[\u0400-\u04FF]/.test(value)) {
    return "Russian";
  }

  const lower = value.toLowerCase();

  const hinglishWords = [
    "kya",
    "kaise",
    "kaisa",
    "kyun",
    "kyu",
    "mujhe",
    "mera",
    "meri",
    "mere",
    "aap",
    "tum",
    "hai",
    "hain",
    "tha",
    "thi",
    "karna",
    "karo",
    "batao",
    "bata",
    "chahiye",
    "nahi",
    "nahin",
    "wala",
    "wali",
    "kitna",
    "kitne",
    "kab",
    "kahan",
    "iske",
    "uske",
    "apna",
    "please"
  ];

  const count = hinglishWords.filter((word) => {
    return new RegExp(`\\b${word}\\b`, "i").test(lower);
  }).length;

  if (count >= 2) {
    return "Hinglish/Roman Hindi";
  }

  return "English";
}

/* ======================================================
   CATEGORY DETECTION
====================================================== */

function detectCategory(text) {
  const value = safeText(text, 6000).toLowerCase();

  if (
    /weather|temperature|forecast|rain|barish|mausam|garmi|sardi|humidity/.test(
      value
    )
  ) {
    return "weather";
  }

  if (
    /stock|share price|nifty|sensex|market|ipo|bitcoin|crypto|gold price|silver price|btc|eth/.test(
      value
    )
  ) {
    return "market";
  }

  if (
    /latest news|breaking news|news today|today news|samachar|khabar|headlines/.test(
      value
    )
  ) {
    return "news";
  }

  if (
    /cricket|football|soccer|match score|live score|ipl|world cup|tennis|basketball|sports/.test(
      value
    )
  ) {
    return "sports";
  }

  if (
    /python|javascript|typescript|node\.?js|react|html|css|sql|postgres|database|api|bug|debug|coding|code|program|programming|function|class |algorithm|github/.test(
      value
    )
  ) {
    return "programming";
  }

  if (
    /upsc|ias|ssc|ibps|bank po|banking exam|railway|rrb|neet|jee|ctet|tet|nda|cds|gate|cat|cuet|exam|pyq|previous year question/.test(
      value
    )
  ) {
    return "exam";
  }

  if (
    /class 1|class 2|class 3|class 4|class 5|class 6|class 7|class 8|class 9|class 10|class 11|class 12|homework|assignment|chapter|lesson|maths|physics|chemistry|biology|history|geography|science/.test(
      value
    )
  ) {
    return "study";
  }

  if (
    /remember|memory|yaad|save this|forget this|bhool jao|mera naam|my name|my preference/.test(
      value
    )
  ) {
    return "memory";
  }

  return "general";
}

/* ======================================================
   LIVE INTENT
====================================================== */

function needsLiveResearch(text, category) {
  const value = safeText(text, 6000).toLowerCase();

  if (
    [
      "weather",
      "market",
      "news",
      "sports"
    ].includes(category)
  ) {
    return true;
  }

  return /today|todays|latest|current|currently|right now|now|live|recent|breaking|this week|this month|2026|2025|aaj|abhi|taaza|taza|haal hi|vartaman|current affairs|result|results|price|rate|score/.test(
    value
  );
}

/* ======================================================
   STUDY INTENT
====================================================== */

function detectStudyIntent(text) {
  const value = safeText(text, 6000).toLowerCase();

  return {
    officialPYQ:
      /pyq|previous year question|previous year paper|past paper|old paper/.test(
        value
      ),

    mock:
      /mock test|practice test|test series/.test(value),

    mcq:
      /mcq|multiple choice|objective question/.test(value),

    revision:
      /revision|revise|revision notes/.test(value),

    flashcards:
      /flashcard|flash cards/.test(value),

    currentAffairs:
      /current affairs|daily current affairs|monthly current affairs/.test(
        value
      ),

    mains:
      /mains answer|mains question|descriptive answer/.test(value),

    homework:
      /homework|assignment|school work/.test(value),

    explain:
      /explain|samjhao|samjha|meaning|what is|kya hai/.test(value),

    important:
      /important questions|important topics|most important/.test(value),

    studyPlan:
      /study plan|timetable|time table|padhai schedule/.test(value)
  };
}

/* ======================================================
   STUDY CONTEXT
====================================================== */

function extractStudyContext(text) {
  const value = safeText(text, 6000);

  const context = {};

  const classMatch = value.match(
    /\bclass\s*(1[0-2]|[1-9])\b/i
  );

  if (classMatch) {
    context.class = `Class ${classMatch[1]}`;
  }

  const yearMatch = value.match(
    /\b(20\d{2})\b/
  );

  if (yearMatch) {
    context.year = yearMatch[1];
  }

  if (/cbse/i.test(value)) {
    context.board = "CBSE";
  } else if (/icse/i.test(value)) {
    context.board = "ICSE";
  } else if (/up board/i.test(value)) {
    context.board = "UP Board";
  } else if (/bihar board|bseb/i.test(value)) {
    context.board = "Bihar Board";
  }

  if (/upsc|ias/i.test(value)) {
    context.exam = "UPSC";
  } else if (/ssc/i.test(value)) {
    context.exam = "SSC";
  } else if (/ibps|bank po/i.test(value)) {
    context.exam = "IBPS/Banking";
  } else if (/railway|rrb/i.test(value)) {
    context.exam = "Railway/RRB";
  } else if (/neet/i.test(value)) {
    context.exam = "NEET";
  } else if (/jee/i.test(value)) {
    context.exam = "JEE";
  } else if (/ctet|tet/i.test(value)) {
    context.exam = "CTET/TET";
  }

  return context;
}

/* ======================================================
   OFFICIAL DOMAINS
====================================================== */

const OFFICIAL_DOMAINS = {
  upsc: "upsc.gov.in",
  ssc: "ssc.gov.in",
  railway: "indianrailways.gov.in",
  rrb: "indianrailways.gov.in",
  ibps: "ibps.in",
  sbi: "sbi.co.in",
  ctet: "ctet.nic.in",
  neet: "neet.nta.nic.in",
  jee: "jeemain.nta.nic.in"
};

function getOfficialDomain(text) {
  const value = safeText(text, 5000).toLowerCase();

  for (const key of Object.keys(OFFICIAL_DOMAINS)) {
    if (value.includes(key)) {
      return OFFICIAL_DOMAINS[key];
    }
  }

  if (/ias/.test(value)) {
    return OFFICIAL_DOMAINS.upsc;
  }

  return "";
}

/* ======================================================
   MEMORY
====================================================== */

async function ensureMemoryTable() {
  if (!pool) return;

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

function containsSensitiveMemory(text) {
  const value = safeText(text, 5000).toLowerCase();

  const blocked = [
    "password",
    "passcode",
    "api key",
    "api_key",
    "secret key",
    "private key",
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

  return blocked.some((item) => value.includes(item));
}

function extractMemoryCandidate(text) {
  const value = safeText(text, 2000);

  if (containsSensitiveMemory(value)) {
    return null;
  }

  const patterns = [
    /remember that (.+)/i,
    /remember (.+)/i,
    /please remember (.+)/i,
    /save this (.+)/i,
    /mera naam (.+?) hai/i,
    /my name is (.+)/i,
    /i am (.+)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match && match[1]) {
      const memory = safeText(match[1], 500);

      if (
        memory.length >= 2 &&
        memory.length <= 500
      ) {
        return memory;
      }
    }
  }

  return null;
}

async function saveMemory(userId, memory) {
  if (!pool) {
    return false;
  }

  if (!memory || containsSensitiveMemory(memory)) {
    return false;
  }

  await pool.query(
    `
      INSERT INTO public.user_memories
      (user_id, memory)
      VALUES ($1, $2)
    `,
    [userId, memory]
  );

  return true;
}

async function getMemories(userId) {
  if (!pool) return [];

  const result = await pool.query(
    `
      SELECT id, memory, created_at, updated_at
      FROM public.user_memories
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT $2
    `,
    [userId, MAX_MEMORY_ITEMS]
  );

  return result.rows;
}

async function deleteMemory(userId, id) {
  if (!pool) return false;

  const result = await pool.query(
    `
      DELETE FROM public.user_memories
      WHERE id = $1 AND user_id = $2
    `,
    [id, userId]
  );

  return result.rowCount > 0;
}

async function clearMemories(userId) {
  if (!pool) return 0;

  const result = await pool.query(
    `
      DELETE FROM public.user_memories
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rowCount;
}

/* ======================================================
   MEMORY CONTEXT
====================================================== */

function formatMemoryContext(memories) {
  if (!Array.isArray(memories) || !memories.length) {
    return "";
  }

  return memories
    .map((item) => `- ${safeText(item.memory, 500)}`)
    .join("\n");
}

/* ======================================================
   TAVILY SEARCH
====================================================== */

async function tavilySearch(
  query,
  options = {}
) {
  if (!TAVILY_API_KEY) {
    return {
      ok: false,
      error: "TAVILY_API_KEY not configured",
      results: []
    };
  }

  const payload = {
    api_key: TAVILY_API_KEY,
    query: safeText(query, 1000),
    search_depth:
      options.searchDepth || "advanced",
    topic:
      options.topic || "general",
    max_results:
      Number(options.maxResults) || 6,
    include_answer: true,
    include_raw_content: false,
    include_images: false
  };

  if (
    Array.isArray(options.includeDomains) &&
    options.includeDomains.length
  ) {
    payload.include_domains =
      options.includeDomains;
  }

  try {
    const response = await fetch(TAVILY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: timeoutSignal(20000)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error:
          data?.detail ||
          data?.message ||
          `Tavily HTTP ${response.status}`,
        results: []
      };
    }

    return {
      ok: true,
      answer: data?.answer || "",
      results: Array.isArray(data?.results)
        ? data.results
        : []
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      results: []
    };
  }
}

/* ======================================================
   GDELT NEWS
====================================================== */

async function gdeltSearch(query) {
  try {
    const url =
      `${GDELT_URL}?query=` +
      encodeURIComponent(query) +
      `&mode=artlist` +
      `&maxrecords=10` +
      `&format=json` +
      `&sort=HybridRel`;

    const response = await fetch(url, {
      signal: timeoutSignal(15000)
    });

    if (!response.ok) {
      return {
        ok: false,
        results: []
      };
    }

    const data = await response.json();

    const articles =
      Array.isArray(data?.articles)
        ? data.articles
        : [];

    return {
      ok: true,
      results: articles.map((item) => ({
        title: item.title || "",
        url: item.url || "",
        domain: item.domain || "",
        date: item.seendate || "",
        language: item.language || ""
      }))
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      results: []
    };
  }
}

/* ======================================================
   WEATHER
====================================================== */

function weatherDescription(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail"
  };

  return map[code] || "Unknown conditions";
}

async function geocodeCity(city) {
  const url =
    `${GEO_URL}?name=` +
    encodeURIComponent(city) +
    `&count=1&language=en&format=json`;

  try {
    const response = await fetch(url, {
      signal: timeoutSignal(10000)
    });

    if (!response.ok) return null;

    const data = await response.json();

    const place = data?.results?.[0];

    if (!place) return null;

    return {
      name: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone
    };
  } catch {
    return null;
  }
}

async function weatherSearch(city) {
  const place = await geocodeCity(city);

  if (!place) {
    return {
      ok: false,
      error: "City not found"
    };
  }

  const url =
    `${WEATHER_URL}` +
    `?latitude=${encodeURIComponent(place.latitude)}` +
    `&longitude=${encodeURIComponent(place.longitude)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto` +
    `&forecast_days=3`;

  try {
    const response = await fetch(url, {
      signal: timeoutSignal(10000)
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Weather HTTP ${response.status}`
      };
    }

    const data = await response.json();

    return {
      ok: true,
      place,
      current: data.current,
      daily: data.daily
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

function extractCityFromWeatherQuestion(text) {
  const value = safeText(text, 3000);

  const patterns = [
    /weather in ([a-zA-Z .'-]+)/i,
    /temperature in ([a-zA-Z .'-]+)/i,
    /forecast in ([a-zA-Z .'-]+)/i,
    /mausam ([a-zA-Z .'-]+)/i,
    /weather of ([a-zA-Z .'-]+)/i,
    /temperature of ([a-zA-Z .'-]+)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match && match[1]) {
      return safeText(match[1], 100);
    }
  }

  return "Delhi";
}

/* ======================================================
   RESEARCH QUERY
====================================================== */

function buildResearchQuery(
  question,
  category,
  studyContext
) {
  let query = safeText(question, 1200);

  if (category === "news") {
    query += " latest news current";
  }

  if (category === "market") {
    query += " latest current price market";
  }

  if (category === "sports") {
    query += " latest current score result";
  }

  if (studyContext?.officialPYQ) {
    query += " official previous year question paper";
  }

  if (studyContext?.currentAffairs) {
    query += " current affairs";
  }

  return safeText(query, 1800);
}

/* ======================================================
   EXTERNAL RESEARCH ROUTER
====================================================== */

async function performResearch(
  question,
  category,
  studyIntent,
  studyContext
) {
  /*
   * Weather gets a direct structured source.
   */
  if (category === "weather") {
    const city =
      extractCityFromWeatherQuestion(question);

    const weather = await weatherSearch(city);

    if (weather.ok) {
      return {
        type: "weather",
        ok: true,
        weather
      };
    }
  }

  const query = buildResearchQuery(
    question,
    category,
    studyContext
  );

  const officialDomain =
    getOfficialDomain(question);

  const shouldUseOfficial =
    studyIntent.officialPYQ ||
    Boolean(officialDomain);

  let tavily;

  if (shouldUseOfficial) {
    tavily = await tavilySearch(
      query,
      {
        includeDomains: officialDomain
          ? [officialDomain]
          : [],
        searchDepth: "advanced",
        maxResults: 6
      }
    );
  } else {
    tavily = await tavilySearch(
      query,
      {
        searchDepth: "advanced",
        topic:
          category === "news"
            ? "news"
            : "general",
        maxResults: 6
      }
    );
  }

  /*
   * GDELT only when news/current information
   * is relevant.
   */
  let gdelt = {
    ok: false,
    results: []
  };

  if (
    category === "news" ||
    needsLiveResearch(question, category)
  ) {
    gdelt = await gdeltSearch(query);
  }

  return {
    type: "web",
    ok:
      Boolean(tavily?.ok) ||
      Boolean(gdelt?.ok),
    officialDomain,
    tavily,
    gdelt
  };
}

/* ======================================================
   RESEARCH FORMATTER
====================================================== */

function formatResearch(research) {
  if (!research || !research.ok) {
    return "";
  }

  if (
    research.type === "weather" &&
    research.weather?.ok
  ) {
    const w = research.weather;

    const current = w.current || {};
    const daily = w.daily || {};

    let output = `
LIVE WEATHER DATA
Location: ${w.place.name}, ${w.place.country}
Temperature: ${current.temperature_2m ?? "N/A"} °C
Feels like: ${current.apparent_temperature ?? "N/A"} °C
Humidity: ${current.relative_humidity_2m ?? "N/A"}%
Wind: ${current.wind_speed_10m ?? "N/A"} km/h
Precipitation: ${current.precipitation ?? "N/A"} mm
Condition: ${weatherDescription(current.weather_code)}
`;

    if (Array.isArray(daily.time)) {
      output += "\n3-DAY FORECAST:\n";

      for (let i = 0; i < daily.time.length; i++) {
        output +=
          `${daily.time[i]} | ` +
          `${daily.temperature_2m_min?.[i] ?? "N/A"}°C - ` +
          `${daily.temperature_2m_max?.[i] ?? "N/A"}°C | ` +
          `Rain chance ${daily.precipitation_probability_max?.[i] ?? "N/A"}%\n`;
      }
    }

    return output.trim();
  }

  const parts = [];

  if (research.officialDomain) {
    parts.push(
      `Official domain requested: ${research.officialDomain}`
    );
  }

  if (research.tavily?.answer) {
    parts.push(
      `Search summary:\n${safeText(
        research.tavily.answer,
        5000
      )}`
    );
  }

  if (
    Array.isArray(research.tavily?.results) &&
    research.tavily.results.length
  ) {
    parts.push(
      "WEB SOURCES:\n" +
        research.tavily.results
          .slice(0, 6)
          .map((item, index) => {
            return (
              `${index + 1}. ` +
              `${safeText(item.title, 300)}\n` +
              `URL: ${safeText(item.url, 600)}\n` +
              `${safeText(
                item.content || "",
                700
              )}`
            );
          })
          .join("\n\n")
    );
  }

  if (
    Array.isArray(research.gdelt?.results) &&
    research.gdelt.results.length
  ) {
    parts.push(
      "NEWS SOURCES:\n" +
        research.gdelt.results
          .slice(0, 8)
          .map((item, index) => {
            return (
              `${index + 1}. ` +
              `${safeText(item.title, 300)}\n` +
              `URL: ${safeText(item.url, 600)}`
            );
          })
          .join("\n\n")
    );
  }

  if (!parts.length) return "";

  return (
    "LIVE RESEARCH CONTEXT\n\n" +
    parts.join("\n\n")
  );
}

/* ======================================================
   ATTACHMENTS
====================================================== */

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .slice(0, MAX_ATTACHMENTS)
    .map((item) => {
      if (typeof item === "string") {
        return {
          name: "attachment",
          type: "text",
          content: safeText(item, 6000)
        };
      }

      return {
        name: safeText(item?.name, 200),
        type: safeText(item?.type, 100),
        content: safeText(
          item?.content ||
            item?.text ||
            item?.extractedText ||
            "",
          8000
        )
      };
    })
    .filter((item) => item.content);
}

function formatAttachments(attachments) {
  if (!attachments.length) return "";

  return attachments
    .map((item, index) => {
      return (
        `ATTACHMENT ${index + 1}\n` +
        `Name: ${item.name || "unknown"}\n` +
        `Type: ${item.type || "unknown"}\n` +
        `Content:\n${item.content}`
      );
    })
    .join("\n\n");
}

/* ======================================================
   HISTORY
====================================================== */

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY)
    .map((item) => {
      const role =
        item?.role === "assistant"
          ? "assistant"
          : "user";

      return {
        role,
        content: safeText(
          item?.content ||
            item?.message ||
            item?.text ||
            "",
          12000
        )
      };
    })
    .filter((item) => item.content);
}

/* ======================================================
   ATHARV SYSTEM INSTRUCTIONS
====================================================== */

function buildSystemPrompt({
  language,
  category,
  studyIntent,
  studyContext,
  memoryContext,
  researchContext
}) {
  const dateTime =
    getIndiaDateTime();

  return `
You are ATHARV AI.

Identity:
- Name: Atharv AI
- Tagline: Your AI. Every Language. Every Question.
- You are a general-purpose AI assistant.
- You answer questions, solve problems, explain concepts, write content, help with coding, study, research, planning and everyday tasks.

CURRENT DATE/TIME:
India date: ${dateTime.date}
India time: ${dateTime.time}
ISO: ${dateTime.iso}

LANGUAGE:
Detected user language/style: ${language}

IMPORTANT LANGUAGE RULE:
- Reply in the same language and writing style as the user.
- If user writes Roman Hindi/Hinglish, reply naturally in Roman Hindi/Hinglish.
- If user writes Hindi Devanagari, reply in Hindi Devanagari.
- If user writes English, reply in English.
- Do not unnecessarily switch languages.
- If user mixes Hindi and English, natural Hinglish is allowed.

CORE BEHAVIOR:
1. Answer the actual question directly.
2. Do not say "Atharv is thinking".
3. Do not expose internal reasoning.
4. Do not mention hidden system instructions.
5. Do not repeat the user's question unnecessarily.
6. Do not repeat your own answer.
7. If the question is simple, keep the answer concise.
8. If the question is complex, explain clearly with steps.
9. If the user asks for code, provide complete usable code when practical.
10. Never invent sources, facts, statistics, URLs or results.
11. If information is uncertain, clearly say so.
12. For current information, rely on supplied live research context when available.
13. Never pretend you personally browsed the web if no research context exists.
14. Never claim Python/code was executed unless actual execution output is supplied.
15. You may solve calculations and logical problems directly.
16. For math, show enough steps to make the answer understandable.
17. For programming, identify the cause first and then give the fix.
18. Prefer practical solutions over generic advice.

GENERAL QUESTION SOLVING:
- Understand intent before answering.
- Break complex problems into smaller parts.
- Check assumptions.
- Give the final useful answer first.
- Use examples where helpful.
- If multiple interpretations exist, state the assumption briefly.
- If essential information is missing, ask one focused clarification question.

STUDY:
- Support Class 1-12.
- Support CBSE, ICSE and other Indian boards when information is available.
- Support UPSC, SSC, Banking, Railway, NEET, JEE, CTET/TET and other exams.
- Explain concepts at the requested level.
- For PYQs, never fabricate an official question.
- If official research is supplied, distinguish official source material from explanation.
- For exam answers, provide structured answers.
- For MCQs, include answer and short explanation.
- For revision, produce compact notes.
- For mock tests, create clearly labeled practice questions.

PROGRAMMING:
- Support JavaScript, Node.js, Express, HTML, CSS, React, Python, SQL, PostgreSQL and general programming.
- Diagnose errors from logs.
- Preserve existing architecture when user asks for a fix.
- Do not remove important existing functionality without explaining it.
- Give copy-paste-ready code when requested.
- Do not claim code was executed unless execution evidence exists.

LIVE INFORMATION:
Category: ${category}

If LIVE RESEARCH CONTEXT is present:
- Use it for current facts.
- Prefer official sources for official documents.
- Prefer direct sources over secondary summaries.
- Mention dates when freshness matters.
- Do not turn search snippets into certainty if the source is unclear.

MEMORY:
${memoryContext || "No saved memory available."}

STUDY CONTEXT:
${jsonSafe(studyContext, "{}")}

STUDY INTENT:
${jsonSafe(studyIntent, "{}")}

LIVE RESEARCH:
${researchContext || "No live research was retrieved for this request."}

PRIVACY:
- Never ask the user to reveal passwords, OTPs, private keys, recovery phrases, CVV or similar secrets.
- Never store such secrets as memory.
- If the user accidentally provides such a secret, do not repeat it.

RESPONSE STYLE:
- Helpful.
- Natural.
- Clear.
- Human-like.
- No unnecessary filler.
- No fake confidence.
- No repetitive conclusion.
`;
}

/* ======================================================
   GROQ REQUEST
====================================================== */

async function callGroq(
  model,
  messages,
  options = {}
) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const payload = {
    model,
    messages,
    temperature:
      typeof options.temperature === "number"
        ? options.temperature
        : 0.35,

    max_completion_tokens:
      Number(options.maxCompletionTokens) || 4096,

    stream: Boolean(options.stream),

    include_reasoning: false
  };

  const response = await fetch(
    GROQ_URL,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${GROQ_API_KEY}`,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify(payload),
      signal: timeoutSignal(
        options.timeout || REQUEST_TIMEOUT_MS
      )
    }
  );

  if (!response.ok) {
    let errorBody = "";

    try {
      errorBody =
        JSON.stringify(
          await response.json()
        );
    } catch {
      errorBody =
        await response.text();
    }

    throw new Error(
      `Groq HTTP ${response.status}: ${errorBody}`
    );
  }

  return response;
}

/* ======================================================
   GROQ COMPLETE
====================================================== */

async function callGroqComplete(
  model,
  messages
) {
  const response = await callGroq(
    model,
    messages,
    {
      stream: false,
      maxCompletionTokens: 4096
    }
  );

  const data =
    await response.json();

  const message =
    data?.choices?.[0]?.message;

  const content =
    message?.content;

  if (!content) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  return safeText(content, 50000);
}

/* ======================================================
   GROQ STREAM
====================================================== */

async function streamGroqToClient(
  model,
  messages,
  res
) {
  const response = await callGroq(
    model,
    messages,
    {
      stream: true,
      maxCompletionTokens: 4096,
      timeout: 60000
    }
  );

  if (!response.body) {
    throw new Error(
      "Groq streaming body unavailable."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) break;

    buffer += decoder.decode(
      value,
      { stream: true }
    );

    const lines =
      buffer.split("\n");

    buffer =
      lines.pop() || "";

    for (const rawLine of lines) {
      const line =
        rawLine.trim();

      if (!line.startsWith("data:")) {
        continue;
      }

      const payload =
        line.slice(5).trim();

      if (payload === "[DONE]") {
        continue;
      }

      try {
        const data =
          JSON.parse(payload);

        const delta =
          data?.choices?.[0]?.delta?.content;

        if (delta) {
          fullText += delta;

          res.write(
            `data: ${JSON.stringify({
              type: "delta",
              text: delta
            })}\n\n`
          );
        }
      } catch {
        /*
         * Ignore malformed partial SSE lines.
         */
      }
    }
  }

  return cleanResponse(fullText);
}

/* ======================================================
   RESPONSE CLEANING
====================================================== */

function cleanResponse(text) {
  let value =
    safeText(text, 50000);

  value =
    value.replace(
      /^Atharv\s+AI\s*:\s*/i,
      ""
    );

  value =
    value.replace(
      /^(atharv is thinking|atharv soch raha hai)\.*\s*/i,
      ""
    );

  value =
    value.replace(
      /\n{4,}/g,
      "\n\n"
    );

  return value.trim();
}

function isBadResponse(text) {
  const value =
    safeText(text, 50000);

  if (!value) return true;

  if (value.length < 2) return true;

  if (
    /atharv is thinking/i.test(value) &&
    value.length < 100
  ) {
    return true;
  }

  return false;
}

/* ======================================================
   MESSAGE BUILDER
====================================================== */

function buildMessages({
  question,
  language,
  category,
  studyIntent,
  studyContext,
  memoryContext,
  researchContext,
  history,
  attachments
}) {
  const systemPrompt =
    buildSystemPrompt({
      language,
      category,
      studyIntent,
      studyContext,
      memoryContext,
      researchContext
    });

  const messages = [
    {
      role: "system",
      content: systemPrompt
    }
  ];

  for (const item of history) {
    messages.push({
      role: item.role,
      content: item.content
    });
  }

  let userContent =
    safeText(question, 16000);

  if (attachments.length) {
    userContent +=
      "\n\n" +
      formatAttachments(attachments);
  }

  messages.push({
    role: "user",
    content: userContent
  });

  return messages;
}

/* ======================================================
   RESPONSE GENERATOR
====================================================== */

async function generateAtharvResponse({
  question,
  userId,
  history = [],
  attachments = []
}) {
  const cleanQuestion =
    safeText(question, 16000);

  if (!cleanQuestion) {
    throw new Error(
      "Question/message is empty."
    );
  }

  const language =
    detectLanguage(cleanQuestion);

  const category =
    detectCategory(cleanQuestion);

  const studyIntent =
    detectStudyIntent(cleanQuestion);

  const studyContext =
    extractStudyContext(cleanQuestion);

  const memories =
    await getMemories(userId);

  const memoryContext =
    formatMemoryContext(memories);

  const shouldResearch =
    needsLiveResearch(
      cleanQuestion,
      category
    ) ||
    studyIntent.officialPYQ ||
    studyIntent.currentAffairs;

  let research = null;

  if (shouldResearch) {
    research =
      await performResearch(
        cleanQuestion,
        category,
        studyIntent,
        studyContext
      );
  }

  const researchContext =
    formatResearch(research);

  const normalizedHistory =
    normalizeHistory(history);

  const normalizedAttachments =
    normalizeAttachments(
      attachments
    );

  const messages =
    buildMessages({
      question: cleanQuestion,
      language,
      category,
      studyIntent,
      studyContext,
      memoryContext,
      researchContext,
      history: normalizedHistory,
      attachments:
        normalizedAttachments
    });

  let preferredModel =
    shouldResearch
      ? LIVE_MODEL
      : GENERAL_MODEL;

  let answer = "";

  try {
    answer =
      await callGroqComplete(
        preferredModel,
        messages
      );
  } catch (primaryError) {
    console.error(
      "PRIMARY GROQ ERROR:",
      primaryError.message
    );

    if (
      FALLBACK_MODEL &&
      FALLBACK_MODEL !== preferredModel
    ) {
      console.log(
        `Trying fallback model: ${FALLBACK_MODEL}`
      );

      answer =
        await callGroqComplete(
          FALLBACK_MODEL,
          messages
        );

      preferredModel =
        FALLBACK_MODEL;
    } else {
      throw primaryError;
    }
  }

  answer =
    cleanResponse(answer);

  if (isBadResponse(answer)) {
    throw new Error(
      "Atharv generated an invalid response."
    );
  }

  return {
    answer,
    response: answer,
    text: answer,

    metadata: {
      serverVersion:
        SERVER_VERSION,

      model:
        preferredModel,

      language,

      category,

      liveResearch:
        Boolean(research?.ok),

      studyIntent,

      studyContext,

      memoryCount:
        memories.length,

      researchSources:
        research?.tavily?.results?.length ||
        0
    }
  };
}

/* ======================================================
   ROOT
====================================================== */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "Atharv AI",
    version: SERVER_VERSION,
    message:
      "Atharv AI server is running."
  });
});

/* ======================================================
   HEALTH
====================================================== */

app.get("/health", async (req, res) => {
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

    status: "healthy",

    service: "Atharv AI",

    version:
      SERVER_VERSION,

    node:
      process.version,

    time:
      new Date().toISOString(),

    database,

    providers: {
      groq:
        Boolean(GROQ_API_KEY),

      tavily:
        Boolean(TAVILY_API_KEY),

      gdelt: true,

      openMeteo: true
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
      multilingual: true,

      reasoning: true,

      generalQuestionAnswering: true,

      liveResearch: true,

      weather: true,

      marketRouting: true,

      newsRouting: true,

      sportsRouting: true,

      examRouting: true,

      officialPYQRouting: true,

      studyEngine: true,

      programmingEngine: true,

      memory:
        Boolean(pool),

      attachments: true,

      streaming: true,

      pythonExecution:
        false,

      compoundModels:
        false
    }
  });
});

/* ======================================================
   DEPENDENCY HEALTH
====================================================== */

app.get(
  "/health/dependencies",
  async (req, res) => {
    const result = {
      groq: {
        configured:
          Boolean(GROQ_API_KEY)
      },

      tavily: {
        configured:
          Boolean(TAVILY_API_KEY)
      },

      gdelt: {
        configured: true
      },

      openMeteo: {
        configured: true
      },

      database: {
        configured:
          Boolean(pool),

        connected: false
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

    res.json({
      ok: true,
      version:
        SERVER_VERSION,
      dependencies:
        result
    });
  }
);

/* ======================================================
   CHAT
====================================================== */

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const question =
        safeText(
          req.body?.message ||
          req.body?.question ||
          req.body?.prompt ||
          "",
          16000
        );

      if (!question) {
        return res.status(400).json({
          ok: false,
          error:
            "Message/question is required."
        });
      }

      const userId =
        getUserId(req);

      /*
       * Optional automatic memory.
       */
      const memoryCandidate =
        extractMemoryCandidate(
          question
        );

      let memorySaved = false;

      if (memoryCandidate) {
        memorySaved =
          await saveMemory(
            userId,
            memoryCandidate
          );
      }

      const result =
        await generateAtharvResponse({
          question,
          userId,
          history:
            req.body?.history,
          attachments:
            req.body?.attachments
        });

      return res.json({
        ok: true,

        answer:
          result.answer,

        response:
          result.response,

        text:
          result.text,

        metadata: {
          ...result.metadata,
          memorySaved
        }
      });
    } catch (error) {
      console.error(
        "CHAT ERROR:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Atharv could not generate a response.",
        message:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined
      });
    }
  }
);

/* ======================================================
   STREAM CHAT
====================================================== */

app.post(
  "/api/chat/stream",
  async (req, res) => {
    let streamStarted = false;

    try {
      const question =
        safeText(
          req.body?.message ||
          req.body?.question ||
          req.body?.prompt ||
          "",
          16000
        );

      if (!question) {
        return res.status(400).json({
          ok: false,
          error:
            "Message/question is required."
        });
      }

      const userId =
        getUserId(req);

      const language =
        detectLanguage(question);

      const category =
        detectCategory(question);

      const studyIntent =
        detectStudyIntent(question);

      const studyContext =
        extractStudyContext(question);

      const memories =
        await getMemories(userId);

      const memoryContext =
        formatMemoryContext(memories);

      const shouldResearch =
        needsLiveResearch(
          question,
          category
        ) ||
        studyIntent.officialPYQ ||
        studyIntent.currentAffairs;

      let research = null;

      if (shouldResearch) {
        research =
          await performResearch(
            question,
            category,
            studyIntent,
            studyContext
          );
      }

      const researchContext =
        formatResearch(research);

      const history =
        normalizeHistory(
          req.body?.history
        );

      const attachments =
        normalizeAttachments(
          req.body?.attachments
        );

      const messages =
        buildMessages({
          question,
          language,
          category,
          studyIntent,
          studyContext,
          memoryContext,
          researchContext,
          history,
          attachments
        });

      let model =
        shouldResearch
          ? LIVE_MODEL
          : GENERAL_MODEL;

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

      res.setHeader(
        "X-Accel-Buffering",
        "no"
      );

      if (res.flushHeaders) {
        res.flushHeaders();
      }

      streamStarted = true;

      res.write(
        `data: ${JSON.stringify({
          type: "meta",
          version:
            SERVER_VERSION,
          model,
          language,
          category,
          liveResearch:
            Boolean(research?.ok)
        })}\n\n`
      );

      let finalAnswer = "";

      try {
        finalAnswer =
          await streamGroqToClient(
            model,
            messages,
            res
          );
      } catch (primaryError) {
        console.error(
          "STREAM PRIMARY ERROR:",
          primaryError.message
        );

        if (
          FALLBACK_MODEL &&
          FALLBACK_MODEL !== model
        ) {
          model =
            FALLBACK_MODEL;

          res.write(
            `data: ${JSON.stringify({
              type: "fallback",
              model
            })}\n\n`
          );

          finalAnswer =
            await streamGroqToClient(
              model,
              messages,
              res
            );
        } else {
          throw primaryError;
        }
      }

      if (isBadResponse(finalAnswer)) {
        throw new Error(
          "Streaming response was empty."
        );
      }

      res.write(
        `data: ${JSON.stringify({
          type: "done",
          answer:
            finalAnswer
        })}\n\n`
      );

      res.end();
    } catch (error) {
      console.error(
        "STREAM CHAT ERROR:",
        error
      );

      if (!streamStarted) {
        return res.status(500).json({
          ok: false,
          error:
            "Atharv could not start streaming.",
          message:
            process.env.NODE_ENV ===
            "development"
              ? error.message
              : undefined
        });
      }

      try {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error:
              "Atharv could not complete the response."
          })}\n\n`
        );

        res.end();
      } catch {
        /*
         * Connection already closed.
         */
      }
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
        await getMemories(userId);

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
          "Could not load memory."
      });
    }
  }
);

/* ======================================================
   MEMORY SAVE
====================================================== */

app.post(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memory =
        safeText(
          req.body?.memory ||
          req.body?.text ||
          "",
          500
        );

      if (!memory) {
        return res.status(400).json({
          ok: false,
          error:
            "Memory text is required."
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
            "Sensitive secrets cannot be saved."
        });
      }

      const saved =
        await saveMemory(
          userId,
          memory
        );

      res.json({
        ok: saved,
        message: saved
          ? "Memory saved."
          : "Memory could not be saved."
      });
    } catch (error) {
      console.error(
        "MEMORY SAVE ERROR:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "Could not save memory."
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
        Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid memory id."
        });
      }

      const deleted =
        await deleteMemory(
          userId,
          id
        );

      res.json({
        ok: true,
        deleted
      });
    } catch (error) {
      console.error(
        "MEMORY DELETE ERROR:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "Could not delete memory."
      });
    }
  }
);

/* ======================================================
   MEMORY CLEAR
====================================================== */

app.delete(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const deleted =
        await clearMemories(
          userId
        );

      res.json({
        ok: true,
        deleted
      });
    } catch (error) {
      console.error(
        "MEMORY CLEAR ERROR:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "Could not clear memory."
      });
    }
  }
);

/* ======================================================
   WEATHER DIRECT API
====================================================== */

app.get(
  "/api/weather",
  async (req, res) => {
    try {
      const city =
        safeText(
          req.query.city ||
          "Delhi",
          100
        );

      const result =
        await weatherSearch(city);

      if (!result.ok) {
        return res.status(404).json({
          ok: false,
          error:
            result.error ||
            "Weather unavailable."
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Weather request failed."
      });
    }
  }
);

/* ======================================================
   SEARCH DIRECT API
====================================================== */

app.get(
  "/api/search",
  async (req, res) => {
    try {
      const query =
        safeText(
          req.query.q ||
          req.query.query ||
          "",
          1200
        );

      if (!query) {
        return res.status(400).json({
          ok: false,
          error:
            "Search query is required."
        });
      }

      const result =
        await tavilySearch(
          query,
          {
            searchDepth: "advanced",
            maxResults: 8
          }
        );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Search failed."
      });
    }
  }
);

/* ======================================================
   VERSION
====================================================== */

app.get(
  "/api/version",
  (req, res) => {
    res.json({
      ok: true,
      name: "Atharv AI",
      version:
        SERVER_VERSION,
      generalModel:
        GENERAL_MODEL,
      liveModel:
        LIVE_MODEL,
      fallbackModel:
        FALLBACK_MODEL
    });
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
        "API endpoint not found.",
      path:
        req.originalUrl
    });
  }
);

/* ======================================================
   STATIC FRONTEND
====================================================== */

const publicPath =
  path.join(__dirname);

app.use(
  express.static(
    publicPath,
    {
      extensions: ["html"]
    }
  )
);

/*
 * Express 5 compatible SPA fallback.
 */
app.get(
  "*splat",
  (req, res, next) => {
    if (
      req.path.startsWith("/api/")
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
   GLOBAL ERROR HANDLER
====================================================== */

app.use(
  (error, req, res, next) => {
    console.error(
      "GLOBAL ERROR:",
      error
    );

    if (res.headersSent) {
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
   DATABASE STARTUP
====================================================== */

async function initializeDatabase() {
  if (!pool) {
    console.warn(
      "DATABASE_URL not configured. Memory disabled."
    );

    return false;
  }

  try {
    await pool.query(
      "SELECT NOW()"
    );

    await ensureMemoryTable();

    console.log(
      "Database initialized successfully."
    );

    return true;
  } catch (error) {
    console.error(
      "DATABASE INITIALIZATION ERROR:",
      error.message
    );

    return false;
  }
}

/* ======================================================
   MODEL VALIDATION
====================================================== */

function validateModels() {
  const models = [
    GENERAL_MODEL,
    LIVE_MODEL,
    FALLBACK_MODEL
  ];

  const compoundFound =
    models.some(
      (model) =>
        model === "groq/compound" ||
        model === "groq/compound-mini"
    );

  if (compoundFound) {
    console.error(
      "FATAL MODEL CONFIGURATION ERROR:"
    );

    console.error(
      "Deprecated Groq Compound model detected."
    );

    return false;
  }

  return true;
}

/* ======================================================
   START SERVER
====================================================== */

async function startServer() {
  console.log(
    "================================================="
  );

  console.log(
    `ATHARV AI v${SERVER_VERSION}`
  );

  console.log(
    "Starting server..."
  );

  console.log(
    `Node: ${process.version}`
  );

  console.log(
    `Port: ${PORT}`
  );

  console.log(
    `General Model: ${GENERAL_MODEL}`
  );

  console.log(
    `Live Model: ${LIVE_MODEL}`
  );

  console.log(
    `Fallback Model: ${FALLBACK_MODEL}`
  );

  console.log(
    `Groq: ${GROQ_API_KEY ? "ENABLED" : "DISABLED"}`
  );

  console.log(
    `Tavily: ${TAVILY_API_KEY ? "ENABLED" : "DISABLED"}`
  );

  console.log(
    `Database: ${DATABASE_URL ? "ENABLED" : "DISABLED"}`
  );

  console.log(
    "================================================="
  );

  if (!validateModels()) {
    process.exit(1);
  }

  await initializeDatabase();

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        "================================================="
      );

      console.log(
        `ATHARV AI SERVER v${SERVER_VERSION}`
      );

      console.log(
        `Server running on port ${PORT}`
      );

      console.log(
        `General Model: ${GENERAL_MODEL}`
      );

      console.log(
        `Live Model: ${LIVE_MODEL}`
      );

      console.log(
        `Fallback Model: ${FALLBACK_MODEL}`
      );

      console.log(
        "General Q&A: ENABLED"
      );

      console.log(
        "Reasoning: ENABLED"
      );

      console.log(
        "Multilingual AI: ENABLED"
      );

      console.log(
        "World Languages: ENABLED"
      );

      console.log(
        "Live Research: ENABLED"
      );

      console.log(
        "Weather: ENABLED"
      );

      console.log(
        "News Routing: ENABLED"
      );

      console.log(
        "Market Routing: ENABLED"
      );

      console.log(
        "Sports Routing: ENABLED"
      );

      console.log(
        "Exam Routing: ENABLED"
      );

      console.log(
        "Official PYQ Routing: ENABLED"
      );

      console.log(
        "Study Engine: ENABLED"
      );

      console.log(
        "Programming Engine: ENABLED"
      );

      console.log(
        `Memory: ${pool ? "ENABLED" : "DISABLED"}`
      );

      console.log(
        "Attachments: ENABLED"
      );

      console.log(
        "Streaming: ENABLED"
      );

      console.log(
        "Compound Models: DISABLED"
      );

      console.log(
        "Python Execution Claim: DISABLED"
      );

      console.log(
        "================================================="
      );
    }
  );
}

/* ======================================================
   PROCESS HANDLERS
====================================================== */

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "UNHANDLED REJECTION:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );
  }
);

/* ======================================================
   START
====================================================== */

startServer();
