"use strict";

/*
=========================================================
 ATHARV AI - BACKEND
 Version 22.0.0
 --------------------------------------------------------
 - Express 5
 - Groq AI
 - Optional Tavily live research
 - PostgreSQL persistent memory
 - In-memory memory fallback
 - Weather API
 - CORS
 - Helmet
 - Compression
 - Rate limiting
 - Graceful shutdown
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
    console.warn("pg package not available. Database memory will use fallback.");
}

/* ======================================================
   CONFIG
====================================================== */

const app = express();

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";

const VERSION = "22.0.0";

const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();

const GROQ_MODEL =
    String(
        process.env.GROQ_MODEL ||
        "openai/gpt-oss-120b"
    ).trim();

const GROQ_FALLBACK_MODEL =
    String(
        process.env.GROQ_FALLBACK_MODEL ||
        "openai/gpt-oss-20b"
    ).trim();

const TAVILY_API_KEY =
    String(process.env.TAVILY_API_KEY || "").trim();

const DATABASE_URL =
    String(process.env.DATABASE_URL || "").trim();

const GROQ_TIMEOUT_MS = 150000;

const MAX_MESSAGE_CHARS = 12000;
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_CHARS = 12000;

const MAX_RESEARCH_CHARS = 7000;

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const INDEX_FILE = path.join(PUBLIC_DIR, "index.html");

/* ======================================================
   BASIC CHECK
====================================================== */

if (!fs.existsSync(PUBLIC_DIR)) {
    console.warn("WARNING: public directory not found:", PUBLIC_DIR);
}

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

app.use(compression());

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

const rateMap = new Map();

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;

function rateLimit(req, res, next) {
    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

    const now = Date.now();

    let record = rateMap.get(ip);

    if (!record || now - record.start > RATE_WINDOW_MS) {
        record = {
            start: now,
            count: 0
        };
    }

    record.count += 1;

    rateMap.set(ip, record);

    if (record.count > RATE_LIMIT) {
        return res.status(429).json({
            ok: false,
            error: "Too many requests. Please wait a moment."
        });
    }

    next();
}

app.use("/api", rateLimit);

/* ======================================================
   MEMORY
====================================================== */

let pool = null;

const memoryFallback = new Map();

function normalizeUserId(value) {
    const raw = String(value || "guest").trim();

    if (!raw) {
        return "guest";
    }

    return raw
        .replace(/[^a-zA-Z0-9_.-]/g, "_")
        .slice(0, 120) || "guest";
}

function normalizeMemoryKey(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 100);
}

function normalizeMemoryValue(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 1000);
}

/* ======================================================
   DATABASE INIT
====================================================== */

async function initDatabase() {
    if (!DATABASE_URL || !Pool) {
        console.log("Database unavailable. Using memory fallback.");
        return;
    }

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

        console.log("PostgreSQL connected.");
    } catch (error) {
        console.error("Database initialization failed:", error.message);
        pool = null;
    }
}

/* ======================================================
   MEMORY FUNCTIONS
====================================================== */

async function getMemories(userId, limit = 20) {
    const uid = normalizeUserId(userId);

    if (pool) {
        try {
            const result = await pool.query(
                `
                SELECT memory_key, memory_value
                FROM user_memories
                WHERE user_id = $1
                ORDER BY updated_at DESC
                LIMIT $2
                `,
                [uid, limit]
            );

            return result.rows;
        } catch (error) {
            console.error("Memory GET DB error:", error.message);
        }
    }

    const userMemory = memoryFallback.get(uid);

    if (!userMemory) {
        return [];
    }

    return Array.from(userMemory.entries())
        .slice(-limit)
        .reverse()
        .map(([memory_key, memory_value]) => ({
            memory_key,
            memory_value
        }));
}

