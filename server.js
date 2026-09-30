"use strict";

/*
=========================================================
 ATHARV AI
 SERVER BOOTSTRAP
 Version 17.0.2
 --------------------------------------------------------
 Modular Backend
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
 GLOBAL STATE
=========================================================
*/

let server = null;
let shuttingDown = false;


/*
=========================================================
 START SERVER
=========================================================
*/

async function startServer() {

  try {

    console.log("==============================================");
    console.log(" ATHARV AI SERVER STARTING");
    console.log("==============================================");

    console.log(
      "Environment:",
      config.nodeEnv
    );

    console.log(
      "Version:",
      config.version
    );

    console.log(
      "Port:",
      config.port
    );


    /*
    -------------------------------------------------------
    DATABASE
    -------------------------------------------------------
    */

    await initDatabase();


    /*
    -------------------------------------------------------
    HTTP SERVER
    -------------------------------------------------------
    */

    server =
      http.createServer(app);


    server.listen(
      config.port,
      "0.0.0.0",
      () => {

        console.log("==============================================");
        console.log(" ATHARV AI SERVER RUNNING");
        console.log("==============================================");

        console.log(
          `Port: ${config.port}`
        );

        console.log(
          `Environment: ${config.nodeEnv}`
        );

        console.log(
          `Version: ${config.version}`
        );

        console.log(
          "Health: /health"
        );

        console.log(
          "Version API: /api/version"
        );

        console.log(
          "Chat API: /api/chat"
        );

        console.log(
          "Live API: /api/chat/research"
        );

        console.log(
          "Memory API: /api/memory"
        );

        console.log("==============================================");
      }
    );


    /*
    -------------------------------------------------------
    SERVER ERROR
    -------------------------------------------------------
    */

    server.on(
      "error",
      (error) => {

        console.error(
          "HTTP SERVER ERROR:",
          error
        );


        if (
          error.code ===
          "EADDRINUSE"
        ) {

          console.error(
            `Port ${config.port} is already in use.`
          );
        }


        process.exit(1);
      }
    );


  } catch (error) {

    console.error("==============================================");
    console.error(" ATHARV AI SERVER START FAILED");
    console.error("==============================================");

    console.error(
      error
    );

    process.exit(1);
  }
}


/*
=========================================================
 GRACEFUL SHUTDOWN
=========================================================
*/

async function shutdown(
  signal
) {

  if (shuttingDown) {
    return;
  }


  shuttingDown = true;


  console.log("");
  console.log("==============================================");

  console.log(
    `SHUTDOWN SIGNAL: ${signal}`
  );

  console.log("==============================================");


  /*
  -------------------------------------------------------
  STOP ACCEPTING NEW CONNECTIONS
  -------------------------------------------------------
  */

  if (server) {

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
  }


  /*
  -------------------------------------------------------
  CLOSE DATABASE
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

    console.error(
      "UNHANDLED REJECTION:",
      reason
    );
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

    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );


    /*
    Give logs a moment to flush.
    */

    setTimeout(
      () => {
        shutdown(
          "UNCAUGHT_EXCEPTION"
        );
      },
      100
    );
  }
);


/*
=========================================================
 START
=========================================================
*/

startServer();
