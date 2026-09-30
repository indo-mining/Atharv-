"use strict";

/*
=========================================================
 ATHARV AI
 EXPRESS APPLICATION
 Version 17.0.2
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
 RENDER REVERSE PROXY
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
 RATE LIMIT
=========================================================
*/

app.use(rateLimiter);

/*
=========================================================
 PUBLIC
=========================================================
*/

const publicPath = path.join(
  __dirname,
  "..",
  "public"
);

/*
=========================================================
 SERVICE WORKER
 --------------------------------------------------------
 Never allow an old service worker to remain cached.
=========================================================
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
=========================================================
 STATIC FILES
=========================================================
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
    }
  })
);

/*
=========================================================
 HEALTH
=========================================================
*/

app.get("/health", (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  return res.status(200).json({
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

  return res.status(200).json({
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
 ROOT
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
=========================================================
*/

app.use(
  (req, res) => {

    if (req.method !== "GET") {
      return res.status(404).json({
        success: false,
        error: "Route not found."
      });
    }

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
            error: "Page not found."
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