async function saveMemory(userId, key, value) {
    const uid = normalizeUserId(userId);
    const memoryKey = normalizeMemoryKey(key);
    const memoryValue = normalizeMemoryValue(value);

    if (!memoryKey || !memoryValue) {
        throw new Error("Memory key and value are required.");
    }

    if (pool) {
        try {
            await pool.query(
                `
                INSERT INTO user_memories
                    (user_id, memory_key, memory_value)
                VALUES
                    ($1, $2, $3)
                ON CONFLICT (user_id, memory_key)
                DO UPDATE SET
                    memory_value = EXCLUDED.memory_value,
                    updated_at = NOW()
                `,
                [uid, memoryKey, memoryValue]
            );

            return;
        } catch (error) {
            console.error("Memory SAVE DB error:", error.message);
        }
    }

    if (!memoryFallback.has(uid)) {
        memoryFallback.set(uid, new Map());
    }

    memoryFallback
        .get(uid)
        .set(memoryKey, memoryValue);
}

/* ======================================================
   SYSTEM PROMPT
====================================================== */

function getSystemPrompt(memories = []) {
    let memoryText = "";

    if (memories.length) {
        memoryText = memories
            .map(
                item =>
                    `${item.memory_key}: ${item.memory_value}`
            )
            .join("\n");
    }

    return `
You are Atharv AI.

Your identity:
- Your name is Atharv AI.
- Be helpful, accurate, clear and practical.
- Do not unnecessarily repeat the user's name.
- Do not claim to have performed an action you did not perform.
- If information may be current or changing, use available research when requested.

Language rules:
- If the user writes English, answer in English.
- If the user writes Hindi in Devanagari, answer in Hindi.
- If the user writes Roman Hindi/Hinglish, answer in Roman Hindi/Hinglish.
- If the user mixes languages, naturally follow the user's dominant language.
- Do not unnecessarily convert Roman Hindi into Devanagari.
- For code, preserve code syntax and explain in the user's language where useful.

Answer style:
- Directly answer the question.
- Use headings, bullets and code blocks when useful.
- Avoid unnecessary filler.
- For programming, provide complete working code when requested.
- If something is uncertain, say so clearly.

Persistent user memory:
${memoryText || "No saved memories."}
`;
}

/* ======================================================
   MESSAGE NORMALIZATION
====================================================== */

function normalizeMessages(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    let totalChars = 0;

    const output = [];

    for (
        let i = history.length - 1;
        i >= 0 && output.length < MAX_HISTORY_ITEMS;
        i--
    ) {
        const item = history[i];

        if (!item || typeof item !== "object") {
            continue;
        }

        const role =
            item.role === "assistant"
                ? "assistant"
                : item.role === "user"
                    ? "user"
                    : null;

        if (!role) {
            continue;
        }

        const content = String(
            item.content ||
            item.message ||
            item.text ||
            ""
        )
            .trim()
            .slice(0, MAX_HISTORY_CHARS);

        if (!content) {
            continue;
        }

        if (
            totalChars + content.length >
            MAX_HISTORY_CHARS
        ) {
            break;
        }

        output.unshift({
            role,
            content
        });

        totalChars += content.length;
    }

    return output;
}

/* ======================================================
   GROQ
====================================================== */

async function callGroq(messages, model) {
    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is not configured on the server."
        );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, GROQ_TIMEOUT_MS);

    try {
        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization:
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

        const text = await response.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch {
            data = {
                raw: text
            };
        }

        if (!response.ok) {
            const errorMessage =
                data?.error?.message ||
                data?.message ||
                data?.raw ||
                `Groq HTTP ${response.status}`;

            throw new Error(errorMessage);
        }

        const content =
            data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error(
                "Groq returned an empty response."
            );
        }

        return String(content).trim();
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                "Groq request timed out. Please try again."
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

/* ======================================================
   CHAT
====================================================== */

