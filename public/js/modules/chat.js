/**
 * public/js/modules/chat.js
 * Landing → chat view transition, message rendering, API integration.
 */

import { renderMarkdown } from './markdown.js';
import { loadGraduationHat, initStaticLotties } from './lottie-hat.js';

const HISTORY_KEY = 'upes-chat-history';
const MAX_HISTORY = 30;

let landing, chatView, messagesInner, messagesScroll;
let textarea, sendBtn, clearBtn;
let isInChatMode = false;

export function initChat() {
    landing = document.getElementById('landing');
    chatView = document.getElementById('chat-view');
    messagesInner = document.getElementById('messages-inner');
    messagesScroll = document.getElementById('messages-scroll');
    textarea = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');
    clearBtn = document.getElementById('clear-btn');

    textarea.addEventListener('input', () => {
        autoResize(textarea);
        sendBtn.disabled = !textarea.value.trim();
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) send();
        }
    });

    sendBtn.addEventListener('click', send);

    document.querySelectorAll('.topic-card').forEach(card => {
        card.addEventListener('click', () => {
            const q = card.getAttribute('data-question');
            if (q) populateInput(q);
        });
    });

    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            const q = link.getAttribute('data-question');
            if (q) populateInput(q);
        });
    });

    clearBtn?.addEventListener('click', clearChat);

    initStaticLotties();

    const headerBrand = document.querySelector('.header-brand');
    headerBrand?.addEventListener('click', () => {
        localStorage.removeItem(HISTORY_KEY);
    });
}

function populateInput(text) {
    textarea.value = text;
    autoResize(textarea);
    sendBtn.disabled = false;
    textarea.focus();
}

function send() {
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    autoResize(textarea);
    sendBtn.disabled = true;
    fireQuestion(text);
}

async function fireQuestion(question) {
    if (!isInChatMode) enterChatMode();

    appendUserMessage(question);
    scrollToBottom();

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
        appendBotMessage('Network error. Please check your connection and try again.', []);
    }

    scrollToBottom();
}

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

function appendUserMessage(text) {
    const group = makeGroup();
    const row = makeRow('user');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    row.appendChild(bubble);
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
    if (role === 'user') {
        a.innerHTML = '<i class="fa-solid fa-user"></i>';
    } else {
        const lottieContainer = document.createElement('div');
        lottieContainer.className = 'lottie-graduation-hat';
        a.appendChild(lottieContainer);
        loadGraduationHat(lottieContainer);
    }
    return a;
}

function autoResize(el) {
    el.style.height = '1px';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        messagesScroll.scrollTop = messagesScroll.scrollHeight;
    });
}

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
