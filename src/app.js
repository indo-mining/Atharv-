"use strict";

/*
=========================================================
 ATHARV AI - BACKEND SERVER
 Version 21.1.0
 --------------------------------------------------------
 - Express 5 compatible
 - Groq AI
 - Tavily Live Research
 - PostgreSQL / Neon Memory
 - Weather
 - CORS
 - Helmet
 - Compression
 - Rate limiting
 - Static frontend
 - Health / Version APIs
=========================================================
*/

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

let Pool = null;

try {
    ({ Pool } = require("pg"));
} catch {
    console.warn("⚠️ pg package not installed. Database memory disabled.");
}

/* ======================================================
   CONFIG
====================================================== */

const app = express();

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const GROQ_MODEL =
    process.env.GROQ_MODEL ||
    "openai/gpt-oss-120b";

const GROQ_FALLBACK_MODEL =
    process.env.GROQ_FALLBACK_MODEL ||
    "openai/gpt-oss-20b";

const TAVILY_API_KEY =
    process.env.TAVILY_API_KEY || "";

const DATABASE_URL =
    process.env.DATABASE_URL || "";

const VERSION = "21.1.0";

const GROQ_TIMEOUT_MS = 150000;
const MAX_MESSAGE_CHARS = 12000;
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_CHARS = 12000;

/* ======================================================
   PATHS
====================================================== */

const ROOT_DIR = path.resolve(__dirname, "..");

const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const INDEX_FILE = path.join(
    PUBLIC_DIR,
    "index.html"
);

/* ======================================================
   BASIC CHECK
====================================================== */

console.log("");
console.log("==========================================");
console.log("        ATHARV AI BACKEND");
console.log("==========================================");
console.log("Version:", VERSION);
console.log("Node:", process.version);
console.log("Port:", PORT);
console.log("Groq:", GROQ_API_KEY ? "Configured" : "Missing");
console.log("Tavily:", TAVILY_API_KEY ? "Configured" : "Missing");
console.log("Database:", DATABASE_URL ? "Configured" : "Missing");
console.log("Public:", PUBLIC_DIR);
console.log("==========================================");
console.log("");

/* ======================================================
   MIDDLEWARE
====================================================== */

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(
    cors({
        origin: true,
        credentials: false
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

/* ======================================================
   SIMPLE RATE LIMIT
====================================================== */

const rateStore = new Map();

const RATE_WINDOW = 60 * 1000;
const RATE_LIMIT = 30;

function rateLimit(req, res, next) {

    const ip =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "unknown";

    const now = Date.now();

    let data = rateStore.get(ip);

    if (!data || now - data.time > RATE_WINDOW) {
        data = {
            time: now,
            count: 0
        };
    }

    data.count++;

    rateStore.set(ip, data);

    if (data.count > RATE_LIMIT) {
        return res.status(429).json({
            ok: false,
            error: "Too many requests. Please try again shortly."
        });
    }

    next();
}

app.use("/api", rateLimit);

/* ======================================================
   DATABASE
====================================================== */

let pool = null;

if (Pool && DATABASE_URL) {

    try {

        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            },
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        });

        pool.on("error", err => {
            console.error(
                "DATABASE POOL ERROR:",
                err.message
            );
        });

        console.log("✅ PostgreSQL pool created.");

    } catch (error) {

        console.error(
            "❌ PostgreSQL initialization failed:",
            error.message
        );

        pool = null;
    }
}

/* ======================================================
   DATABASE INITIALIZATION
====================================================== */

