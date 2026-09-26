"use strict";

const config = require("../config");

const {
  normalizeHistory,
  normalizeUserId
} = require("../utils/text");

const {
  generateAnswer,
  generateStream,
  researchQuery
} = require("../services/aiService");

const {
  getMemories
} = require("./memoryController");

async function chat(req, res) {
  const {
    message,
    history,
    userId
  } = req.body || {};

  if (
    typeof message !== "string" ||
    !message.trim()
  ) {
    return res.status(400).json({
      success: false,
      error: "Message is required."
    });
  }

  if (
    message.length >
    config.maxMessageLength
  ) {
    return res.status(400).json({
      success: false,
      error: `Message is too long. Maximum ${config.maxMessageLength} characters.`
    });
  }

  const normalizedUserId =
    normalizeUserId(userId);

  const memories =
    await getMemories(
      normalizedUserId,
      {
        limit: 20,
        silent: true
      }
    );

  const result =
    await generateAnswer({
      message,
      history: normalizeHistory(history),
      memories
    });

  return res.json({
    success: true,
    ...result
  });
}

async function streamChat(req, res) {
  const {
    message,
    history,
    userId
  } = req.body || {};

  if (
    typeof message !== "string" ||
    !message.trim()
  ) {
    return res.status(400).json({
      success: false,
      error: "Message is required."
    });
  }

  const normalizedUserId =
    normalizeUserId(userId);

  const memories =
    await getMemories(
      normalizedUserId,
      {
        limit: 20,
        silent: true
      }
    );

  const response =
    await generateStream({
      message,
      history: normalizeHistory(history),
      memories
    });

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

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  if (!response.body) {
    throw new Error(
      "Streaming response body unavailable."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  try {
    while (true) {
      const {
        done,
        value
      } = await reader.read();

      if (done) break;

      const chunk =
        decoder.decode(
          value,
          {
            stream: true
          }
        );

      res.write(chunk);
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}

async function research(req, res) {
  const {
    query
  } = req.body || {};

  if (
    typeof query !== "string" ||
    !query.trim()
  ) {
    return res.status(400).json({
      success: false,
      error: "Query is required."
    });
  }

  const result =
    await researchQuery(query);

  return res.json({
    success: true,
    ...result
  });
}

module.exports = {
  chat,
  streamChat,
  research
};
