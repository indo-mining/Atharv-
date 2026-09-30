"use strict";

/*
=========================================================
 ATHARV AI
 SERVER BOOTSTRAP
 Version 17.1.0
 --------------------------------------------------------
 Advanced Production Bootstrap
 - Express 5
 - Groq AI
 - Tavily Search
 - Neon PostgreSQL
 - Persistent Memory
 - Weather
 - Rate Limiting
 - Helmet
 - CORS
 - Compression
 - Graceful Shutdown
 - Render Proxy Support
 - Startup Validation
 - HTTP Keep Alive
 - Request Timeout Protection
 - Fatal Error Handling
=========================================================
*/

require("dotenv").config();

const http = require("http");

const app = require("./src/app");
const config = require("./src/config");

const {
  initDatabase,
  closeDatabase
} = require("./src/db/postgres");


/*
=========================================================
 SERVER SETTINGS
=========================================================
*/

const SHUTDOWN_TIMEOUT =
  Number(process.env.SHUTDOWN_TIMEOUT || 10000);

const REQUEST_TIMEOUT =
  Number(process.env.SERVER_REQUEST_TIMEOUT || 120000);

const KEEP_ALIVE_TIMEOUT =
  Number(process.env.KEEP_ALIVE_TIMEOUT || 65000);

const HEADERS_TIMEOUT =
  Number(process.env.HEADERS_TIMEOUT || 66000);

const MAX_REQUESTS_PER_SOCKET =
  Number(process.env.MAX_REQUESTS_PER_SOCKET || 100);


/*
=========================================================
 GLOBAL STATE
=========================================================
*/

let server = null;
let shuttingDown = false;
let startupComplete = false;


/*
=========================================================
 STARTUP LOG
=========================================================
*/

function printStartupBanner() {

  console.log("");
  console.log("=================================================");
  console.log("              ATHARV AI SERVER");
  console.log("=================================================");

  console.log(
    `Environment : ${config.nodeEnv}`
  );

  console.log(
    `Version     : ${config.version}`
  );

  console.log(
    `Port        : ${config.port}`
  );

  console.log(
    `Node        : ${process.version}`
  );

  console.log(
    `PID         : ${process.pid}`
  );

  console.log(
    `Platform    : ${process.platform}`
  );

  console.log("=================================================");
}


/*
=========================================================
 ENVIRONMENT CHECK
 ---------------------------------------------------------
 Do not print secret values.
=========================================================
*/

function validateEnvironment() {

  const warnings = [];

  if (!process.env.GROQ_API_KEY) {
    warnings.push(
      "GROQ_API_KEY is not configured."
    );
  }

  if (!process.env.DATABASE_URL) {
    warnings.push(
      "DATABASE_URL is not configured."
    );
  }

  if (!process.env.TAVILY_API_KEY) {
    warnings.push(
      "TAVILY_API_KEY is not configured. Live research may be unavailable."
    );
  }

  if (warnings.length) {

    console.warn("");
    console.warn("ENVIRONMENT WARNINGS:");

    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }

    console.warn("");
  }

  return warnings;
}


/*
=========================================================
 SERVER CONFIGURATION
=========================================================
*/

function configureHttpServer() {

  if (!server) {
    return;
  }


  /*
  -------------------------------------------------------
  KEEP ALIVE
  -------------------------------------------------------
  */

  server.keepAliveTimeout =
    KEEP_ALIVE_TIMEOUT;


  /*
  -------------------------------------------------------
  HEADERS TIMEOUT
  -------------------------------------------------------
  */

  server.headersTimeout =
    Math.max(
      HEADERS_TIMEOUT,
      KEEP_ALIVE_TIMEOUT + 1000
    );


  /*
  -------------------------------------------------------
  REQUEST TIMEOUT
  -------------------------------------------------------
  */

  server.requestTimeout =
    REQUEST_TIMEOUT;


  /*
  -------------------------------------------------------
  MAX REQUESTS PER SOCKET
  -------------------------------------------------------
  */

  server.maxRequestsPerSocket =
    MAX_REQUESTS_PER_SOCKET;


  /*
  -------------------------------------------------------
  CONNECTION TIMEOUT
  -------------------------------------------------------
  */

  server.timeout =
    REQUEST_TIMEOUT;


  console.log(
    "HTTP server configuration applied."
  );
}


/*
=========================================================
 SERVER METRICS
=========================================================
*/

function printRuntimeInfo() {

  const memory =
    process.memoryUsage();

  console.log("");
  console.log("RUNTIME:");

  console.log(
    `RSS         : ${Math.round(memory.rss / 1024 / 1024)} MB`
  );

  console.log(
    `Heap Used   : ${Math.round(memory.heapUsed / 1024 / 1024)} MB`
  );

  console.log(
    `Heap Total  : ${Math.round(memory.heapTotal / 1024 / 1024)} MB`
  );

  console.log(
    `Uptime      : ${Math.round(process.uptime())} sec`
  );
}


/*
=========================================================
 START SERVER
=========================================================
*/

