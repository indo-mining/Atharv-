/*
=========================================================
 ATHARV AI SERVER
 Version 15.0.0 FINAL
 --------------------------------------------------------
 Your AI. Every Language. Every Question.

 FEATURES
 - Multilingual AI
 - Hindi / Hinglish / English / Indian languages
 - World language support
 - Intelligent intent router
 - Live web information
 - Groq Compound web search
 - Tavily fallback
 - GDELT news fallback
 - Weather / Open-Meteo
 - Market / news / sports routing
 - Official PYQ research
 - Official exam source routing
 - Study Engine Class 1-12
 - Competitive Exams
 - MCQ / Mock Test / Revision / Flashcards
 - Homework / Answer Evaluation
 - UPSC Prelims / Mains
 - Programming / Debugging
 - Python execution compatibility
 - PostgreSQL memory
 - Attachment compatibility
 - Streaming
 - Compound-model fallback
 - Response corruption protection
 - Repetition protection
 - Health monitoring
 - Dependency monitoring

=========================================================
*/

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");
const path = require("path");

const app = express();

/* ========================================================
   CONFIG
======================================================== */

const PORT =
  Number(process.env.PORT) || 10000;

const SERVER_VERSION =
  "15.0.0";

const GROQ_API_KEY =
  process.env.GROQ_API_KEY || "";

const TAVILY_API_KEY =
  process.env.TAVILY_API_KEY || "";

const DATABASE_URL =
  process.env.DATABASE_URL || "";

const GENERAL_MODEL =
  process.env.GROQ_MODEL ||
  "groq/compound-mini";

const LIVE_MODEL =
  process.env.GROQ_LIVE_MODEL ||
  "groq/compound-mini";

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

const MAX_BODY_SIZE =
  "10mb";

/* ========================================================
   EXPRESS
======================================================== */

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

/* ========================================================
   DATABASE
======================================================== */

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

  pool.on("error", error => {
    console.error(
      "POSTGRES POOL ERROR:",
      error.message
    );
  });
}

/* ========================================================
   HELPERS
======================================================== */

function safeString(value, fallback = "") {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value);
}

function limitText(text, max = 12000) {
  const value = safeString(text);

  if (value.length <= max) {
    return value;
  }

  return (
    value.slice(0, max) +
    "\n\n[Content shortened for safety.]"
  );
}

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 20000
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function isCompoundModel(model) {
  return (
    model === "groq/compound" ||
    model === "groq/compound-mini"
  );
}

/* ========================================================
   USER ID
======================================================== */

function getUserId(req) {
  const supplied =
    req.body?.userId ||
    req.headers["x-atharv-user-id"] ||
    req.query?.userId;

  const raw =
    supplied ||
    req.ip ||
    "anonymous";

  return crypto
    .createHash("sha256")
    .update(String(raw))
    .digest("hex");
}

/* ========================================================
   DATE / TIME
======================================================== */

function getIndiaDateTime() {
  try {
    return new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        dateStyle: "full",
        timeStyle: "long"
      }
    ).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

/* ========================================================
   LANGUAGE
======================================================== */

function detectLanguage(text) {
  const value = safeString(text);

  const scripts = [
    [/[\u0900-\u097F]/, "Hindi/Devanagari"],
    [/[\u0980-\u09FF]/, "Bengali"],
    [/[\u0A00-\u0A7F]/, "Punjabi"],
    [/[\u0A80-\u0AFF]/, "Gujarati"],
    [/[\u0B00-\u0B7F]/, "Odia"],
    [/[\u0B80-\u0BFF]/, "Tamil"],
    [/[\u0C00-\u0C7F]/, "Telugu"],
    [/[\u0C80-\u0CFF]/, "Kannada"],
    [/[\u0D00-\u0D7F]/, "Malayalam"],
    [/[\u0600-\u06FF]/, "Arabic/Urdu"],
    [/[\u3040-\u30FF]/, "Japanese"],
    [/[\uAC00-\uD7AF]/, "Korean"],
    [/[\u4E00-\u9FFF]/, "Chinese"],
    [/[\u0400-\u04FF]/, "Russian"]
  ];

  for (const [regex, name] of scripts) {
    if (regex.test(value)) {
      return name;
    }
  }

  const lower = value.toLowerCase();

  const hinglishWords = [
    "mera",
    "meri",
    "mujhe",
    "mujhko",
    "mujhse",
    "kya",
    "kaise",
    "kaisa",
    "kyun",
    "kyunki",
    "batao",
    "samjhao",
    "samjha",
    "hai",
    "hain",
    "mein",
    "main",
    "karna",
    "karni",
    "karo",
    "chahiye",
    "acha",
    "accha",
    "nahi",
    "nahin",
    "kahan",
    "kab",
    "kaun",
    "iska",
    "uska",
    "aap",
    "aapko"
  ];

  const words =
    lower.split(/\s+/);

  const hits =
    hinglishWords.filter(
      word => words.includes(word)
    ).length;

  return hits > 0
    ? "Hinglish"
    : "English";
}

/* ========================================================
   INTENT / CATEGORY ROUTER
======================================================== */

function detectCategory(text) {
  const lower =
    safeString(text).toLowerCase();

  if (
    /weather|temperature|forecast|rain|storm|मौसम|तापमान|बारिश|वर्षा|तूफान/
      .test(lower)
  ) {
    return "weather";
  }

  if (
    /stock|share price|market|nifty|sensex|ipo|crypto|bitcoin|ethereum|शेयर|स्टॉक|बाजार|बाज़ार|निफ्टी|सेंसेक्स/
      .test(lower)
  ) {
    return "market";
  }

  if (
    /news|latest|today|current affairs|breaking|headline|आज की खबर|समाचार|ताज़ा खबर|ताजा खबर|करंट अफेयर्स/
      .test(lower)
  ) {
    return "news";
  }

  if (
    /sport|cricket|football|tennis|ipl|match|score|खेल|क्रिकेट|फुटबॉल|मैच|स्कोर/
      .test(lower)
  ) {
    return "sports";
  }

  if (
    /upsc|ssc|banking|ibps|sbi|railway|rrb|nda|cds|capf|defence|defense|police|psc|ctet|tet|competitive exam|सरकारी परीक्षा|प्रतियोगी परीक्षा/
      .test(lower)
  ) {
    return "exam";
  }

  if (
    /class\s*(1[0-2]|[1-9])|कक्षा\s*(1[0-2]|[1-9])|ncert|cbse|icse|chapter|homework|mcq|mock test|revision|flashcard|pyq|previous year|important questions|notes/
      .test(lower)
  ) {
    return "study";
  }

  if (
    /python|javascript|typescript|java|c\+\+|c programming|html|css|sql|php|rust|golang|go language|kotlin|swift|node\.?js|react|postgresql|mysql|coding|programming|code|debug|github|api|database/
      .test(lower)
  ) {
    return "programming";
  }

  if (
    /remember|memory|yaad rakh|याद रखना|what do you remember|मेरी याद/
      .test(lower)
  ) {
    return "memory";
  }

  return "general";
}