async function initDatabase() {

    if (!pool) {
        console.log(
            "ℹ️ Database unavailable. Memory will use fallback mode."
        );
        return;
    }

    try {

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_memories (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                memory_key TEXT NOT NULL,
                memory_value TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, memory_key)
            )
        `);

        console.log(
            "✅ user_memories table ready."
        );

    } catch (error) {

        console.error(
            "❌ Database initialization error:",
            error.message
        );
    }
}

/* ======================================================
   FALLBACK MEMORY
====================================================== */

const memoryFallback = new Map();

function normalizeUserId(value) {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {
        return "guest";
    }

    return value
        .trim()
        .slice(0, 120);
}

/* ======================================================
   MEMORY - GET
====================================================== */

async function getMemories(
    userId,
    limit = 20
) {

    userId = normalizeUserId(userId);

    if (pool) {

        try {

            const result = await pool.query(
                `
                SELECT
                    memory_key,
                    memory_value,
                    created_at,
                    updated_at
                FROM user_memories
                WHERE user_id = $1
                ORDER BY updated_at DESC
                LIMIT $2
                `,
                [userId, limit]
            );

            return result.rows;

        } catch (error) {

            console.error(
                "Memory read error:",
                error.message
            );
        }
    }

    const local =
        memoryFallback.get(userId) || {};

    return Object.entries(local)
        .slice(-limit)
        .map(([memory_key, memory_value]) => ({
            memory_key,
            memory_value
        }));
}

/* ======================================================
   MEMORY - SAVE
====================================================== */

async function saveMemory(
    userId,
    key,
    value
) {

    userId = normalizeUserId(userId);

    key = String(key || "")
        .trim()
        .slice(0, 200);

    value = String(value || "")
        .trim()
        .slice(0, 2000);

    if (!key || !value) {
        return false;
    }

    if (pool) {

        try {

            await pool.query(
                `
                INSERT INTO user_memories
                    (
                        user_id,
                        memory_key,
                        memory_value,
                        created_at,
                        updated_at
                    )
                VALUES
                    ($1, $2, $3, NOW(), NOW())

                ON CONFLICT(user_id, memory_key)
                DO UPDATE SET
                    memory_value = EXCLUDED.memory_value,
                    updated_at = NOW()
                `,
                [
                    userId,
                    key,
                    value
                ]
            );

            return true;

        } catch (error) {

            console.error(
                "Memory save error:",
                error.message
            );
        }
    }

    if (!memoryFallback.has(userId)) {
        memoryFallback.set(userId, {});
    }

    memoryFallback
        .get(userId)[key] = value;

    return true;
}

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
        service: "Atharv AI",
        version: VERSION,
        status: "healthy",
        groq: Boolean(GROQ_API_KEY),
        tavily: Boolean(TAVILY_API_KEY),
        database,
        timestamp: new Date().toISOString()
    });
});

/* ======================================================
   VERSION
====================================================== */

app.get("/api/version", (req, res) => {

    res.json({
        ok: true,
        app: "Atharv AI",
        version: VERSION,
        backend: "online"
    });
});

/* ======================================================
   GROQ REQUEST
====================================================== */

async function callGroq(
    messages,
    model
) {

    if (!GROQ_API_KEY) {

        throw new Error(
            "GROQ_API_KEY is not configured on the server."
        );
    }

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            GROQ_TIMEOUT_MS
        );

    try {

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${GROQ_API_KEY}`
                },

                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.2,
                    max_tokens: 4096
                }),

                signal: controller.signal
            }
        );

        const raw =
            await response.text();

        let data;

        try {
            data = JSON.parse(raw);
        } catch {
            data = {
                raw
            };
        }

        if (!response.ok) {

            const errorMessage =
                data?.error?.message ||
                data?.message ||
                raw ||
                `Groq HTTP ${response.status}`;

            const error =
                new Error(errorMessage);

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

    } finally {

        clearTimeout(timeout);
    }
}

/* ======================================================
   LANGUAGE / SYSTEM PROMPT
====================================================== */

