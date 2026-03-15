const STORAGE_KEY_THEME = 'interlude_ai_theme';

// ─── DOM references ────────────────────────────

const chatWindow       = document.getElementById('chat-window');
const chatForm         = document.getElementById('chat-form');
const messageInput     = document.getElementById('message-input');
const sendBtn          = document.getElementById('send-btn');
const sidebar          = document.getElementById('sidebar');
const sidebarOverlay   = document.getElementById('sidebar-overlay');
const sidebarToggle    = document.getElementById('sidebar-toggle');
const sidebarClose     = document.getElementById('sidebar-close');
const newChatBtn       = document.getElementById('new-chat-btn');
const settingsBtn      = document.getElementById('settings-btn');
const settingsOverlay  = document.getElementById('settings-overlay');
const settingsClose    = document.getElementById('settings-close');
const themeToggleInput = document.getElementById('theme-toggle-input');
const imageModeBtn     = document.getElementById('image-mode-btn');
const inputHint        = document.getElementById('input-hint');
const chatList         = document.getElementById('chat-list');

let currentChatId = null;
let imageMode = false;

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

// ─── Image mode toggle ─────────────────────────

function setImageMode(active) {
  imageMode = active;
  imageModeBtn.classList.toggle('is-active', active);
  if (active) {
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

// ─── Empty state ───────────────────────────────

function renderEmptyState() {
  chatWindow.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">✦</div>
      <p class="empty-state__title">How can I help you today?</p>
      <p class="empty-state__desc">Ask me anything, or toggle <strong>Image</strong> to generate images via Hugging Face.</p>
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
}

// ─── Chat history (sidebar) ────────────────────

async function loadChats() {
  try {
    const res = await fetch('/api/chats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chats = await res.json();
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
      await deleteChat(chat._id);
    });

    item.appendChild(titleSpan);
    item.appendChild(deleteBtn);
    item.addEventListener('click', () => loadChat(chat._id));
    chatList.appendChild(item);
  });
}

function renderActiveChatInList(chatId) {
  chatList.querySelectorAll('.chat-list__item').forEach(item => {
    item.classList.toggle('is-active', item.dataset.id === chatId);
  });
}

async function loadChat(chatId) {
  try {
    const res = await fetch(`/api/chats/${chatId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chat = await res.json();
    currentChatId = chatId;

    chatWindow.innerHTML = '';
    if (!chat.messages.length) {
      renderEmptyState();
    } else {
      chat.messages.forEach(msg => {
        if (msg.type === 'image') {
          appendImageMessage(msg.content, '');
        } else {
          appendMessage(msg.role, msg.content);
        }
      });
    }

    renderActiveChatInList(chatId);
    closeSidebar();
    messageInput.focus();
  } catch (err) {
    console.error('Failed to load chat:', err);
  }
}

async function deleteChat(chatId) {
  try {
    await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
    if (chatId === currentChatId) {
      currentChatId = null;
      renderEmptyState();
    }
    await loadChats();
  } catch (err) {
    console.error('Failed to delete chat:', err);
  }
}

// ─── Send chat message ─────────────────────────

async function sendMessage(userText) {
  appendMessage('user', userText);
  setInputEnabled(false);
  showTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: currentChatId, message: userText }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }

    const data = await res.json();
    currentChatId = data.chatId;

    hideTypingIndicator();
    appendMessage('assistant', data.reply);
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

// ─── Generate image ────────────────────────────

async function generateImage(prompt) {
  appendMessage('user', prompt);
  setInputEnabled(false);
  showTypingIndicator();

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: currentChatId, prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }

    const data = await res.json();
    currentChatId = data.chatId;

    hideTypingIndicator();
    appendImageMessage(data.imageData, prompt);
    await loadChats();
    renderActiveChatInList(currentChatId);
  } catch (err) {
    hideTypingIndicator();
    appendMessage('assistant', `Image generation error: ${err.message}`);
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

renderEmptyState();
loadChats();