/* ========================================================
   LIVE INTENT
======================================================== */

function needsLiveSearch(text) {
  const lower =
    safeString(text).toLowerCase();

  return (
    /today|today's|latest|current|right now|now|live|recent|breaking|news|price|share price|stock price|weather|forecast|score|result|election|current affairs|notification|admit card|answer key|result date/
      .test(lower) ||

    /आज|अभी|ताज़ा|ताजा|वर्तमान|मौसम|शेयर|भाव|खबर|नतीजा|परिणाम|परीक्षा|आधिकारिक|सिलेबस|अधिसूचना|एडमिट कार्ड/
      .test(lower)
  );
}

/* ========================================================
   STUDY INTENT
======================================================== */

function detectStudyIntent(text) {
  const lower =
    safeString(text).toLowerCase();

  const rules = [
    [
      "exam_pyq",
      /official.*pyq|pyq.*official|previous year question|previous year paper|past paper|official question paper|पिछले वर्ष के प्रश्न|आधिकारिक प्रश्न पत्र/
    ],
    [
      "exam_current_affairs",
      /current affairs|करंट अफेयर्स|समसामयिक|current gk/
    ],
    [
      "exam_mains_answer",
      /mains answer|answer writing|उत्तर लेखन|मेन परीक्षा/
    ],
    [
      "study_mock_test",
      /mock test|mock exam|मॉक टेस्ट|मॉक परीक्षा/
    ],
    [
      "study_flashcards",
      /flashcard|flash cards|फ्लैश कार्ड/
    ],
    [
      "study_revision",
      /revision|revise|रिविजन|दोहराओ|दोबारा पढ़ाओ/
    ],
    [
      "study_mcq",
      /mcq|multiple choice|बहुविकल्पीय/
    ],
    [
      "study_important_questions",
      /important questions|important question|महत्वपूर्ण प्रश्न/
    ],
    [
      "study_notes",
      /notes|short notes|नोट्स|संक्षिप्त नोट्स/
    ],
    [
      "study_plan",
      /study plan|पढ़ाई की योजना|अध्ययन योजना/
    ],
    [
      "study_homework",
      /homework|होमवर्क|गृहकार्य/
    ],
    [
      "study_evaluate",
      /check my answer|evaluate|answer check|उत्तर जांच|उत्तर जाँच/
    ],
    [
      "study_doubt",
      /doubt|confused|समझ नहीं|डाउट|शंका/
    ],
    [
      "study_explain",
      /explain|samjhao|समझाओ|व्याख्या|teach|पढ़ाओ/
    ]
  ];

  for (const [intent, regex] of rules) {
    if (regex.test(lower)) {
      return intent;
    }
  }

  return null;
}

/* ========================================================
   STUDY CONTEXT
======================================================== */

function extractStudyContext(text) {
  const value =
    safeString(text);

  const classMatch =
    value.match(
      /(?:class|कक्षा)\s*(1[0-2]|[1-9])/i
    );

  const lower =
    value.toLowerCase();

  let board = null;

  if (lower.includes("cbse")) {
    board = "CBSE";
  } else if (lower.includes("icse")) {
    board = "ICSE";
  } else if (
    lower.includes("state board")
  ) {
    board = "State Board";
  }

  const exams = [
    "UPSC",
    "SSC CGL",
    "SSC CHSL",
    "SSC MTS",
    "SSC GD",
    "IBPS",
    "SBI",
    "Banking",
    "Railway",
    "RRB",
    "NDA",
    "CDS",
    "CAPF",
    "Defence",
    "Police",
    "State PSC",
    "CTET",
    "TET"
  ];

  let exam = null;

  for (const item of exams) {
    if (
      lower.includes(
        item.toLowerCase()
      )
    ) {
      exam = item;
      break;
    }
  }

  const yearMatch =
    value.match(
      /\b(20\d{2})\b/
    );

  let paperType = null;

  if (
    /prelims|preliminary/
      .test(lower)
  ) {
    paperType = "Prelims";
  }

  if (
    /mains|main examination/
      .test(lower)
  ) {
    paperType = "Mains";
  }

  return {
    classNumber:
      classMatch
        ? Number(classMatch[1])
        : null,

    board,

    exam,

    year:
      yearMatch
        ? Number(yearMatch[1])
        : null,

    paperType
  };
}

/* ========================================================
   OFFICIAL DOMAINS
======================================================== */

function getOfficialDomains(exam) {
  const value =
    safeString(exam)
      .toLowerCase();

  if (value.includes("upsc")) {
    return ["upsc.gov.in"];
  }

  if (value.includes("ssc")) {
    return ["ssc.gov.in"];
  }

  if (
    value.includes("railway") ||
    value.includes("rrb")
  ) {
    return ["indianrailways.gov.in"];
  }

  if (value.includes("ibps")) {
    return ["ibps.in"];
  }

  if (value.includes("sbi")) {
    return ["sbi.co.in"];
  }

  if (
    value.includes("ctet") ||
    value.includes("tet")
  ) {
    return ["ctet.nic.in"];
  }

  return [];
}

/* ========================================================
   MEMORY
======================================================== */

async function ensureMemoryTable() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_memories (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      memory TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_user_memories_user_id
    ON public.user_memories(user_id)
  `);
}

function isSensitiveMemory(text) {
  const lower =
    safeString(text).toLowerCase();

  const blocked = [
    "password",
    "passwd",
    "passcode",
    "api key",
    "apikey",
    "secret key",
    "private key",
    "seed phrase",
    "recovery phrase",
    "wallet seed",
    "otp",
    "one time password",
    "credit card",
    "cvv",
    "debit card",
    "bank account",
    "pin number",
    "atm pin"
  ];

  return blocked.some(
    item => lower.includes(item)
  );
}

function extractMemory(text) {
  const value =
    safeString(text).trim();

  if (isSensitiveMemory(value)) {
    return null;
  }

  const patterns = [
    /^(?:my name is|i am|i'm)\s+(.+)$/i,
    /^(?:mera naam|मेरा नाम)\s+(.+)$/i,
    /^(?:remember that|remember this|yaad rakhna|याद रखना)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match =
      value.match(pattern);

    if (
      match &&
      match[1]
    ) {
      return limitText(
        match[1].trim(),
        500
      );
    }
  }

  return null;
}

async function saveMemory(
  userId,
  memory
) {
  if (!pool || !memory) {
    return null;
  }

  if (isSensitiveMemory(memory)) {
    return null;
  }

  /*
    Avoid unnecessary duplicate memories.
  */

  const existing =
    await pool.query(
      `
      SELECT id
      FROM public.user_memories
      WHERE user_id = $1
      AND LOWER(memory) = LOWER($2)
      LIMIT 1
      `,
      [userId, memory]
    );

  if (existing.rows.length) {
    await pool.query(
      `
      UPDATE public.user_memories
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [existing.rows[0].id]
    );

    return {
      id: existing.rows[0].id,
      memory
    };
  }

  const result =
    await pool.query(
      `
      INSERT INTO public.user_memories
        (user_id, memory)
      VALUES
        ($1, $2)
      RETURNING id, memory, created_at
      `,
      [userId, memory]
    );

  return result.rows[0];
}

