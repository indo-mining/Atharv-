"use strict";

const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");

const config = require("../config");

function securityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],

          scriptSrc: [
            "'self'",
            "'unsafe-inline'"
          ],

          styleSrc: [
            "'self'",
            "'unsafe-inline'"
          ],

          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https:"
          ],

          connectSrc: [
            "'self'",
            "https:"
          ],

          mediaSrc: [
            "'self'",
            "blob:",
            "https:"
          ],

          fontSrc: [
            "'self'",
            "data:",
            "https:"
          ],

          objectSrc: [
            "'none'"
          ],

          baseUri: [
            "'self'"
          ],

          frameAncestors: [
            "'self'"
          ]
        }
      },

      crossOriginEmbedderPolicy: false
    })
  );

  const origins = config.allowedOrigins;

  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) {
          return callback(null, true);
        }

        if (
          origins.length === 0 ||
          origins.includes(origin)
        ) {
          return callback(null, true);
        }

        return callback(
          new Error("CORS origin not allowed.")
        );
      },

      credentials: true
    })
  );

  app.use(compression());

  app.use(
    morgan(
      config.nodeEnv === "production"
        ? "combined"
        : "dev"
    )
  );
}

module.exports = securityMiddleware;
