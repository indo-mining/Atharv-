"use strict";

/*
=========================================================
 ATHARV AI - BACKEND SERVER
 Version 21.0.0
 --------------------------------------------------------
 FIXES:
 - /api/chat fully implemented
 - /api/chat/research implemented
 - Groq direct HTTP API
 - GPT-OSS primary + fallback model
 - Render/cold-start friendly
 - Request timeout handling
 - Memory API
 - PostgreSQL / Neon support
 - Optional Tavily live search
 - CORS
 - Helmet
 - Compression
 - Rate limiting
 - Static frontend serving
 - Health/version endpoints
=========================================================
*/

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

let pg = null;

try {
  pg = require("pg");
} catch (error) {
  console.warn("pg package not installed. Database memory disabled.");
}


/* =====================================================
   APP
===================================================== */

const app = express();


/* =====================================================
   CONFIG
===================================================== */

const PORT =
  Number(process.env.PORT) || 10000;

const HOST =
  process.env.HOST || "0.0.0.0";

const VERSION =
  "21.0.0";


const GROQ_API_KEY =
  process.env.GROQ_API_KEY || "";


const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";


const PRIMARY_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-120b";


const FALLBACK_MODEL =
  process.env.GROQ_FALLBACK_MODEL ||
  "openai/gpt-oss-20b";


const TAVILY_API_KEY =
  process.env.TAVILY_API_KEY || "";


const DATABASE_URL =
  process.env.DATABASE_URL || "";


/*
 * Groq timeout must be below frontend timeout.
 * Frontend waits around 180 seconds.
 */

const GROQ_TIMEOUT =
  Number(process.env.GROQ_TIMEOUT_MS) || 165000;


const MAX_MESSAGE_CHARS =
  12000;


const MAX_HISTORY_MESSAGES =
  20;


const MAX_HISTORY_CHARS =
  18000;


const MAX_MEMORY_ITEMS =
  20;


const MAX_MEMORY_CHARS =
  6000;


const MAX_RESEARCH_CHARS =
  7000;


/* =====================================================
   SECURITY / MIDDLEWARE
===================================================== */

app.disable("x-powered-by");


app.use(
  helmet({
    contentSecurityPolicy: false
  })
);


app.use(
  cors({
    origin: true,
    credentials: true
  })
);


app.use(
  compression()
);


app.use(
  express.json({
    limit: "2mb"
  })
);


app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);


/* =====================================================
   SIMPLE RATE LIMIT
===================================================== */

const rateMap =
  new Map();


const RATE_WINDOW =
  60 * 1000;


const RATE_LIMIT =
  40;


function rateLimit(req, res, next) {

  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown";


  const now =
    Date.now();


  let item =
    rateMap.get(ip);


  if (
    !item ||
    now - item.start > RATE_WINDOW
  ) {

    item = {
      start: now,
      count: 0
    };

    rateMap.set(ip, item);
  }


  item.count++;


  if (item.count > RATE_LIMIT) {

    return res.status(429).json({
      ok: false,
      error: "Too many requests. Please try again shortly."
    });
  }


  next();
}


app.use("/api/", rateLimit);


/* =====================================================
   DATABASE
===================================================== */

let pool = null;


if (
  DATABASE_URL &&
  pg &&
  pg.Pool
) {

  try {

    pool =
      new pg.Pool({
        connectionString: DATABASE_URL,

        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,

        max: 5,

        idleTimeoutMillis: 30000,

        connectionTimeoutMillis: 10000
      });


    pool.on(
      "error",
      error => {

        console.error(
          "PostgreSQL pool error:",
          error.message
        );

      }
    );


  } catch (error) {

    console.error(
      "PostgreSQL initialization failed:",
      error.message
    );

    pool = null;
  }
}