async function getMemories(userId) {
  if (!pool) return [];

  const result =
    await pool.query(
      `
      SELECT
        id,
        memory,
        created_at,
        updated_at
      FROM public.user_memories
      WHERE user_id = $1
      ORDER BY
        updated_at DESC NULLS LAST,
        id DESC
      LIMIT 50
      `,
      [userId]
    );

  return result.rows;
}

async function deleteMemory(
  userId,
  id
) {
  if (!pool) return false;

  const result =
    await pool.query(
      `
      DELETE FROM public.user_memories
      WHERE id = $1
      AND user_id = $2
      `,
      [id, userId]
    );

  return result.rowCount > 0;
}

async function clearMemories(userId) {
  if (!pool) return 0;

  const result =
    await pool.query(
      `
      DELETE FROM public.user_memories
      WHERE user_id = $1
      `,
      [userId]
    );

  return result.rowCount;
}

async function processMemoryRequest(
  userId,
  message
) {
  const lower =
    safeString(message).toLowerCase();

  if (
    /forget everything|forget all memories|clear memory|delete memory|सब भूल जाओ|सारी यादें मिटाओ/
      .test(lower)
  ) {
    const count =
      await clearMemories(userId);

    return {
      handled: true,
      reply:
        `ठीक है। मैंने आपकी ${count} saved memories हटा दी हैं।`
    };
  }

  if (
    /what do you remember|what you remember|meri memory|मेरी यादें|मेरे बारे में क्या याद/
      .test(lower)
  ) {
    const memories =
      await getMemories(userId);

    if (!memories.length) {
      return {
        handled: true,
        reply:
          "अभी मेरी memory में आपके बारे में कुछ saved नहीं है।"
      };
    }

    const list =
      memories
        .map(
          (item, index) =>
            `${index + 1}. ${item.memory}`
        )
        .join("\n");

    return {
      handled: true,
      reply:
        `### मुझे आपके बारे में यह याद है:\n\n${list}`
    };
  }

  const extracted =
    extractMemory(message);

  if (extracted) {
    const saved =
      await saveMemory(
        userId,
        extracted
      );

    if (saved) {
      return {
        handled: true,
        reply:
          `ठीक है, मैं इसे याद रखूँगा: **${extracted}**`
      };
    }
  }

  return {
    handled: false
  };
}

/* ========================================================
   TAVILY
======================================================== */

