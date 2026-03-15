const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const HF_IMAGE_API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';
const HF_VIDEO_API_URL = 'https://api-inference.huggingface.co/models/tencent/HunyuanVideo';

const STORAGE_KEY_GROQ = 'interlude_ai_groq_key';
const STORAGE_KEY_HF   = 'interlude_ai_hf_key';
const STORAGE_KEY_THEME = 'interlude_ai_theme';

// ─── DOM references ────────────────────────────

const apiKeyInput     = document.getElementById('api-key-input');
const saveKeyBtn      = document.getElementById('save-key-btn');
const apiKeyStatus    = document.getElementById('api-key-status');
const hfApiKeyInput   = document.getElementById('hf-api-key-input');
const saveHfKeyBtn    = document.getElementById('save-hf-key-btn');
const hfApiKeyStatus  = document.getElementById('hf-api-key-status');
const chatWindow      = document.getElementById('chat-window');
const chatForm        = document.getElementById('chat-form');
const messageInput    = document.getElementById('message-input');
const sendBtn         = document.getElementById('send-btn');
const sidebar         = document.getElementById('sidebar');
const sidebarOverlay  = document.getElementById('sidebar-overlay');
const sidebarToggle   = document.getElementById('sidebar-toggle');
const sidebarClose    = document.getElementById('sidebar-close');
const newChatBtn      = document.getElementById('new-chat-btn');
const settingsBtn     = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose   = document.getElementById('settings-close');
const themeToggleInput = document.getElementById('theme-toggle-input');
const imageModeBtn    = document.getElementById('image-mode-btn');
const videoModeBtn    = document.getElementById('video-mode-btn');
const inputHint       = document.getElementById('input-hint');

let conversationHistory = [];
let imageMode = false;
let videoMode = false;

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

function openSettings() {
  settingsOverlay.classList.add('is-open');
  settingsOverlay.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  settingsOverlay.classList.remove('is-open');
  settingsOverlay.setAttribute('aria-hidden', 'true');
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettings();
});

// ─── New Chat ──────────────────────────────────

newChatBtn.addEventListener('click', () => {
  conversationHistory = [];
  renderEmptyState();
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

// ─── Groq API Key ──────────────────────────────

function getGroqApiKey() {
  return localStorage.getItem(STORAGE_KEY_GROQ) || '';
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
  localStorage.setItem(STORAGE_KEY_GROQ, key);
  apiKeyInput.value = '';
  setApiKeyStatus('Groq API key saved.', 'success');
});

// ─── HuggingFace API Key ───────────────────────

function getHfApiKey() {
  return localStorage.getItem(STORAGE_KEY_HF) || '';
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
  localStorage.setItem(STORAGE_KEY_HF, key);
  hfApiKeyInput.value = '';
  setHfApiKeyStatus('Hugging Face API key saved.', 'success');
});

// ─── Image mode toggle ─────────────────────────

function setImageMode(active) {
  imageMode = active;
  imageModeBtn.classList.toggle('is-active', active);
  if (active) {
    if (videoMode) setVideoMode(false);
    messageInput.placeholder = 'Describe an image to generate…';
    inputHint.innerHTML = 'Image generation via Hugging Face · <kbd>Enter</kbd> to generate';
  } else {
    messageInput.placeholder = 'Message Interlude AI…';
    inputHint.innerHTML = 'Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line';
  }
  messageInput.focus();
}

imageModeBtn.addEventListener('click', () => {
  setImageMode(!imageMode);
});

// ─── Video mode toggle ─────────────────────────

function setVideoMode(active) {
  videoMode = active;
  videoModeBtn.classList.toggle('is-active', active);
  if (active) {
    if (imageMode) setImageMode(false);
    messageInput.placeholder = 'Describe a video to generate…';
    inputHint.innerHTML = 'Video generation via Hugging Face · <kbd>Enter</kbd> to generate · Generation may take several minutes';
  } else {
    messageInput.placeholder = 'Message Interlude AI…';
    inputHint.innerHTML = 'Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line';
  }
  messageInput.focus();
}