async function initDatabase() {

  if (!pool) {
    return;
  }


  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_memories (
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
      ON user_memories(user_id)
    `);


    console.log(
      "Database ready"
    );


  } catch (error) {

    console.error(
      "Database initialization error:",
      error.message
    );
  }
}


/* =====================================================
   HELPERS
===================================================== */

function normalizeUserId(value) {

  const id =
    String(value || "guest")
      .trim()
      .slice(0, 120);


  return id || "guest";
}


function cleanText(
  value,
  max = 12000
) {

  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}


function normalizeHistory(
  history
) {

  if (!Array.isArray(history)) {
    return [];
  }


  const result = [];


  for (
    const item of history
      .slice(-MAX_HISTORY_MESSAGES)
  ) {

    if (!item) continue;


    const role =
      item.role === "assistant"
        ? "assistant"
        : item.role === "user"
          ? "user"
          : null;


    if (!role) continue;


    const content =
      cleanText(
        item.content,
        4000
      );


    if (!content) continue;


    result.push({
      role,
      content
    });
  }


  return result;
}


function historyLength(
  history
) {

  return history.reduce(
    (total, item) =>
      total + item.content.length,
    0
  );
}


/* =====================================================
   MEMORY
===================================================== */

async function getMemories(
  userId
) {

  if (!pool) {
    return [];
  }


  try {

    const result =
      await pool.query(
        `
        SELECT id, memory, created_at, updated_at
        FROM user_memories
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
        `,
        [
          userId,
          MAX_MEMORY_ITEMS
        ]
      );


    return result.rows || [];


  } catch (error) {

    console.error(
      "Memory read error:",
      error.message
    );


    return [];
  }
}


async function saveMemory(
  userId,
  memory
) {

  if (!pool) {
    return false;
  }


  const clean =
    cleanText(
      memory,
      1000
    );


  if (!clean) {
    return false;
  }


  try {

    await pool.query(
      `
      INSERT INTO user_memories
        (user_id, memory, updated_at)
      VALUES
        ($1, $2, NOW())
      `,
      [
        userId,
        clean
      ]
    );


    return true;


  } catch (error) {

    console.error(
      "Memory save error:",
      error.message
    );


    return false;
  }
}


/* =====================================================
   MEMORY TEXT
===================================================== */

function memoriesToText(
  memories
) {

  if (!Array.isArray(memories)) {
    return "";
  }


  return memories
    .map(
      item =>
        typeof item === "string"
          ? item
          : item.memory || ""
    )
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_MEMORY_CHARS);
}


/* =====================================================
   SYSTEM PROMPT
===================================================== */

function buildSystemPrompt(
  memoryText = "",
  researchText = ""
) {

  let prompt = `

You are Atharv AI.

You are a helpful, accurate and practical AI assistant.

IMPORTANT LANGUAGE RULES:

1. If the user writes in English, reply in English.
2. If the user writes in Hindi using Devanagari, reply in Hindi using Devanagari.
3. If the user writes in Roman Hindi or Hinglish, reply naturally in Roman Hindi/Hinglish.
4. If the user mixes languages, naturally match the user's language style.
5. Do not unnecessarily translate the user's language.
6. Keep answers clear and easy to understand.
7. Do not repeatedly call the user's name unless naturally necessary.

For factual or current information:
- Do not invent facts.
- If live research is provided, use it carefully.
- Clearly distinguish known information from uncertainty.

For programming:
- Give working code.
- Explain important errors simply.
- Prefer complete copy-paste solutions when appropriate.

For important information:
- Encourage verification when information may change.

You are Atharv AI, not a demo assistant.
`;


  if(memoryText){

    prompt += `

USER MEMORY:

${memoryText}

Use this information naturally when relevant.
Do not mention that you are reading a memory database.
`;
  }


  if(researchText){

    prompt += `

LIVE RESEARCH:

${researchText}

Use the research when answering the user's question.
Do not claim information is current unless supported by the research.
`;
  }


  return prompt.trim();
}


/* =====================================================
   GROQ REQUEST
===================================================== */

async function callGroq(
  model,
  messages
) {

  if (!GROQ_API_KEY) {

    throw new Error(
      "GROQ_API_KEY is not configured on the server."
    );
  }


  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => controller.abort(),
      GROQ_TIMEOUT
    );


  try {

    const response =
      await fetch(
        GROQ_URL,
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${GROQ_API_KEY}`,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            model,

            messages,

            temperature: 0.7,

            max_tokens: 4096,

            stream: false
          }),

          signal:
            controller.signal
        }
      );


    const raw =
      await response.text();


    let data = null;


    try {

      data =
        raw
          ? JSON.parse(raw)
          : null;

    } catch {

      data = null;
    }


    if (!response.ok) {

      const apiError =
        data?.error?.message ||
        data?.message ||
        raw ||
        `Groq HTTP ${response.status}`;


      const error =
        new Error(
          apiError
        );


      error.status =
        response.status;


      throw error;
    }


    const content =
      data?.choices?.[0]?.message?.content;


    if (
      typeof content !== "string" ||
      !content.trim()
    ) {

      throw new Error(
        "Groq returned an empty response."
      );
    }


    return content.trim();


  } catch (error) {

    if (
      error.name === "AbortError"
    ) {

      throw new Error(
        "Groq request timed out."
      );
    }


    throw error;


  } finally {

    clearTimeout(timer);
  }
}


