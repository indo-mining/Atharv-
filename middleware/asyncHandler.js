"use strict";

function errorHandler(err, req, res, next) {
  console.error("REQUEST ERROR:", {
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: err.stack
  });

  if (res.headersSent) {
    return next(err);
  }

  const isProduction =
    process.env.NODE_ENV === "production";

  res.status(err.statusCode || 500).json({
    success: false,
    error: isProduction
      ? "Something went wrong. Please try again."
      : err.message
  });
}

module.exports = errorHandler;
