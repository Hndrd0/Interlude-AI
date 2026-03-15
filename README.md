# Interlude AI

> A full-stack AI chat web application powered by **Groq LLaMA 3**, **Appwrite**, and **MongoDB Atlas** — hosted on GitHub Pages.

![Dark UI preview](https://img.shields.io/badge/UI-Dark%20Modern-7c6af7?style=flat-square)
![Frontend](https://img.shields.io/badge/Frontend-GitHub%20Pages-222?style=flat-square&logo=github)
![Backend](https://img.shields.io/badge/Backend-Appwrite%20Functions-F02E65?style=flat-square&logo=appwrite)
![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=flat-square&logo=mongodb)
![AI](https://img.shields.io/badge/AI-Groq%20LLaMA%203-orange?style=flat-square)

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Local Development](#local-development)
6. [Deployment](#deployment)
   - [Frontend – GitHub Pages](#frontend--github-pages)
   - [Backend – Appwrite Functions](#backend--appwrite-functions)
   - [Database – MongoDB Atlas](#database--mongodb-atlas)
7. [Environment Variables](#environment-variables)
8. [Security Notes](#security-notes)

---

## Features

- 🔒 **Email / Password authentication** via Appwrite
- 💬 **Multiple conversations** – create, switch, and delete chats
- 📜 **Persistent history** stored in MongoDB Atlas
- 🤖 **AI responses** from Groq's `llama3-70b-8192` model
- ✨ **Markdown rendering** (bold, code blocks, tables, lists…)
- 🎨 **Syntax highlighting** in code blocks (highlight.js)
- ⌛ **Typing indicator** while waiting for the AI
- 📱 **Responsive design** — works on mobile and desktop
- 💾 **Last-session restore** via `localStorage`

---

## Architecture

```
┌─────────────────────┐         ┌─────────────────────────┐
│   Browser / GitHub  │  HTTPS  │  Appwrite Cloud          │
│   Pages (frontend)  │────────▶│  Functions (chat.js)     │
│   HTML + CSS + JS   │◀────────│  - Groq API call         │
└─────────────────────┘  JSON   │  - MongoDB write         │
                                └──────────┬──────────────┘
                                           │ mongodb+srv
                                ┌──────────▼──────────────┐
                                │  MongoDB Atlas           │
                                │  users / chats / messages│
                                └─────────────────────────┘
```

- The **Groq API key** lives **only** in the Appwrite Function environment — it is never exposed to the browser.
- Appwrite handles authentication JWT tokens; the frontend never stores raw passwords.

---

## Project Structure

```
interlude-ai/
├── frontend/
│   ├── index.html      # Single-page app shell (auth + chat UI)
│   ├── style.css       # Dark modern styles, CSS variables, responsive layout
│   └── app.js          # Vanilla JS: auth, chat list, message rendering, API calls
├── backend/
│   ├── package.json    # Node.js dependencies for the Appwrite function
│   └── functions/
│       └── chat.js     # Appwrite serverless function (Groq + MongoDB)
├── database/
│   └── schema.md       # MongoDB Atlas collection schemas & index recommendations
├── .env.example        # Template for all required environment variables
└── README.md
```

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Appwrite Cloud](https://cloud.appwrite.io) account | Auth + Serverless Functions |
| [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free cluster | Persistent storage |
| [Groq API key](https://console.groq.com/keys) | AI responses |
| GitHub account | Hosting the frontend |

---

## Local Development

The frontend is plain HTML/CSS/JS — no build step required.

```bash
# Serve with any static server, e.g. the VS Code Live Server extension,
# Python's built-in server, or npx serve:
cd frontend
npx serve .
# Open http://localhost:3000
```

> **Note:** Appwrite and MongoDB features require the real cloud services even during development. Update the `CONFIG` object in `frontend/app.js` with your actual project IDs.

---

## Deployment

### Frontend – GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to `Deploy from a branch`.
4. Select the branch (`main`) and folder `/frontend`.
5. Click **Save**.
6. Your site will be live at `https://<username>.github.io/<repo>/`.

> GitHub Pages serves static files — no server-side code runs here.

---

### Backend – Appwrite Functions

1. Log in to [Appwrite Cloud](https://cloud.appwrite.io) and open your project.
2. Go to **Functions → Create Function**.
3. Choose runtime: **Node.js 18**.
4. Set the **entry point** to `backend/functions/chat.js`.
5. In the **Variables** tab, add the following environment variables (see [Environment Variables](#environment-variables)):
   - `GROQ_API_KEY`
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
6. Deploy the function. Copy the **Function ID**.
7. Update `CONFIG.chatFunctionId` in `frontend/app.js` with the Function ID.

To deploy the function code via the Appwrite CLI:

```bash
npm install -g appwrite-cli
appwrite login
appwrite deploy function
```

---

### Database – MongoDB Atlas

1. Create a free M0 cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user with read/write access.
3. Whitelist the Appwrite function IP (or use `0.0.0.0/0` for development).
4. Copy the **connection string** (`mongodb+srv://…`) — this is your `MONGODB_URI`.
5. Create the required indexes (see [`database/schema.md`](database/schema.md)):

```js
// Run in Atlas Data Explorer or mongosh
db.users.createIndex({ userId: 1 }, { unique: true });
db.chats.createIndex({ chatId: 1 }, { unique: true });
db.chats.createIndex({ userId: 1 });
db.messages.createIndex({ chatId: 1, timestamp: 1 });
```

#### Appwrite Database (for the frontend)

The chat list and messages visible in the sidebar are also stored in **Appwrite Databases** (so the frontend can fetch them without going through the function). Create:

1. A **Database** — copy its ID as `APPWRITE_DATABASE_ID` / `CONFIG.appwriteDatabaseId`.
2. A **`chats` Collection** with attributes:
   - `userId` (string, required)
   - `title` (string, required)
   - `createdAt` (string, required)
3. A **`messages` Collection** with attributes:
   - `chatId` (string, required)
   - `role` (string, required)
   - `content` (string, required, size 65535)
   - `timestamp` (string, required)
4. Set **Collection Permissions** so that users can read/write their own documents:
   - `create`: `users`
   - `read / update / delete`: `user:<userId>` (use document-level security)

---

## Environment Variables

See [`.env.example`](.env.example) for a full annotated template.

### Backend (Appwrite Function environment)

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API secret key — **never put this in frontend code** |
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | ✅ | MongoDB database name (default: `interlude_ai`) |
| `GROQ_TIMEOUT_MS` | ☑️ | Groq request timeout in ms (default: `30000`) |

### Frontend (`frontend/app.js` → `CONFIG` object)

These are **not secrets** and are embedded directly in JavaScript:

| Config key | Description |
|------------|-------------|
| `appwriteEndpoint` | Appwrite API endpoint (e.g. `https://cloud.appwrite.io/v1`) |
| `appwriteProjectId` | Appwrite project ID |
| `appwriteDatabaseId` | Appwrite database ID |
| `collections.chats` | Appwrite chats collection ID |
| `collections.messages` | Appwrite messages collection ID |
| `chatFunctionId` | Appwrite Function ID for the `/chat` endpoint |

---

## Security Notes

- ✅ The **Groq API key** is stored exclusively as an Appwrite Function environment variable. It is never included in frontend code or committed to the repository.
- ✅ User passwords are handled entirely by Appwrite — the application never stores them.
- ✅ User input is sanitised before rendering: plain text messages use `textContent` (not `innerHTML`); AI responses go through `marked.parse()` which escapes raw HTML by default.
- ✅ Conversation history sent to the backend is capped at 20 turns to limit token usage and potential prompt injection via very long contexts.
- ⚠️ For production, restrict your MongoDB Atlas network access to only Appwrite's function IP ranges instead of `0.0.0.0/0`.
- ⚠️ Set `Content-Security-Policy` and `X-Frame-Options` headers on your GitHub Pages site (via a `_headers` file if using a CDN proxy, or via Appwrite hosting).