/* =====================================================
   GROQ WITH FALLBACK
===================================================== */

async function askGroq(
  messages
) {

  let firstError = null;


  try {

    return await callGroq(
      PRIMARY_MODEL,
      messages
    );

  } catch (error) {

    firstError =
      error;

    console.error(
      `Primary Groq model failed (${PRIMARY_MODEL}):`,
      error.message
    );
  }


  /*
   * Do not use the same model twice.
   */

  if (
    FALLBACK_MODEL &&
    FALLBACK_MODEL !== PRIMARY_MODEL
  ) {

    try {

      console.log(
        `Trying fallback model: ${FALLBACK_MODEL}`
      );


      return await callGroq(
        FALLBACK_MODEL,
        messages
      );

    } catch (fallbackError) {

      console.error(
        `Fallback Groq model failed (${FALLBACK_MODEL}):`,
        fallbackError.message
      );


      throw new Error(
        `AI request failed. Primary: ${firstError?.message || "error"}. Fallback: ${fallbackError.message}`
      );
    }
  }


  throw firstError ||
    new Error(
      "AI request failed."
    );
}


/* =====================================================
   TAVILY SEARCH
===================================================== */

async function tavilySearch(
  query
) {

  if (!TAVILY_API_KEY) {

    return "";
  }


  const cleanQuery =
    cleanText(
      query,
      1000
    );


  if (!cleanQuery) {
    return "";
  }


  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => controller.abort(),
      30000
    );


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

            query:
              cleanQuery,

            search_depth:
              "advanced",

            max_results:
              5,

            include_answer:
              true,

            include_raw_content:
              false
          }),

          signal:
            controller.signal
        }
      );


    if(!response.ok){

      const text =
        await response.text();

      console.error(
        "Tavily error:",
        text
      );

      return "";
    }


    const data =
      await response.json();


    const parts = [];


    if(data?.answer){

      parts.push(
        `Summary:\n${data.answer}`
      );
    }


    if(
      Array.isArray(
        data?.results
      )
    ){

      for(
        const item of
        data.results.slice(0,5)
      ){

        const title =
          item.title || "Source";


        const content =
          item.content || "";


        const url =
          item.url || "";


        parts.push(
          `${title}\n${content}\n${url}`
        );
      }
    }


    return parts
      .join("\n\n")
      .slice(
        0,
        MAX_RESEARCH_CHARS
      );


  } catch (error) {

    console.error(
      "Tavily request failed:",
      error.message
    );


    return "";


  } finally {

    clearTimeout(timer);
  }
}


/* =====================================================
   HEALTH
===================================================== */

app.get(
  "/health",
  async (req,res) => {

    let database =
      false;


    if(pool){

      try{

        await pool.query(
          "SELECT 1"
        );

        database = true;

      }catch{

        database = false;
      }
    }


    res.json({

      ok:true,

      service:
        "Atharv AI",

      version:
        VERSION,

      database,

      groq:
        Boolean(GROQ_API_KEY),

      tavily:
        Boolean(TAVILY_API_KEY),

      timestamp:
        new Date().toISOString()

    });

  }
);


/* =====================================================
   VERSION
===================================================== */

app.get(
  "/api/version",
  (req,res) => {

    res.json({

      ok:true,

      version:
        VERSION,

      service:
        "Atharv AI"

    });

  }
);


/* =====================================================
   CHAT
===================================================== */

