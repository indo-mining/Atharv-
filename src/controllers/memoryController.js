"use strict";

const config = require("../config");

const {
  query,
  isDatabaseAvailable
} = require("../db/postgres");

const {
  cleanText,
  normalizeUserId
} = require("../utils/text");

async function getMemories(
  userId,
  options = {}
) {
  if (!isDatabaseAvailable()) {
    if (options.silent) {
      return [];
    }

    return [];
  }

  const id =
    normalizeUserId(userId);

  const limit = Math.min(
    Number(options.limit) || 50,
    100
  );

  const result = await query(
    `
      SELECT
        id,
        user_id,
        memory,
        created_at
      FROM user_memories
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [id, limit]
  );

  return result.rows;
}

async function listMemories(req, res) {
  const userId =
    normalizeUserId(
      req.query.userId ||
      req.headers["x-user-id"]
    );

  const memories =
    await getMemories(userId);

  return res.json({
    success: true,
    memories
  });
}

async function addMemory(req, res) {
  if (!isDatabaseAvailable()) {
    return res.status(503).json({
      success: false,
      error: "Memory database is not configured."
    });
  }

  const userId =
    normalizeUserId(
      req.body?.userId ||
      req.headers["x-user-id"]
    );

  const memory =
    cleanText(
      req.body?.memory,
      config.maxMemoryLength
    );

  if (!memory) {
    return res.status(400).json({
      success: false,
      error: "Memory is required."
    });
  }

  const result = await query(
    `
      INSERT INTO user_memories
        (user_id, memory)
      VALUES
        ($1, $2)
      RETURNING
        id,
        user_id,
        memory,
        created_at
    `,
    [userId, memory]
  );

  return res.status(201).json({
    success: true,
    memory: result.rows[0]
  });
}

async function deleteMemories(req, res) {
  if (!isDatabaseAvailable()) {
    return res.status(503).json({
      success: false,
      error: "Memory database is not configured."
    });
  }

  const userId =
    normalizeUserId(
      req.query.userId ||
      req.body?.userId ||
      req.headers["x-user-id"]
    );

  const id = req.query.id;

  if (id) {
    await query(
      `
        DELETE FROM user_memories
        WHERE id = $1
        AND user_id = $2
      `,
      [id, userId]
    );
  } else {
    await query(
      `
        DELETE FROM user_memories
        WHERE user_id = $1
      `,
      [userId]
    );
  }

  return res.json({
    success: true,
    message: "Memory deleted."
  });
}

module.exports = {
  getMemories,
  listMemories,
  addMemory,
  deleteMemories
};
