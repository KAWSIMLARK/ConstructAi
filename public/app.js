// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

// ── State ────────────────────────────────────────────
let conversations = JSON.parse(localStorage.getItem('cc_conversations') || '[]');
let currentId = null;
let isStreaming = false;

// ── DOM refs ─────────────────────────────────────────
const welcome    = document.getElementById('welcome');
const messagesEl = document.getElementById('messages');
const inputText  = document.getElementById('inputText');
const btnSend    = document.getElementById('btnSend');
const btnNewChat = document.getElementById('btnNewChat');
const chatList   = document.getElementById('chatList');
const sidebar    = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');

// ── Init ─────────────────────────────────────────────
function init() {
  renderChatList();

  document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputText.value = btn.dataset.q;
      sendMessage();
    });
  });

  inputText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) sendMessage();
    }
  });

  inputText.addEventListener('input', () => {
    inputText.style.height = 'auto';
    inputText.style.height = Math.min(inputText.scrollHeight, 200) + 'px';
  });

  btnSend.addEventListener('click', () => { if (!isStreaming) sendMessage(); });
  btnNewChat.addEventListener('click', newChat);
  sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  document.addEventListener('click', e => {
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ── New chat ──────────────────────────────────────────
function newChat() {
  currentId = null;
  messagesEl.innerHTML = '';
  messagesEl.classList.remove('visible');
  welcome.style.display = '';
  renderChatList();
  inputText.value = '';
  inputText.style.height = 'auto';
  sidebar.classList.remove('open');
}

// ── Send message ──────────────────────────────────────
async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || isStreaming) return;

  // Start or continue conversation
  if (!currentId) {
    currentId = Date.now().toString();
    conversations.unshift({ id: currentId, title: text.slice(0, 50), messages: [] });
  }

  const conv = conversations.find(c => c.id === currentId);
  conv.messages.push({ role: 'user', content: text });
  saveConversations();

  // Show messages area, hide welcome
  welcome.style.display = 'none';
  messagesEl.classList.add('visible');

  appendMessage('user', text);
  inputText.value = '';
  inputText.style.height = 'auto';
  renderChatList();

  // Typing indicator
  const typingId = 'typing-' + Date.now();
  const typingEl = document.createElement('div');
  typingEl.className = 'message assistant';
  typingEl.id = typingId;
  typingEl.innerHTML = `
    <div class="message-avatar"><svg viewBox="0 0 64 64" class="avatar-svg"><use href="#ccLogo"/></svg></div>
    <div class="message-body">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  messagesEl.appendChild(typingEl);
  scrollToBottom();

  isStreaming = true;
  btnSend.disabled = true;

  let accumulated = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conv.messages }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Replace typing indicator with real message
    typingEl.remove();
    const assistantEl = createAssistantMessage();
    messagesEl.appendChild(assistantEl);
    const contentEl = assistantEl.querySelector('.message-content');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = JSON.parse(line.slice(6));

        if (data.type === 'text') {
          accumulated += data.content;
          contentEl.innerHTML = marked.parse(accumulated);
          hljs.highlightAll();
          scrollToBottom();
        } else if (data.type === 'done') {
          break;
        } else if (data.type === 'error') {
          contentEl.textContent = `Erreur : ${data.message}`;
        }
      }
    }

    conv.messages.push({ role: 'assistant', content: accumulated });
    saveConversations();
    addMessageActions(assistantEl, accumulated);

  } catch (err) {
    typingEl.remove();
    appendMessage('assistant', `Erreur de connexion : ${err.message}`);
  } finally {
    isStreaming = false;
    btnSend.disabled = false;
    scrollToBottom();
  }
}

// ── DOM helpers ───────────────────────────────────────
function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = `message ${role}`;
  const avatar = role === 'user'
    ? '👤'
    : '<svg viewBox="0 0 64 64" class="avatar-svg"><use href="#ccLogo"/></svg>';
  const content = role === 'user'
    ? `<div class="message-content">${escapeHtml(text)}</div>`
    : `<div class="message-content">${marked.parse(text)}</div>`;

  el.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-body">${content}</div>`;

  if (role === 'assistant') {
    addMessageActions(el, text);
    setTimeout(() => hljs.highlightAll(), 0);
  }
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function createAssistantMessage() {
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.innerHTML = `
    <div class="message-avatar"><svg viewBox="0 0 64 64" class="avatar-svg"><use href="#ccLogo"/></svg></div>
    <div class="message-body">
      <div class="message-content"></div>
    </div>`;
  return el;
}

function addMessageActions(el, text) {
  const body = el.querySelector('.message-body');
  if (!body || body.querySelector('.message-actions')) return;

  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.innerHTML = `
    <button class="action-btn btn-copy">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg>
      Copier
    </button>`;

  actions.querySelector('.btn-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(text);
    actions.querySelector('.btn-copy').textContent = '✓ Copié';
    setTimeout(() => {
      actions.querySelector('.btn-copy').innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copier`;
    }, 2000);
  });

  body.appendChild(actions);
}

// ── Sidebar chat list ─────────────────────────────────
function renderChatList() {
  chatList.innerHTML = '';
  if (conversations.length === 0) {
    chatList.innerHTML = '<div style="padding:10px 8px;font-size:12px;color:var(--text-muted)">Aucune conversation</div>';
    return;
  }
  conversations.forEach(conv => {
    const btn = document.createElement('button');
    btn.className = 'chat-item' + (conv.id === currentId ? ' active' : '');
    btn.textContent = conv.title || 'Conversation';
    btn.addEventListener('click', () => loadConversation(conv.id));
    chatList.appendChild(btn);
  });
}

function loadConversation(id) {
  currentId = id;
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;

  welcome.style.display = 'none';
  messagesEl.innerHTML = '';
  messagesEl.classList.add('visible');

  conv.messages.forEach(msg => appendMessage(msg.role, msg.content));
  renderChatList();
  sidebar.classList.remove('open');
  scrollToBottom();
}

// ── Persistence ───────────────────────────────────────
function saveConversations() {
  localStorage.setItem('cc_conversations', JSON.stringify(conversations));
}

// ── Utils ─────────────────────────────────────────────
function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start ─────────────────────────────────────────────
init();
