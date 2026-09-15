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
   Backend Version 10.0
   Universal Intelligence + Smart Token Protection
   ========================================================= */

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

Your purpose is to help users understand information and complete
useful tasks, not merely provide short answers.

CORE RULES:

1. Answer the user's actual request directly.
2. Do not unnecessarily ask clarification questions.
3. Do invent facts.
4. Do invent current prices, news, weather, scores, events,
   statistics or market information.
5. When live research context is provided, use it as the primary
   source for current information.
6. If sources disagree, clearly explain the disagreement.
7. Never present an unverified current number as confirmed.
8. If live verification fails for a question requiring current
   information, say that live verification could not be completed.
9. Do not merely tell the user to check a website when useful
   research information is already available.
10. Summarize useful research directly and mention important sources.
11. Respect the user's selected language.
12. If a language is selected, answer primarily in that language.
13. Hinglish means natural Roman Hindi mixed with English.
14. Hindi should normally use Devanagari unless the user clearly
    uses Roman Hindi and prefers that style.
15. Auto Detect should follow the user's actual language and style.
16. Preserve the user's tone.
17. Do not start every answer with the user's name.
18. Use remembered information naturally when relevant.
19. Never reveal API keys, passwords, tokens, database URLs or secrets.
20. Never claim an action was performed unless it actually was.
21. Financial information contains uncertainty and risk.
22. Do promise investment returns or option profits.
23. Never claim a future stock price is certain.
24. Teach study and exam concepts clearly.
25. Never guarantee an exact future exam question.
26. For documents, use supplied document content.
27. For coding, provide practical working code when useful.
28. For professional work, create usable output.
29. For planning, give practical steps.
30. Keep normal answers reasonably concise.
31. Use headings, bullets and tables when useful.
32. Current information must come from current research.
33. Support major world languages when reliable.
34. Never fabricate sources or URLs.
35. If research is weak, say so rather than guessing.
36. Focus on solving the user's task, not merely describing it.
37. When possible, give the user a useful next step automatically.
`;

/* =========================================================
   HELPERS
   ========================================================= */

function safeString(value, max = 10000) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).slice(0, max);
}

function limitText(value, max = 50000) {
  return safeString(value, max);
}

/*
  Approximate token count.
  This is intentionally conservative because different models
  tokenize text differently.
*/
function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
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
   DATE / TIME
   ========================================================= */

function getUserDateTime(timeZone) {
  try {
    const tz = timeZone || "Asia/Kolkata";

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
  const value = String(language || "")
    .trim()
    .toLowerCase();

  if (!value) {
    return "auto";
  }

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

  if (/[\u0900-\u097F]/.test(value)) return "hi";
  if (/[\u0980-\u09FF]/.test(value)) return "bn";
  if (/[\u0A00-\u0A7F]/.test(value)) return "pa";
  if (/[\u0A80-\u0AFF]/.test(value)) return "gu";
  if (/[\u0B00-\u0B7F]/.test(value)) return "ta";
  if (/[\u0C00-\u0C7F]/.test(value)) return "te";
  if (/[\u0C80-\u0CFF]/.test(value)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(value)) return "ml";
  if (/[\u0600-\u06FF]/.test(value)) return "ur";
  if (/[\u3040-\u30FF]/.test(value)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(value)) return "ko";
  if (/[\u4E00-\u9FFF]/.test(value)) return "zh";

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
    "thik",
    "ka",
    "ki",
    "ke"
  ];

  const lower = value.toLowerCase();

  const count = hinglishWords.filter(word => {
    return new RegExp(`\\b${word}\\b`, "i").test(lower);
  }).length;

  if (count >= 2) {
    return "hinglish";
  }

  return "en";
}

function getLanguageInstruction(language, languageName, message) {
  const selected =
    normalizeLanguagePreference(language);

  if (selected === "auto") {
    const detected =
      detectLanguageProfile(message);

    if (detected === "hinglish") {
      return `
LANGUAGE:
Auto Detect

Detected style:
Hinglish / Roman Hindi.

Reply naturally in Roman Hindi/Hinglish.
Do not switch to Devanagari unless the user asks.
`;
    }

    return `
LANGUAGE:
Auto Detect

Detected language:
${LANGUAGE_NAMES[detected] || detected}

Reply primarily in the detected language.
`;
  }

  if (selected === "hinglish") {
    return `
MANDATORY RESPONSE LANGUAGE:
Hinglish / Roman Hindi.

