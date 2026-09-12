require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());
app.use(express.json());

// Frontend files serve karega
app.use(express.static(__dirname));


// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// ========================================
// HEALTH CHECK
// ========================================

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Atharv AI"
  });
});


// ========================================
// ATHARV AI CHAT
// ========================================

app.post("/api/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    // Message check
    if (!userMessage || !userMessage.trim()) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // API key check
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");

      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured"
      });
    }


    // ========================================
    // OPENAI REQUEST
    // ========================================

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({

          model: process.env.AI_MODEL || "gpt-5",

          instructions:
            `You are Atharv AI, a helpful Indian AI assistant.

            Answer naturally and clearly.

            Support Hindi, Hinglish, English and other languages.

            If the user asks in Hindi, answer in Hindi.
            If the user asks in Hinglish, answer in Hinglish.
            If the user asks in English, answer in English.

            Keep answers easy to understand.

            Be helpful, accurate and respectful.

            Do not unnecessarily repeat the user's question.`,

          input: userMessage

        })
      }
    );


    // ========================================
    // OPENAI RESPONSE
    // ========================================

    const data = await response.json();


    // ========================================
    // OPENAI ERROR
    // ========================================

    if (!response.ok) {

      console.error(
        "OPENAI ERROR:",
        JSON.stringify(data, null, 2)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "AI service error"
      });

    }


    // ========================================
    // GET AI REPLY
    // ========================================

    const reply =
      data.output_text ||
      "Sorry, Atharv could not generate a response.";


    // ========================================
    // SEND TO FRONTEND
    // ========================================

    return res.json({
      reply: reply
    });


  } catch (error) {

    console.error(
      "ATHARV SERVER ERROR:",
      error
    );

    return res.status(500).json({
      error: "Atharv server error"
    });

  }

});


// ========================================
// SERVER START
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Atharv AI running on port ${PORT}`
  );

});
