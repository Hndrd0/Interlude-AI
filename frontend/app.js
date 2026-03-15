/**
 * app.js – Interlude AI Frontend
 *
 * Responsibilities:
 *  - Appwrite authentication (email/password login & registration)
 *  - Creating, listing, and deleting chat conversations via Appwrite Databases
 *  - Sending messages to the backend Appwrite Function (POST /chat)
 *  - Rendering user and AI messages with Markdown + syntax highlighting
 *  - Persisting the last-active chat in localStorage
 *  - Auto-scroll, typing indicator, textarea auto-resize
 *
 * IMPORTANT: The Groq API key is NEVER used here. All AI calls go through
 * the backend Appwrite Function which keeps the key in its environment variables.
 */

'use strict';

// ============================================================
// CONFIGURATION – replace these values with your own project
// ============================================================
const CONFIG = {
  /** Appwrite project endpoint (e.g. https://cloud.appwrite.io/v1) */
  appwriteEndpoint: 'https://cloud.appwrite.io/v1',
  /** Appwrite project ID */
  appwriteProjectId: 'YOUR_APPWRITE_PROJECT_ID',
  /** Appwrite database ID (stores chats & messages) */
  appwriteDatabaseId: 'YOUR_DATABASE_ID',
  /** Appwrite collection IDs */
  collections: {
    chats:    'chats',
    messages: 'messages',
  },
  /** Appwrite Function ID for the /chat endpoint */
  chatFunctionId: 'YOUR_CHAT_FUNCTION_ID',
};

// ============================================================
// APPWRITE SDK INITIALIZATION
// ============================================================
const { Client, Account, Databases, ID, Query, Functions } = Appwrite;

const client = new Client()
  .setEndpoint(CONFIG.appwriteEndpoint)
  .setProject(CONFIG.appwriteProjectId);

const account   = new Account(client);
const databases = new Databases(client);
const functions = new Functions(client);

