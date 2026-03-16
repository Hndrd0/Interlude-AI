require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const Chat      = require('./models/Chat');
const Settings  = require('./models/Settings');

// ─── Available models catalogue ────────────────

const MODELS_CATALOGUE = {
  reasoning: [
    { name: 'GPT OSS 120B',  id: 'meta-llama/llama-4-maverick-17b-128e-instruct' },
    { name: 'GPT OSS 20B',   id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { name: 'Qwen 3 32B',    id: 'qwen/qwen3-32b' },
  ],
  functionCalling: [
    { name: 'GPT OSS 120B',  id: 'meta-llama/llama-4-maverick-17b-128e-instruct' },
    { name: 'GPT OSS 20B',   id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { name: 'Llama 4 Scout', id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { name: 'Qwen 3 32B',    id: 'qwen/qwen3-32b' },
    { name: 'Kimi K2',       id: 'moonshotai/kimi-k2-instruct' },
  ],
  textToSpeech: [
    { name: 'Orpheus English (default)', id: 'canopylabs/orpheus-v1-english' },
    { name: 'ElevenLabs TTS',            id: 'elevenlabs/tts' },
    { name: 'Orpheus Arabic Saudi',      id: 'canopy/orpheus-3-3b-arabic-sa-ft' },
  ],
  speechToText: [
    { name: 'Whisper Large v3',       id: 'whisper-large-v3' },
    { name: 'Whisper Large v3 Turbo', id: 'whisper-large-v3-turbo' },
  ],
  textToText: [
    { name: 'GPT OSS 120B',  id: 'meta-llama/llama-4-maverick-17b-128e-instruct' },
    { name: 'GPT OSS 20B',   id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { name: 'Kimi K2',       id: 'moonshotai/kimi-k2-instruct' },
    { name: 'Llama 4 Scout', id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile' },
  ],
  vision: [
    { name: 'Llama 4 Scout', id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  ],
  multilingual: [
    { name: 'GPT OSS 120B',           id: 'meta-llama/llama-4-maverick-17b-128e-instruct' },
    { name: 'GPT OSS 20B',            id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { name: 'Kimi K2',                id: 'moonshotai/kimi-k2-instruct' },
    { name: 'Llama 4 Scout',          id: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { name: 'Llama 3.3 70B',          id: 'llama-3.3-70b-versatile' },
    { name: 'Whisper Large v3',       id: 'whisper-large-v3' },
  ],
  safety: [
    { name: 'Safety GPT OSS 20B', id: 'meta-llama/llama-guard-4-12b' },
  ],
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('./public'));

// ─── Rate limiting ──────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/', apiLimiter);

// ─── MongoDB connection ─────────────────────────

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// ─── GET /api/chats ─────────────────────────────
// Returns a list of all chats (no messages, just metadata)

app.get('/api/chats', async (req, res) => {
  try {
    const chats = await Chat.find({}, 'title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/chats ────────────────────────────
// Creates an empty chat session

app.post('/api/chats', async (req, res) => {
  try {
    const chat = new Chat({ title: 'New Chat', messages: [] });
    await chat.save();
    res.status(201).json({ _id: chat._id, title: chat.title, createdAt: chat.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/chats/:id ──────────────────────

app.delete('/api/chats/:id', async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/chats/:id ─────────────────────────
// Returns full chat including all messages

app.get('/api/chats/:id', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id).lean();
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/chat ─────────────────────────────
// Send a user message; proxies to Groq and persists both messages

app.post('/api/chat', async (req, res) => {
  const { chatId, message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    let chat;
    if (chatId) {
      chat = await Chat.findById(chatId);
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
    } else {
      chat = new Chat({ title: message.slice(0, 60), messages: [] });
    }

    chat.messages.push({ role: 'user', content: message, type: 'text' });

    // Build conversation history (text messages only) for Groq
    const systemPrompt = process.env.SYSTEM_PROMPT || 'You are Interlude AI, a helpful assistant.';
    const history = chat.messages
      .filter(m => m.type === 'text')
      .map(m => ({ role: m.role, content: m.content }));
    const groqMessages = [{ role: 'system', content: systemPrompt }, ...history];

    const groqRes = await fetch(
      process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model:      process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages:   groqMessages,
          max_tokens: parseInt(process.env.MAX_TOKENS || '1024', 10),
        }),
      }
    );

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Groq API error (${groqRes.status})`);
    }

    const data  = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content ?? 'No response received.';

    chat.messages.push({ role: 'assistant', content: reply, type: 'text' });
    chat.updatedAt = new Date();
    await chat.save();

    res.json({ chatId: chat._id, reply, title: chat.title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/models ────────────────────────────
// Returns the available models grouped by capability

app.get('/api/models', (_req, res) => {
  res.json(MODELS_CATALOGUE);
});

// ─── GET /api/settings ──────────────────────────
// Returns all stored settings (values are redacted for sensitive keys)

app.get('/api/settings', async (_req, res) => {
  try {
    const settings = await Settings.find({}, 'key updatedAt').lean();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/settings/:key ─────────────────────

app.get('/api/settings/:key', async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: req.params.key }).lean();
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json({ key: setting.key, value: setting.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/settings ─────────────────────────
// Creates or updates a setting

app.post('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key || typeof key !== 'string' || !key.trim()) {
    return res.status(400).json({ error: 'key is required' });
  }
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'value is required' });
  }
  try {
    await Settings.findOneAndUpdate(
      { key: key.trim() },
      { key: key.trim(), value: String(value) },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/settings/:key ──────────────────

app.delete('/api/settings/:key', async (req, res) => {
  try {
    await Settings.findOneAndDelete({ key: req.params.key });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ───────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`Interlude AI running at http://localhost:${PORT}`);
});
