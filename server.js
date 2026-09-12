require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

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

    if (!userMessage || !userMessage.trim()) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured"
      });
    }


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
            Be helpful, accurate and respectful.`,

          input: userMessage

        })
      }
    );


    const data = await response.json();


    if (!response.ok) {

      console.error("OPENAI ERROR:", data);

      return res.status(response.status).json({
        error:
          data.error?.message ||
          "AI service error"
      });

    }


    // Responses API output
    const reply =
      data.output_text ||
      "Sorry, Atharv could not generate a response.";


    res.json({
      reply: reply
    });


  } catch (error) {

    console.error("ATHARV SERVER ERROR:", error);

    res.status(500).json({
      error: "Atharv server error"
    });

  }

});


// ========================================
// SERVER
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Atharv AI running on port ${PORT}`
  );

});
