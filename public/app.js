const DOM = {
  sidebar: document.getElementById('sidebar'),
  newChatBtn: document.getElementById('new-chat-btn'),
  chatHistoryList: document.getElementById('chat-history-list'),
  modelSelect: document.getElementById('model-select'),
  chatMessages: document.getElementById('chat-messages'),
  chatContainer: document.querySelector('.chat-container'),
  chatForm: document.getElementById('chat-form'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  welcomeScreen: document.querySelector('.welcome-screen'),
  inputAreaWrapper: document.querySelector('.input-area-wrapper')
};

const STATE = {
  chats: JSON.parse(localStorage.getItem('claude_chats') || '[]'),
  currentChatId: null,
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function saveState() {
  localStorage.setItem('claude_chats', JSON.stringify(STATE.chats));
}

// Auto-resize textarea
DOM.messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';

  // Show/hide send button based on input
  if (this.value.trim().length > 0) {
    DOM.sendBtn.style.display = 'flex';
  } else {
    DOM.sendBtn.style.display = 'none';
  }
});

DOM.messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (DOM.messageInput.value.trim().length > 0) {
      DOM.chatForm.dispatchEvent(new Event('submit'));
    }
  }
});

// Render Chat History Sidebar
function renderSidebar() {
  DOM.chatHistoryList.innerHTML = '';
  STATE.chats.sort((a, b) => b.updatedAt - a.updatedAt).forEach(chat => {
    const li = document.createElement('li');
    li.className = `sidebar-item ${chat.id === STATE.currentChatId ? 'active' : ''}`;
    li.textContent = chat.title || 'New Chat';
    li.addEventListener('click', () => loadChat(chat.id));
    DOM.chatHistoryList.appendChild(li);
  });
}

// Load specific chat
function loadChat(chatId) {
  STATE.currentChatId = chatId;
  const chat = STATE.chats.find(c => c.id === chatId);

  DOM.chatMessages.innerHTML = '';
  if (chat && chat.messages.length > 0) {
    DOM.chatContainer.classList.add('has-messages');

    // Move input to bottom
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'fixed-bottom-input';
    inputWrapper.appendChild(DOM.inputAreaWrapper);
    DOM.chatContainer.appendChild(inputWrapper);

    chat.messages.forEach(msg => {
      appendMessageToUI(msg.role, msg.content);
    });
  } else {
    startNewChatUI();
  }

  renderSidebar();
}

function startNewChatUI() {
  STATE.currentChatId = null;
  DOM.chatMessages.innerHTML = '';
  DOM.chatContainer.classList.remove('has-messages');

  // Remove fixed bottom input wrapper if it exists and put input back in welcome screen
  const fixedInput = document.querySelector('.fixed-bottom-input');
  if (fixedInput) {
    DOM.welcomeScreen.appendChild(DOM.inputAreaWrapper);
    fixedInput.remove();
  }

  DOM.chatMessages.appendChild(DOM.welcomeScreen);
  renderSidebar();
  DOM.messageInput.focus();
}

// Start new chat
DOM.newChatBtn.addEventListener('click', startNewChatUI);

// Append message to UI
function appendMessageToUI(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  if (role === 'assistant') {
    const icon = document.createElement('div');
    icon.className = 'assistant-icon';
    msgDiv.appendChild(icon);
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content; // Using textContent for basic safety

  msgDiv.appendChild(contentDiv);
  DOM.chatMessages.appendChild(msgDiv);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function showLoading() {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant loading-msg';

  const icon = document.createElement('div');
  icon.className = 'assistant-icon';
  msgDiv.appendChild(icon);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = `
    <div class="loading-indicator">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
  `;

  msgDiv.appendChild(contentDiv);
  DOM.chatMessages.appendChild(msgDiv);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  return msgDiv;
}

// Handle Form Submission
DOM.chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = DOM.messageInput.value.trim();
  if (!content) return;

  DOM.messageInput.value = '';
  DOM.messageInput.style.height = 'auto';
  DOM.sendBtn.style.display = 'none';
  DOM.sendBtn.disabled = true;

  // Transition UI if first message
  if (!DOM.chatContainer.classList.contains('has-messages')) {
    DOM.chatContainer.classList.add('has-messages');
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'fixed-bottom-input';
    inputWrapper.appendChild(DOM.inputAreaWrapper);
    DOM.chatContainer.appendChild(inputWrapper);
  }

  // 1. Add user message to UI
  appendMessageToUI('user', content);

  // 2. Initialize chat if needed
  let chat = STATE.chats.find(c => c.id === STATE.currentChatId);
  if (!chat) {
    chat = {
      id: generateId(),
      title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    STATE.chats.push(chat);
    STATE.currentChatId = chat.id;
  }

  chat.messages.push({ role: 'user', content });
  chat.updatedAt = Date.now();
  saveState();
  renderSidebar();

  // 3. Show Loading
  const loadingEl = showLoading();

  // 4. Fetch from API
  try {
    const model = DOM.modelSelect.value;

    // Format messages for standard OpenAI format compatible with g4f
    const apiMessages = chat.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await fetch('https://g4f.space/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // 5. Remove loading & show response
    loadingEl.remove();
    appendMessageToUI('assistant', reply);

    // 6. Save to state
    chat.messages.push({ role: 'assistant', content: reply });
    chat.updatedAt = Date.now();
    saveState();

  } catch (error) {
    console.error('Chat error:', error);
    loadingEl.remove();
    appendMessageToUI('assistant', 'Sorry, an error occurred while processing your request.');
  } finally {
    DOM.sendBtn.disabled = false;
    DOM.messageInput.focus();
  }
});

// Initialize
renderSidebar();
if (STATE.currentChatId) {
  loadChat(STATE.currentChatId);
} else {
  DOM.messageInput.focus();
}
