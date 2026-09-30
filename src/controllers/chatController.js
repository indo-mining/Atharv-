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

/*
=========================================================
 SAFE MEMORY LOADER
=========================================================
*/

async function loadMemories(userId) {
  try {
    const normalizedUserId =
      normalizeUserId(userId);

    /*
    -------------------------------------------------------
    If no valid user ID exists, do not break chat.
    -------------------------------------------------------
    */

    if (!normalizedUserId) {
      return [];
    }

    const memories =
      await getMemories(
        normalizedUserId,
        {
          limit: 20,
          silent: true
        }
      );

    return Array.isArray(memories)
      ? memories
      : [];
  } catch (error) {
    /*
    -------------------------------------------------------
    Memory failure must NOT stop AI chat.
    -------------------------------------------------------
    */

    console.error(
      "MEMORY LOAD ERROR:",
      error
    );

    return [];
  }
}

/*
=========================================================
 NORMAL CHAT
=========================================================
*/

async function chat(req, res) {
  try {
    const body =
      req.body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    /*
    -------------------------------------------------------
    Support both:
      history
      chatHistory
    -------------------------------------------------------
    */

    const history =
      Array.isArray(body.history)
        ? body.history
        : Array.isArray(body.chatHistory)
          ? body.chatHistory
          : [];

    const userId =
      body.userId ||
      body.user_id ||
      body.sessionId ||
      body.session_id ||
      "";

    /*
    -------------------------------------------------------
    MESSAGE VALIDATION
    -------------------------------------------------------
    */

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required."
      });
    }

    /*
    -------------------------------------------------------
    LENGTH
    -------------------------------------------------------
    */

    if (
      message.length >
      config.maxMessageLength
    ) {
      return res.status(400).json({
        success: false,
        error:
          `Message is too long. Maximum ${config.maxMessageLength} characters.`
      });
    }

    /*
    -------------------------------------------------------
    MEMORY
    -------------------------------------------------------
    */

    const memories =
      await loadMemories(userId);

    /*
    -------------------------------------------------------
    AI
    -------------------------------------------------------
    */

    const result =
      await generateAnswer({
        message,

        history:
          normalizeHistory(history),

        memories
      });

    /*
    -------------------------------------------------------
    RESPONSE
    -------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {

    console.error(
      "CHAT CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Atharv could not generate a response."
    });
  }
}

/*
=========================================================
 STREAM CHAT
=========================================================
*/

async function streamChat(req, res) {
  try {
    const body =
      req.body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const history =
      Array.isArray(body.history)
        ? body.history
        : Array.isArray(body.chatHistory)
          ? body.chatHistory
          : [];

    const userId =
      body.userId ||
      body.user_id ||
      body.sessionId ||
      body.session_id ||
      "";

    /*
    -------------------------------------------------------
    VALIDATION
    -------------------------------------------------------
    */

    if (!message) {
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
        error:
          `Message is too long. Maximum ${config.maxMessageLength} characters.`
      });
    }

    /*
    -------------------------------------------------------
    MEMORY
    -------------------------------------------------------
    */

    const memories =
      await loadMemories(userId);

    /*
    -------------------------------------------------------
    AI STREAM
    -------------------------------------------------------
    */

    const response =
      await generateStream({
        message,

        history:
          normalizeHistory(history),

        memories
      });

    /*
    -------------------------------------------------------
    HEADERS
    -------------------------------------------------------
    */

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/event-stream; charset=utf-8"
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

    /*
    -------------------------------------------------------
    RESPONSE BODY
    -------------------------------------------------------
    */

    if (
      !response ||
      !response.body
    ) {
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
        } =
          await reader.read();

        if (done) {
          break;
        }

        const chunk =
          decoder.decode(
            value,
            {
              stream: true
            }
          );

        if (chunk) {
          res.write(chunk);
        }
      }

      /*
      -----------------------------------------------------
      Flush final decoder data
      -----------------------------------------------------
      */

      const finalChunk =
        decoder.decode();

      if (finalChunk) {
        res.write(finalChunk);
      }

    } finally {
      reader.releaseLock();

      if (!res.writableEnded) {
        res.end();
      }
    }

  } catch (error) {

    console.error(
      "STREAM CHAT ERROR:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Streaming response failed."
      });
    }

    if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({
          error:
            error?.message ||
            "Streaming response failed."
        })}\n\n`
      );

      res.end();
    }
  }
}

/*
=========================================================
 LIVE / RESEARCH
=========================================================
*/

async function research(req, res) {
  try {
    const body =
      req.body || {};

    /*
    -------------------------------------------------------
    Accept:
      query
      message
    -------------------------------------------------------
    */

    const query =
      typeof body.query === "string"
        ? body.query.trim()
        : typeof body.message === "string"
          ? body.message.trim()
          : "";

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required."
      });
    }

    if (
      query.length >
      config.maxMessageLength
    ) {
      return res.status(400).json({
        success: false,
        error:
          `Query is too long. Maximum ${config.maxMessageLength} characters.`
      });
    }

    /*
    -------------------------------------------------------
    TAVILY / RESEARCH
    -------------------------------------------------------
    */

    const result =
      await researchQuery(query);

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {

    console.error(
      "RESEARCH CONTROLLER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Live research failed."
    });
  }
}

/*
=========================================================
 EXPORT
=========================================================
*/

module.exports = {
  chat,
  streamChat,
  research
};