async function generateAnswer({
    message,
    history,
    userId
}) {
    const memories = await getMemories(
        userId,
        20
    );

    const normalizedHistory =
        normalizeMessages(history);

    const systemPrompt =
        getSystemPrompt(memories);

    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        ...normalizedHistory,
        {
            role: "user",
            content: message
        }
    ];

    try {
        return await callGroq(
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
            try {
                return await callGroq(
                    messages,
                    GROQ_FALLBACK_MODEL
                );
            } catch (fallbackError) {
                console.error(
                    "Fallback Groq model failed:",
                    fallbackError.message
                );

                throw new Error(
                    `AI request failed: ${fallbackError.message}`
                );
            }
        }

        throw primaryError;
    }
}

/* ======================================================
   HEALTH
====================================================== */

app.get("/health", async (req, res) => {
    let database = false;

    if (pool) {
        try {
            await pool.query("SELECT 1");
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
        uptime: Math.round(process.uptime())
    });
});

/* ======================================================
   VERSION
====================================================== */

app.get("/api/version", (req, res) => {
    res.json({
        ok: true,
        version: VERSION,
        service: "Atharv AI",
        model: GROQ_MODEL
    });
});

/* ======================================================
   CHAT API
====================================================== */

app.post("/api/chat", async (req, res) => {
    try {
        const message = String(
            req.body?.message || ""
        ).trim();

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

        const history =
            Array.isArray(req.body?.history)
                ? req.body.history
                : [];

        const userId = normalizeUserId(
            req.body?.userId
        );

        const reply = await generateAnswer({
            message,
            history,
            userId
        });

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

        return res.status(500).json({
            ok: false,
            error:
                error?.message ||
                "Unable to generate a response."
        });
    }
});

/* ======================================================
   TAVILY SEARCH
====================================================== */

async function tavilySearch(query) {
    if (!TAVILY_API_KEY) {
        throw new Error(
            "TAVILY_API_KEY is not configured."
        );
    }

    const response = await fetch(
        "https://api.tavily.com/search",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query,
                search_depth: "advanced",
                include_answer: true,
                include_raw_content: false,
                max_results: 5
            })
        }
    );

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            "Invalid response from search service."
        );
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            `Search HTTP ${response.status}`
        );
    }

    return data;
}

/* ======================================================
   RESEARCH CHAT
====================================================== */

