"use strict";

function errorHandler(err, req, res, next) {
  console.error("SERVER ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
}

module.exports = errorHandler;
