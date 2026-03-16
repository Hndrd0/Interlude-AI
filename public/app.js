const STORAGE_KEY_THEME         = 'interlude_ai_theme';
const STORAGE_KEY_CHATS         = 'interlude_ai_chats';
const STORAGE_KEY_GROQ_KEY      = 'interlude_ai_groq_key';
const STORAGE_KEY_GROQ_MODEL    = 'interlude_ai_groq_model';
const STORAGE_KEY_SYSTEM_PROMPT = 'interlude_ai_system_prompt';
const STORAGE_KEY_MONGO_URL     = 'interlude_ai_mongo_url';
const STORAGE_KEY_MONGO_KEY     = 'interlude_ai_mongo_key';
const STORAGE_KEY_MONGO_DB      = 'interlude_ai_mongo_db';
const STORAGE_KEY_MONGO_DS      = 'interlude_ai_mongo_datasource';
const STORAGE_KEY_REASONING_MODEL = 'interlude_ai_reasoning_model';
const STORAGE_KEY_TTS_VOICE     = 'interlude_ai_tts_voice';

const DEFAULT_GROQ_MODEL           = 'llama-3.1-8b-instant';
const DEFAULT_SYSTEM_PROMPT        = 'You are Interlude AI, a helpful and knowledgeable assistant.';
const DEFAULT_MAX_TOKENS           = 1024;
const DEFAULT_REASONING_MODEL      = 'deepseek-r1-distill-llama-70b';
const DEFAULT_REASONING_MAX_TOKENS = 8192;
const GROQ_API_URL                 = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_WHISPER_URL             = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_TTS_URL                 = 'https://api.groq.com/openai/v1/audio/speech';
const GROQ_TTS_MODEL               = 'elevenlabs/tts';
const DEFAULT_TTS_VOICE            = 'aria';
const VISION_MODEL                 = 'meta-llama/llama-4-scout-17b-16e-instruct';
const DEFAULT_IMAGE_PROMPT         = 'What do you see in this image?';
const CAMERA_JPEG_QUALITY          = 0.85;
const DEFAULT_CAMERA_WIDTH         = 640;
const DEFAULT_CAMERA_HEIGHT        = 480;

// Maps old/deprecated Groq model aliases to their current API IDs.
const MODEL_ID_ALIASES = {
  'gpt-oss-20b':  'meta-llama/llama-4-scout-17b-16e-instruct',
  'gpt-oss-120b': 'meta-llama/llama-4-maverick-17b-128e-instruct',
};

function resolveModelId(id) {
  return MODEL_ID_ALIASES[id] || id;
}

// ─── DOM references ────────────────────────────

const chatWindow        = document.getElementById('chat-window');
const chatForm          = document.getElementById('chat-form');
const messageInput      = document.getElementById('message-input');
const sendBtn           = document.getElementById('send-btn');
const sidebar           = document.getElementById('sidebar');
const sidebarOverlay    = document.getElementById('sidebar-overlay');
const sidebarToggle     = document.getElementById('sidebar-toggle');
const sidebarClose      = document.getElementById('sidebar-close');
const newChatBtn        = document.getElementById('new-chat-btn');
const settingsBtn       = document.getElementById('settings-btn');
const settingsOverlay   = document.getElementById('settings-overlay');
const settingsClose     = document.getElementById('settings-close');
const themeToggleInput  = document.getElementById('theme-toggle-input');
const chatList          = document.getElementById('chat-list');

const groqKeyInput      = document.getElementById('groq-key-input');
const groqModelInput    = document.getElementById('groq-model-input');
const systemPromptInput = document.getElementById('system-prompt-input');
const mongoUrlInput     = document.getElementById('mongo-url-input');
const mongoKeyInput     = document.getElementById('mongo-key-input');
const mongoDbInput      = document.getElementById('mongo-db-input');
const mongoDsInput      = document.getElementById('mongo-ds-input');
const reasoningModelInput = document.getElementById('reasoning-model-input');
const ttsVoiceInput     = document.getElementById('tts-voice-input');
const saveSettingsBtn   = document.getElementById('save-settings-btn');

