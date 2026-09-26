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

router.post(
  "/",
  asyncHandler(chat)
);

router.post(
  "/stream",
  asyncHandler(streamChat)
);

router.post(
  "/research",
  asyncHandler(research)
);

module.exports = router;