Use natural Roman Hindi mixed with English.
Do not switch to Devanagari unless explicitly requested.
`;
  }

  return `
MANDATORY RESPONSE LANGUAGE:
${languageName || LANGUAGE_NAMES[selected] || selected}

Answer primarily in this language.
Do not unnecessarily switch to English.

Technical names, code, URLs and proper nouns may remain
in their original form.
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

const INVALID_NAME_WORDS = new Set([
  "kya",
  "kaise",
  "kyun",
  "kab",
  "kahan",
  "kon",
  "kaun",
  "hai",
  "hain",
  "mera",
  "meri",
  "mere",
  "naam",
  "name",
  "batao",
  "bata",
  "please",
  "plz",
  "aap",
  "apka",
  "apki",
  "mujhe",
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "my",
  "is"
]);

function isInvalidName(name) {
  if (!name) return true;

  const value = String(name)
    .trim()
    .replace(/\s+/g, " ");

  if (value.length < 2 || value.length > 80) {
    return true;
  }

  if (containsSecret(value)) {
    return true;
  }

  const words =
    value
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  if (!words.length) {
    return true;
  }

  if (
    words.some(word =>
      INVALID_NAME_WORDS.has(
        word.replace(/[.,!?]+$/, "")
      )
    )
  ) {
    return true;
  }

  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(value)) {
    return true;
  }

  return false;
}

function extractName(message) {
  const text = String(message || "").trim();

  const patterns = [
    /(?:my\s+name\s+is)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s*[.!?,]|$)/i,

    /(?:mera\s+naam)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?:\s+hai)(?=\s*[.!?,]|$)/i,

    /(?:मेरा\s+नाम)\s+([^\n,.!?]{2,60}?)(?:\s+है)(?=\s*[.!?,]|$)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match || !match[1]) {
      continue;
    }

    const name =
      match[1]
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[.!?,]+$/, "");

    if (!isInvalidName(name)) {
      return name;
    }
  }

  return null;
}

async function saveMemory(userId, key, value) {
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
    [userId, key, value]
  );

  return true;
}

async function getMemories(userId) {
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
}

async function deleteMemory(userId, key) {
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

  const lines =
    memories
      .slice(0, 15)
      .map(item =>
        `- ${safeString(item.memory_key, 100)}: ${safeString(item.memory_value, 250)}`
      );

  return `
USER MEMORY

Use this information naturally when relevant.
Do not mention the internal memory system.

${lines.join("\n")}
`;
}