videoModeBtn.addEventListener('click', () => {
  setVideoMode(!videoMode);
});

// ─── Empty state ───────────────────────────────

function renderEmptyState() {
  chatWindow.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">✦</div>
      <p class="empty-state__title">How can I help you today?</p>
      <p class="empty-state__desc">Ask me anything. Toggle <strong>Image</strong> to generate images or <strong>Video</strong> to generate videos via Hugging Face.</p>
    </div>`;
}

// ─── Messages ──────────────────────────────────

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

function createImageMessageElement(imageUrl, prompt) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message message--ai';

  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';

  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = prompt;
  img.className = 'message__image';

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

function appendImageMessage(imageUrl, prompt) {
  const emptyState = chatWindow.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const el = createImageMessageElement(imageUrl, prompt);
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
  imageModeBtn.disabled = !enabled;
  videoModeBtn.disabled = !enabled;
}

// ─── Send chat message (Groq) ──────────────────

async function sendMessage(userText) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    setApiKeyStatus('Please save your Groq API key first.', 'error');
    openSettings();
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

// ─── Generate image (Hugging Face) ────────────

async function generateImage(prompt) {
  const apiKey = getHfApiKey();
  if (!apiKey) {
    setHfApiKeyStatus('Please save your Hugging Face API key first.', 'error');
    openSettings();
    return;
  }

  appendMessage('user', prompt);
  setInputEnabled(false);
  showTypingIndicator();

  try {
    const response = await fetch(HF_IMAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errMsg = `Request failed (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    hideTypingIndicator();
    appendImageMessage(imageUrl, prompt);
  } catch (err) {
    hideTypingIndicator();
    appendMessage('assistant', `Image generation error: ${err.message}`);
  } finally {
    setInputEnabled(true);
    messageInput.focus();
  }
}

// ─── Generate video (Hugging Face) ────────────

function createVideoMessageElement(videoUrl, prompt) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message message--ai';

  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';

  const video = document.createElement('video');
  video.src = videoUrl;
  video.controls = true;
  video.className = 'message__video';
  video.setAttribute('aria-label', prompt);

  bubble.appendChild(video);
  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  return wrapper;
}

function appendVideoMessage(videoUrl, prompt) {
  const emptyState = chatWindow.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const el = createVideoMessageElement(videoUrl, prompt);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

async function generateVideo(prompt) {
  const apiKey = getHfApiKey();
  if (!apiKey) {
    setHfApiKeyStatus('Please save your Hugging Face API key first.', 'error');
    openSettings();
    return;
  }

  appendMessage('user', prompt);
  setInputEnabled(false);

  const emptyState = chatWindow.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const noticeEl = document.createElement('div');
  noticeEl.className = 'message message--ai';
  noticeEl.id = 'video-notice';
  noticeEl.innerHTML = `
    <div class="message__avatar">AI</div>
    <div class="message__bubble video-generating-notice">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
      <p class="video-generating-notice__text">⏳ Generating your video… this may take several minutes. Please wait.</p>
    </div>`;
  chatWindow.appendChild(noticeEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const response = await fetch(HF_VIDEO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errMsg = `Request failed (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const blob = await response.blob();
    const videoUrl = URL.createObjectURL(blob);

    const notice = document.getElementById('video-notice');
    if (notice) notice.remove();
    appendVideoMessage(videoUrl, prompt);
  } catch (err) {
    const notice = document.getElementById('video-notice');
    if (notice) notice.remove();
    appendMessage('assistant', `Video generation error: ${err.message}`);
  } finally {
    setInputEnabled(true);
    messageInput.focus();
  }
}

// ─── Form submit ───────────────────────────────

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = '';
  autoResizeTextarea();
  if (imageMode) {
    generateImage(text);
  } else if (videoMode) {
    generateVideo(text);
  } else {
    sendMessage(text);
  }
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

if (getGroqApiKey()) {
  setApiKeyStatus('API key loaded.', 'success');
}
if (getHfApiKey()) {
  setHfApiKeyStatus('API key loaded.', 'success');
}

renderEmptyState();