async function tavilySearch(
  query,
  options = {}
) {
  if (!TAVILY_API_KEY) {
    return {
      answer: "",
      results: []
    };
  }

  const payload = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth:
      options.searchDepth ||
      "advanced",
    max_results:
      options.maxResults ||
      6,
    include_answer: true,
    include_raw_content: false
  };

  if (
    options.includeDomains?.length
  ) {
    payload.include_domains =
      options.includeDomains;
  }

  try {
    const response =
      await fetchWithTimeout(
        TAVILY_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify(payload)
        },
        20000
      );

    if (!response.ok) {
      throw new Error(
        `Tavily HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    return {
      answer:
        safeString(data.answer),

      results:
        Array.isArray(data.results)
          ? data.results
          : []
    };
  } catch (error) {
    console.error(
      "TAVILY ERROR:",
      error.message
    );

    return {
      answer: "",
      results: []
    };
  }
}

/* ========================================================
   GDELT
======================================================== */

async function gdeltSearch(query) {
  try {
    const url =
      new URL(GDELT_URL);

    url.searchParams.set(
      "query",
      query
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
        15000
      );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    return (
      Array.isArray(data.articles)
        ? data.articles
        : []
    ).map(article => ({
      title:
        safeString(article.title),

      url:
        safeString(article.url),

      source:
        safeString(article.domain),

      date:
        safeString(article.seendate),

      snippet:
        safeString(article.title)
    }));
  } catch (error) {
    console.error(
      "GDELT ERROR:",
      error.message
    );

    return [];
  }
}

/* ========================================================
   WEATHER
======================================================== */

function extractWeatherLocation(message) {
  const value =
    safeString(message).trim();

  const patterns = [
    /weather\s+(?:in|of|for)\s+(.+)/i,
    /temperature\s+(?:in|of|for)\s+(.+)/i,
    /forecast\s+(?:in|of|for)\s+(.+)/i,
    /(.+?)\s+(?:weather|temperature|forecast)$/i,
    /(.+?)\s+(?:ka|ke|ki)\s+(?:mausam|weather)/i,
    /(.+?)\s+का मौसम/i,
    /मौसम\s+(?:में|का|की|के)\s*(.+)/i
  ];

  for (const pattern of patterns) {
    const match =
      value.match(pattern);

    if (
      match &&
      match[1]
    ) {
      return match[1]
        .replace(
          /today|today's|now|right now|आज|अभी/gi,
          ""
        )
        .replace(
          /[?.!,]+$/,
          ""
        )
        .trim();
    }
  }

  const cities = [
    "Delhi",
    "New Delhi",
    "Mumbai",
    "Kolkata",
    "Chennai",
    "Bengaluru",
    "Bangalore",
    "Hyderabad",
    "Pune",
    "Jaipur",
    "Ahmedabad",
    "Lucknow",
    "Patna",
    "Ranchi",
    "Noida",
    "Gurugram",
    "Gurgaon",
    "Chandigarh",
    "Surat",
    "Indore",
    "Bhopal",
    "Varanasi",
    "Agra"
  ];

  for (const city of cities) {
    if (
      new RegExp(
        `\\b${city}\\b`,
        "i"
      ).test(value)
    ) {
      return city;
    }
  }

  return null;
}

async function weatherSearch(location) {
  const city =
    safeString(location).trim();

  if (!city) return null;

  try {
    const geoUrl =
      new URL(GEO_URL);

    geoUrl.searchParams.set(
      "name",
      city
    );

    geoUrl.searchParams.set(
      "count",
      "1"
    );

    geoUrl.searchParams.set(
      "language",
      "en"
    );

    const geoResponse =
      await fetchWithTimeout(
        geoUrl.toString(),
        {},
        10000
      );

    if (!geoResponse.ok) {
      return null;
    }

    const geo =
      await geoResponse.json();

    const place =
      geo.results?.[0];

    if (!place) return null;

    const weatherUrl =
      new URL(WEATHER_URL);

    weatherUrl.searchParams.set(
      "latitude",
      place.latitude
    );

    weatherUrl.searchParams.set(
      "longitude",
      place.longitude
    );

    weatherUrl.searchParams.set(
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

    weatherUrl.searchParams.set(
      "daily",
      [
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max"
      ].join(",")
    );

    weatherUrl.searchParams.set(
      "forecast_days",
      "3"
    );

    weatherUrl.searchParams.set(
      "timezone",
      "auto"
    );

    const response =
      await fetchWithTimeout(
        weatherUrl.toString(),
        {},
        10000
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    return {
      location:
        `${place.name}, ${place.country}`,

      latitude:
        place.latitude,

      longitude:
        place.longitude,

      current:
        data.current || null,

      daily:
        data.daily || null
    };
  } catch (error) {
    console.error(
      "WEATHER ERROR:",
      error.message
    );

    return null;
  }
}

/* ========================================================
   SEARCH QUERY
======================================================== */

function buildSearchQuery(
  message,
  category,
  studyIntent,
  studyContext
) {
  let query =
    safeString(message).trim();

  if (
    studyIntent ===
    "exam_pyq"
  ) {
    const exam =
      studyContext.exam ||
      "UPSC";

    const year =
      studyContext.year ||
      new Date().getFullYear();

    query =
      `${exam} ${year} official previous year question paper PYQ`;

    if (
      studyContext.paperType
    ) {
      query +=
        ` ${studyContext.paperType}`;
    }
  }

  if (
    studyIntent ===
    "exam_current_affairs"
  ) {
    query +=
      " latest verified current affairs";
  }

  if (category === "news") {
    query +=
      " latest current verified information";
  }

  return limitText(
    query,
    1000
  );
}

/* ========================================================
   EXTERNAL RESEARCH ROUTER
======================================================== */

async function researchWeb({
  message,
  category,
  studyIntent,
  studyContext
}) {
  const searchQuery =
    buildSearchQuery(
      message,
      category,
      studyIntent,
      studyContext
    );

  /*
    WEATHER
  */

  if (category === "weather") {
    const location =
      extractWeatherLocation(
        message
      );

    if (location) {
      const weather =
        await weatherSearch(
          location
        );

      if (weather) {
        return {
          type: "weather",
          weather,
          sources: []
        };
      }
    }
  }

  /*
    OFFICIAL PYQ
  */

  if (
    studyIntent ===
    "exam_pyq"
  ) {
    const domains =
      getOfficialDomains(
        studyContext.exam
      );

    if (domains.length) {
      const official =
        await tavilySearch(
          searchQuery,
          {
            searchDepth:
              "advanced",
            maxResults: 6,
            includeDomains:
              domains
          }
        );

      if (
        official.results.length
      ) {
        return {
          type:
            "official_exam",

          verifiedOfficial:
            true,

          answer:
            official.answer,

          results:
            official.results,

          sources:
            official.results.map(
              item => ({
                title:
                  item.title,
                url:
                  item.url,
                source:
                  item.url,
                official:
                  true
              })
            )
        };
      }
    }

    const general =
      await tavilySearch(
        searchQuery,
        {
          searchDepth:
            "advanced",
          maxResults: 8
        }
      );

    return {
      type:
        "official_exam",

      verifiedOfficial:
        false,

      answer:
        general.answer,

      results:
        general.results,

      sources:
        general.results.map(
          item => ({
            title:
              item.title,
            url:
              item.url,
            source:
              item.url,
            official:
              false
          })
        )
    };
  }

  /*
    GENERAL WEB RESEARCH
  */

  const tavily =
    await tavilySearch(
      searchQuery,
      {
        searchDepth:
          "advanced",
        maxResults: 6
      }
    );

  const gdelt =
    category === "news"
      ? await gdeltSearch(
          searchQuery
        )
      : [];

  return {
    type: "web",

    answer:
      tavily.answer,

    results:
      tavily.results,

    gdelt,

    sources: [
      ...tavily.results.map(
        item => ({
          title:
            item.title,
          url:
            item.url,
          source:
            item.url
        })
      ),

      ...gdelt.map(
        item => ({
          title:
            item.title,
          url:
            item.url,
          source:
            item.source
        })
      )
    ]
  };
}

/* ========================================================
   RESEARCH FORMAT
======================================================== */

function formatResearchContext(
  research
) {
  if (!research) {
    return "";
  }

  let output =
    "\n\n===== VERIFIED / LIVE RESEARCH =====\n";

  if (
    research.type ===
    "weather"
  ) {
    output +=
      JSON.stringify(
        research.weather,
        null,
        2
      );

    output +=
      "\n===== END RESEARCH =====\n";

    return output;
  }

  if (
    research.verifiedOfficial !==
    undefined
  ) {
    output +=
      `OFFICIAL VERIFICATION: ${
        research.verifiedOfficial
          ? "VERIFIED OFFICIAL SOURCE"
          : "NOT VERIFIED AS OFFICIAL"
      }\n\n`;
  }

  if (research.answer) {
    output +=
      `SEARCH SUMMARY:\n${research.answer}\n\n`;
  }

  if (
    Array.isArray(
      research.results
    )
  ) {
    research.results
      .slice(0, 8)
      .forEach(
        (item, index) => {
          output +=
            `[Source ${index + 1}]\n`;

          output +=
            `Title: ${safeString(
              item.title
            )}\n`;

          output +=
            `URL: ${safeString(
              item.url
            )}\n`;

          output +=
            `Content: ${limitText(
              item.content ||
                item.snippet ||
                "",
              2500
            )}\n\n`;
        }
      );
  }

  if (
    Array.isArray(
      research.gdelt
    )
  ) {
    research.gdelt
      .slice(0, 5)
      .forEach(
        (item, index) => {
          output +=
            `[News Source ${index + 1}]\n`;

          output +=
            `Title: ${item.title}\n`;

          output +=
            `URL: ${item.url}\n\n`;
        }
      );
  }

  output +=
    "===== END RESEARCH =====\n";

  return limitText(
    output,
    18000
  );
}

/* ========================================================
   ATHARV CORE
======================================================== */

const ATHARV_INSTRUCTIONS = `
You are Atharv AI.

IDENTITY:
You are Atharv, a helpful, accurate, attentive multilingual AI assistant.

TAGLINE:
"Your AI. Every Language. Every Question."

CURRENT DATE/TIME:
${getIndiaDateTime()}

CORE RULES:
1. Answer directly.
2. Never say "Atharv is thinking".
3. Never create filler.
4. Do not unnecessarily ask clarification.
5. Make a reasonable interpretation when possible.
6. Match the user's language.
7. Match the user's tone and style.
8. Hindi -> Hindi.
9. Hinglish -> natural Hinglish.
10. English -> English.
11. Other languages -> answer in that language when possible.
12. Never invent facts.
13. Never invent citations.
14. Never claim an action happened when it did not.
15. Use supplied live research when available.
16. Clearly distinguish verified information from examples.
17. For time-sensitive information, mention the relevant date.
18. If information is uncertain, say so briefly.

RESPONSE STYLE:
- Simple question: concise.
- Learning question: clear explanation.
- Complex question: structured answer.
- Use headings/bullets when useful.
- Avoid unnecessary walls of text.
- Do not repeat yourself.

LIVE INFORMATION:
- Treat supplied live research as the current research context.
- Do not claim old model knowledge is live.
- Do not invent current prices, news, weather, results or statistics.
- If research does not verify something, say so.

WEATHER:
- Explain current conditions clearly.
- Mention location and date/time when useful.

MARKET:
- Clearly distinguish current factual data from analysis.
- Never guarantee profit.
- If current data is unavailable, say so.
- Do not fabricate prices.

NEWS:
- Distinguish reported facts from uncertain claims.
- Mention dates.
- Avoid sensational language.

STUDY ENGINE:
Support Classes 1-12.

When class is known:
- Match student's level.
- Explain concept first.
- Give examples.
- Give important points.
- Give practice questions when useful.

FEATURES:
- Chapter explanation
- Topic explanation
- Notes
- Important questions
- MCQ
- Mock tests
- Revision
- Flashcards
- Homework
- Doubt solving
- Answer evaluation
- Study plans
- Mathematics
- Science

IMPORTANT QUESTIONS:
AI-generated/prioritized questions are not guaranteed exam questions.

MCQ:
- A/B/C/D.
- One correct answer unless multiple answers requested.
- Avoid ambiguous choices.
- Verify answers.
- Label generated questions as practice.

OFFICIAL PYQ:
This is extremely important.

If user asks for an official PYQ:
- Never invent an official PYQ.
- Never present an AI-generated question as official.
- Prefer official examination authorities.
- Clearly distinguish official PYQ from Atharv Practice Question.
- If exact official paper/question cannot be verified, say so.
- Never fabricate exact wording.

UPSC:
- Distinguish Prelims GS Paper-I and CSAT.
- Distinguish Mains from Prelims.
- Never claim a question was asked unless verified.
- Use live research for current information.

PROGRAMMING:
Support:
Python, C, C++, Java, HTML, CSS, JavaScript,
TypeScript, SQL, PHP, Rust, Go, Kotlin, Swift,
Node.js, React, PostgreSQL, MySQL and other common technologies.

Programming:
- Teach beginner to advanced.
- Generate code.
- Explain code.
- Debug.
- Review.
- Build projects.
- Explain errors.
- Help with APIs and databases.

CODE EXECUTION:
Only claim execution when an execution result is actually supplied.
Groq Compound code execution is Python-oriented.
Do not claim that C/C++/Java/SQL was executed if it was only reasoned about.

MEMORY:
Use supplied memory naturally.
Never expose internal database details.
Never store passwords, OTPs, API keys, private keys,
recovery phrases, card PINs or CVVs.

ATTACHMENTS:
Only use attachment content supplied to the model.
Never claim to see unavailable attachment content.

PRIVACY:
Do not request unnecessary personal information.

QUALITY:
Be useful.
Be attentive.
Be accurate.
Never invent official documents.
Never invent citations.
Never repeat malformed text.
`;

/* ========================================================
   HISTORY
======================================================== */

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-12)
    .map(item => ({
      role:
        item?.role ===
        "assistant"
          ? "assistant"
          : "user",

      content:
        limitText(
          safeString(
            item?.content ??
            item?.message ??
            item?.text ??
            ""
          ),
          5000
        )
    }))
    .filter(
      item =>
        item.content.trim()
    );
}

/* ========================================================
   ATTACHMENTS
======================================================== */

function normalizeAttachments(
  attachments
) {
  if (
    !Array.isArray(
      attachments
    )
  ) {
    return [];
  }

  return attachments
    .slice(0, 5)
    .map(item => ({
      name:
        safeString(
          item?.name ||
          item?.filename ||
          "attachment"
        ),

      type:
        safeString(
          item?.type ||
          "unknown"
        ),

      content:
        limitText(
          safeString(
            item?.content ||
            item?.text ||
            ""
          ),
          8000
        )
    }));
}

/* ========================================================
   RESPONSE CLEANING
======================================================== */

function cleanResponse(text) {
  let value =
    safeString(text)
      .replace(/\r\n/g, "\n")
      .trim();

  if (!value) {
    return "";
  }

  value =
    value.replace(
      /(.)\1{80,}/g,
      "$1$1$1…"
    );

  value =
    value.replace(
      /([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱᵐ⁺⁻])\1{20,}/g,
      "$1"
    );

  value =
    value.replace(
      /([^\s])\1{100,}/g,
      "$1$1…"
    );

  value =
    value.replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
      ""
    );

  return limitText(
    value,
    30000
  );
}

function isBadResponse(text) {
  const value =
    safeString(text).trim();

  if (!value) return true;

  if (
    /^(error|failed|undefined|null)$/i
      .test(value)
  ) {
    return true;
  }

  if (
    /(.{1,4})\1{30,}/
      .test(value)
  ) {
    return true;
  }

  return false;
}

/* ========================================================
   GROQ PAYLOAD
======================================================== */

function buildGroqPayload({
  model,
  messages,
  officialDomain = [],
  enableCode = false
}) {
  const payload = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 8192,
  };

  if (
    isCompoundModel(model)
  ) {
    const tools = [
      "web_search"
    ];

    if (enableCode) {
      tools.push(
        "code_interpreter"
      );
    }

    payload.compound_custom = {
      tools: {
        enabled_tools: tools
      }
    };

    payload.search_settings = {
      country: "india"
    };

    if (
      officialDomain.length
    ) {
      payload.search_settings
        .include_domains =
        officialDomain;
    }
  }

  return payload;
}

/* ========================================================
   GROQ CONTENT
======================================================== */

function normalizeGroqContent(
  content
) {
  if (
    typeof content ===
    "string"
  ) {
    return content;
  }

  if (
    Array.isArray(content)
  ) {
    return content
      .map(item => {
        if (
          typeof item ===
          "string"
        ) {
          return item;
        }

        return (
          item?.text ||
          item?.content ||
          ""
        );
      })
      .join("");
  }

  if (
    content &&
    typeof content ===
      "object"
  ) {
    return (
      content.text ||
      content.content ||
      ""
    );
  }

  return "";
}

/* ========================================================
   GROQ COMPLETE
======================================================== */

async function callGroq({
  model,
  messages,
  officialDomain = [],
  enableCode = false
}) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured"
    );
  }

  const payload =
    buildGroqPayload({
      model,
      messages,
      officialDomain,
      enableCode
    });

  const response =
    await fetchWithTimeout(
      GROQ_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${GROQ_API_KEY}`,

          "Content-Type":
            "application/json",

          "Groq-Model-Version":
            "latest"
        },

        body:
          JSON.stringify(payload)
      },
      60000
    );

  const raw =
    await response.text();

  let data = null;

  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }

  if (!response.ok) {
    console.error(
      "GROQ ERROR:",
      response.status,
      raw.slice(0, 2000)
    );

    throw new Error(
      data?.error?.message ||
      `Groq HTTP ${response.status}`
    );
  }

  const message =
    data?.choices?.[0]
      ?.message;

  const content =
    normalizeGroqContent(
      message?.content ||
      data?.output_text ||
      ""
    );

  return {
    text:
      cleanResponse(content),

    raw: data,

    executedTools:
      message?.executed_tools ||
      []
  };
}