const micBtn       = document.getElementById('mic-btn');
const reasoningBtn = document.getElementById('reasoning-btn');
const ttsBtn       = document.getElementById('tts-btn');
const imageBtn     = document.getElementById('image-btn');
const imageMenu    = document.getElementById('image-menu');
const uploadPhotoBtn    = document.getElementById('upload-photo-btn');
const useCameraBtn      = document.getElementById('use-camera-btn');
const imageUploadInput  = document.getElementById('image-upload-input');
const cameraCaptureInput = document.getElementById('camera-capture-input');
const imagePreviewArea  = document.getElementById('image-preview-area');
const imagePreviewEl    = document.getElementById('image-preview');
const removeImageBtn    = document.getElementById('remove-image-btn');
const cameraModal       = document.getElementById('camera-modal');
const cameraVideo       = document.getElementById('camera-video');
const cameraCanvas      = document.getElementById('camera-canvas');
const capturePhotoBtn   = document.getElementById('capture-photo-btn');
const cameraCancelBtn   = document.getElementById('camera-cancel-btn');
const cameraCloseBtn    = document.getElementById('camera-close-btn');

let currentChatId = null;

// ─── Sidebar ───────────────────────────────────

function openSidebar() {
  sidebar.classList.add('is-open');
  sidebarOverlay.classList.add('is-visible');
}

function closeSidebar() {
  sidebar.classList.remove('is-open');
  sidebarOverlay.classList.remove('is-visible');
}

sidebarToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// ─── Settings modal ─────────────────────────────

async function openSettings() {
  // Prefer server-stored values (MongoDB), fall back to localStorage
  const [srvKey, srvModel, srvPrompt, srvReasoning] = await Promise.all([
    serverSettingsLoad(SETTINGS_KEYS.groqKey),
    serverSettingsLoad(SETTINGS_KEYS.groqModel),
    serverSettingsLoad(SETTINGS_KEYS.systemPrompt),
    serverSettingsLoad(SETTINGS_KEYS.reasoningModel),
  ]);

  groqKeyInput.value        = srvKey       ?? localStorage.getItem(STORAGE_KEY_GROQ_KEY)          ?? '';
  groqModelInput.value      = srvModel     ?? localStorage.getItem(STORAGE_KEY_GROQ_MODEL)        ?? '';
  systemPromptInput.value   = srvPrompt    ?? localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT)     ?? '';
  reasoningModelInput.value = srvReasoning ?? localStorage.getItem(STORAGE_KEY_REASONING_MODEL)   ?? '';
  mongoUrlInput.value       = localStorage.getItem(STORAGE_KEY_MONGO_URL)         || '';
  mongoKeyInput.value       = localStorage.getItem(STORAGE_KEY_MONGO_KEY)         || '';
  mongoDbInput.value        = localStorage.getItem(STORAGE_KEY_MONGO_DB)          || '';
  mongoDsInput.value        = localStorage.getItem(STORAGE_KEY_MONGO_DS)          || '';
  ttsVoiceInput.value       = localStorage.getItem(STORAGE_KEY_TTS_VOICE)         || '';
  settingsOverlay.classList.add('is-open');
  settingsOverlay.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  settingsOverlay.classList.remove('is-open');
  settingsOverlay.setAttribute('aria-hidden', 'true');
}

