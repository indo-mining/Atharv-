"use strict";

/*
=========================================================
 ATHARV AI
 EXPRESS APPLICATION
 Version 17.0.2
 --------------------------------------------------------
 - ATHARV AI Web UI
 - Groq AI
 - Tavily Search
 - Neon PostgreSQL
 - Persistent Memory
 - Weather
 - Rate Limiting
 - Render Reverse Proxy Support
 - Helmet
 - CORS
 - Compression
 - Health
 - Version
 - SPA fallback
 - API never cached by frontend
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
 RENDER / REVERSE PROXY
 --------------------------------------------------------
 Render sits behind a reverse proxy and sends:
 X-Forwarded-For

 express-rate-limit needs Express to trust the proxy,
 otherwise it can throw:

 ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
=========================================================
*/

app.set("trust proxy", 1);

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

const publicPath = path.join(
  __dirname,
  "..",
  "public"
);

/*
---------------------------------------------------------
 SERVICE WORKER
 --------------------------------------------------------
 Never let the normal static cache aggressively cache
 service-worker.js.
---------------------------------------------------------
*/

app.get(
  "/service-worker.js",
  (req, res, next) => {
    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    next();
  }
);

/*
---------------------------------------------------------
 STATIC FILES
 --------------------------------------------------------
 API responses must never be handled by this middleware.
---------------------------------------------------------
*/

app.use(
  express.static(publicPath, {
    maxAge:
      config.nodeEnv === "production"
        ? "1d"
        : 0,

    etag: true,

    index: false,

    setHeaders: (res, filePath) => {
      /*
      -----------------------------------------------------
      Never cache service worker.
      -----------------------------------------------------
      */

      if (
        filePath.endsWith(
          "service-worker.js"
        )
      ) {
        res.setHeader(
          "Cache-Control",
          "no-cache, no-store, must-revalidate"
        );
      }

      /*
      -----------------------------------------------------
      API should never be served as static content.
      -----------------------------------------------------
      */
    }
  })
);

/*
=========================================================
 HEALTH
=========================================================
*/

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    ok: true,
    status: "OK",
    service: "Atharv AI",
    version: config.version,

    databaseConfigured:
      Boolean(config.databaseUrl),

    tavilyConfigured:
      Boolean(config.tavilyApiKey),

    timestamp:
      new Date().toISOString()
  });
});

/*
=========================================================
 VERSION
=========================================================
*/

app.get("/api/version", (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

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
 API 404
 --------------------------------------------------------
 Important:
 API requests must NEVER fall through to index.html.
=========================================================
*/

app.use(
  "/api",
  (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.status(404).json({
      success: false,
      error: "API route not found."
    });
  }
);

/*
=========================================================
 ROOT WEBSITE
=========================================================
*/

app.get("/", (req, res) => {
  return res.sendFile(
    path.join(
      publicPath,
      "index.html"
    ),
    {
      headers: {
        "Cache-Control":
          "no-cache, no-store, must-revalidate"
      }
    },
    (error) => {
      if (
        error &&
        !res.headersSent
      ) {
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
 Frontend routes:
 /chat
 /home
 /settings
 etc.
=========================================================
*/

app.use(
  (req, res) => {

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
    FRONTEND ROUTE
    -------------------------------------------------------
    */

    return res.sendFile(
      path.join(
        publicPath,
        "index.html"
      ),
      {
        headers: {
          "Cache-Control":
            "no-cache, no-store, must-revalidate"
        }
      },
      (error) => {

        if (
          error &&
          !res.headersSent
        ) {
          console.error(
            "SPA FALLBACK ERROR:",
            error
          );

          res.status(404).json({
            success: false,
            error:
              "Page not found."
          });
        }

      }
    );
  }
);

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