app.post(
  "/api/chat",
  async (req,res) => {

    const started =
      Date.now();


    try {

      const body =
        req.body || {};


      const message =
        cleanText(
          body.message ||
          body.prompt ||
          body.content,
          MAX_MESSAGE_CHARS
        );


      if(!message){

        return res.status(400).json({

          ok:false,

          error:
            "Message is required.",

          reply:
            "Please enter a message."
        });
      }


      const userId =
        normalizeUserId(
          body.userId
        );


      let history =
        normalizeHistory(
          body.history ||
          body.messages
        );


      /*
       * Prevent excessive request size.
       */

      while(
        historyLength(history) >
        MAX_HISTORY_CHARS
      ){

        history.shift();
      }


      const memories =
        await getMemories(
          userId
        );


      const memoryText =
        memoriesToText(
          memories
        );


      const systemPrompt =
        buildSystemPrompt(
          memoryText
        );


      const messages = [

        {
          role:
            "system",

          content:
            systemPrompt
        },

        ...history,

        {
          role:
            "user",

          content:
            message
        }

      ];


      console.log(
        `[CHAT] ${userId} | ${message.slice(0,80)}`
      );


      const reply =
        await askGroq(
          messages
        );


      /*
       * Return all common response names
       * so old/new frontend code remains compatible.
       */

      return res.json({

        ok:true,

        reply,

        message:
          reply,

        content:
          reply,

        model:
          PRIMARY_MODEL,

        elapsed:
          Date.now() - started

      });


    } catch (error) {

      console.error(
        "CHAT ERROR:",
        error
      );


      const status =
        Number(error?.status) >= 400 &&
        Number(error?.status) < 600
          ? Number(error.status)
          : 500;


      let message =
        error?.message ||
        "Unable to generate a response.";


      if(
        /timed out/i.test(message)
      ){

        message =
          "AI request timed out. Please try again.";
      }


      return res.status(status).json({

        ok:false,

        error:
          message,

        reply:
          `⚠️ ${message}`,

        elapsed:
          Date.now() - started

      });

    }

  }
);


/* =====================================================
   LIVE RESEARCH CHAT
===================================================== */

app.post(
  "/api/chat/research",
  async (req,res) => {

    const started =
      Date.now();


    try {

      const body =
        req.body || {};


      const message =
        cleanText(
          body.message ||
          body.prompt ||
          body.content,
          MAX_MESSAGE_CHARS
        );


      if(!message){

        return res.status(400).json({

          ok:false,

          error:
            "Message is required.",

          reply:
            "Please enter a message."
        });
      }


      const userId =
        normalizeUserId(
          body.userId
        );


      let history =
        normalizeHistory(
          body.history ||
          body.messages
        );


      while(
        historyLength(history) >
        MAX_HISTORY_CHARS
      ){

        history.shift();
      }


      const memories =
        await getMemories(
          userId
        );


      const memoryText =
        memoriesToText(
          memories
        );


      /*
       * If Tavily isn't configured,
       * still answer through Groq.
       */

      const research =
        await tavilySearch(
          message
        );


      const systemPrompt =
        buildSystemPrompt(
          memoryText,
          research
        );


      const messages = [

        {
          role:
            "system",

          content:
            systemPrompt
        },

        ...history,

        {
          role:
            "user",

          content:
            message
        }

      ];


      const reply =
        await askGroq(
          messages
        );


      return res.json({

        ok:true,

        reply,

        message:
          reply,

        content:
          reply,

        researchUsed:
          Boolean(research),

        research:
          research || "",

        elapsed:
          Date.now() - started

      });


    } catch(error){

      console.error(
        "RESEARCH ERROR:",
        error
      );


      return res.status(500).json({

        ok:false,

        error:
          error?.message ||
          "Research request failed.",

        reply:
          `⚠️ ${
            error?.message ||
            "Research request failed."
          }`

      });

    }

  }
);


/* =====================================================
   MEMORY GET
===================================================== */

app.get(
  "/api/memory",
  async (req,res) => {

    try {

      const userId =
        normalizeUserId(
          req.query.userId
        );


      const memories =
        await getMemories(
          userId
        );


      return res.json({

        ok:true,

        userId,

        memories

      });


    } catch(error) {

      console.error(
        "MEMORY GET ERROR:",
        error
      );


      return res.status(500).json({

        ok:false,

        memories:[],

        error:
          "Memory service unavailable."

      });

    }

  }
);


/* =====================================================
   MEMORY SAVE
===================================================== */

