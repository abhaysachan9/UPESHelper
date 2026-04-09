/**
 * public/js/modules/chat.js
 * ChatGPT-style chat: landing → chat view transition,
 * auto-expanding textarea, streaming-like message flow.
 */

import { renderMarkdown } from './markdown.js';

const HISTORY_KEY = 'upes-chat-history';
const MAX_HISTORY = 30;

// ── DOM refs ──────────────────────────────────────────────────────────────────
let landing, chatView, messagesInner, messagesScroll;
let textarea, sendBtn, voiceBtn, clearBtn;
let isInChatMode = false;

export function initChat() {
    landing = document.getElementById('landing');
    chatView = document.getElementById('chat-view');
    messagesInner = document.getElementById('messages-inner');
    messagesScroll = document.getElementById('messages-scroll');
    textarea = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');
    clearBtn = document.getElementById('clear-btn');

    // ── Restore history ───────────────────────────────────────────
    // restoreHistory(); // Disabled so localhost and IP act identically as fresh starts

    // ── Auto-expand textarea ──────────────────────────────────────
    textarea.addEventListener('input', () => {
        autoResize(textarea);
        sendBtn.disabled = !textarea.value.trim();
    });

    // ── Send on Enter (Shift+Enter for new line) ──────────────────
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) send();
        }
    });

    sendBtn.addEventListener('click', send);

    // ── FAQ chips ─────────────────────────────────────────────────
    document.querySelectorAll('.faq-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.getAttribute('data-question');
            if (q) fireQuestion(q);
        });
    });

    // ── Clear / New chat ──────────────────────────────────────────
    clearBtn?.addEventListener('click', clearChat);
    const topbarBrand = document.querySelector('.topbar-brand');
    topbarBrand?.addEventListener('click', (e) => {
        // Clear history from storage so the page loads fresh when it navigates
        localStorage.removeItem(HISTORY_KEY);
    });
}

// ── Send flow ─────────────────────────────────────────────────────────────────

function send() {
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    autoResize(textarea);
    sendBtn.disabled = true;
    fireQuestion(text);
}

async function fireQuestion(question) {
    // Switch to chat mode on first message
    if (!isInChatMode) enterChatMode();

    // Render user bubble
    appendUserMessage(question);
    scrollToBottom();

    // Typing indicator
    const typingEl = appendTyping();
    scrollToBottom();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: question }),
        });

        typingEl.remove();

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            appendBotMessage(err.error || 'Something went wrong. Please try again.', []);
        } else {
            const data = await res.json();
            appendBotMessage(data.answer, data.sources || []);
            persist(question, data.answer, data.sources || []);
        }
    } catch {
        typingEl.remove();
        appendBotMessage('⚠️ Network error. Please check your connection and try again.', []);
    }

    scrollToBottom();
}

// ── Chat mode transition ──────────────────────────────────────────────────────

function enterChatMode() {
    isInChatMode = true;
    landing.classList.add('hidden');
    chatView.classList.add('active');
    chatView.setAttribute('aria-hidden', 'false');
    if (clearBtn) clearBtn.style.display = 'flex';
}

function clearChat() {
    messagesInner.innerHTML = '';
    localStorage.removeItem(HISTORY_KEY);
    isInChatMode = false;
    chatView.classList.remove('active');
    chatView.setAttribute('aria-hidden', 'true');
    landing.classList.remove('hidden');
    if (clearBtn) clearBtn.style.display = 'none';
    textarea.value = '';
    autoResize(textarea);
    sendBtn.disabled = true;
}

// ── Message renderers ─────────────────────────────────────────────────────────

function appendUserMessage(text) {
    const group = makeGroup();
    const row = makeRow('user');
    const avatar = makeAvatar('user');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    row.appendChild(makeAvatar('user'));
    row.appendChild(bubble);

    // Flip: avatar after bubble for user (flex-direction row-reverse handles it)
    row.innerHTML = '';
    const av2 = makeAvatar('user');
    row.appendChild(bubble);
    row.appendChild(av2);

    group.appendChild(row);
    messagesInner.appendChild(group);
}

function appendBotMessage(text, sources) {
    const group = makeGroup();
    const row = makeRow('bot');
    const avatar = makeAvatar('bot');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(text);

    row.appendChild(avatar);
    row.appendChild(bubble);
    group.appendChild(row);

    if (sources && sources.length > 0) {
        const strip = document.createElement('div');
        strip.className = 'msg-sources';
        strip.innerHTML = '<span>Sources:</span>';
        sources.forEach(src => {
            const url = typeof src === 'string' ? src : src.url;
            const title = typeof src === 'object' && src.title ? src.title : '';
            const a = document.createElement('a');
            a.className = 'source-link';
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            if (title) {
                a.textContent = title;
                a.title = url;
            } else {
                try { a.textContent = new URL(url).hostname.replace('www.', ''); }
                catch { a.textContent = url; }
            }
            strip.appendChild(a);
        });
        group.appendChild(strip);
    }

    messagesInner.appendChild(group);
}

function appendTyping() {
    const group = makeGroup();
    const row = makeRow('bot');
    const avatar = makeAvatar('bot');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble typing-bubble';
    bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    row.appendChild(avatar);
    row.appendChild(bubble);
    group.appendChild(row);
    messagesInner.appendChild(group);
    return group;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function makeGroup() {
    const g = document.createElement('div');
    g.className = 'msg-group';
    return g;
}

function makeRow(role) {
    const r = document.createElement('div');
    r.className = `msg-row ${role}`;
    return r;
}

function makeAvatar(role) {
    const a = document.createElement('div');
    a.className = 'msg-avatar';
    a.setAttribute('aria-hidden', 'true');
    a.innerHTML = role === 'user'
        ? '<i class="fa-solid fa-user"></i>'
        : '<i class="fa-solid fa-robot"></i>';
    return a;
}

function autoResize(el) {
    el.style.height = '1px';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        messagesScroll.scrollTop = messagesScroll.scrollHeight;
    });
}

// ── Persistence ───────────────────────────────────────────────────────────────

function persist(question, answer, sources) {
    try {
        const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        hist.push({ question, answer, sources, ts: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-MAX_HISTORY)));
    } catch { /* ignore */ }
}

function restoreHistory() {
    try {
        const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (!hist.length) return;
        enterChatMode();
        hist.forEach(item => {
            appendUserMessage(item.question);
            appendBotMessage(item.answer, item.sources || []);
        });
        setTimeout(scrollToBottom, 60);
    } catch { /* ignore */ }
}