const SYSTEM_PROMPT = `
You are Atharv AI.

Your identity:
- Name: Atharv AI
- Purpose: helpful, accurate, practical AI assistant

Language rules:
1. If the user writes in English, answer in English.
2. If the user writes Hindi in Devanagari, answer in Hindi.
3. If the user writes Roman Hindi/Hinglish, answer in Roman Hindi/Hinglish.
4. If the user uses another language, answer in that language when possible.
5. Do not unnecessarily change the user's language.

Response rules:
- Be clear and useful.
- Do not unnecessarily repeat the user's name.
- For coding questions, provide working code.
- For technical questions, explain simply when needed.
- Do not claim to have live information unless live research data was actually provided.
- If information may have changed, say so when appropriate.
- Never invent sources, facts, API results, or actions.
`;

/* ======================================================
   NORMALIZE HISTORY
====================================================== */

function normalizeMessages(
    history,
    userMessage
) {

    const result = [
        {
            role: "system",
            content: SYSTEM_PROMPT
        }
    ];

    if (Array.isArray(history)) {

        for (
            const item of history.slice(-MAX_HISTORY_ITEMS)
        ) {

            if (!item) continue;

            const role =
                item.role === "assistant"
                    ? "assistant"
                    : item.role === "user"
                        ? "user"
                        : null;

            if (!role) continue;

            let content =
                item.content ??
                item.message ??
                item.text ??
                "";

            if (
                typeof content !== "string" ||
                !content.trim()
            ) {
                continue;
            }

            content =
                content.slice(
                    0,
                    MAX_HISTORY_CHARS
                );

            result.push({
                role,
                content
            });
        }
    }

    result.push({
        role: "user",
        content: userMessage
    });

    return result;
}

/* ======================================================
   CHAT
====================================================== */

app.post("/api/chat", async (req, res) => {

    try {

        const message =
            typeof req.body?.message === "string"
                ? req.body.message.trim()
                : "";

        if (!message) {

            return res.status(400).json({
                ok: false,
                error: "Message is required."
            });
        }

        if (
            message.length >
            MAX_MESSAGE_CHARS
        ) {

            return res.status(400).json({
                ok: false,
                error:
                    `Message is too long. Maximum ${MAX_MESSAGE_CHARS} characters.`
            });
        }

        const userId =
            normalizeUserId(
                req.body?.userId
            );

        const history =
            Array.isArray(req.body?.history)
                ? req.body.history
                : [];

        const memories =
            await getMemories(
                userId,
                10
            );

        let memoryText = "";

        if (memories.length) {

            memoryText =
                "\n\nKnown user memories:\n" +
                memories
                    .map(
                        item =>
                            `- ${item.memory_key}: ${item.memory_value}`
                    )
                    .join("\n");
        }

        const messages =
            normalizeMessages(
                history,
                message
            );

        if (memoryText) {

            messages[0].content +=
                memoryText;
        }

        let reply;

        try {

            reply =
                await callGroq(
                    messages,
                    GROQ_MODEL
                );

        } catch (primaryError) {

            console.error(
                "Primary Groq model failed:",
                primaryError.message
            );

            if (
                GROQ_FALLBACK_MODEL &&
                GROQ_FALLBACK_MODEL !== GROQ_MODEL
            ) {

                console.log(
                    "Trying fallback model:",
                    GROQ_FALLBACK_MODEL
                );

                reply =
                    await callGroq(
                        messages,
                        GROQ_FALLBACK_MODEL
                    );

            } else {

                throw primaryError;
            }
        }

        return res.json({
            ok: true,
            reply,
            message: reply,
            content: reply
        });

    } catch (error) {

        console.error(
            "CHAT ERROR:",
            error
        );

        const status =
            error?.name === "AbortError"
                ? 504
                : error?.status >= 400 &&
                    error?.status < 600
                    ? error.status
                    : 500;

        const message =
            error?.name === "AbortError"
                ? "AI request timed out. Please try again."
                : error?.message ||
                    "AI request failed.";

        return res.status(status).json({
            ok: false,
            error: message
        });
    }
});

/* ======================================================
   TAVILY RESEARCH
====================================================== */

