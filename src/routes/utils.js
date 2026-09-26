"use strict";

const express = require("express");

const asyncHandler =
  require("../middleware/asyncHandler");

const {
  weather
} = require("../controllers/utilityController");

const router =
  express.Router();

router.get(
  "/weather",
  asyncHandler(weather)
);

module.exports = router;
