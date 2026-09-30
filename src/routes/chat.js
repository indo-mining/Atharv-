"use strict";

const express = require("express");

const asyncHandler =
  require("../middleware/asyncHandler");

const {
  chat,
  streamChat,
  research
} = require("../controllers/chatController");

const router =
  express.Router();

/*
=========================================================
 NORMAL CHAT
 POST /api/chat
=========================================================
*/

router.post(
  "/",
  asyncHandler(chat)
);

/*
=========================================================
 STREAM CHAT
 POST /api/chat/stream
=========================================================
*/

router.post(
  "/stream",
  asyncHandler(streamChat)
);

/*
=========================================================
 LIVE / RESEARCH
 POST /api/chat/research
=========================================================
*/

router.post(
  "/research",
  asyncHandler(research)
);

module.exports = router;
