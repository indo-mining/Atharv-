"use strict";

const config = {
  version: "17.0.0",

  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 10000,

  groqApiKey: process.env.GROQ_API_KEY || "",

  groqPrimaryModel:
    process.env.GROQ_PRIMARY_MODEL || "openai/gpt-oss-120b",

  groqFallbackModel:
    process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b",

  tavilyApiKey:
    process.env.TAVILY_API_KEY || "",

  databaseUrl:
    process.env.DATABASE_URL || "",

  allowedOrigins:
    process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      : [],

  maxMessageLength:
    Number(process.env.MAX_MESSAGE_LENGTH) || 12000,

  maxHistoryMessages:
    Number(process.env.MAX_HISTORY_MESSAGES) || 30,

  maxHistoryChars:
    Number(process.env.MAX_HISTORY_CHARS) || 30000,

  maxMemoryLength:
    Number(process.env.MAX_MEMORY_LENGTH) || 1000,

  rateLimitWindowMs:
    Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,

  rateLimitMax:
    Number(process.env.RATE_LIMIT_MAX) || 60,

  trustProxy:
    String(process.env.TRUST_PROXY).toLowerCase() === "true"
};

module.exports = config;
