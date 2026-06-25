// --- Configuration ---
const APPWRITE_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const APPWRITE_PROJECT = '69d0f017002257fde008';
const APPWRITE_FUNCTION_ID = '6a3d22d90005828b2ccc';

// --- Global State ---
let appwriteClient;
let appwriteAccount;
let appwriteFunctions;
let currentUserId = null;
let currentSession = null;

// Initialize Appwrite
function initAppwrite() {
    const { Client, Account, Functions } = window.Appwrite;

    appwriteClient = new Client()
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT);

    appwriteAccount = new Account(appwriteClient);
    appwriteFunctions = new Functions(appwriteClient);
}

// Anonymous Authentication
async function authenticateAnonymously() {
    try {
        // Check for existing session
        currentSession = await appwriteAccount.getSession('current');
        const user = await appwriteAccount.get();
        currentUserId = user.$id;
        console.log("Logged in with existing anonymous session:", currentUserId);
    } catch (e) {
        // No session exists, create a new anonymous one
        console.log("No session found. Creating new anonymous session...");
        try {
            currentSession = await appwriteAccount.createAnonymousSession();
            const user = await appwriteAccount.get();
            currentUserId = user.$id;
            console.log("Created new anonymous session:", currentUserId);
        } catch (err) {
            console.error("Failed to create anonymous session:", err);
            // Fallback for local testing without Appwrite configured
            currentUserId = "local_dev_" + Math.random().toString(36).substr(2, 9);
        }
    }
}

// Initialization on load
document.addEventListener('DOMContentLoaded', async () => {
    initAppwrite();
    await authenticateAnonymously();

    // We will initialize UI and App logic here in next steps
    console.log("App initialized.");
});