async function startServer() {

  if (startupComplete) {
    return;
  }


  try {

    printStartupBanner();

    validateEnvironment();


    /*
    -------------------------------------------------------
    DATABASE
    -------------------------------------------------------
    */

    console.log(
      "Initializing database..."
    );

    await initDatabase();

    console.log(
      "Database initialized successfully."
    );


    /*
    -------------------------------------------------------
    CREATE HTTP SERVER
    -------------------------------------------------------
    */

    server =
      http.createServer(app);


    configureHttpServer();


    /*
    -------------------------------------------------------
    SERVER ERROR
    -------------------------------------------------------
    */

    server.on(
      "error",
      (error) => {

        console.error("");
        console.error(
          "HTTP SERVER ERROR:",
          error
        );


        if (
          error &&
          error.code === "EADDRINUSE"
        ) {

          console.error(
            `Port ${config.port} is already in use.`
          );
        }


        if (!shuttingDown) {

          shutdown(
            "SERVER_ERROR"
          );
        }
      }
    );


    /*
    -------------------------------------------------------
    CONNECTION MONITOR
    -------------------------------------------------------
    */

    server.on(
      "connection",
      (socket) => {

        socket.setKeepAlive(
          true,
          1000
        );

        socket.setNoDelay(
          true
        );
      }
    );


    /*
    -------------------------------------------------------
    CLIENT ERROR
    -------------------------------------------------------
    */

    server.on(
      "clientError",
      (error, socket) => {

        console.warn(
          "HTTP CLIENT ERROR:",
          error.message
        );


        if (
          socket &&
          !socket.destroyed
        ) {

          socket.end(
            "HTTP/1.1 400 Bad Request\r\n\r\n"
          );
        }
      }
    );


    /*
    -------------------------------------------------------
    LISTEN
    -------------------------------------------------------
    */

    server.listen(
      config.port,
      "0.0.0.0",
      () => {

        startupComplete = true;


        console.log("");
        console.log("=================================================");
        console.log("          ATHARV AI SERVER RUNNING");
        console.log("=================================================");

        console.log(
          `Port        : ${config.port}`
        );

        console.log(
          `Environment : ${config.nodeEnv}`
        );

        console.log(
          `Version     : ${config.version}`
        );

        console.log(
          `Health      : /health`
        );

        console.log(
          `Version API : /api/version`
        );

        console.log(
          `Chat API    : /api/chat`
        );

        console.log(
          `Live API    : /api/chat/research`
        );

        console.log(
          `Memory API  : /api/memory`
        );

        console.log(
          `Weather API : /api/weather`
        );

        console.log("=================================================");

        printRuntimeInfo();

        console.log("");
        console.log(
          "Atharv AI is ready."
        );
        console.log("");
      }
    );


  } catch (error) {

    console.error("");
    console.error("=================================================");
    console.error("       ATHARV AI SERVER START FAILED");
    console.error("=================================================");

    console.error(
      error
    );

    console.error("=================================================");

    try {

      await closeDatabase();

    } catch (dbError) {

      console.error(
        "DATABASE CLEANUP ERROR:",
        dbError
      );
    }

    process.exit(1);
  }
}


/*
=========================================================
 GRACEFUL SHUTDOWN
=========================================================
*/

async function shutdown(signal) {

  if (shuttingDown) {
    return;
  }


  shuttingDown = true;


  console.log("");
  console.log("=================================================");
  console.log(
    `SHUTDOWN SIGNAL: ${signal}`
  );
  console.log("=================================================");


  /*
  -------------------------------------------------------
  FORCE EXIT TIMER
  -------------------------------------------------------
  */

  const forceExitTimer =
    setTimeout(
      () => {

        console.error(
          "Graceful shutdown timeout reached."
        );

        process.exit(1);

      },
      SHUTDOWN_TIMEOUT
    );


  forceExitTimer.unref();


  /*
  -------------------------------------------------------
  STOP ACCEPTING NEW CONNECTIONS
  -------------------------------------------------------
  */

  if (server) {

    try {

      await new Promise(
        (resolve) => {

          server.close(
            (error) => {

              if (error) {

                console.error(
                  "HTTP SERVER CLOSE ERROR:",
                  error
                );

              } else {

                console.log(
                  "HTTP server closed."
                );
              }

              resolve();
            }
          );
        }
      );

    } catch (error) {

      console.error(
        "HTTP shutdown error:",
        error
      );
    }
  }


  /*
  -------------------------------------------------------
  DATABASE
  -------------------------------------------------------
  */

  try {

    await closeDatabase();

    console.log(
      "Database pool closed."
    );

  } catch (error) {

    console.error(
      "DATABASE CLOSE ERROR:",
      error
    );
  }


  /*
  -------------------------------------------------------
  COMPLETE
  -------------------------------------------------------
  */

  clearTimeout(
    forceExitTimer
  );


  console.log(
    "Atharv AI shutdown complete."
  );

  process.exit(0);
}


/*
=========================================================
 PROCESS SIGNALS
=========================================================
*/

process.on(
  "SIGTERM",
  () => {
    shutdown("SIGTERM");
  }
);


process.on(
  "SIGINT",
  () => {
    shutdown("SIGINT");
  }
);


/*
=========================================================
 UNHANDLED PROMISE
=========================================================
*/

process.on(
  "unhandledRejection",
  (reason) => {

    console.error("");
    console.error(
      "UNHANDLED REJECTION:",
      reason
    );

    /*
    Do not immediately kill the server.

    Individual request handlers should already
    convert expected async errors into HTTP responses.
    */
  }
);


/*
=========================================================
 UNCAUGHT EXCEPTION
=========================================================
*/

process.on(
  "uncaughtException",
  (error) => {

    console.error("");
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );


    /*
    -------------------------------------------------------
    Fatal process state
    -------------------------------------------------------
    */

    if (!shuttingDown) {

      setTimeout(
        () => {

          shutdown(
            "UNCAUGHT_EXCEPTION"
          );

        },
        100
      );

    }
  }
);


/*
=========================================================
 START
=========================================================
*/

startServer();
