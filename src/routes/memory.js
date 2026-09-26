"use strict";

const express = require("express");

const asyncHandler =
  require("../middleware/asyncHandler");

const {
  listMemories,
  addMemory,
  deleteMemories
} = require("../controllers/memoryController");

const router =
  express.Router();

router.get(
  "/",
  asyncHandler(listMemories)
);

router.post(
  "/",
  asyncHandler(addMemory)
);

router.delete(
  "/",
  asyncHandler(deleteMemories)
);

module.exports = router;
