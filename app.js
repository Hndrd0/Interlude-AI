const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const STORAGE_KEY = 'interlude_ai_groq_key';

const HF_API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.2-klein-9B';
const HF_STORAGE_KEY = 'interlude_ai_hf_key';

const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const apiKeyStatus = document.getElementById('api-key-status');
const hfApiKeyInput = document.getElementById('hf-api-key-input');
const saveHfKeyBtn = document.getElementById('save-hf-key-btn');
const hfApiKeyStatus = document.getElementById('hf-api-key-status');
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const newChatBtn = document.getElementById('new-chat-btn');
const modeChatBtn = document.getElementById('mode-chat-btn');
const modeImageBtn = document.getElementById('mode-image-btn');
const modeStatus = document.getElementById('mode-status');

let conversationHistory = [];
let currentMode = 'chat'; // 'chat' | 'image'
let imageObjectUrls = [];

// ─── Sidebar ───────────────────────────────────────────────

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

// ─── New Chat ──────────────────────────────────────────────

newChatBtn.addEventListener('click', () => {
  conversationHistory = [];
  imageObjectUrls.forEach(url => URL.revokeObjectURL(url));
  imageObjectUrls = [];
  renderEmptyState();
  closeSidebar();
  messageInput.focus();
});

// ─── API Key (Groq) ────────────────────────────────────────

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function setApiKeyStatus(message, type) {
  apiKeyStatus.textContent = message;
  apiKeyStatus.className = `api-key-section__status api-key-section__status--${type}`;
}

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setApiKeyStatus('Please enter a valid API key.', 'error');
    return;
  }
  localStorage.setItem(STORAGE_KEY, key);
  apiKeyInput.value = '';
  setApiKeyStatus('API key saved successfully.', 'success');
});

// ─── API Key (Hugging Face) ────────────────────────────────

function getHfApiKey() {
  return localStorage.getItem(HF_STORAGE_KEY) || '';
}

function setHfApiKeyStatus(message, type) {
  hfApiKeyStatus.textContent = message;
  hfApiKeyStatus.className = `api-key-section__status api-key-section__status--${type}`;
}

saveHfKeyBtn.addEventListener('click', () => {
  const key = hfApiKeyInput.value.trim();
  if (!key) {
    setHfApiKeyStatus('Please enter a valid API key.', 'error');
    return;
  }
  localStorage.setItem(HF_STORAGE_KEY, key);
  hfApiKeyInput.value = '';
  setHfApiKeyStatus('API key saved successfully.', 'success');
});

// ─── Mode Toggle ───────────────────────────────────────────

function setMode(mode) {
  currentMode = mode;
  if (mode === 'chat') {
    modeChatBtn.classList.add('mode-toggle__btn--active');
    modeImageBtn.classList.remove('mode-toggle__btn--active');
    messageInput.placeholder = 'Message Interlude AI…';
    modeStatus.textContent = '';
  } else {
    modeImageBtn.classList.add('mode-toggle__btn--active');
    modeChatBtn.classList.remove('mode-toggle__btn--active');
    messageInput.placeholder = 'Describe an image to generate…';
    modeStatus.textContent = 'Using FLUX.2-klein-9B';
    modeStatus.className = 'api-key-section__status api-key-section__status--success';
  }
}

modeChatBtn.addEventListener('click', () => setMode('chat'));
modeImageBtn.addEventListener('click', () => setMode('image'));

// ─── Empty state ───────────────────────────────────────────

function renderEmptyState() {
  chatWindow.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">✦</div>
      <p class="empty-state__title">How can I help you today?</p>
      <p class="empty-state__desc">Ask me anything — I'm powered by Groq's fast inference.</p>
    </div>`;
}

// ─── Messages ──────────────────────────────────────────────

function createMessageElement(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `message message--${role === 'user' ? 'user' : 'ai'}`;

  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';
  bubble.textContent = text;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  return wrapper;
}

function createImageMessageElement(objectUrl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message message--ai';

  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble message__bubble--image';

  const img = document.createElement('img');
  img.src = objectUrl;
  img.alt = 'Generated image';
  img.className = 'generated-image';

  bubble.appendChild(img);
  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  return wrapper;
}

function appendMessage(role, text) {
  const emptyState = chatWindow.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const el = createMessageElement(role, text);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

function appendImageMessage(objectUrl) {
  const emptyState = chatWindow.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const el = createImageMessageElement(objectUrl);
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

// ─── Image generation ──────────────────────────────────────

async function generateImage(prompt) {
  const hfKey = getHfApiKey();
  if (!hfKey) {
    setHfApiKeyStatus('Please save your Hugging Face API key first.', 'error');
    openSidebar();
    return;
  }

  appendMessage('user', prompt);
  setInputEnabled(false);
  showTypingIndicator();

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfKey}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${response.status}): unable to parse error response`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    imageObjectUrls.push(objectUrl);

    hideTypingIndicator();
    appendImageMessage(objectUrl);
  } catch (err) {
    hideTypingIndicator();
    appendMessage('assistant', `Error: ${err.message}`);
  } finally {
    setInputEnabled(true);
    messageInput.focus();
  }
}

// ─── Send message ──────────────────────────────────────────

async function sendMessage(userText) {
  if (currentMode === 'image') {
    await generateImage(userText);
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    setApiKeyStatus('Please save your Groq API key first.', 'error');
    openSidebar();
    return;
  }

  conversationHistory.push({ role: 'user', content: userText });
  appendMessage('user', userText);
  setInputEnabled(false);
  showTypingIndicator();

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Request failed (${response.status})`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? 'No response received.';
    conversationHistory.push({ role: 'assistant', content: reply });

    hideTypingIndicator();
    appendMessage('assistant', reply);
  } catch (err) {
    hideTypingIndicator();
    appendMessage('assistant', `Error: ${err.message}`);
  } finally {
    setInputEnabled(true);
    messageInput.focus();
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = '';
  autoResizeTextarea();
  sendMessage(text);
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

// ─── Init ──────────────────────────────────────────────────

if (getApiKey()) {
  setApiKeyStatus('API key loaded.', 'success');
}
if (getHfApiKey()) {
  setHfApiKeyStatus('API key loaded.', 'success');
}
renderEmptyState();