async function saveSettings() {
  const set = (key, val) => val ? localStorage.setItem(key, val) : localStorage.removeItem(key);
  const groqKey    = groqKeyInput.value.trim();
  const groqModel  = groqModelInput.value.trim();
  const sysPrompt  = systemPromptInput.value.trim();
  const rsnModel   = reasoningModelInput.value.trim();

  // Save to localStorage (fast, always available)
  set(STORAGE_KEY_GROQ_KEY,        groqKey);
  set(STORAGE_KEY_GROQ_MODEL,      groqModel);
  set(STORAGE_KEY_SYSTEM_PROMPT,   sysPrompt);
  set(STORAGE_KEY_MONGO_URL,       mongoUrlInput.value.trim());
  set(STORAGE_KEY_MONGO_KEY,       mongoKeyInput.value.trim());
  set(STORAGE_KEY_MONGO_DB,        mongoDbInput.value.trim());
  set(STORAGE_KEY_MONGO_DS,        mongoDsInput.value.trim());
  set(STORAGE_KEY_REASONING_MODEL, rsnModel);
  set(STORAGE_KEY_TTS_VOICE,       ttsVoiceInput.value.trim());

  // Persist sensitive settings to MongoDB (server-side) for security
  await Promise.all([
    groqKey   ? serverSettingsSave(SETTINGS_KEYS.groqKey,        groqKey)   : Promise.resolve(),
    groqModel ? serverSettingsSave(SETTINGS_KEYS.groqModel,      groqModel) : Promise.resolve(),
    sysPrompt ? serverSettingsSave(SETTINGS_KEYS.systemPrompt,   sysPrompt) : Promise.resolve(),
    rsnModel  ? serverSettingsSave(SETTINGS_KEYS.reasoningModel, rsnModel)  : Promise.resolve(),
  ]);

  closeSettings();
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', saveSettings);
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSettings();
    return;
  }
  // Auto-focus the message input when the user starts typing anywhere on the page
  if (settingsOverlay.classList.contains('is-open')) return;
  const activeTag = document.activeElement?.tagName?.toUpperCase();
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (messageInput.disabled) return;
  if (e.key.length === 1) {
    messageInput.focus();
  }
});

// ─── Server settings sync ───────────────────────
// Persists settings to MongoDB via the backend API (falls back gracefully).

const SETTINGS_KEYS = {
  groqKey:        'groq_api_key',
  groqModel:      'groq_model',
  systemPrompt:   'system_prompt',
  reasoningModel: 'reasoning_model',
};

async function serverSettingsSave(key, value) {
  try {
    await fetch('/api/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key, value }),
    });
  } catch {
    // Server unavailable; localStorage is the fallback
  }
}

async function serverSettingsLoad(key) {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ?? null;
  } catch {
    return null;
  }
}

// ─── Models catalogue ───────────────────────────
// Wire up collapsible category rows and "click to use" model pills.

document.querySelectorAll('.models-category__toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const list     = toggle.nextElementSibling;
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.querySelector('.models-category__chevron').textContent = expanded ? '▸' : '▾';
    if (expanded) list.setAttribute('hidden', '');
    else          list.removeAttribute('hidden');
  });
});

document.querySelectorAll('.model-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const modelId = pill.dataset.modelId;
    groqModelInput.value = modelId;
    // Flash the input to confirm the selection
    groqModelInput.classList.add('settings-input--flash');
    setTimeout(() => groqModelInput.classList.remove('settings-input--flash'), 600);
    groqModelInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});

// ─── New Chat ──────────────────────────────────

newChatBtn.addEventListener('click', () => {
  currentChatId = null;
  renderEmptyState();
  renderActiveChatInList(null);
  closeSidebar();
  messageInput.focus();
});

// ─── Theme ─────────────────────────────────────