app.post("/api/chat/research", async (req, res) => {
    try {
        const message = String(
            req.body?.message || ""
        ).trim();

        if (!message) {
            return res.status(400).json({
                ok: false,
                error: "Message is required."
            });
        }

        if (!TAVILY_API_KEY) {
            return res.status(503).json({
                ok: false,
                error:
                    "Live Search is not configured. Add TAVILY_API_KEY in Render environment variables."
            });
        }

        const searchData =
            await tavilySearch(message);

        const sources =
            Array.isArray(searchData?.results)
                ? searchData.results
                : [];

        const researchText = sources
            .map((item, index) => {
                const title =
                    String(item?.title || "")
                        .slice(0, 300);

                const content =
                    String(
                        item?.content ||
                        item?.snippet ||
                        ""
                    ).slice(
                        0,
                        MAX_RESEARCH_CHARS
                    );

                const url =
                    String(item?.url || "");

                return `
Source ${index + 1}
Title: ${title}
URL: ${url}
Content: ${content}
`;
            })
            .join("\n");

        const userId = normalizeUserId(
            req.body?.userId
        );

        const memories = await getMemories(
            userId,
            20
        );

        const history =
            normalizeMessages(
                req.body?.history
            );

        const system =
            getSystemPrompt(memories) +
            `

Live research instructions:
- Use the supplied search results as evidence.
- Clearly distinguish facts from uncertainty.
- Do not invent information.
- When useful, mention the source website naturally.
- Answer in the user's language.

SEARCH RESULTS:
${researchText || "No search results available."}
`;

        const answer = await callGroq(
            [
                {
                    role: "system",
                    content: system
                },
                ...history,
                {
                    role: "user",
                    content: message
                }
            ],
            GROQ_MODEL
        );

        return res.json({
            ok: true,
            reply: answer,
            message: answer,
            content: answer,
            sources: sources.map(item => ({
                title: item?.title || "",
                url: item?.url || ""
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
});

/* ======================================================
   MEMORY GET
====================================================== */

app.get("/api/memory", async (req, res) => {
    try {
        const userId = normalizeUserId(
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
            error
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
        const userId = normalizeUserId(
            req.body?.userId
        );

        const key = normalizeMemoryKey(
            req.body?.key ||
            req.body?.memory_key
        );

        const value = normalizeMemoryValue(
            req.body?.value ||
            req.body?.memory_value
        );

        if (!key || !value) {
            return res.status(400).json({
                ok: false,
                error:
                    "Memory key and value are required."
            });
        }

        await saveMemory(
            userId,
            key,
            value
        );

        return res.json({
            ok: true,
            message: "Memory saved.",
            memory: {
                memory_key: key,
                memory_value: value
            }
        });
    } catch (error) {
        console.error(
            "MEMORY POST ERROR:",
            error
        );

        return res.status(500).json({
            ok: false,
            error:
                error?.message ||
                "Unable to save memory."
        });
    }
});

/* ======================================================
   WEATHER
====================================================== */

app.get("/api/weather", async (req, res) => {
    try {
        const latitude = Number(
            req.query?.lat
        );

        const longitude = Number(
            req.query?.lon
        );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return res.status(400).json({
                ok: false,
                error:
                    "Valid latitude and longitude are required."
            });
        }

        const url =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${encodeURIComponent(latitude)}` +
            `&longitude=${encodeURIComponent(longitude)}` +
            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m" +
            "&timezone=auto";

        const response =
            await fetch(url);

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                "Weather service failed."
            );
        }

        return res.json({
            ok: true,
            data
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error:
                error?.message ||
                "Unable to fetch weather."
        });
    }
});

/* ======================================================
   STATIC FRONTEND
====================================================== */

app.use(
    express.static(PUBLIC_DIR, {
        extensions: ["html"],
        maxAge: "1h"
    })
);

/* ======================================================
   FRONTEND FALLBACK
====================================================== */

app.use((req, res, next) => {
    if (
        req.method === "GET" &&
        !req.path.startsWith("/api/")
    ) {
        if (fs.existsSync(INDEX_FILE)) {
            return res.sendFile(INDEX_FILE);
        }
    }

    next();
});

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
   ERROR HANDLER
====================================================== */

app.use((error, req, res, next) => {
    console.error(
        "GLOBAL ERROR:",
        error
    );

    if (res.headersSent) {
        return next(error);
    }

    res.status(
        Number(error?.status) || 500
    ).json({
        ok: false,
        error:
            error?.message ||
            "Internal server error."
    });
});

/* ======================================================
   START
====================================================== */

let server = null;

async function startServer() {
    await initDatabase();

    server = app.listen(
        PORT,
        HOST,
        () => {
            console.log("");
            console.log(
                "=========================================="
            );
            console.log(
                " ATHARV AI SERVER"
            );
            console.log(
                ` VERSION: ${VERSION}`
            );
            console.log(
                ` PORT: ${PORT}`
            );
            console.log(
                ` HOST: ${HOST}`
            );
            console.log(
                ` GROQ: ${GROQ_API_KEY ? "configured" : "missing"}`
            );
            console.log(
                ` TAVILY: ${TAVILY_API_KEY ? "configured" : "missing"}`
            );
            console.log(
                ` DATABASE: ${pool ? "connected" : "fallback"}`
            );
            console.log(
                "=========================================="
            );
            console.log("");
        }
    );
}

/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */

async function shutdown(signal) {
    console.log(
        `${signal} received. Shutting down...`
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

        process.exit(0);
    } catch (error) {
        console.error(
            "Shutdown error:",
            error
        );

        process.exit(1);
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

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "UNHANDLED REJECTION:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );
    }
);

startServer();

module.exports = app;
