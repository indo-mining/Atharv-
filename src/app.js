"use strict";

const express = require("express");
const path = require("path");

const config = require("./config");

const securityMiddleware = require("./middleware/security");
const rateLimiter = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");

const chatRoutes = require("./routes/chat");
const memoryRoutes = require("./routes/memory");
const utilityRoutes = require("./routes/utils");

const app = express();

if (config.trustProxy) {
  app.set("trust proxy", 1);
}

securityMiddleware(app);

app.use(express.json({
  limit: "1mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "1mb"
}));

app.use(rateLimiter);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    name: "Atharv AI",
    version: config.version,
    status: "running"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    service: "Atharv AI",
    version: config.version,
    databaseConfigured: Boolean(config.databaseUrl),
    tavilyConfigured: Boolean(config.tavilyApiKey),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/version", (req, res) => {
  res.status(200).json({
    success: true,
    version: config.version,
    name: "Atharv AI"
  });
});

app.use("/api/chat", chatRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api", utilityRoutes);

const publicPath = path.join(__dirname, "..", "public");

app.use(express.static(publicPath, {
  maxAge: config.nodeEnv === "production" ? "1d" : 0
}));

app.use((req, res) => {
  if (req.method !== "GET") {
    return res.status(404).json({
      success: false,
      error: "Route not found."
    });
  }

  return res.sendFile(
    path.join(publicPath, "index.html"),
    (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({
          success: false,
          error: "Page not found."
        });
      }
    }
  );
});

app.use(errorHandler);

module.exports = app;