/* ========================================================
   GROQ STREAM
======================================================== */

async function streamGroq({
  model,
  messages,
  officialDomain = [],
  enableCode = false,
  onDelta
}) {
  /*
    Compound models are handled as a complete
    response and then delivered in chunks.
  */

  if (
    isCompoundModel(model)
  ) {
    const result =
      await callGroq({
        model,
        messages,
        officialDomain,
        enableCode
      });

    const text =
      cleanResponse(
        result.text
      );

    const chunkSize = 180;

    for (
      let i = 0;
      i < text.length;
      i += chunkSize
    ) {
      await onDelta(
        text.slice(
          i,
          i + chunkSize
        )
      );

      await sleep(8);
    }

    return result;
  }

  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured"
    );
  }

  const payload =
    buildGroqPayload({
      model,
      messages,
      officialDomain,
      enableCode
    });

  payload.stream = true;

  const response =
    await fetchWithTimeout(
      GROQ_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${GROQ_API_KEY}`,

          "Content-Type":
            "application/json",

          "Groq-Model-Version":
            "latest"
        },

        body:
          JSON.stringify(payload)
      },
      60000
    );

  if (!response.ok) {
    const raw =
      await response.text();

    throw new Error(
      `Groq streaming HTTP ${response.status}: ${raw.slice(
        0,
        1000
      )}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Groq streaming body unavailable"
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";
  let fullText = "";
  let finalData = null;

  while (true) {
    const {
      value,
      done
    } = await reader.read();

    if (done) break;

    buffer +=
      decoder.decode(
        value,
        { stream: true }
      );

    const lines =
      buffer.split("\n");

    buffer =
      lines.pop() || "";

    for (const line of lines) {
      const trimmed =
        line.trim();

      if (
        !trimmed.startsWith(
          "data:"
        )
      ) {
        continue;
      }

      const rawData =
        trimmed
          .slice(5)
          .trim();

      if (
        rawData ===
        "[DONE]"
      ) {
        continue;
      }

      let data;

      try {
        data =
          JSON.parse(
            rawData
          );
      } catch {
        continue;
      }

      finalData = data;

      const delta =
        data?.choices?.[0]
          ?.delta
          ?.content;

      if (delta) {
        fullText += delta;

        await onDelta(
          delta
        );
      }
    }
  }

  return {
    text:
      cleanResponse(
        fullText
      ),

    raw:
      finalData,

    executedTools: []
  };
}