app.post(
  "/api/memory",
  async (req,res) => {

    try {

      const body =
        req.body || {};


      const userId =
        normalizeUserId(
          body.userId
        );


      const memory =
        cleanText(
          body.memory ||
          body.content ||
          body.text,
          1000
        );


      if(!memory){

        return res.status(400).json({

          ok:false,

          error:
            "Memory text is required."

        });
      }


      if(!pool){

        return res.status(503).json({

          ok:false,

          saved:false,

          error:
            "Database is not configured."

        });
      }


      const saved =
        await saveMemory(
          userId,
          memory
        );


      return res.json({

        ok:
          saved,

        saved,

        userId,

        memory

      });


    } catch(error) {

      console.error(
        "MEMORY POST ERROR:",
        error
      );


      return res.status(500).json({

        ok:false,

        saved:false,

        error:
          "Unable to save memory."

      });

    }

  }
);


/* =====================================================
   WEATHER
===================================================== */

app.get(
  "/api/weather",
  async (req,res) => {

    /*
     * Kept as a safe endpoint so old frontend
     * requests do not break the application.
     *
     * Frontend can use its own weather provider
     * later if configured.
     */

    return res.json({

      ok:false,

      error:
        "Weather service is not configured."

    });

  }
);


/* =====================================================
   STATIC FRONTEND
===================================================== */

const publicCandidates = [

  path.join(
    process.cwd(),
    "public"
  ),

  path.join(
    __dirname,
    "public"
  ),

  process.cwd()

];


let publicDir =
  process.cwd();


for(
  const candidate of
  publicCandidates
){

  try{

    if(
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isDirectory()
    ){

      publicDir =
        candidate;

      break;
    }

  }catch{}
}


console.log(
  "Frontend directory:",
  publicDir
);


app.use(
  express.static(
    publicDir,
    {
      index:false,

      maxAge:
        process.env.NODE_ENV === "production"
          ? "1h"
          : 0
    }
  )
);


/* =====================================================
   SPA FALLBACK
===================================================== */

app.get(
  "*",
  (req,res,next) => {

    /*
     * Never return index.html for API routes.
     */

    if(
      req.path.startsWith("/api/")
    ){

      return next();
    }


    const indexPath =
      path.join(
        publicDir,
        "index.html"
      );


    if(
      fs.existsSync(indexPath)
    ){

      return res.sendFile(
        indexPath
      );
    }


    return res.status(404).send(
      "Atharv AI frontend not found."
    );

  }
);


/* =====================================================
   404 API
===================================================== */

app.use(
  "/api/",
  (req,res) => {

    res.status(404).json({

      ok:false,

      error:
        "API endpoint not found."

    });

  }
);


/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
  (error,req,res,next) => {

    console.error(
      "EXPRESS ERROR:",
      error
    );


    if(res.headersSent){

      return next(error);
    }


    res.status(
      error.status || 500
    ).json({

      ok:false,

      error:
        error.message ||
        "Internal server error."

    });

  }
);


/* =====================================================
   START SERVER
===================================================== */

async function startServer(){

  await initDatabase();


  app.listen(
    PORT,
    HOST,
    () => {

      console.log(
        "================================================="
      );

      console.log(
        `Atharv AI v${VERSION} started`
      );

      console.log(
        `Server: http://${HOST}:${PORT}`
      );

      console.log(
        `Groq key: ${GROQ_API_KEY ? "configured" : "MISSING"}`
      );

      console.log(
        `Primary model: ${PRIMARY_MODEL}`
      );

      console.log(
        `Fallback model: ${FALLBACK_MODEL}`
      );

      console.log(
        `Tavily: ${TAVILY_API_KEY ? "configured" : "disabled"}`
      );

      console.log(
        `Database: ${pool ? "connected/configured" : "disabled"}`
      );

      console.log(
        "================================================="
      );

    }
  );

}


startServer()
  .catch(
    error => {

      console.error(
        "SERVER START ERROR:",
        error
      );

      process.exit(1);
    }
  );


/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

async function shutdown(
  signal
){

  console.log(
    `${signal} received. Shutting down...`
  );


  try{

    if(pool){

      await pool.end();
    }

  }catch(error){

    console.error(
      "Database shutdown error:",
      error.message
    );
  }


  process.exit(0);
}


process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);


process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);


/* =====================================================
   EXPORT
===================================================== */

module.exports = app;