async function processMemoryRequest(userId, message) {
  const name =
    extractName(message);

  if (name) {
    await saveMemory(
      userId,
      "name",
      name
    );
  }

  const lower =
    String(message || "")
      .toLowerCase();

  const rememberRequest =
    lower.includes("remember that") ||
    lower.includes("yaad rakhna") ||
    lower.includes("yaad rakho") ||
    lower.includes("याद रखना");

  if (
    rememberRequest &&
    !containsSecret(message)
  ) {
    const cleaned =
      message
        .replace(/remember that/gi, "")
        .replace(/yaad rakhna/gi, "")
        .replace(/yaad rakho/gi, "")
        .replace(/याद रखना/g, "")
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

/* =========================================================
   QUERY ROUTER
   ========================================================= */

function classifyQuery(message) {
  const text =
    String(message || "")
      .toLowerCase();

  const weatherWords = [
    "weather",
    "forecast",
    "temperature",
    "rain",
    "raining",
    "mausam",
    "barish",
    "baarish",
    "tapman"
  ];

  const marketWords = [
    "stock",
    "share price",
    "share",
    "nifty",
    "sensex",
    "market",
    "stock price",
    "share bhav",
    "share bazaar",
    "bazaar",
    "ipo",
    "intraday",
    "option",
    "call option",
    "put option",
    "futures",
    "gold price",
    "silver price"
  ];

  const cryptoWords = [
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "crypto",
    "solana",
    "toncoin",
    "dogecoin"
  ];

  const sportsWords = [
    "cricket",
    "football",
    "soccer",
    "tennis",
    "match",
    "score",
    "live score",
    "ipl",
    "world cup",
    "winner",
    "fixture",
    "result"
  ];

  const newsWords = [
    "news",
    "breaking",
    "latest news",
    "headlines",
    "samachar",
    "khabar",
    "taaza khabar",
    "aaj ki khabar",
    "aaj ki news",
    "duniya mein kya ho raha",
    "what is happening",
    "what happened"
  ];

  const currentWords = [
    "today",
    "aaj",
    "abhi",
    "right now",
    "current",
    "latest",
    "live",
    "this morning",
    "this evening",
    "tonight",
    "recent",
    "recently"
  ];

  if (weatherWords.some(x => text.includes(x))) {
    return "weather";
  }

  if (cryptoWords.some(x => text.includes(x))) {
    return "crypto";
  }

  if (marketWords.some(x => text.includes(x))) {
    return "market";
  }

  if (sportsWords.some(x => text.includes(x))) {
    return "sports";
  }

  if (newsWords.some(x => text.includes(x))) {
    return "news";
  }

  if (currentWords.some(x => text.includes(x))) {
    return "current";
  }

  return "general";
}

function needsLiveSearch(message) {
  return classifyQuery(message) !== "general";
}

/* =========================================================
   SEARCH
   ========================================================= */

function buildSearchQuery(
  message,
  languageName,
  category
) {
  let query =
    safeString(message, 1000)
      .replace(/\s+/g, " ")
      .trim();

  const suffixMap = {
    news:
      "latest verified news current developments",
    market:
      "latest verified market information current price",
    crypto:
      "latest verified crypto market information current price",
    sports:
      "latest verified sports information live score result",
    weather:
      "current weather forecast",
    current:
      "latest current verified information"
  };

  if (suffixMap[category]) {
    query += ` ${suffixMap[category]}`;
  }

  if (
    languageName &&
    languageName !== "Auto Detect"
  ) {
    query += ` (${languageName})`;
  }

  return query;
}

async function searchTavily(query) {
  if (!TAVILY_API_KEY) {
    return {
      provider: "tavily",
      ok: false,
      reason: "Tavily API key not configured",
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
            api_key:
              TAVILY_API_KEY,
            query,
            search_depth:
              "advanced",
            topic:
              "general",
            max_results:
              6,
            include_answer:
              true,
            include_raw_content:
              false,
            include_images:
              false
          })
        }
      );

    if (!response.ok) {
      console.error(
        "TAVILY ERROR:",
        response.status,
        await response.text()
      );

      return {
        provider: "tavily",
        ok: false,
        results: []
      };
    }

    const data =
      await response.json();

    return {
      provider: "tavily",
      ok: true,

      answer:
        safeString(
          data.answer,
          3000
        ),

      results:
        Array.isArray(data.results)
          ? data.results
              .slice(0, 6)
              .map(item => ({
                title:
                  safeString(
                    item.title,
                    250
                  ),

                url:
                  safeString(
                    item.url,
                    400
                  ),

                content:
                  safeString(
                    item.content,
                    1200
                  )
              }))
          : []
    };

  } catch (error) {
    console.error(
      "TAVILY FETCH ERROR:",
      error
    );

    return {
      provider: "tavily",
      ok: false,
      results: []
    };
  }
}

/* =========================================================
   GDELT
   ========================================================= */

async function searchGdelt(query) {
  try {
    const params =
      new URLSearchParams({
        query,
        mode: "artlist",
        format: "json",
        maxrecords: "6",
        sort: "datedesc",
        timespan: "3d"
      });

    const response =
      await fetch(
        `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`
      );

    if (!response.ok) {
      return {
        provider: "gdelt",
        ok: false,
        results: []
      };
    }

    const data =
      await response.json();

    const articles =
      Array.isArray(data.articles)
        ? data.articles
        : [];

    return {
      provider: "gdelt",
      ok: true,

      results:
        articles
          .slice(0, 6)
          .map(item => ({
            title:
              safeString(
                item.title,
                250
              ),

            url:
              safeString(
                item.url,
                400
              ),

            content:
              safeString(
                item.seendate ||
                item.domain ||
                "",
                300
              )
          }))
          .filter(item => item.url)
    };

  } catch (error) {
    console.error(
      "GDELT ERROR:",
      error
    );

    return {
      provider: "gdelt",
      ok: false,
      results: []
    };
  }
}

/* =========================================================
   WEATHER
   ========================================================= */

function extractWeatherLocation(message) {
  const text =
    String(message || "").trim();

  const patterns = [
    /weather\s+(?:in|of|for)\s+(.+)/i,
    /forecast\s+(?:in|of|for)\s+(.+)/i,
    /temperature\s+(?:in|of|for)\s+(.+)/i,
    /(.+?)\s+(?:ka|ki|ke)\s+mausam/i,
    /(.+?)\s+(?:ka|ki|ke)\s+weather/i,
    /(.+?)\s+(?:mein|me)\s+mausam/i,
    /mausam\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match =
      text.match(pattern);

    if (match && match[1]) {
      const location =
        match[1]
          .trim()
          .replace(/[?.!,]+$/, "");

      if (
        location.length >= 2 &&
        location.length <= 100
      ) {
        return location;
      }
    }
  }

  return null;
}

