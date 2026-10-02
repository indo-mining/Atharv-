# Atharv AI

Your AI. Every Language. Every Question.

Atharv AI is an AI-powered chat application built with Node.js, Express and Groq.

## Features

- AI chat
- Multi-language conversations
- Live research support
- Memory support
- Weather information
- Chat history
- File attachments
- Voice input
- PWA support
- Mobile-friendly interface

## Tech Stack

- Node.js
- Express
- Groq AI
- Tavily Search
- PostgreSQL / Neon
- HTML
- CSS
- JavaScript

## Environment Variables

Create a `.env` file in the project root.

Never commit `.env` or API keys to GitHub.

Example:

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
TAVILY_API_KEY=
DATABASE_URL=
PORT=10000