function applyTheme(isLight) {
  if (isLight) {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  themeToggleInput.checked = isLight;
  localStorage.setItem(STORAGE_KEY_THEME, isLight ? 'light' : 'dark');
}

themeToggleInput.addEventListener('change', () => {
  applyTheme(themeToggleInput.checked);
});

// ─── Empty state ───────────────────────────────

function renderEmptyState() {
  chatWindow.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">✦</div>
      <p class="empty-state__title">How can I help you today?</p>
      <p class="empty-state__desc">Ask me anything. Powered by Groq.</p>
    </div>`;
}

// ─── Markdown renderer ─────────────────────────
// Safely converts markdown to HTML (HTML-escapes first, then applies formatting).

function renderMarkdown(raw) {
  // 1. Escape HTML to prevent XSS
  let t = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Protect code blocks with placeholders
  const codeBlocks  = [];
  const inlineCodes = [];
  t = t.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const langAttr = lang ? ` class="language-${lang}"` : '';
    codeBlocks.push(`<pre class="md-pre"><code${langAttr}>${code.trimEnd()}</code></pre>`);
    return `\x00cb${codeBlocks.length - 1}\x00`;
  });
  t = t.replace(/`([^`\n]+)`/g, (_m, code) => {
    inlineCodes.push(`<code class="md-code">${code}</code>`);
    return `\x00ic${inlineCodes.length - 1}\x00`;
  });

  // 3. Inline formatting (bold must come before italic to avoid conflicts)
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  t = t.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

  // 4. Line-by-line block processing
  const lines    = t.split('\n');
  const out      = [];
  let inUl       = false;
  let inOl       = false;
  let paraLines  = [];

  const flushPara = () => {
    if (!paraLines.length) return;
    out.push(`<p class="md-p">${paraLines.join('<br>')}</p>`);
    paraLines = [];
  };
  const closeUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };
  const closeOl = () => { if (inOl) { out.push('</ol>'); inOl = false; } };

  for (const line of lines) {
    if (!line.trim()) {
      flushPara(); closeUl(); closeOl();
      continue;
    }
    if (/\x00cb\d+\x00/.test(line)) {
      flushPara(); closeUl(); closeOl();
      out.push(line);
      continue;
    }
    if (/^---+$/.test(line)) {
      flushPara(); closeUl(); closeOl();
      out.push('<hr class="md-hr">');
      continue;
    }
    const h3 = line.match(/^### (.+)/);
    if (h3) { flushPara(); closeUl(); closeOl(); out.push(`<h3 class="md-h3">${h3[1]}</h3>`); continue; }
    const h2 = line.match(/^## (.+)/);
    if (h2) { flushPara(); closeUl(); closeOl(); out.push(`<h2 class="md-h2">${h2[1]}</h2>`); continue; }
    const h1 = line.match(/^# (.+)/);
    if (h1) { flushPara(); closeUl(); closeOl(); out.push(`<h1 class="md-h1">${h1[1]}</h1>`); continue; }
    const bq = line.match(/^&gt; (.+)/);
    if (bq) { flushPara(); closeUl(); closeOl(); out.push(`<blockquote class="md-blockquote">${bq[1]}</blockquote>`); continue; }
    const ul = line.match(/^[-*] (.+)/);
    if (ul) { flushPara(); closeOl(); if (!inUl) { out.push('<ul class="md-ul">'); inUl = true; } out.push(`<li>${ul[1]}</li>`); continue; }
    const ol = line.match(/^\d+\. (.+)/);
    if (ol) { flushPara(); closeUl(); if (!inOl) { out.push('<ol class="md-ol">'); inOl = true; } out.push(`<li>${ol[1]}</li>`); continue; }

    closeUl(); closeOl();
    paraLines.push(line);
  }
  flushPara(); closeUl(); closeOl();

  t = out.join('\n');

  // 5. Restore placeholders
  t = t.replace(/\x00cb(\d+)\x00/g,  (_, i) => codeBlocks[+i]);
  t = t.replace(/\x00ic(\d+)\x00/g,  (_, i) => inlineCodes[+i]);

  return t;
}

// ─── Messages ──────────────────────────────────

function createMessageElement(role, text, thinking = null, imageDataUrl = null) {
  const wrapper = document.createElement('div');
  wrapper.className = `message message--${role === 'user' ? 'user' : 'ai'}`;

  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';

  if (role === 'user') {
    if (imageDataUrl) {
      const img = document.createElement('img');
      img.src       = imageDataUrl;
      img.className = 'message__attached-image';
      img.alt       = 'Attached image';
      bubble.appendChild(img);
    }
    if (text) {
      const textDiv = document.createElement('div');
      textDiv.textContent = text;
      bubble.appendChild(textDiv);
    }
  } else {
    bubble.classList.add('md-content');

    if (thinking) {
      const details = document.createElement('details');
      details.className = 'reasoning-block';
      const summary = document.createElement('summary');
      summary.className = 'reasoning-block__toggle';
      summary.textContent = 'Reasoning';
      const reasoningContent = document.createElement('div');
      reasoningContent.className = 'reasoning-block__content md-content';
      reasoningContent.innerHTML = renderMarkdown(thinking);
      details.appendChild(summary);
      details.appendChild(reasoningContent);
      bubble.appendChild(details);
    }

    const answerDiv = document.createElement('div');
    answerDiv.innerHTML = renderMarkdown(text);
    bubble.appendChild(answerDiv);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  return wrapper;
}

function appendMessage(role, text, thinking = null, imageDataUrl = null) {
  const emptyState = chatWindow.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const el = createMessageElement(role, text, thinking, imageDataUrl);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

function showTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message message--ai';
  wrapper.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = 'AI';

  const indicator = document.createElement('div');
  indicator.className = 'message__bubble typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';

  wrapper.appendChild(avatar);
  wrapper.appendChild(indicator);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function setInputEnabled(enabled) {
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

// ─── Local storage helpers ─────────────────────

function localChatsGet() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_CHATS) || '[]'); }
  catch { return []; }
}

function localChatsSet(chats) {
  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
}

function generateId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── MongoDB Atlas Data API helpers ────────────
//
// Point STORAGE_KEY_MONGO_URL at your Atlas App Services Data API base URL, e.g.:
//   https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1
//
// Leave the URL and key blank to fall back to localStorage-only mode.

function mongoIsConfigured() {
  const url = localStorage.getItem(STORAGE_KEY_MONGO_URL);
  const key = localStorage.getItem(STORAGE_KEY_MONGO_KEY);
  return !!(url && key);
}

async function mongoAction(action, query) {
  const url    = (localStorage.getItem(STORAGE_KEY_MONGO_URL) || '').replace(/\/$/, '');
  const key    = localStorage.getItem(STORAGE_KEY_MONGO_KEY) || '';
  const db     = localStorage.getItem(STORAGE_KEY_MONGO_DB)  || 'interlude-ai';
  const source = localStorage.getItem(STORAGE_KEY_MONGO_DS)  || 'Cluster0';

  const res = await fetch(`${url}/action/${action}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body:    JSON.stringify({ dataSource: source, database: db, collection: 'chats', ...query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `MongoDB API error (${res.status})`);
  }
  return res.json();
}

// ─── Chat persistence layer ────────────────────

async function getChats() {
  if (mongoIsConfigured()) {
    const data = await mongoAction('find', {
      filter:     {},
      sort:       { updatedAt: -1 },
      projection: { title: 1, createdAt: 1, updatedAt: 1 },
    });
    return data.documents || [];
  }
  return localChatsGet()
    .map(({ _id, title, createdAt, updatedAt }) => ({ _id, title, createdAt, updatedAt }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getChatById(chatId) {
  if (mongoIsConfigured()) {
    const data = await mongoAction('findOne', { filter: { _id: chatId } });
    return data.document;
  }
  return localChatsGet().find(c => c._id === chatId) || null;
}

async function upsertChat(chat) {
  if (mongoIsConfigured()) {
    await mongoAction('updateOne', {
      filter: { _id: chat._id },
      update: { $set: chat },
      upsert: true,
    });
  }
  const chats = localChatsGet();
  const idx = chats.findIndex(c => c._id === chat._id);
  if (idx >= 0) chats[idx] = chat;
  else chats.unshift(chat);
  localChatsSet(chats);
}

async function removeChat(chatId) {
  if (mongoIsConfigured()) {
    await mongoAction('deleteOne', { filter: { _id: chatId } });
  }
  localChatsSet(localChatsGet().filter(c => c._id !== chatId));
}

// ─── Chat history (sidebar) ────────────────────

async function loadChats() {
  try {
    const chats = await getChats();
    renderChatList(chats);
  } catch (err) {
    console.error('Failed to load chats:', err);
  }
}

function renderChatList(chats) {
  chatList.innerHTML = '';
  if (!chats.length) {
    const empty = document.createElement('p');
    empty.className = 'chat-list__empty';
    empty.textContent = 'No conversations yet';
    chatList.appendChild(empty);
    return;
  }
  chats.forEach(chat => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'chat-list__item';
    item.dataset.id = chat._id;
    if (chat._id === currentChatId) item.classList.add('is-active');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-list__title';
    titleSpan.textContent = chat.title || 'New Chat';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'chat-list__delete';
    deleteBtn.setAttribute('aria-label', 'Delete chat');
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteChatAndUpdate(chat._id);
    });

    item.appendChild(titleSpan);
    item.appendChild(deleteBtn);
    item.addEventListener('click', () => loadChatById(chat._id));
    chatList.appendChild(item);
  });
}

function renderActiveChatInList(chatId) {
  chatList.querySelectorAll('.chat-list__item').forEach(item => {
    item.classList.toggle('is-active', item.dataset.id === chatId);
  });
}

async function loadChatById(chatId) {
  try {
    const chat = await getChatById(chatId);
    if (!chat) return;
    currentChatId = chatId;

    chatWindow.innerHTML = '';
    if (!chat.messages.length) {
      renderEmptyState();
    } else {
      chat.messages.forEach(msg => appendMessage(msg.role, msg.content));
    }

    renderActiveChatInList(chatId);
    closeSidebar();
    messageInput.focus();
  } catch (err) {
    console.error('Failed to load chat:', err);
  }
}

async function deleteChatAndUpdate(chatId) {
  try {
    await removeChat(chatId);
    if (chatId === currentChatId) {
      currentChatId = null;
      renderEmptyState();
    }
    await loadChats();
  } catch (err) {
    console.error('Failed to delete chat:', err);
  }
}

// ─── Groq API ──────────────────────────────────

async function callGroq(messages) {
  const apiKey = localStorage.getItem(STORAGE_KEY_GROQ_KEY);
  if (!apiKey) {
    throw new Error('Groq API key not configured. Open ⚙ Settings to add your API key.');
  }
  const model        = resolveModelId(localStorage.getItem(STORAGE_KEY_GROQ_MODEL) || DEFAULT_GROQ_MODEL);
  const systemPrompt = localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT;

  const groqMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const res = await fetch(GROQ_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: groqMessages, max_tokens: DEFAULT_MAX_TOKENS }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API error (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? 'No response received.';
}

// ─── Groq Reasoning API ────────────────────────

async function callGroqReasoning(messages) {
  const apiKey = localStorage.getItem(STORAGE_KEY_GROQ_KEY);
  if (!apiKey) {
    throw new Error('Groq API key not configured for Reasoning mode. Open ⚙ Settings to add your Groq API key.');
  }
  const model        = resolveModelId(localStorage.getItem(STORAGE_KEY_REASONING_MODEL) || DEFAULT_REASONING_MODEL);
  const systemPrompt = localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT;

  const reasoningMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const res = await fetch(GROQ_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: reasoningMessages, max_tokens: DEFAULT_REASONING_MAX_TOKENS }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API error (${res.status})`);
  }

  const data   = await res.json();
  const choice = data.choices?.[0];
  const raw    = choice?.message?.content ?? 'No response received.';

  // Groq exposes reasoning in a dedicated field for some models; fall back to
  // parsing <think>…</think> blocks that DeepSeek-style models embed in content.
  let thinking = choice?.message?.reasoning_content ?? null;
  let content  = raw;

  if (!thinking) {
    const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>\s*/);
    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
      content  = raw.replace(thinkMatch[0], '').trim() || 'No response received.';
    }
  }

  return { thinking, content };
}

