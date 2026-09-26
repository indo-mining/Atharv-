"use strict";

const { Pool } = require("pg");
const config = require("../config");

let pool = null;

if (config.databaseUrl) {
  pool = new Pool({
    connectionString: config.databaseUrl,

    ssl: {
      rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
  });

  pool.on("error", (error) => {
    console.error("POSTGRES POOL ERROR:", error);
  });
}

async function initDatabase() {
  if (!pool) {
    console.log("DATABASE: DATABASE_URL not configured.");
    return false;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_memories (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        memory TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_user_id
      ON user_memories(user_id);
    `);

    console.log("DATABASE: initialized successfully.");

    return true;
  } catch (error) {
    console.error("DATABASE INIT ERROR:", error);
    throw error;
  }
}

async function query(text, params = []) {
  if (!pool) {
    throw new Error("Database is not configured.");
  }

  return pool.query(text, params);
}

async function getClient() {
  if (!pool) {
    throw new Error("Database is not configured.");
  }

  return pool.connect();
}

async function closeDatabase() {
  if (!pool) return;

  await pool.end();
  pool = null;
}

function isDatabaseAvailable() {
  return Boolean(pool);
}

module.exports = {
  initDatabase,
  query,
  getClient,
  closeDatabase,
  isDatabaseAvailable
};
