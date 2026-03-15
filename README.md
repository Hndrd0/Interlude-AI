# Interlude AI

A full-stack AI chatbot with persistent chat history powered by Groq and MongoDB Atlas.

## Features

- 💬 Chat with Groq LLMs (full conversation history per session)
- 🖼️ Generate images via Hugging Face (FLUX.1-schnell)
- 🗂️ Persistent chat history stored in MongoDB Atlas
- 🌙 Dark / Light theme

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Description |
|---|---|
| `PORT` | Server port (default `3000`) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `GROQ_API_KEY` | Your Groq API key |
| `GROQ_MODEL` | Model name (default `llama-3.1-8b-instant`) |
| `HF_API_KEY` | Your Hugging Face API key |
| `SYSTEM_PROMPT` | Custom system prompt for the AI |
| `MAX_TOKENS` | Max response tokens (default `1024`) |

### 3. Run

```bash
# Production
npm start

# Development (auto-restart on file change, Node 18+)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

