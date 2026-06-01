# Interlude AI

A static AI chatbot that runs entirely on GitHub Pages. Chat history is stored in your browser (localStorage) or synced to MongoDB Atlas. Powered by Groq

## Features

- 💬 Chat with Groq LLMs (full conversation history per session)
- 🗂️ Chat history stored in browser localStorage (no server needed)
- ☁️ Optional MongoDB Atlas sync via the Data API
- 🌙 Dark / Light theme

## Deployment

### GitHub Pages (recommended)

1. Fork or push this repository to GitHub.
2. Go to **Settings → Pages** and set the source to **GitHub Actions**.
3. Push to `main` — the workflow in `.github/workflows/pages.yml` will automatically deploy the `public/` folder to GitHub Pages.
4. Open the published URL and click the ⚙ **Settings** icon to enter your Groq API key.

### Local development (optional)

If you want to run the Express backend locally:

```bash
npm install
cp .env.example .env   # fill in GROQ_API_KEY and MONGODB_URI
npm start              # http://localhost:3000
```

## Browser configuration

All credentials are stored in your browser's `localStorage` — nothing is sent to any server except Groq and (optionally) MongoDB Atlas.

Open **⚙ Settings** in the app to configure:

| Setting | Description |
|---|---|
| **Groq API Key** | Your key from [console.groq.com](https://console.groq.com) — required |
| **Model** | Groq model name (default: `llama-3.1-8b-instant`) |
| **System Prompt** | Custom system prompt for the AI |
| **MongoDB Data API Base URL** | Atlas App Services Data API URL — optional |
| **MongoDB API Key** | Atlas Data API key — optional |
| **Database** | MongoDB database name (default: `interlude-ai`) |
| **Data Source** | MongoDB cluster name (default: `Cluster0`) |

> **Without MongoDB configured**, chats are stored locally in `localStorage` and persist only in the current browser.

## MongoDB Atlas (optional cloud sync)

1. In your Atlas project enable **App Services → Data API**.
2. Create an API key with **read and write** access scoped to the `interlude-ai` database (or your chosen database), and copy the **Data API Base URL** (e.g. `https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1`).
3. Add your GitHub Pages domain (e.g. `https://<user>.github.io`) to the **App Services → CORS Origins** list.
4. Enter the URL and key in the app's Settings modal.