/* ========================================================
   MESSAGE BUILDER
======================================================== */

function buildMessages({
  message,
  history,
  memory,
  research,
  language,
  category,
  studyIntent,
  studyContext,
  attachments
}) {
  const memoryText =
    memory.length
      ? `
USER MEMORY:
${memory
  .slice(0, 20)
  .map(
    item =>
      `- ${item.memory}`
  )
  .join("\n")}
`
      : "";

  const studyText =
    studyIntent
      ? `
STUDY CONTEXT:
Intent: ${studyIntent}
Class: ${
        studyContext.classNumber ||
        "not specified"
      }
Board: ${
        studyContext.board ||
        "not specified"
      }
Exam: ${
        studyContext.exam ||
        "not specified"
      }
Year: ${
        studyContext.year ||
        "not specified"
      }
Paper Type: ${
        studyContext.paperType ||
        "not specified"
      }
`
      : "";

  const attachmentText =
    attachments.length
      ? `
ATTACHMENTS:
${attachments
  .map(
    item =>
      `File: ${item.name}
Type: ${item.type}
Content:
${item.content}`
  )
  .join("\n\n")}
`
      : "";

  const researchText =
    formatResearchContext(
      research
    );

  const system = `
${ATHARV_INSTRUCTIONS}

USER LANGUAGE:
${language}

CATEGORY:
${category}

${memoryText}

${studyText}

${attachmentText}

${researchText}
`;

  const messages = [
    {
      role: "system",
      content: system
    }
  ];

  messages.push(
    ...history
  );

  messages.push({
    role: "user",
    content:
      limitText(
        message,
        12000
      )
  });

  return messages;
}

/* ========================================================
   EXTERNAL RESEARCH DECISION
======================================================== */

function shouldUseExternalResearch({
  category,
  studyIntent,
  message
}) {
  if (
    category === "weather" ||
    category === "news" ||
    category === "market" ||
    category === "sports"
  ) {
    return true;
  }

  if (
    studyIntent ===
    "exam_pyq" ||
    studyIntent ===
    "exam_current_affairs"
  ) {
    return true;
  }

  if (
    needsLiveSearch(message)
  ) {
    return true;
  }

  return false;
}

/* ========================================================
   GENERATE RESPONSE
======================================================== */

async function generateAtharvResponse({
  message,
  history,
  userId,
  attachments = []
}) {
  const language =
    detectLanguage(message);

  const category =
    detectCategory(message);

  const studyIntent =
    detectStudyIntent(message);

  const studyContext =
    extractStudyContext(message);

  const memory =
    await getMemories(userId);

  const liveNeeded =
    needsLiveSearch(message);

  let research = null;

  if (
    shouldUseExternalResearch({
      category,
      studyIntent,
      message
    })
  ) {
    research =
      await researchWeb({
        message,
        category,
        studyIntent,
        studyContext
      });
  }

  const messages =
    buildMessages({
      message,
      history,
      memory,
      research,
      language,
      category,
      studyIntent,
      studyContext,
      attachments
    });

  const officialDomains =
    studyIntent ===
    "exam_pyq"
      ? getOfficialDomains(
          studyContext.exam
        )
      : [];

  const liveModelRequired =
    liveNeeded ||
    studyIntent ===
      "exam_pyq" ||
    studyIntent ===
      "exam_current_affairs";

  const preferredModel =
    liveModelRequired
      ? LIVE_MODEL
      : GENERAL_MODEL;

  const enableCode =
    category ===
      "programming" ||
    /calculate|calculation|solve|python|debug|code/i
      .test(message);

  let result;

  try {
    result =
      await callGroq({
        model:
          preferredModel,

        messages,

        officialDomain:
          officialDomains,

        enableCode
      });
  } catch (error) {
    console.error(
      "PRIMARY GROQ ERROR:",
      error.message
    );

    if (
      preferredModel !==
      GENERAL_MODEL
    ) {
      result =
        await callGroq({
          model:
            GENERAL_MODEL,

          messages,

          officialDomain: [],

          enableCode: false
        });
    } else {
      throw error;
    }
  }

  const reply =
    cleanResponse(
      result.text
    );

  if (
    isBadResponse(reply)
  ) {
    throw new Error(
      "AI returned an invalid response"
    );
  }

  return {
    reply,
    response: reply,
    answer: reply,
    text: reply,

    language,
    category,

    studyIntent,

    studyContext,

    live:
      liveNeeded,

    sources:
      research?.sources || [],

    executedTools:
      result.executedTools || [],

    responseId:
      result.raw?.id || null,

    model:
      result.raw?.model ||
      preferredModel,

    serverVersion:
      SERVER_VERSION
  };
}

