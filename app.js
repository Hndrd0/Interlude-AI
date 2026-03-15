const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama3-8b-8192';
const STORAGE_KEY = 'interlude_ai_groq_key';

const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const apiKeyStatus = document.getElementById('api-key-status');
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

let conversationHistory = [];

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
  setApiKeyStatus('API key saved.', 'success');
  renderEmptyStateOrHistory();
});

function renderEmptyState() {
  chatWindow.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">💬</div>
      <p class="empty-state__title">Start a conversation</p>
      <p class="empty-state__desc">Ask me anything — I'm here to help.</p>
    </div>`;
}

function renderEmptyStateOrHistory() {
  if (conversationHistory.length === 0) {
    renderEmptyState();
  }
}

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

function appendMessage(role, text) {
  const emptyState = chatWindow.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const el = createMessageElement(role, text);
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

async function sendMessage(userText) {
  const apiKey = getApiKey();
  if (!apiKey) {
    setApiKeyStatus('Please save your Groq API key first.', 'error');
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

// Init
if (getApiKey()) {
  setApiKeyStatus('API key loaded.', 'success');
}
renderEmptyState();