// ============================================================
// MARKED.JS CONFIGURATION (Markdown rendering)
// ============================================================
marked.setOptions({
  breaks: true,   // treat newlines as <br>
  gfm:    true,   // GitHub-flavoured Markdown
  highlight: (code, lang) => {
    // Use highlight.js for syntax colouring when a language is provided
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

// ============================================================
// DOM REFERENCES
// ============================================================
const authScreen   = document.getElementById('auth-screen');
const appEl        = document.getElementById('app');

// Auth
const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError   = document.getElementById('login-error');
const registerError= document.getElementById('register-error');
const tabBtns      = document.querySelectorAll('.tab-btn');

// Sidebar
const sidebar      = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarToggle= document.getElementById('sidebar-toggle');
const chatList     = document.getElementById('chat-list');
const newChatBtn   = document.getElementById('new-chat-btn');
const logoutBtn    = document.getElementById('logout-btn');
const userEmailEl  = document.getElementById('user-email');

// Chat area
const emptyState   = document.getElementById('empty-state');
const messagesEl   = document.getElementById('messages');
const chatForm     = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn      = document.getElementById('send-btn');
const startChatBtn = document.getElementById('start-chat-btn');

// ============================================================
// APPLICATION STATE
// ============================================================
let currentUser  = null;   // Appwrite user object
let currentChatId= null;   // ID of the active conversation
let isLoading    = false;  // prevent double-submits
let conversations= [];     // cached list of chat documents

// ============================================================
// HELPERS
// ============================================================

/** Scroll the message list to the very bottom */
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/** Create and append a message bubble to the messages container */
function appendMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar avatar-${role === 'user' ? 'user' : 'ai'}`;
  avatar.textContent = role === 'user' ? 'You' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = `bubble bubble-${role === 'user' ? 'user' : 'ai'}`;

  if (role === 'user') {
    // Plain text – escape HTML to prevent XSS
    bubble.textContent = content;
  } else {
    // AI content is rendered as Markdown
    bubble.innerHTML = marked.parse(content);
    // Apply syntax highlighting to any code blocks
    bubble.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

/** Show the animated typing indicator while waiting for the AI */
function showTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';
  wrapper.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'avatar avatar-ai';
  avatar.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'bubble bubble-ai';
  bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

/** Remove the typing indicator */
function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

/** Auto-resize the textarea as the user types */
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
}

/** Show the chat area (hide empty state) */
function showChatArea() {
  emptyState.classList.add('hidden');
  messagesEl.classList.remove('hidden');
}

/** Show the empty state (hide message list) */
function showEmptyState() {
  emptyState.classList.remove('hidden');
  messagesEl.classList.add('hidden');
}

/** Persist the last active chat ID to localStorage */
function saveLastChatId(chatId) {
  if (chatId) {
    localStorage.setItem('interlude_last_chat', chatId);
  } else {
    localStorage.removeItem('interlude_last_chat');
  }
}

/** Read the last active chat ID from localStorage */
function getLastChatId() {
  return localStorage.getItem('interlude_last_chat');
}

// ============================================================
// AUTH – login / register / logout
// ============================================================

/** Check if a user is already logged in (existing session) */
async function initAuth() {
  try {
    currentUser = await account.get();
    showApp();
  } catch {
    // No active session – show auth screen
    showAuth();
  }
}

function showAuth() {
  authScreen.classList.remove('hidden');
  appEl.classList.add('hidden');
}

function showApp() {
  authScreen.classList.add('hidden');
  appEl.classList.remove('hidden');
  userEmailEl.textContent = currentUser.email;
  loadChatList();
}

// Tab switching (Sign In / Sign Up)
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    loginForm.classList.toggle('hidden', tab !== 'login');
    registerForm.classList.toggle('hidden', tab !== 'register');
    loginError.textContent = '';
    registerError.textContent = '';
  });
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    await account.createEmailPasswordSession(email, password);
    currentUser = await account.get();
    showApp();
  } catch (err) {
    loginError.textContent = err.message || 'Login failed. Please check your credentials.';
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    // Create account then immediately log in
    await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    currentUser = await account.get();
    showApp();
  } catch (err) {
    registerError.textContent = err.message || 'Registration failed.';
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await account.deleteSession('current');
  } catch { /* session may already be invalid */ }
  currentUser   = null;
  currentChatId = null;
  conversations = [];
  saveLastChatId(null);
  chatList.innerHTML = '';
  messagesEl.innerHTML = '';
  showAuth();
});

// ============================================================
// CHAT LIST – create / load / delete conversations
// ============================================================

/** Render the sidebar list from the `conversations` array */
function renderChatList() {
  chatList.innerHTML = '';
  conversations.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.$id === currentChatId ? ' active' : '');
    item.dataset.id = chat.$id;

    const title = document.createElement('span');
    title.className = 'chat-item-title';
    title.textContent = chat.title || 'New chat';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chat-item-delete';
    deleteBtn.title = 'Delete conversation';
    deleteBtn.setAttribute('aria-label', `Delete "${chat.title}"`);
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteChat(chat.$id);
    });

    item.appendChild(title);
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => selectChat(chat.$id));
    chatList.appendChild(item);
  });
}

/** Fetch all conversations belonging to the current user */
async function loadChatList() {
  try {
    const response = await databases.listDocuments(
      CONFIG.appwriteDatabaseId,
      CONFIG.collections.chats,
      [
        Query.equal('userId', currentUser.$id),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]
    );
    conversations = response.documents;
    renderChatList();

    // Re-open the last chat session
    const lastId = getLastChatId();
    if (lastId && conversations.find(c => c.$id === lastId)) {
      selectChat(lastId);
    } else if (conversations.length > 0) {
      selectChat(conversations[0].$id);
    } else {
      showEmptyState();
    }
  } catch (err) {
    console.error('Failed to load chat list:', err);
  }
}

/** Create a new conversation document in Appwrite */
async function createNewChat() {
  try {
    const doc = await databases.createDocument(
      CONFIG.appwriteDatabaseId,
      CONFIG.collections.chats,
      ID.unique(),
      {
        userId:    currentUser.$id,
        title:     'New chat',
        createdAt: new Date().toISOString(),
      }
    );
    conversations.unshift(doc);
    renderChatList();
    selectChat(doc.$id);
  } catch (err) {
    console.error('Failed to create chat:', err);
  }
}

/** Select a conversation and load its messages */
async function selectChat(chatId) {
  currentChatId = chatId;
  saveLastChatId(chatId);
  renderChatList(); // update active highlight
  showChatArea();
  messagesEl.innerHTML = '';

  // Close sidebar on mobile
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');

  await loadMessages(chatId);
}

/** Delete a conversation and all its messages */
async function deleteChat(chatId) {
  try {
    // Delete all messages for this chat first
    const msgs = await databases.listDocuments(
      CONFIG.appwriteDatabaseId,
      CONFIG.collections.messages,
      [Query.equal('chatId', chatId), Query.limit(500)]
    );
    await Promise.all(
      msgs.documents.map(m =>
        databases.deleteDocument(CONFIG.appwriteDatabaseId, CONFIG.collections.messages, m.$id)
      )
    );

    // Delete the chat document
    await databases.deleteDocument(CONFIG.appwriteDatabaseId, CONFIG.collections.chats, chatId);

    conversations = conversations.filter(c => c.$id !== chatId);
    renderChatList();

    if (currentChatId === chatId) {
      currentChatId = null;
      saveLastChatId(null);
      messagesEl.innerHTML = '';
      if (conversations.length > 0) {
        selectChat(conversations[0].$id);
      } else {
        showEmptyState();
      }
    }
  } catch (err) {
    console.error('Failed to delete chat:', err);
  }
}

/** Load and render all messages for a given chat */
async function loadMessages(chatId) {
  try {
    const response = await databases.listDocuments(
      CONFIG.appwriteDatabaseId,
      CONFIG.collections.messages,
      [
        Query.equal('chatId', chatId),
        Query.orderAsc('timestamp'),
        Query.limit(500),
      ]
    );
    messagesEl.innerHTML = '';
    response.documents.forEach(msg => {
      appendMessage(msg.role, msg.content);
    });
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

// ============================================================
// CHAT SUBMISSION – send message & get AI response
// ============================================================

/** Update the title of the current chat based on the first user message */
async function maybeUpdateChatTitle(firstMessage) {
  const chat = conversations.find(c => c.$id === currentChatId);
  if (!chat || chat.title !== 'New chat') return;

  // Use first ~40 characters of the message as the title
  const newTitle = firstMessage.length > 40
    ? firstMessage.slice(0, 40).trimEnd() + '…'
    : firstMessage;

  try {
    await databases.updateDocument(
      CONFIG.appwriteDatabaseId,
      CONFIG.collections.chats,
      currentChatId,
      { title: newTitle }
    );
    chat.title = newTitle;
    renderChatList();
  } catch (err) {
    console.error('Failed to update chat title:', err);
  }
}

/** Save a message document to Appwrite Databases */
async function saveMessage(chatId, role, content) {
  return databases.createDocument(
    CONFIG.appwriteDatabaseId,
    CONFIG.collections.messages,
    ID.unique(),
    {
      chatId,
      role,
      content,
      timestamp: new Date().toISOString(),
    }
  );
}

/**
 * Build conversation history for the AI request.
 * Reads messages currently rendered in the DOM to avoid extra DB calls.
 */
function buildHistory() {
  const history = [];
  const bubbles = messagesEl.querySelectorAll('.message');
  bubbles.forEach(wrapper => {
    const isUser = wrapper.classList.contains('user');
    const bubble = wrapper.querySelector('.bubble');
    if (!bubble) return;
    // For user messages, use textContent; for AI, strip HTML tags for the API
    const content = isUser ? bubble.textContent : bubble.innerText;
    history.push({ role: isUser ? 'user' : 'assistant', content });
  });
  return history;
}

/** Main submit handler */
async function handleSend(e) {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text || isLoading) return;

  // Ensure we have an active chat; create one if needed
  if (!currentChatId) {
    await createNewChat();
    if (!currentChatId) return; // creation failed
  }

  isLoading = true;
  sendBtn.disabled = true;
  messageInput.value = '';
  autoResizeTextarea();

  // 1. Show the user's message immediately
  appendMessage('user', text);

  // 2. Update chat title on first message
  await maybeUpdateChatTitle(text);

  // 3. Persist user message to Appwrite
  saveMessage(currentChatId, 'user', text).catch(err =>
    console.error('Failed to save user message:', err)
  );

  // 4. Build conversation history (includes the message just added)
  const history = buildHistory();

  // 5. Show typing indicator
  showTypingIndicator();

  try {
    /**
     * Call the Appwrite serverless Function.
     * The function receives the full conversation history and returns the AI reply.
     * The Groq API key lives ONLY in the function's environment variables.
     */
    const execution = await functions.createExecution(
      CONFIG.chatFunctionId,
      JSON.stringify({
        chatId:  currentChatId,
        userId:  currentUser.$id,
        message: text,
        history: history.slice(-20), // send last 20 turns to stay within token limits
      }),
      false // synchronous execution
    );

    removeTypingIndicator();

    // Parse the JSON response from the function
    const result = JSON.parse(execution.responseBody);

    if (result.error) {
      throw new Error(result.error);
    }

    const aiReply = result.reply;

    // 6. Render AI response
    appendMessage('assistant', aiReply);

    // 7. Persist AI message to Appwrite
    saveMessage(currentChatId, 'assistant', aiReply).catch(err =>
      console.error('Failed to save AI message:', err)
    );

  } catch (err) {
    removeTypingIndicator();
    appendMessage('assistant', `⚠️ Error: ${err.message || 'Something went wrong. Please try again.'}`);
    console.error('Chat error:', err);
  } finally {
    isLoading = false;
    sendBtn.disabled = !messageInput.value.trim();
    messageInput.focus();
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// New chat button (sidebar header)
newChatBtn.addEventListener('click', createNewChat);

// Empty state "New Conversation" button
startChatBtn.addEventListener('click', createNewChat);

// Chat form submit
chatForm.addEventListener('submit', handleSend);

// Enable / disable send button based on input content
messageInput.addEventListener('input', () => {
  autoResizeTextarea();
  sendBtn.disabled = !messageInput.value.trim() || isLoading;
});

// Send on Enter (Shift+Enter = newline)
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) chatForm.dispatchEvent(new Event('submit'));
  }
});

// Mobile: sidebar toggle
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('visible');
});

sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
});

// ============================================================
// BOOT
// ============================================================
initAuth();