/* ========================================================
   CHAT API
======================================================== */

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const message =
        safeString(
          body.message ||
          body.prompt ||
          body.input ||
          ""
        ).trim();

      if (!message) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Message is required"
          });
      }

      const userId =
        getUserId(req);

      const memoryRequest =
        await processMemoryRequest(
          userId,
          message
        );

      if (
        memoryRequest.handled
      ) {
        return res.json({
          ok: true,

          reply:
            memoryRequest.reply,

          response:
            memoryRequest.reply,

          answer:
            memoryRequest.reply,

          text:
            memoryRequest.reply,

          responseId: null,

          conversationId:
            body.conversationId ||
            body.chatId ||
            null,

          memoryHandled: true,

          serverVersion:
            SERVER_VERSION
        });
      }

      const history =
        normalizeHistory(
          body.history
        );

      const attachments =
        normalizeAttachments(
          body.attachments
        );

      const result =
        await generateAtharvResponse({
          message,
          history,
          userId,
          attachments
        });

      return res.json({
        ok: true,
        ...result,

        conversationId:
          body.conversationId ||
          body.chatId ||
          null
      });
    } catch (error) {
      console.error(
        "CHAT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,

          error:
            "Atharv AI could not complete the request.",

          details:
            process.env.NODE_ENV ===
            "production"
              ? undefined
              : error.message,

          serverVersion:
            SERVER_VERSION
        });
    }
  }
);

/* ========================================================
   STREAM API
======================================================== */