// ─── Reasoning mode ────────────────────────────

let isReasoningMode = false;

function toggleReasoningMode() {
  isReasoningMode = !isReasoningMode;
  reasoningBtn.classList.toggle('is-active', isReasoningMode);
  reasoningBtn.setAttribute('aria-pressed', String(isReasoningMode));
}

reasoningBtn.addEventListener('click', toggleReasoningMode);

// ─── TTS mode ──────────────────────────────────

let isTTSMode = false;

function toggleTTSMode() {
  isTTSMode = !isTTSMode;
  ttsBtn.classList.toggle('is-active', isTTSMode);
  ttsBtn.setAttribute('aria-pressed', String(isTTSMode));
}

ttsBtn.addEventListener('click', toggleTTSMode);

// ─── Groq TTS (ElevenLabs) ─────────────────────

async function callGroqTTS(text) {
  const apiKey = localStorage.getItem(STORAGE_KEY_GROQ_KEY);
  if (!apiKey) return;

  try {
    const voice = localStorage.getItem(STORAGE_KEY_TTS_VOICE) || DEFAULT_TTS_VOICE;
    const res = await fetch(GROQ_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: GROQ_TTS_MODEL, input: text, voice }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('TTS error:', errData.error?.message || `TTS error (${res.status})`);
      return;
    }

    const audioBuffer = await res.arrayBuffer();
    const audioBlob   = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl    = URL.createObjectURL(audioBlob);
    const audio       = new Audio(audioUrl);
    audio.play();
    audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl));
  } catch (err) {
    console.error('TTS error:', err.message);
  }
}