async function tavilySearch(query) {

    if (!TAVILY_API_KEY) {
        return [];
    }

    const controller =
        new AbortController();

    const timeout =
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
                        query,
                        search_depth: "advanced",
                        max_results: 6,
                        include_answer: true,
                        include_raw_content: false
                    }),

                    signal: controller.signal
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Tavily search failed."
            );
        }

        return {
            answer:
                data?.answer || "",
            results:
                Array.isArray(data?.results)
                    ? data.results
                    : []
        };

    } finally {

        clearTimeout(timeout);
    }
}

/* ======================================================
   RESEARCH CHAT
====================================================== */

app.post(
    "/api/chat/research",
    async (req, res) => {

        try {

            const query =
                typeof req.body?.message === "string"
                    ? req.body.message.trim()
                    : "";

            if (!query) {

                return res.status(400).json({
                    ok: false,
                    error: "Research query is required."
                });
            }

            if (!TAVILY_API_KEY) {

                return res.status(503).json({
                    ok: false,
                    error:
                        "Live Search is not configured on the server."
                });
            }

            const search =
                await tavilySearch(query);

            const sources =
                search.results || [];

            const researchText =
                sources
                    .map((item, index) => {

                        return `
SOURCE ${index + 1}
Title: ${item.title || ""}
URL: ${item.url || ""}
Content: ${(
                            item.content || ""
                        ).slice(0, 3500)}
`;
                    })
                    .join("\n");

            const researchPrompt = `
Answer the user's question using the live research below.

User question:
${query}

Live research:
${researchText}

Important:
- Use only information supported by the research.
- If sources disagree, mention the disagreement.
- Do not invent facts.
- Keep the user's language.
- Give useful source links when available.
`;

            const messages = [
                {
                    role: "system",
                    content: SYSTEM_PROMPT
                },
                {
                    role: "user",
                    content: researchPrompt
                }
            ];

            let reply;

            try {

                reply =
                    await callGroq(
                        messages,
                        GROQ_MODEL
                    );

            } catch {

                reply =
                    await callGroq(
                        messages,
                        GROQ_FALLBACK_MODEL
                    );
            }

            return res.json({
                ok: true,
                reply,
                message: reply,
                content: reply,
                sources: sources.map(item => ({
                    title: item.title || "",
                    url: item.url || "",
                    content:
                        item.content || ""
                }))
            });

        } catch (error) {

            console.error(
                "RESEARCH ERROR:",
                error
            );

            return res.status(500).json({
                ok: false,
                error:
                    error?.message ||
                    "Live research failed."
            });
        }
    }
);

/* ======================================================
   MEMORY GET
====================================================== */

app.get("/api/memory", async (req, res) => {

    try {

        const userId =
            normalizeUserId(
                req.query?.userId
            );

        const memories =
            await getMemories(
                userId,
                50
            );

        return res.json({
            ok: true,
            memories
        });

    } catch (error) {

        console.error(
            "MEMORY GET ERROR:",
            error.message
        );

        return res.status(500).json({
            ok: false,
            error: "Unable to load memories."
        });
    }
});

/* ======================================================
   MEMORY POST
====================================================== */

app.post("/api/memory", async (req, res) => {

    try {

        const userId =
            normalizeUserId(
                req.body?.userId
            );

        const key =
            req.body?.key ||
            req.body?.memory_key ||
            req.body?.name;

        const value =
            req.body?.value ||
            req.body?.memory_value ||
            req.body?.content;

        if (!key || !value) {

            return res.status(400).json({
                ok: false,
                error:
                    "Memory key and value are required."
            });
        }

        const saved =
            await saveMemory(
                userId,
                key,
                value
            );

        return res.json({
            ok: saved,
            message: saved
                ? "Memory saved."
                : "Memory was not saved."
        });

    } catch (error) {

        console.error(
            "MEMORY POST ERROR:",
            error.message
        );

        return res.status(500).json({
            ok: false,
            error: "Unable to save memory."
        });
    }
});

/* ======================================================
   WEATHER
====================================================== */