app.post(
  "/api/chat/stream",
  async (req, res) => {
    let streamStarted =
      false;

    try {
      const body =
        req.body || {};

      const message =
        safeString(
          body.message ||
          body.prompt ||
          body.input ||
          ""
        ).trim();

      if (!message) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Message is required"
          });
      }

      const userId =
        getUserId(req);

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

      res.flushHeaders?.();

      streamStarted = true;

      const memoryRequest =
        await processMemoryRequest(
          userId,
          message
        );

      if (
        memoryRequest.handled
      ) {
        res.write(
          `data: ${JSON.stringify({
            type: "delta",
            text:
              memoryRequest.reply
          })}\n\n`
        );

        res.write(
          `data: ${JSON.stringify({
            type: "done"
          })}\n\n`
        );

        return res.end();
      }

      const history =
        normalizeHistory(
          body.history
        );

      const attachments =
        normalizeAttachments(
          body.attachments
        );

      const language =
        detectLanguage(message);

      const category =
        detectCategory(message);

      const studyIntent =
        detectStudyIntent(message);

      const studyContext =
        extractStudyContext(message);

      const memory =
        await getMemories(userId);

      const liveNeeded =
        needsLiveSearch(message);

      let research = null;

      if (
        shouldUseExternalResearch({
          category,
          studyIntent,
          message
        })
      ) {
        research =
          await researchWeb({
            message,
            category,
            studyIntent,
            studyContext
          });
      }

      const messages =
        buildMessages({
          message,
          history,
          memory,
          research,
          language,
          category,
          studyIntent,
          studyContext,
          attachments
        });

      const officialDomains =
        studyIntent ===
        "exam_pyq"
          ? getOfficialDomains(
              studyContext.exam
            )
          : [];

      const liveModelRequired =
        liveNeeded ||
        studyIntent ===
          "exam_pyq" ||
        studyIntent ===
          "exam_current_affairs";

      const preferredModel =
        liveModelRequired
          ? LIVE_MODEL
          : GENERAL_MODEL;

      const enableCode =
        category ===
          "programming" ||
        /calculate|calculation|solve|python|debug|code/i
          .test(message);

      let result = null;

      try {
        result =
          await streamGroq({
            model:
              preferredModel,

            messages,

            officialDomain:
              officialDomains,

            enableCode,

            onDelta:
              async chunk => {
                if (!chunk) return;

                res.write(
                  `data: ${JSON.stringify({
                    type: "delta",
                    text: chunk
                  })}\n\n`
                );
              }
          });
      } catch (primaryError) {
        console.error(
          "PRIMARY STREAM ERROR:",
          primaryError.message
        );

        if (
          preferredModel !==
          GENERAL_MODEL
        ) {
          result =
            await streamGroq({
              model:
                GENERAL_MODEL,

              messages,

              officialDomain: [],

              enableCode: false,

              onDelta:
                async chunk => {
                  if (!chunk) return;

                  res.write(
                    `data: ${JSON.stringify({
                      type: "delta",
                      text: chunk
                    })}\n\n`
                  );
                }
            });
        } else {
          throw primaryError;
        }
      }

      const reply =
        cleanResponse(
          result.text
        );

      if (
        isBadResponse(reply)
      ) {
        throw new Error(
          "AI returned invalid streaming response"
        );
      }

      res.write(
        `data: ${JSON.stringify({
          type: "meta",

          responseId:
            result.raw?.id ||
            null,

          conversationId:
            body.conversationId ||
            body.chatId ||
            null,

          language,

          category,

          studyIntent:
            studyIntent ||
            null,

          sources:
            research?.sources ||
            [],

          model:
            result.raw?.model ||
            preferredModel,

          serverVersion:
            SERVER_VERSION
        })}\n\n`
      );

      res.write(
        `data: ${JSON.stringify({
          type: "done"
        })}\n\n`
      );

      return res.end();
    } catch (error) {
      console.error(
        "STREAM ERROR:",
        error
      );

      if (
        !streamStarted ||
        !res.headersSent
      ) {
        return res
          .status(500)
          .json({
            ok: false,

            error:
              "Atharv AI could not complete the request.",

            details:
              process.env.NODE_ENV ===
              "production"
                ? undefined
                : error.message
          });
      }

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            "Atharv AI could not complete the request."
        })}\n\n`
      );

      res.end();
    }
  }
);

/* ========================================================
   MEMORY GET
======================================================== */

app.get(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memories =
        await getMemories(userId);

      return res.json({
        ok: true,
        memories
      });
    } catch (error) {
      console.error(
        "MEMORY GET ERROR:",
        error.message
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            "Could not load memory"
        });
    }
  }
);

/* ========================================================
   MEMORY POST
======================================================== */

app.post(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const memory =
        safeString(
          req.body?.memory ||
          req.body?.text ||
          ""
        ).trim();

      if (!memory) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Memory is required"
          });
      }

      if (
        isSensitiveMemory(memory)
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Sensitive secrets cannot be stored."
          });
      }

      const saved =
        await saveMemory(
          userId,
          limitText(
            memory,
            500
          )
        );

      return res.json({
        ok: true,
        memory: saved
      });
    } catch (error) {
      console.error(
        "MEMORY POST ERROR:",
        error.message
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            "Could not save memory"
        });
    }
  }
);

/* ========================================================
   MEMORY DELETE
======================================================== */

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
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Invalid memory id"
          });
      }

      const deleted =
        await deleteMemory(
          userId,
          id
        );

      return res.json({
        ok: true,
        deleted
      });
    } catch (error) {
      console.error(
        "MEMORY DELETE ERROR:",
        error.message
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            "Could not delete memory"
        });
    }
  }
);

/* ========================================================
   MEMORY CLEAR
======================================================== */

app.delete(
  "/api/memory",
  async (req, res) => {
    try {
      const userId =
        getUserId(req);

      const count =
        await clearMemories(
          userId
        );

      return res.json({
        ok: true,
        deleted: count
      });
    } catch (error) {
      console.error(
        "MEMORY CLEAR ERROR:",
        error.message
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            "Could not clear memories"
        });
    }
  }
);

/* ========================================================
   HEALTH
======================================================== */

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

    return res.json({
      ok: true,

      service:
        "Atharv AI",

      version:
        SERVER_VERSION,

      status:
        database ||
        !DATABASE_URL
          ? "healthy"
          : "degraded",

      database,

      providers: {
        groq:
          Boolean(
            GROQ_API_KEY
          ),

        groqGeneralModel:
          GENERAL_MODEL,

        groqLiveModel:
          LIVE_MODEL,

        tavily:
          Boolean(
            TAVILY_API_KEY
          ),

        gdelt: true,

        openMeteo: true
      },

      features: {
        multilingual: true,

        worldLanguages: true,

        intelligentRouter: true,

        memory: true,

        liveWebSearch: true,

        groqCompound:
          isCompoundModel(
            LIVE_MODEL
          ),

        officialPYQ: true,

        officialExamDomains: true,

        tavilyFallback: true,

        gdeltFallback: true,

        weather: true,

        marketRouting: true,

        newsRouting: true,

        sportsRouting: true,

        streaming: true,

        compoundFallback: true,

        attachments: true,

        study: true,

        schoolClasses: "1-12",

        competitiveExams: true,

        pyq: true,

        mcq: true,

        mockTests: true,

        revision: true,

        flashcards: true,

        homework: true,

        answerEvaluation: true,

        programming: true,

        pythonExecution:
          isCompoundModel(
            GENERAL_MODEL
          ) ||
          isCompoundModel(
            LIVE_MODEL
          ),

        programmingLanguages: [
          "Python",
          "C",
          "C++",
          "Java",
          "HTML",
          "CSS",
          "JavaScript",
          "TypeScript",
          "SQL",
          "PHP",
          "Rust",
          "Go",
          "Kotlin",
          "Swift",
          "Node.js",
          "React",
          "PostgreSQL",
          "MySQL"
        ]
      },

      time:
        getIndiaDateTime()
    });
  }
);

/* ========================================================
   DEPENDENCY HEALTH
======================================================== */

app.get(
  "/health/dependencies",
  async (req, res) => {
    const dependencies = {
      groq:
        Boolean(
          GROQ_API_KEY
        ),

      tavily:
        Boolean(
          TAVILY_API_KEY
        ),

      database: false,

      gdelt: true,

      openMeteo: true
    };

    if (pool) {
      try {
        await pool.query(
          "SELECT 1"
        );

        dependencies.database =
          true;
      } catch {
        dependencies.database =
          false;
      }
    }

    return res.json({
      ok: true,

      version:
        SERVER_VERSION,

      dependencies
    });
  }
);

/* ========================================================
   STATIC FRONTEND
======================================================== */

const publicPath =
  __dirname;

app.use(
  express.static(
    publicPath,
    {
      extensions: ["html"]
    }
  )
);

/* ========================================================
   ROOT
======================================================== */

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

/* ========================================================
   SPA FALLBACK
======================================================== */

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

/* ========================================================
   API 404
======================================================== */

app.use(
  "/api",
  (req, res) => {
    res
      .status(404)
      .json({
        ok: false,
        error:
          "API endpoint not found"
      });
  }
);

/* ========================================================
   GLOBAL ERROR
======================================================== */

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

    res
      .status(500)
      .json({
        ok: false,

        error:
          "Atharv AI server error",

        serverVersion:
          SERVER_VERSION
      });
  }
);

/* ========================================================
   START SERVER
======================================================== */

async function startServer() {
  try {
    if (pool) {
      await pool.query(
        "SELECT 1"
      );

      await ensureMemoryTable();

      console.log(
        "Database connected."
      );

      console.log(
        "Memory table ready."
      );
    } else {
      console.warn(
        "DATABASE_URL not configured."
      );
    }

    app.listen(
      PORT,
      () => {
        console.log(
          "========================================"
        );

        console.log(
          `ATHARV AI v${SERVER_VERSION}`
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
          "========================================"
        );

        console.log(
          "Multilingual AI: ENABLED"
        );

        console.log(
          "World Languages: ENABLED"
        );

        console.log(
          "Intelligent Router: ENABLED"
        );

        console.log(
          "Live Web Research: ENABLED"
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
          "Memory: ENABLED"
        );

        console.log(
          "Streaming: ENABLED"
        );

        console.log(
          "Weather: ENABLED"
        );

        console.log(
          "Market Routing: ENABLED"
        );

        console.log(
          "News Routing: ENABLED"
        );

        console.log(
          "Frontend: ENABLED"
        );

        console.log(
          "========================================"
        );
      }
    );
  } catch (error) {
    console.error(
      "SERVER START ERROR:",
      error
    );

    /*
      Keep Render alive even if DB is temporarily unavailable.
    */

    app.listen(
      PORT,
      () => {
        console.log(
          `Atharv AI v${SERVER_VERSION} running on ${PORT} with degraded database state.`
        );
      }
    );
  }
}

startServer();