// ─── Groq Vision API (Llama 4 Scout) ───────────

async function callGroqVision(messages, imageDataUrl) {
  const apiKey = localStorage.getItem(STORAGE_KEY_GROQ_KEY);
  if (!apiKey) {
    throw new Error('Groq API key not configured. Open ⚙ Settings to add your API key.');
  }
  const systemPrompt = localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT;

  // Build the vision messages array.
  // All prior messages are plain text; the current (last) user message includes the image.
  const visionMessages = [{ role: 'system', content: systemPrompt }];
  const prevMessages   = messages.slice(0, -1);
  prevMessages.forEach(m => visionMessages.push({ role: m.role, content: m.content }));

  const lastMsg = messages[messages.length - 1];
  visionMessages.push({
    role: 'user',
    content: [
      { type: 'text',      text: lastMsg.content },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
  });

  const res = await fetch(GROQ_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: VISION_MODEL, messages: visionMessages, max_tokens: DEFAULT_MAX_TOKENS }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API error (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? 'No response received.';
}

// ─── Image attachment ──────────────────────────

let pendingImage = null; // { dataUrl: string, mimeType: string } | null

function setPendingImage(dataUrl, mimeType) {
  pendingImage            = { dataUrl, mimeType };
  imagePreviewEl.src      = dataUrl;
  imagePreviewArea.removeAttribute('hidden');
}

function clearPendingImage() {
  pendingImage = null;
  imagePreviewEl.src = '';
  imagePreviewArea.setAttribute('hidden', '');
}

removeImageBtn.addEventListener('click', clearPendingImage);

// Toggle the image attachment dropdown menu
imageBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isHidden = imageMenu.hasAttribute('hidden');
  if (isHidden) {
    imageMenu.removeAttribute('hidden');
    imageBtn.setAttribute('aria-expanded', 'true');
  } else {
    imageMenu.setAttribute('hidden', '');
    imageBtn.setAttribute('aria-expanded', 'false');
  }
});

