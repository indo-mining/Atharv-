"use strict";

/*
=========================================================
 ATHARV AI
 EXPRESS APPLICATION
 Version 17.0.1
 --------------------------------------------------------
 - ATHARV AI Web UI
 - Groq AI
 - Tavily Search
 - Neon PostgreSQL
 - Memory
 - Weather
 - Rate Limiting
 - Helmet
 - CORS
 - Compression
 - Health
 - Version
 - SPA fallback
=========================================================
*/

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

/*
=========================================================
 PROXY
=========================================================
*/

if (config.trustProxy) {
  app.set("trust proxy", 1);
}

/*
=========================================================
 SECURITY
=========================================================
*/

securityMiddleware(app);

/*
=========================================================
 BODY PARSERS
=========================================================
*/

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

/*
=========================================================
 RATE LIMITING
=========================================================
*/

app.use(rateLimiter);

/*
=========================================================
 PUBLIC FRONTEND
=========================================================
*/

const publicPath = path.join(__dirname, "..", "public");

app.use(
  express.static(publicPath, {
    maxAge:
      config.nodeEnv === "production"
        ? "1d"
        : 0
  })
);

/*
=========================================================
 HEALTH
 --------------------------------------------------------
 Keep this separate from the website.
=========================================================
*/

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    ok: true,
    status: "OK",
    service: "Atharv AI",
    version: config.version,
    databaseConfigured: Boolean(
      config.databaseUrl
    ),
    tavilyConfigured: Boolean(
      config.tavilyApiKey
    ),
    timestamp: new Date().toISOString()
  });
});

/*
=========================================================
 VERSION
=========================================================
*/

app.get("/api/version", (req, res) => {
  res.status(200).json({
    success: true,
    version: config.version,
    name: "Atharv AI"
  });
});

/*
=========================================================
 API ROUTES
=========================================================
*/

app.use(
  "/api/chat",
  chatRoutes
);

app.use(
  "/api/memory",
  memoryRoutes
);

app.use(
  "/api",
  utilityRoutes
);

/*
=========================================================
 ROOT WEBSITE
 --------------------------------------------------------
 IMPORTANT:
 Do NOT return JSON from "/".
 The actual ATHARV AI web interface is served here.
=========================================================
*/

app.get("/", (req, res) => {
  return res.sendFile(
    path.join(
      publicPath,
      "index.html"
    ),
    (error) => {
      if (error && !res.headersSent) {
        console.error(
          "ROOT PAGE ERROR:",
          error
        );

        res.status(404).json({
          success: false,
          error:
            "Atharv AI web interface not found."
        });
      }
    }
  );
});

/*
=========================================================
 SPA FALLBACK
 --------------------------------------------------------
 Handles frontend routes such as:
 /chat
 /home
 /settings
 etc.
=========================================================
*/

app.use((req, res) => {

  /*
  -------------------------------------------------------
  NON-GET REQUEST
  -------------------------------------------------------
  */

  if (req.method !== "GET") {
    return res.status(404).json({
      success: false,
      error: "Route not found."
    });
  }

  /*
  -------------------------------------------------------
  API REQUEST THAT DID NOT MATCH
  -------------------------------------------------------
  */

  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      error: "API route not found."
    });
  }

  /*
  -------------------------------------------------------
  FRONTEND ROUTE
  -------------------------------------------------------
  */

  return res.sendFile(
    path.join(
      publicPath,
      "index.html"
    ),
    (error) => {

      if (error && !res.headersSent) {

        console.error(
          "SPA FALLBACK ERROR:",
          error
        );

        res.status(404).json({
          success: false,
          error: "Page not found."
        });
      }

    }
  );
});

/*
=========================================================
 ERROR HANDLER
=========================================================
*/

app.use(errorHandler);

/*
=========================================================
 EXPORT
=========================================================
*/

module.exports = app;