// --- UI Elements ---
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const newChatBtn = document.getElementById('new-chat-btn');
const chatList = document.getElementById('chat-list');
const emptyState = document.getElementById('empty-state');
const chatMessagesArea = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const modelPickerBtn = document.getElementById('model-picker-btn');
const modelPopup = document.getElementById('model-popup');
const currentModelNameEl = document.getElementById('current-model-name');
const openSettingsBtn = document.getElementById('open-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsTabs = document.querySelectorAll('.settings-tab');
const settingsPanels = document.querySelectorAll('.settings-panel');
const openArtifactsBtn = document.getElementById('open-artifacts-btn');
const artifactsPanel = document.getElementById('artifacts-panel');
const closeArtifactsBtn = document.getElementById('close-artifacts-btn');
const themeRadios = document.querySelectorAll('input[name="theme"]');

// --- State ---
let chats = JSON.parse(localStorage.getItem('interlude_chats')) || [];
let activeChatId = null;
let currentModelId = localStorage.getItem('interlude_model') || 'gpt-4o';

const MODELS = [
    { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI' },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
    { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
    { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek' },
    { id: 'qwen-3-235b', name: 'Qwen-3 235B', provider: 'Alibaba' },
    { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta' }
];

// --- Initialization Logic ---
function initUI() {
    renderChatList();
    renderModelPicker();
    applyTheme(localStorage.getItem('interlude_theme') || 'dark');
    setupEventListeners();

    // Auto-select latest chat or show new chat state
    if (chats.length > 0) {
        selectChat(chats[0].id);
    } else {
        showEmptyState();
    }
}

// --- Chat Management ---
function createNewChat() {
    const newChat = {
        id: 'chat_' + Date.now(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    chats.unshift(newChat);
    saveChats();
    renderChatList();
    selectChat(newChat.id);
}

function selectChat(id) {
    activeChatId = id;
    const chat = chats.find(c => c.id === id);

    if (chat && chat.messages.length > 0) {
        emptyState.style.display = 'none';
        chatMessagesArea.style.display = 'flex';
        renderMessages(chat.messages);
    } else {
        showEmptyState();
    }

    // Update active class in sidebar
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });

    if (window.innerWidth <= 768) {
        sidebar.classList.remove('mobile-open');
    }
}

function saveChats() {
    localStorage.setItem('interlude_chats', JSON.stringify(chats));
}

function showEmptyState() {
    emptyState.style.display = 'flex';
    chatMessagesArea.style.display = 'none';
    chatMessagesArea.innerHTML = '';
}

function renderChatList() {
    chatList.innerHTML = '';
    chats.forEach(chat => {
        const li = document.createElement('li');
        li.className = `chat-item ${chat.id === activeChatId ? 'active' : ''}`;
        li.dataset.id = chat.id;

        const btn = document.createElement('button');
        btn.className = 'chat-item-btn';
        btn.textContent = chat.title;
        btn.onclick = () => selectChat(chat.id);

        li.appendChild(btn);
        chatList.appendChild(li);
    });
}

function renderMessages(messages) {
    chatMessagesArea.innerHTML = '';
    messages.forEach(msg => {
        // Will implement actual DOM construction in next step for message rendering
        const div = document.createElement('div');
        div.className = `message-wrapper ${msg.role}`;
        div.innerHTML = `<div class="message">${msg.content}</div>`;
        chatMessagesArea.appendChild(div);
    });
    scrollToBottom();
}

function scrollToBottom() {
    const scrollContainer = document.getElementById('chat-scroll-container');
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

// --- Models Picker ---
function renderModelPicker() {
    const list = modelPopup.querySelector('.model-list');
    list.innerHTML = '';

    let currentModel = MODELS.find(m => m.id === currentModelId) || MODELS[2];
    currentModelNameEl.textContent = currentModel.name;

    MODELS.forEach(model => {
        const option = document.createElement('div');
        option.className = `model-option ${model.id === currentModelId ? 'selected' : ''}`;
        option.onclick = () => {
            currentModelId = model.id;
            currentModelNameEl.textContent = model.name;
            localStorage.setItem('interlude_model', currentModelId);
            modelPopup.classList.add('hidden');
            renderModelPicker(); // Re-render to update checkmarks
        };

        option.innerHTML = `
            <div class="model-info">
                <span class="model-name">${model.name}</span>
                <span class="model-provider">${model.provider}</span>
            </div>
            <div class="model-check">✓</div>
        `;
        list.appendChild(option);
    });
}

// --- Theme ---
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('interlude_theme', theme);
    themeRadios.forEach(radio => {
        radio.checked = (radio.value === theme);
    });
}

// --- Event Listeners ---
function setupEventListeners() {
    // Sidebar toggle
    sidebarToggleBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    // Close mobile sidebar if clicked outside (simplified)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-open')) {
            if (!sidebar.contains(e.target) && !sidebarToggleBtn.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        }
    });

    newChatBtn.addEventListener('click', createNewChat);

    // Model Picker
    modelPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modelPopup.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!modelPickerBtn.contains(e.target) && !modelPopup.contains(e.target)) {
            modelPopup.classList.add('hidden');
        }
    });

    // Auto-grow textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') {
            this.style.height = 'auto'; // Reset if empty
        }
    });

    // Settings Modal
    openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    // Settings Tabs
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsPanels.forEach(p => p.classList.add('hidden'));

            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
        });
    });

    // Theme Radios
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => applyTheme(e.target.value));
    });

    // Artifacts Panel
    openArtifactsBtn.addEventListener('click', () => artifactsPanel.classList.add('open'));
    closeArtifactsBtn.addEventListener('click', () => artifactsPanel.classList.remove('open'));
}

// Hook initialization into the load event
const origLoad = window.onload;
window.onload = function() {
    if(origLoad) origLoad();
    initUI();
};

// --- Message Rendering & Processing ---
function processArtifacts(content) {
    // Look for code blocks that might be artifacts
    const artifactRegex = /```(html|javascript|css|python)\n([\s\S]*?)```/g;
    let newContent = content;
    let match;
    let artifactCounter = 1;

    while ((match = artifactRegex.exec(content)) !== null) {
        const lang = match[1];
        const code = match[2];
        const id = `artifact-${Date.now()}-${artifactCounter++}`;

        // Save full code to a global object to easily retrieve it later
        window.appArtifacts = window.appArtifacts || {};
        window.appArtifacts[id] = { lang, code };

        const artifactHtml = `
            <div class="artifact-card" onclick="openArtifact('${id}')">
                <div class="artifact-info">
                    <span class="artifact-icon">✨</span>
                    <span class="artifact-title">Artifact (${lang})</span>
                </div>
                <div>Click to view</div>
            </div>
        `;
        // We do not replace the actual code block entirely for marked to still parse it,
        // but we prepend an interactive card before the block
        newContent = newContent.replace(match[0], artifactHtml + '\n' + match[0]);
    }

    return newContent;
}

