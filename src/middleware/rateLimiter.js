"use strict";

const rateLimit = require("express-rate-limit");
const config = require("../config");

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,

  limit: config.rateLimitMax,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  skip: (req) => {
    return (
      req.path === "/health" ||
      req.path === "/api/version"
    );
  },

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later."
    });
  }
});

module.exports = limiter;