async function geocodeLocation(location) {
  if (!location) {
    return null;
  }

  try {
    const params =
      new URLSearchParams({
        name: location,
        count: "1",
        language: "en",
        format: "json"
      });

    const response =
      await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    if (
      !data.results ||
      !data.results.length
    ) {
      return null;
    }

    const result =
      data.results[0];

    return {
      name:
        result.name,

      latitude:
        result.latitude,

      longitude:
        result.longitude,

      country:
        result.country,

      timezone:
        result.timezone
    };

  } catch (error) {
    console.error(
      "GEOCODING ERROR:",
      error
    );

    return null;
  }
}

async function getWeather(location) {
  const geo =
    await geocodeLocation(location);

  if (!geo) {
    return {
      provider: "open-meteo",
      ok: false,
      results: []
    };
  }

  try {
    const params =
      new URLSearchParams({
        latitude:
          String(geo.latitude),

        longitude:
          String(geo.longitude),

        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",

        daily:
          "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",

        timezone:
          "auto",

        forecast_days:
          "3"
      });

    const response =
      await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`
      );

    if (!response.ok) {
      return {
        provider: "open-meteo",
        ok: false,
        results: []
      };
    }

    const data =
      await response.json();

    const current =
      data.current || {};

    const daily =
      data.daily || {};

    const weatherText = `
Location: ${geo.name}, ${geo.country}
Timezone: ${geo.timezone}

Current temperature:
${current.temperature_2m ?? "N/A"} °C

Feels like:
${current.apparent_temperature ?? "N/A"} °C

Humidity:
${current.relative_humidity_2m ?? "N/A"}%

Precipitation:
${current.precipitation ?? "N/A"} mm

Wind:
${current.wind_speed_10m ?? "N/A"} km/h

Forecast:
${JSON.stringify(daily, null, 2)}
`;

    return {
      provider: "open-meteo",
      ok: true,

      answer:
        weatherText,

      results: [
        {
          title:
            `Open-Meteo weather — ${geo.name}`,

          url:
            "https://open-meteo.com/",

          content:
            weatherText
        }
      ]
    };

  } catch (error) {
    console.error(
      "WEATHER ERROR:",
      error
    );

    return {
      provider: "open-meteo",
      ok: false,
      results: []
    };
  }
}

/* =========================================================
   RESEARCH ROUTER
   ========================================================= */

async function runResearchRouter(
  message,
  languageName,
  category
) {
  const query =
    buildSearchQuery(
      message,
      languageName,
      category
    );

  const research = {
    category,
    providers: [],
    results: [],
    answers: []
  };

  if (category === "weather") {
    const location =
      extractWeatherLocation(message);

    if (location) {
      const weather =
        await getWeather(location);

      if (weather.ok) {
        research.providers.push(
          "open-meteo"
        );

        research.results.push(
          ...weather.results
        );

        if (weather.answer) {
          research.answers.push(
            weather.answer
          );
        }
      }
    }

    if (!research.results.length) {
      const tavily =
        await searchTavily(query);

      if (tavily.ok) {
        research.providers.push(
          "tavily"
        );

        if (tavily.answer) {
          research.answers.push(
            tavily.answer
          );
        }

        research.results.push(
          ...tavily.results
        );
      }
    }

    return research;
  }

  if (category === "news") {
    const tavily =
      await searchTavily(query);

    if (tavily.ok) {
      research.providers.push(
        "tavily"
      );

      if (tavily.answer) {
        research.answers.push(
          tavily.answer
        );
      }

      research.results.push(
        ...tavily.results
      );
    }

    const gdelt =
      await searchGdelt(query);

    if (gdelt.ok) {
      research.providers.push(
        "gdelt"
      );

      research.results.push(
        ...gdelt.results
      );
    }

    return research;
  }

  const tavily =
    await searchTavily(query);

  if (tavily.ok) {
    research.providers.push(
      "tavily"
    );

    if (tavily.answer) {
      research.answers.push(
        tavily.answer
      );
    }

    research.results.push(
      ...tavily.results
    );
  }

  if (
    category === "current" ||
    !research.results.length
  ) {
    const gdelt =
      await searchGdelt(query);

    if (gdelt.ok) {
      research.providers.push(
        "gdelt"
      );

      research.results.push(
        ...gdelt.results
      );
    }
  }

  return research;
}

/* =========================================================
   RESEARCH CONTEXT
   ========================================================= */

function buildResearchContext(research) {
  if (
    !research ||
    !Array.isArray(research.results) ||
    !research.results.length
  ) {
    return "";
  }

  const pieces = [];

  if (
    Array.isArray(research.answers) &&
    research.answers.length
  ) {
    pieces.push(`
RESEARCH SUMMARY:

${research.answers
  .slice(0, 2)
  .map(x => safeString(x, 1200))
  .join("\n\n")}
`);
  }

  const sources =
    research.results
      .slice(0, 6)
      .map((item, index) => {
        return `
SOURCE ${index + 1}
Title: ${safeString(item.title, 220)}
URL: ${safeString(item.url, 300)}
Content:
${safeString(item.content, 700)}
`;
      });

  pieces.push(
    sources.join("\n")
  );

  return `
LIVE RESEARCH CONTEXT

Category:
${safeString(research.category, 50)}

Providers:
${safeString(
  (research.providers || []).join(", "),
  150
)}

Use this research for current information.
Do not invent unsupported facts.
If sources disagree, explain the disagreement.

${pieces.join("\n")}
`;
}

function buildSources(research) {
  if (
    !research ||
    !Array.isArray(research.results)
  ) {
    return [];
  }

  const seen = new Set();
  const sources = [];

  for (const item of research.results) {
    const url =
      safeString(item.url, 500);

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);

    sources.push({
      title:
        safeString(item.title, 150),

      url
    });

    if (sources.length >= 8) {
      break;
    }
  }

  return sources;
}

/* =========================================================
   ATTACHMENTS
   ========================================================= */

function buildAttachmentContext(body) {
  const description =
    safeString(
      body.attachmentDescription,
      1200
    );

  const text =
    safeString(
      body.attachmentText,
      12000
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
   GROQ MODEL
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

/* =========================================================
   HISTORY
   ========================================================= */

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-8)
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
          1800
        )
    }))
    .filter(
      item => item.content
    );
}

/* =========================================================
   SMART MESSAGE BUDGET
   ========================================================= */

/*
  Groq organization limit:
  8000 TPM.

  We intentionally keep:
  - input around 4800 tokens maximum
  - output around 2200 tokens maximum

  Total remains comfortably below 8000 in normal requests.
*/

function buildBudgetedMessages({
  systemPrompt,
  history,
  message
}) {
  const MAX_INPUT_TOKENS = 4800;

  const systemMessage = {
    role: "system",
    content: systemPrompt
  };

  const userMessage = {
    role: "user",
    content: message
  };

  const result = [
    systemMessage
  ];

  let used =
    estimateTokens(
      systemPrompt
    ) +
    estimateTokens(
      message
    );

  /*
    Always preserve current user question.
  */

  const selectedHistory = [];

  /*
    Add history from newest to oldest.
  */

  for (
    let i = history.length - 1;
    i >= 0;
    i--
  ) {
    const item = history[i];

    const tokens =
      estimateTokens(
        item.content
      );

    if (
      used + tokens >
      MAX_INPUT_TOKENS
    ) {
      break;
    }

    selectedHistory.unshift(item);
    used += tokens;
  }

  result.push(
    ...selectedHistory
  );

  result.push(
    userMessage
  );

  return result;
}

/* =========================================================
   GROQ CALL
   ========================================================= */

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured"
    );
  }

  const model =
    getGroqModel();

  const body = {
    model,

    messages,

    temperature: 0.35,

    /*
      Reduced from 4096 to 2200.
      This is important for the 8000 TPM limit.
    */
    max_tokens: 2200
  };

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

        body:
          JSON.stringify(body)
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

/* =========================================================
   ERROR HANDLING
   ========================================================= */

function friendlyError(error) {
  const message =
    String(
      error?.message ||
      error ||
      ""
    );

  const lower =
    message.toLowerCase();

  if (
    message.includes(
      "GROQ_API_KEY"
    )
  ) {
    return "Atharv AI is not configured correctly on the server.";
  }

  if (
    lower.includes("request too large") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm")
  ) {
    return "Atharv received too much context at once. Please send the message again.";
  }

  if (
    lower.includes("rate")
  ) {
    return "Atharv is temporarily busy. Please try again in a moment.";
  }

  if (
    lower.includes("timeout")
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

      sources: [],

      category:
        "general",

      providers: []
    };
  }

  /* MEMORY */

  await processMemoryRequest(
    userId,
    cleanMessage
  );

  const memories =
    await getMemories(
      userId
    );

  const memoryContext =
    buildMemoryContext(
      memories
    );

  /* LANGUAGE */

  const languageContext =
    getLanguageInstruction(
      language,
      languageName,
      cleanMessage
    );

  /* DATE */

  const currentDateTime =
    getUserDateTime(
      timeZone
    );

  /* ROUTER */

  const category =
    classifyQuery(
      cleanMessage
    );

  let research = null;

  if (
    needsLiveSearch(
      cleanMessage
    )
  ) {
    research =
      await runResearchRouter(
        cleanMessage,
        languageName,
        category
      );
  }

  /*
    Research is already aggressively limited.
  */

  const researchContext =
    buildResearchContext(
      research
    );

  const attachmentContext =
    buildAttachmentContext({
      attachmentDescription,
      attachmentText
    });

  /*
    Keep system context controlled.
  */

  const systemPrompt = `
${ATHARV_INSTRUCTIONS}

CURRENT USER DATE/TIME:
${safeString(currentDateTime, 300)}

QUERY CATEGORY:
${safeString(category, 50)}

${languageContext}

${safeString(memoryContext, 2500)}

${safeString(researchContext, 5500)}

${safeString(attachmentContext, 13500)}
`;

  /*
    Clean history.
  */

  const cleanHistoryItems =
    cleanHistory(
      history
    );

  /*
    Don't duplicate current question
    if frontend already sent it in history.
  */

  const filteredHistory =
    cleanHistoryItems.filter(
      item =>
        !(
          item.role === "user" &&
          item.content ===
            cleanMessage
        )
    );

  /*
    SMART TOKEN BUDGET
  */

  const messages =
    buildBudgetedMessages({
      systemPrompt,

      history:
        filteredHistory,

      message:
        cleanMessage
    });

  console.log(
    "ATHARV REQUEST:",
    JSON.stringify({
      category,
      model: getGroqModel(),
      estimatedInputTokens:
        messages.reduce(
          (total, item) =>
            total +
            estimateTokens(
              item.content
            ),
          0
        ),
      historyMessages:
        filteredHistory.length,
      research:
        Boolean(research),
      attachment:
        Boolean(
          attachmentDescription ||
          attachmentText
        )
    })
  );

  const answer =
    await callGroq(
      messages
    );

  return {
    answer,

    sources:
      buildSources(
        research
      ),

    category,

    providers:
      research?.providers || []
  };
}

/* =========================================================
   CHAT API
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
          ),

        category:
          result.category,

        providers:
          result.providers
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
            friendlyError(
              error
            )
        });
    }
  }
);

/* =========================================================
   STREAM API
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
          answer: result.answer
        })}\n\n`
      );

      res.write(
        `data: ${JSON.stringify({
          type: "sources",
          sources: result.sources
        })}\n\n`
      );

      res.write(
        `data: ${JSON.stringify({
          type: "meta",
          category: result.category,
          providers: result.providers,
          model: getGroqModel()
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
              friendlyError(
                error
              )
          });
      }

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            friendlyError(
              error
            )
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
        "10.0.0",

      universalLanguage:
        true,

      languageIntelligence:
        true,

      memory:
        "v6",

      intelligenceRouter:
        true,

      smartTokenProtection:
        true,

      tavily:
        Boolean(
          TAVILY_API_KEY
        ),

      gdelt:
        true,

      weatherProvider:
        "Open-Meteo",

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

const frontendPath =
  __dirname;

app.use(
  express.static(
    frontendPath
  )
);

/*
  IMPORTANT:
  Frontend catch-all must remain LAST.
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
   START SERVER
   ========================================================= */

async function startServer() {
  try {
    await ensureMemoryTable();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          "===================================="
        );

        console.log(
          "ATHARV AI SERVER"
        );

        console.log(
          "Version: 10.0.0"
        );

        console.log(
          `Port: ${PORT}`
        );

        console.log(
          `Model: ${getGroqModel()}`
        );

        console.log(
          `Tavily: ${
            TAVILY_API_KEY
              ? "enabled"
              : "disabled"
          }`
        );

        console.log(
          "GDELT: enabled"
        );

        console.log(
          "Weather: Open-Meteo"
        );

        console.log(
          "Memory: enabled"
        );

        console.log(
          "Smart Token Protection: enabled"
        );

        console.log(
          "===================================="
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