app.get("/api/weather", async (req, res) => {

    try {

        const city =
            String(
                req.query?.city || ""
            ).trim();

        if (!city) {

            return res.status(400).json({
                ok: false,
                error: "City is required."
            });
        }

        /*
         * Open-Meteo geocoding does not require
         * an API key.
         */

        const geoUrl =
            "https://geocoding-api.open-meteo.com/v1/search" +
            `?name=${encodeURIComponent(city)}` +
            "&count=1" +
            "&language=en" +
            "&format=json";

        const geoResponse =
            await fetch(geoUrl);

        const geo =
            await geoResponse.json();

        const place =
            geo?.results?.[0];

        if (!place) {

            return res.status(404).json({
                ok: false,
                error: "City not found."
            });
        }

        const weatherUrl =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${place.latitude}` +
            `&longitude=${place.longitude}` +
            "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m" +
            "&timezone=auto";

        const weatherResponse =
            await fetch(weatherUrl);

        const weather =
            await weatherResponse.json();

        return res.json({
            ok: true,
            location: {
                name: place.name,
                country: place.country,
                latitude: place.latitude,
                longitude: place.longitude
            },
            current:
                weather.current || null
        });

    } catch (error) {

        console.error(
            "WEATHER ERROR:",
            error.message
        );

        return res.status(500).json({
            ok: false,
            error: "Weather request failed."
        });
    }
});

/* ======================================================
   STATIC FRONTEND
====================================================== */

if (fs.existsSync(PUBLIC_DIR)) {

    app.use(
        express.static(
            PUBLIC_DIR,
            {
                extensions: ["html"]
            }
        )
    );

} else {

    console.warn(
        "⚠️ public directory not found:",
        PUBLIC_DIR
    );
}

/* ======================================================
   API 404
====================================================== */

app.use("/api", (req, res) => {

    res.status(404).json({
        ok: false,
        error: "API endpoint not found."
    });
});

/* ======================================================
   FRONTEND FALLBACK
   Express 5 compatible
====================================================== */

app.use((req, res, next) => {

    if (
        req.method === "GET" &&
        !req.path.startsWith("/api/")
    ) {

        if (fs.existsSync(INDEX_FILE)) {

            return res.sendFile(
                INDEX_FILE
            );
        }
    }

    next();
});

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (res.headersSent) {
            return next(error);
        }

        res.status(
            error?.status || 500
        ).json({
            ok: false,
            error:
                error?.message ||
                "Internal server error."
        });
    }
);

/* ======================================================
   START SERVER
====================================================== */

let server = null;

async function startServer() {

    await initDatabase();

    server =
        app.listen(
            PORT,
            HOST,
            () => {

                console.log("");
                console.log(
                    "🚀 Atharv AI server started"
                );

                console.log(
                    `🌐 Port: ${PORT}`
                );

                console.log(
                    `📁 Public: ${PUBLIC_DIR}`
                );

                console.log(
                    `🤖 Groq model: ${GROQ_MODEL}`
                );

                console.log(
                    `🔎 Live Search: ${
                        TAVILY_API_KEY
                            ? "ON"
                            : "OFF"
                    }`
                );

                console.log(
                    `🧠 Database Memory: ${
                        pool
                            ? "ON"
                            : "OFF"
                    }`
                );

                console.log("");
            }
        );
}

/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */

async function shutdown(
    signal
) {

    console.log(
        `\n${signal} received. Shutting down...`
    );

    try {

        if (server) {

            await new Promise(resolve => {
                server.close(resolve);
            });
        }

        if (pool) {
            await pool.end();
        }

    } catch (error) {

        console.error(
            "Shutdown error:",
            error.message
        );

    } finally {

        process.exit(0);
    }
}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

/* ======================================================
   START
====================================================== */

startServer().catch(error => {

    console.error(
        "❌ FATAL SERVER ERROR:",
        error
    );

    process.exit(1);
});