// Close menu when clicking outside
document.addEventListener('click', () => {
  if (!imageMenu.hasAttribute('hidden')) {
    imageMenu.setAttribute('hidden', '');
    imageBtn.setAttribute('aria-expanded', 'false');
  }
});

// ── Upload Photo ───────────────────────────────

uploadPhotoBtn.addEventListener('click', () => {
  imageMenu.setAttribute('hidden', '');
  imageBtn.setAttribute('aria-expanded', 'false');
  imageUploadInput.click();
});

imageUploadInput.addEventListener('change', () => {
  const file = imageUploadInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => setPendingImage(e.target.result, file.type || 'image/jpeg');
  reader.readAsDataURL(file);
  imageUploadInput.value = '';
});

// ── Camera ─────────────────────────────────────

let cameraStream = null;

useCameraBtn.addEventListener('click', async () => {
  imageMenu.setAttribute('hidden', '');
  imageBtn.setAttribute('aria-expanded', 'false');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Fallback: use native file capture on devices that don't support getUserMedia
    cameraCaptureInput.click();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    cameraStream         = stream;
    cameraVideo.srcObject = stream;
    cameraModal.removeAttribute('hidden');
  } catch {
    // Camera permission denied or unavailable — fall back to file input with capture
    cameraCaptureInput.click();
  }
});

cameraCaptureInput.addEventListener('change', () => {
  const file = cameraCaptureInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => setPendingImage(e.target.result, file.type || 'image/jpeg');
  reader.readAsDataURL(file);
  cameraCaptureInput.value = '';
});

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraModal.setAttribute('hidden', '');
}

