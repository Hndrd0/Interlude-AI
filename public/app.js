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

    // Initialize UI and App logic once session is ready
    console.log("App initialized.");
    await initUI();
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
let availableModels = [];

// --- Initialization Logic ---
async function initUI() {
    renderChatList();
    applyTheme(localStorage.getItem('interlude_theme') || 'dark');
    setupEventListeners();

    // Fetch available models before rendering picker
    await fetchAvailableModels();
    renderModelPicker();

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

function scrollToBottom() {
    const scrollContainer = document.getElementById('chat-scroll-container');
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

// --- Models Picker ---
async function fetchAvailableModels() {
    try {
        const execution = await appwriteFunctions.createExecution(
            APPWRITE_FUNCTION_ID,
            JSON.stringify({ action: 'models', userId: currentUserId }),
            false,
            '/',
            'POST'
        );
        const result = JSON.parse(execution.responseBody);
        if (result.success && result.models) {
            // Assume the API might return the actual fields we expect: model, owned_by, id
            // Sort by model name if available, else by id
            availableModels = result.models.sort((a, b) => {
                const nameA = a.model || a.name || a.id;
                const nameB = b.model || b.name || b.id;
                return nameA.localeCompare(nameB);
            });

            // Validate currentModelId against the fetched list
            if (availableModels.length > 0 && !availableModels.some(m => m.id === currentModelId)) {
                // Do not hardcode a specific model id fallback, use the first valid one
                currentModelId = availableModels[0].id;
                localStorage.setItem('interlude_model', currentModelId);
            }
        }
    } catch (e) {
        console.error("Failed to fetch models:", e);
    }
}

function renderModelPicker() {
    const list = modelPopup.querySelector('.model-list');
    list.innerHTML = '';

    if (availableModels.length === 0) {
        currentModelNameEl.textContent = "Loading Models...";
        return;
    }

    let currentModel = availableModels.find(m => m.id === currentModelId) || availableModels[0];
    currentModelNameEl.textContent = currentModel.model || currentModel.name || currentModel.id;

    availableModels.forEach(model => {
        const option = document.createElement('div');
        option.className = `model-option ${model.id === currentModelId ? 'selected' : ''}`;

        const displayName = model.model || model.name || model.id;
        const providerName = model.owned_by || model.provider || 'Unknown Provider';

        option.onclick = () => {
            currentModelId = model.id;
            currentModelNameEl.textContent = displayName;
            localStorage.setItem('interlude_model', currentModelId);
            modelPopup.classList.add('hidden');
            renderModelPicker(); // Re-render to update checkmarks
        };

        option.innerHTML = `
            <div class="model-info">
                <span class="model-name">${displayName}</span>
                <span class="model-provider">${providerName}</span>
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

// --- Message Rendering & Processing ---
function processArtifacts(content) {
    // Look for code blocks that might be artifacts
    const artifactRegex = /```(html|javascript|css|python)\n([\s\S]*?)```/g;
    let artifactCounter = 1;

    // Use a replacer function to avoid replacing only the first occurrence
    // and correctly handle identical code blocks.
    const newContent = content.replace(artifactRegex, (match, lang, code) => {
        const id = `artifact-${Date.now()}-${artifactCounter++}`;

        // Save full code to a global object to easily retrieve it later
        window.appArtifacts = window.appArtifacts || {};
        window.appArtifacts[id] = { lang, code };

        // Remove inline onclick to comply with DOMPurify. Event delegation handles the click.
        const artifactHtml = `
            <div class="artifact-card artifact-trigger" data-id="${id}">
                <div class="artifact-info">
                    <span class="artifact-icon">✨</span>
                    <span class="artifact-title">Artifact (${lang})</span>
                </div>
                <div>Click to view</div>
            </div>
        `;
        return artifactHtml + '\n' + match;
    });

    return newContent;
}

// Set up event delegation for artifact cards
chatMessagesArea.addEventListener('click', (e) => {
    const trigger = e.target.closest('.artifact-trigger');
    if (trigger) {
        const id = trigger.dataset.id;
        if (id) {
            window.openArtifact(id);
        }
    }
});

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
            messages: chat.messages.map(m => ({ role: m.role, content: m.content }))
        };

        // Use standard Appwrite SDK execution to await the full buffered response
        const execution = await appwriteFunctions.createExecution(
            APPWRITE_FUNCTION_ID,
            JSON.stringify(payload),
            false, // sync execution to get the response body
            '/',
            'POST'
        );

        let result;
        try {
            result = JSON.parse(execution.responseBody);
        } catch (parseError) {
            console.error("Failed to parse execution response:", execution.responseBody);
            throw new Error("Invalid response from server");
        }

        // Appwrite marks executions as 'failed' if the function throws or returns an error status code.
        // However, our function returns a structured JSON payload even on failures.
        if (execution.status === 'failed') {
            if (result && result.error) {
                // If it's a known error from our backend (e.g. quota, DB error)
                throw new Error(result.error);
            } else if (result && result.g4fError) {
                // Specific G4F API error
                throw new Error(`G4F Error: ${result.g4fError}`);
            } else {
                throw new Error("Backend execution failed");
            }
        }

        // Sometimes status is not marked failed, but the payload has an error.
        if (result.error) {
            throw new Error(result.error);
        }

        assistantFullText = result.content;

        // Render the final message
        messageContentDiv.innerHTML = DOMPurify.sanitize(marked.parse(processArtifacts(assistantFullText)));
        scrollToBottom();

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

// --- Data Management Logic ---
document.getElementById('delete-all-chats-btn').addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all chats? This cannot be undone.")) {
        chats = [];
        activeChatId = null;
        saveChats();
        renderChatList();
        showEmptyState();
        document.getElementById('settings-modal').classList.add('hidden');
    }
});

document.getElementById('clear-cache-btn').addEventListener('click', () => {
    if (confirm("Clear local application cache? You will remain authenticated.")) {
        localStorage.removeItem('interlude_chats');
        localStorage.removeItem('interlude_model');
        localStorage.removeItem('interlude_theme');
        window.location.reload();
    }
});

document.getElementById('export-chats-btn').addEventListener('click', () => {
    if (chats.length === 0) {
        alert("No chats to export.");
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chats, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "interlude_chats_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

document.getElementById('import-chats-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedChats = JSON.parse(event.target.result);
            if (Array.isArray(importedChats)) {
                // Merge or overwrite (we will overwrite for simplicity here)
                chats = importedChats;
                saveChats();
                renderChatList();
                if (chats.length > 0) {
                    selectChat(chats[0].id);
                } else {
                    showEmptyState();
                }
                document.getElementById('settings-modal').classList.add('hidden');
                alert("Chats imported successfully.");
            } else {
                alert("Invalid file format.");
            }
        } catch (err) {
            console.error("Error parsing import file:", err);
            alert("Error reading file. Ensure it is a valid JSON export.");
        }
        // Reset input
        e.target.value = '';
    };
    reader.readAsText(file);
});
