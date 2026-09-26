"use strict";

/*
=========================================================
 LISTING APP BACKEND
 Express Application
 --------------------------------------------------------
 - CORS
 - JSON parsing
 - URL encoded parsing
 - Health check
 - Item CRUD routes
 - 404 handling
 - Global error handling
=========================================================
*/

const express = require("express");
const cors = require("cors");

const itemRoutes = require("./routes/itemRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

/*
=========================================================
 CORS
=========================================================
*/

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

/*
=========================================================
 BODY PARSER
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
 REQUEST LOGGER
=========================================================
*/

app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();
});

/*
=========================================================
 ROOT ROUTE
=========================================================
*/

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    name: "Listing App API",
    version: "1.0.0",
    status: "running"
  });
});

/*
=========================================================
 HEALTH CHECK
=========================================================
*/

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    message: "Listing App API is running.",
    timestamp: new Date().toISOString()
  });
});

/*
=========================================================
 ITEM ROUTES
=========================================================
*/

app.use("/api/items", itemRoutes);

/*
=========================================================
 404 HANDLER
=========================================================
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    path: req.originalUrl,
    method: req.method
  });
});

/*
=========================================================
 GLOBAL ERROR HANDLER
=========================================================
*/

app.use(errorHandler);

/*
=========================================================
 EXPORT
=========================================================
*/

module.exports = app;