capturePhotoBtn.addEventListener('click', () => {
  if (!cameraStream) return;
  cameraCanvas.width  = cameraVideo.videoWidth  || DEFAULT_CAMERA_WIDTH;
  cameraCanvas.height = cameraVideo.videoHeight || DEFAULT_CAMERA_HEIGHT;
  cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0);
  const dataUrl = cameraCanvas.toDataURL('image/jpeg', CAMERA_JPEG_QUALITY);
  setPendingImage(dataUrl, 'image/jpeg');
  closeCamera();
});

cameraCancelBtn.addEventListener('click', closeCamera);
cameraCloseBtn.addEventListener('click', closeCamera);

// ─── Microphone / Speech-to-Text ───────────────

let mediaRecorder  = null;
let audioChunks    = [];
let isRecording    = false;

micBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    appendMessage('assistant', 'Error: Microphone access is not supported in this browser.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks  = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      await processAudioTranscription(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add('is-recording');
    micBtn.setAttribute('aria-label', 'Stop recording');
  } catch (err) {
    appendMessage('assistant', `Microphone error: ${err.message}`);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  micBtn.classList.remove('is-recording');
  micBtn.setAttribute('aria-label', 'Start recording');
}

async function processAudioTranscription(audioBlob) {
  const apiKey = localStorage.getItem(STORAGE_KEY_GROQ_KEY);
  if (!apiKey) {
    appendMessage('assistant', 'Error: Groq API key not configured. Open ⚙ Settings to add your API key for transcription.');
    return;
  }

  micBtn.disabled = true;
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'json');

    const res = await fetch(GROQ_WHISPER_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body:    formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Transcription error (${res.status})`);
    }

    const data = await res.json();
    const text = (data.text || '').trim();

    if (text) {
      messageInput.value = messageInput.value
        ? `${messageInput.value} ${text}`
        : text;
      autoResizeTextarea();
      messageInput.focus();
    }
  } catch (err) {
    appendMessage('assistant', `Transcription error: ${err.message}`);
  } finally {
    micBtn.disabled = false;
  }
}

// ─── Send message ──────────────────────────────

async function sendMessage(userText, image = null) {
  appendMessage('user', userText, null, image?.dataUrl ?? null);
  setInputEnabled(false);
  showTypingIndicator();

  try {
    let chat = currentChatId ? await getChatById(currentChatId) : null;
    if (!chat) {
      chat = {
        _id:       generateId(),
        title:     userText.slice(0, 60),
        messages:  [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    chat.messages.push({ role: 'user', content: userText, type: 'text' });

    const history = chat.messages
      .filter(m => m.type === 'text')
      .map(m => ({ role: m.role, content: m.content }));

    let reply = null, thinking = null;
    if (image) {
      // Vision: use Llama 4 Scout to analyse the attached image
      reply    = await callGroqVision(history, image.dataUrl);
      thinking = null;
    } else if (isReasoningMode) {
      const result = await callGroqReasoning(history);
      reply    = result.content;
      thinking = result.thinking;
    } else {
      reply    = await callGroq(history);
      thinking = null;
    }

    chat.messages.push({ role: 'assistant', content: reply, type: 'text' });
    chat.updatedAt = new Date().toISOString();
    await upsertChat(chat);
    currentChatId = chat._id;

    hideTypingIndicator();
    appendMessage('assistant', reply, thinking);

    // Auto-play TTS when Speak mode is active
    if (isTTSMode) {
      callGroqTTS(reply);
    }

    await loadChats();
    renderActiveChatInList(currentChatId);
  } catch (err) {
    hideTypingIndicator();
    appendMessage('assistant', `Error: ${err.message}`);
  } finally {
    setInputEnabled(true);
    messageInput.focus();
  }
}

// ─── Form submit ───────────────────────────────

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text  = messageInput.value.trim();
  const image = pendingImage;
  if (!text && !image) return;
  messageInput.value = '';
  autoResizeTextarea();
  clearPendingImage();
  sendMessage(text || DEFAULT_IMAGE_PROMPT, image);
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}

messageInput.addEventListener('input', autoResizeTextarea);

// ─── Init ──────────────────────────────────────

const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
applyTheme(savedTheme === 'light');

renderEmptyState();
loadChats();