window.openArtifact = function(id) {
    const artifact = window.appArtifacts[id];
    if (!artifact) return;

    const { lang, code } = artifact;
    document.getElementById('artifact-filename').textContent = `app.${lang}`;
    const codeContainer = document.getElementById('artifact-code-container');
    const codeView = document.getElementById('artifact-code-view');
    const previewFrame = document.getElementById('artifact-preview-frame');

    codeContainer.textContent = code;
    codeContainer.className = `language-${lang}`;
    hljs.highlightElement(codeContainer);

    if (lang === 'html') {
        previewFrame.srcdoc = code;
        codeView.classList.add('hidden');
        previewFrame.classList.remove('hidden');
    } else {
        codeView.classList.remove('hidden');
        previewFrame.classList.add('hidden');
    }

    artifactsPanel.classList.add('open');
};

function renderMessages(messages) {
    chatMessagesArea.innerHTML = '';
    messages.forEach(msg => {
        appendMessageToUI(msg.role, msg.content);
    });
    scrollToBottom();
}

function appendMessageToUI(role, content) {
    const div = document.createElement('div');
    div.className = `message-wrapper ${role}`;

    let innerHtml = '';
    if (role === 'assistant') {
        innerHtml += `<div class="message-avatar">AI</div>`;
    }

    // Process markdown and sanitize
    const processedContent = processArtifacts(content);
    const parsedHtml = DOMPurify.sanitize(marked.parse(processedContent));

    innerHtml += `<div class="message-content-wrapper"><div class="message">${parsedHtml}</div></div>`;

    div.innerHTML = innerHtml;

    // Apply highlight.js to any code blocks within the message
    div.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    chatMessagesArea.appendChild(div);
    scrollToBottom();
    return div;
}

// --- Chat Communication (Streaming) ---
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
let abortController = null;

async function sendMessage(text) {
    if (!text.trim()) return;

    if (!activeChatId) {
        createNewChat();
    }

    const chat = chats.find(c => c.id === activeChatId);

    // 1. Add user message
    const userMsg = { role: 'user', content: text };
    chat.messages.push(userMsg);

    if (chat.messages.length === 1) {
        // Set title based on first message
        chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderChatList();
    }

    saveChats();
    emptyState.style.display = 'none';
    chatMessagesArea.style.display = 'flex';

    appendMessageToUI('user', text);
    messageInput.value = '';
    messageInput.style.height = 'auto'; // Reset height

    // 2. Prepare for assistant message
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');

    // Create empty assistant message element
    const assistantMsgWrapper = appendMessageToUI('assistant', '');
    const messageContentDiv = assistantMsgWrapper.querySelector('.message');
    messageContentDiv.classList.add('typing-cursor');

    abortController = new AbortController();

    let assistantFullText = '';

    try {
        const payload = {
            action: 'chat',
            userId: currentUserId,
            model: currentModelId,
            messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
            stream: true
        };

        // Call Appwrite Function via POST request directly to the API endpoint
        // Appwrite Web SDK Execution doesn't support reading raw streams natively,
        // so we use standard fetch against the function execution URL if possible,
        // OR rely on standard SDK execution which handles JSON nicely.
        // Given we need true SSE streaming token-by-token:

        // We build the API execution URL manually to use fetch for SSE
        const functionUrl = `${APPWRITE_ENDPOINT}/functions/${APPWRITE_FUNCTION_ID}/executions`;

        // Alternatively, since Appwrite executions return JSON with stdout/stderr,
        // streaming via Appwrite SDK currently requires writing data to the socket
        // which might be buffered by the Appwrite runtime.
        // We will simulate the streaming locally here for the sake of the UX if the SDK buffers it,
        // but try to use fetch to read the stream.

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Appwrite-Project': APPWRITE_PROJECT
            },
            body: JSON.stringify({
                data: JSON.stringify(payload)
            }),
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Appwrite execution wraps the result. If the backend actually uses Server-Sent Events,
        // it might return in `responseBody` field of the execution document if sync.
        // For true streaming from Appwrite Function to client, the Function needs to be accessed
        // via the generic domain or the client needs to read the execution stream if supported.

        // Given the constraints, we will extract the result.
        // If the backend was a standard endpoint, we'd do standard SSE parsing here.
        // Let's assume standard SSE parsing via fetch response stream:
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            // The chunk might be wrapped by Appwrite execution response format first if not using direct domain.
            // Assuming we use direct domain or Appwrite transparently proxies:
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (dataStr === '[DONE]') break;

                    try {
                        // Note: Appwrite execution wrapping might return the whole SSE payload as a single JSON string in stdout.
                        // We will try parsing it as JSON first (if it's an execution response)
                        let parsedData;
                        try {
                            const executionRes = JSON.parse(dataStr);
                            if(executionRes.responseBody) {
                                // It was an execution object
                                // Process the inner string
                                const innerData = executionRes.responseBody;
                                // Simplified for this static demo to just append what we can parse
                                assistantFullText += innerData;
                            } else if (executionRes.content) {
                                parsedData = executionRes;
                                assistantFullText += parsedData.content;
                            }
                        } catch(e) {
                           // Try raw string parsing if it wasn't valid json
                           assistantFullText += dataStr;
                        }

                        // Incrementally update UI
                        messageContentDiv.innerHTML = DOMPurify.sanitize(marked.parse(processArtifacts(assistantFullText)));
                        scrollToBottom();
                    } catch (err) {
                        console.error("Error parsing stream chunk", err);
                    }
                }
            }
        }

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Fetch aborted');
        } else {
            console.error('Chat error:', err);
            assistantFullText += "\n\n**Error:** Could not generate response.";
            messageContentDiv.innerHTML = DOMPurify.sanitize(marked.parse(assistantFullText));
        }
    } finally {
        messageContentDiv.classList.remove('typing-cursor');
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        abortController = null;

        // Save assistant message to chat history
        chat.messages.push({ role: 'assistant', content: assistantFullText });
        saveChats();

        // Final highlight pass
        messageContentDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}

