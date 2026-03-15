/**
 * chat.js – Interlude AI Backend (Appwrite Serverless Function)
 *
 * Endpoint: POST /chat  (invoked as an Appwrite Function execution)
 *
 * Request body (JSON):
 *   {
 *     chatId:  string,               // Appwrite chat document ID
 *     userId:  string,               // Appwrite user ID
 *     message: string,               // latest user message
 *     history: Array<{role, content}>// previous conversation turns
 *   }
 *
 * Response body (JSON):
 *   { reply: string }   – on success
 *   { error: string }   – on failure
 *
 * Environment variables (set in Appwrite console – NEVER commit these):
 *   GROQ_API_KEY          – Groq API secret key
 *   MONGODB_URI           – MongoDB Atlas connection string
 *   MONGODB_DB_NAME       – MongoDB database name (default: interlude_ai)
 *
 * Runtime: node-18.0 (Appwrite function runtime)
 *
 * IMPORTANT SECURITY NOTE:
 * The GROQ_API_KEY is only accessed here on the server side.
 * It is never sent to the client / browser.
 */

'use strict';

const https      = require('https');
const { MongoClient } = require('mongodb');  // npm i mongodb

// ── MongoDB connection (module-level cache for warm starts) ──
let mongoClient = null;

async function getDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      // Keep-alive for Lambda / serverless environments
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    await mongoClient.connect();
  }
  const dbName = process.env.MONGODB_DB_NAME || 'interlude_ai';
  return mongoClient.db(dbName);
}

// ── Groq API helper ─────────────────────────────────────────

/** Timeout (ms) for Groq API requests — configurable via env var */
const GROQ_TIMEOUT_MS = parseInt(process.env.GROQ_TIMEOUT_MS || '30000', 10);

/**
 * Call the Groq Chat Completions API.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>} AI assistant reply text
 */
function callGroq(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:       'llama3-70b-8192',
      messages,
      max_tokens:  2048,
      temperature: 0.7,
    });

    const options = {
      hostname: 'api.groq.com',
      path:     '/openai/v1/chat/completions',
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
        // API key lives only in server environment – never exposed to clients
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200 || parsed.error) {
            // Include HTTP status code to help diagnose rate limits (429) or auth errors (401)
            const msg = parsed.error?.message || `Groq API error (HTTP ${res.statusCode})`;
            return reject(new Error(msg));
          }
          const reply = parsed.choices?.[0]?.message?.content;
          if (!reply) return reject(new Error('Empty response from Groq'));
          resolve(reply);
        } catch (err) {
          reject(new Error('Failed to parse Groq response: ' + err.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(GROQ_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Groq API request timed out after ${GROQ_TIMEOUT_MS}ms`));
    });
    req.write(body);
    req.end();
  });
}

// ── MongoDB helpers ──────────────────────────────────────────

/**
 * Store a message record in MongoDB.
 * @param {object} db  – MongoDB Db instance
 * @param {string} chatId
 * @param {string} role   – 'user' | 'assistant'
 * @param {string} content
 */
async function storeMessage(db, chatId, role, content) {
  await db.collection('messages').insertOne({
    chatId,
    role,
    content,
    timestamp: new Date(),
  });
}

/**
 * Ensure a chat document exists in MongoDB.
 * Uses upsert so it is idempotent.
 */
async function upsertChat(db, chatId, userId) {
  await db.collection('chats').updateOne(
    { chatId },
    {
      $setOnInsert: {
        chatId,
        userId,
        title:     'New chat',
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Ensure a user document exists in MongoDB.
 */
async function upsertUser(db, userId) {
  await db.collection('users').updateOne(
    { userId },
    { $setOnInsert: { userId, createdAt: new Date() } },
    { upsert: true }
  );
}

// ── Appwrite Function entry point ────────────────────────────

/**
 * Main handler called by Appwrite Functions.
 * @param {object} context – Appwrite function context ({ req, res, log, error })
 */
module.exports = async ({ req, res, log, error }) => {
  // ── Parse request body ──
  let body;
  try {
    body = JSON.parse(req.body || '{}');
  } catch {
    return res.json({ error: 'Invalid JSON body' }, 400);
  }

  const { chatId, userId, message, history = [] } = body;

  // ── Input validation ──
  if (!chatId || typeof chatId !== 'string') {
    return res.json({ error: 'Missing or invalid chatId' }, 400);
  }
  if (!userId || typeof userId !== 'string') {
    return res.json({ error: 'Missing or invalid userId' }, 400);
  }
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.json({ error: 'Missing or empty message' }, 400);
  }
  if (!Array.isArray(history)) {
    return res.json({ error: 'history must be an array' }, 400);
  }

  // ── Environment variable check ──
  if (!process.env.GROQ_API_KEY) {
    error('GROQ_API_KEY environment variable is not set');
    return res.json({ error: 'Server configuration error' }, 500);
  }
  if (!process.env.MONGODB_URI) {
    error('MONGODB_URI environment variable is not set');
    return res.json({ error: 'Server configuration error' }, 500);
  }

  log(`[chat] userId=${userId} chatId=${chatId} message length=${message.length}`);

  try {
    // ── Connect to MongoDB ──
    const db = await getDb();

    // ── Persist user & chat references ──
    await Promise.all([
      upsertUser(db, userId),
      upsertChat(db, chatId, userId),
    ]);

    // ── Save the incoming user message ──
    await storeMessage(db, chatId, 'user', message.trim());

    // ── Build messages array for Groq ──
    // System prompt sets the AI persona
    const groqMessages = [
      {
        role:    'system',
        content: 'You are Interlude AI, a helpful, thoughtful, and concise assistant. ' +
                 'Format your responses using Markdown where appropriate.',
      },
      // Include conversation history (capped by the caller to ~20 turns)
      ...history.map(({ role, content }) => ({
        role:    role === 'user' ? 'user' : 'assistant',
        content: String(content),
      })),
    ];

    // ── Call Groq ──
    const reply = await callGroq(groqMessages);

    // ── Save the AI response ──
    await storeMessage(db, chatId, 'assistant', reply);

    log(`[chat] Groq replied, reply length=${reply.length}`);

    // ── Return the reply to the frontend ──
    return res.json({ reply });

  } catch (err) {
    error(`[chat] Error: ${err.message}`);
    return res.json({ error: err.message || 'Internal server error' }, 500);
  }
};