// Input handling
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(messageInput.value);
    }
});

sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendMessage(messageInput.value);
});

stopBtn.addEventListener('click', () => {
    if (abortController) {
        abortController.abort();
    }
});

// Suggestions
document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const text = btn.textContent.trim();
        messageInput.value = `Tell me more about ${text}`;
        messageInput.focus();
        // sendMessage(`Tell me more about ${text}`); // Optionally auto-send
    });
});

// --- Usage & Promo Logic ---
async function fetchUsage() {
    try {
        const execution = await appwriteFunctions.createExecution(
            APPWRITE_FUNCTION_ID,
            JSON.stringify({ action: 'get_usage', userId: currentUserId }),
            false, // async
            '/',
            'POST'
        );

        const result = JSON.parse(execution.responseBody);

        document.getElementById('tokens-used').textContent = result.tokenUsed;
        document.getElementById('tokens-limit').textContent = result.limit;
        document.getElementById('tokens-remaining').textContent = Math.max(0, result.limit - result.tokenUsed);

        const pct = Math.min(100, (result.tokenUsed / result.limit) * 100);
        document.getElementById('usage-progress-bar').style.width = `${pct}%`;

        if (result.isAdmin) {
            document.getElementById('admin-badge').classList.remove('hidden');
        }

    } catch (e) {
        console.error("Failed to fetch usage:", e);
    }
}

document.getElementById('activate-promo-btn').addEventListener('click', async () => {
    const code = document.getElementById('promo-input').value.trim();
    if (!code) return;

    const statusEl = document.getElementById('promo-status');
    statusEl.textContent = 'Activating...';
    statusEl.className = 'status-message';

    try {
        const execution = await appwriteFunctions.createExecution(
            APPWRITE_FUNCTION_ID,
            JSON.stringify({ action: 'activate_promo', userId: currentUserId, code: code }),
            false,
            '/',
            'POST'
        );

        const result = JSON.parse(execution.responseBody);

        if (result.success) {
            statusEl.textContent = result.message;
            statusEl.className = 'status-message success';
            document.getElementById('admin-badge').classList.remove('hidden');
            fetchUsage();
        } else {
            statusEl.textContent = result.message || 'Invalid code';
            statusEl.className = 'status-message error';
        }
    } catch (e) {
        statusEl.textContent = 'Server error. Try again.';
        statusEl.className = 'status-message error';
    }
});

// Fetch usage when settings modal opens
openSettingsBtn.addEventListener('click', fetchUsage);

