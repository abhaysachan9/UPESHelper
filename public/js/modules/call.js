/**
 * public/js/modules/call.js
 * Voice call with AI using Gemini Live API (WebSocket + ephemeral token).
 * Captures microphone audio, streams to Gemini, plays back audio responses.
 */

const CAPTURE_SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 24000;

// ── State ────────────────────────────────────────────────────────────────────
let ws = null;
let mediaStream = null;
let captureCtx = null;
let captureProcessor = null;
let playbackCtx = null;
let nextPlayTime = 0;
let isCallActive = false;
let isMuted = false;
let callStart = null;
let timerHandle = null;
let setupComplete = false;

// ── DOM refs ─────────────────────────────────────────────────────────────────
let overlay, statusEl, timerEl, transcriptionEl;
let muteBtn, endBtn, callBtn;

// ── Init ─────────────────────────────────────────────────────────────────────

export async function initCall() {
    overlay = document.getElementById('call-overlay');
    statusEl = document.getElementById('call-status');
    timerEl = document.getElementById('call-timer');
    transcriptionEl = document.getElementById('call-transcription');
    muteBtn = document.getElementById('call-mute');
    endBtn = document.getElementById('call-end');
    callBtn = document.getElementById('call-btn');

    if (!overlay || !callBtn) return;

    callBtn.style.display = 'none';

    callBtn.addEventListener('click', startCall);
    endBtn?.addEventListener('click', endCall);
    muteBtn?.addEventListener('click', toggleMute);

    try {
        const res = await fetch('/api/call-enabled');
        const data = await res.json();
        if (data.enabled) callBtn.style.display = '';
    } catch { /* leave hidden */ }
}

// ── Call lifecycle ───────────────────────────────────────────────────────────

async function startCall() {
    if (isCallActive) return;

    showOverlay();
    setStatus('Fetching config…');
    resetTranscription();

    try {
        const config = await fetchConfig();
        setStatus('Opening WebSocket…');

        await connectWs(config);
        setStatus('Mic access…');

        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: CAPTURE_SAMPLE_RATE,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        startCapture();

        isCallActive = true;
        setStatus('Connected');
        overlay.classList.add('speaking');
        startTimer();
    } catch (err) {
        console.error('Call start failed:', err);
        setStatus(friendlyError(err));
        setTimeout(endCall, 2500);
    }
}

function endCall() {
    const wasActive = isCallActive;
    isCallActive = false;
    isMuted = false;
    setupComplete = false;

    if (ws) { try { ws.close(); } catch {} ws = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    if (captureProcessor) { captureProcessor.disconnect(); captureProcessor = null; }
    if (captureCtx) { try { captureCtx.close(); } catch {} captureCtx = null; }
    if (playbackCtx) { try { playbackCtx.close(); } catch {} playbackCtx = null; }
    nextPlayTime = 0;

    stopTimer();
    resetMuteUI();

    if (wasActive) {
        overlay.classList.remove('speaking');
        setStatus('Call ended');
        setTimeout(() => { hideOverlay(); setStatus('Connecting…'); }, 1200);
    } else {
        hideOverlay();
        setStatus('Connecting…');
    }
}

// ── WebSocket ────────────────────────────────────────────────────────────────

function connectWs(config) {
    return new Promise((resolve, reject) => {
        const url = `${config.wsUrl}?access_token=${encodeURIComponent(config.token)}`;
        if (statusEl) statusEl.textContent = 'WS connecting to: ' + url.substring(0, 80) + '…';
        const WS = window.WebSocket;
        ws = new WS(url);
        ws.binaryType = 'arraybuffer';

        let settled = false;
        const fail = (msg) => { if (!settled) { settled = true; reject(new Error(msg)); } };
        const succeed = () => { if (!settled) { settled = true; resolve(); } };

        const timeout = setTimeout(() => {
            if (statusEl) statusEl.textContent = 'TIMEOUT readyState=' + ws?.readyState;
            fail('Connection timed out');
            try { ws.close(); } catch {}
        }, 20000);

        ws.onopen = () => {
            if (statusEl) statusEl.textContent = 'WS OPEN, sending setup…';
            const setupMsg = JSON.stringify({
                setup: {
                    model: `models/${config.model}`,
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                    },
                },
            });
            ws.send(setupMsg);
        };

        ws.onmessage = (event) => {
            const msg = parseWsMessage(event.data);
            if (!msg) {
                if (statusEl) statusEl.textContent = 'MSG: unparseable, type=' + typeof event.data;
                return;
            }
            if (statusEl) statusEl.textContent = 'MSG: ' + JSON.stringify(msg).substring(0, 100);

            if (msg.setupComplete) {
                clearTimeout(timeout);
                setupComplete = true;
                ws.onmessage = onWsMessage;
                succeed();
                return;
            }

            if (msg.error) {
                clearTimeout(timeout);
                fail(msg.error.message || 'Setup rejected by server');
                return;
            }
        };

        ws.onerror = (ev) => {
            clearTimeout(timeout);
            if (statusEl) statusEl.textContent = 'WS ERROR';
            fail('WebSocket connection error');
        };

        ws.onclose = (e) => {
            clearTimeout(timeout);
            if (statusEl) statusEl.textContent = 'WS CLOSE code=' + e.code + ' reason=' + (e.reason || 'none');
            if (!settled) {
                fail(e.reason || `Connection closed (${e.code})`);
            } else if (isCallActive) {
                endCall();
            }
        };
    });
}

function parseWsMessage(data) {
    try {
        const text = typeof data === 'string'
            ? data
            : new TextDecoder().decode(data);
        return JSON.parse(text);
    } catch { return null; }
}

function onWsMessage(event) {
    const msg = parseWsMessage(event.data);
    if (!msg) return;

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
                queueAudio(part.inlineData.data);
            }
        }
    }

    if (sc.inputTranscription?.text) {
        appendTranscript('you', sc.inputTranscription.text);
    }
    if (sc.outputTranscription?.text) {
        appendTranscript('ai', sc.outputTranscription.text);
    }
}

// ── Audio Capture ────────────────────────────────────────────────────────────

function startCapture() {
    captureCtx = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE });
    const source = captureCtx.createMediaStreamSource(mediaStream);
    const bufSize = 4096;
    captureProcessor = captureCtx.createScriptProcessor(bufSize, 1, 1);

    captureProcessor.onaudioprocess = (e) => {
        if (!isCallActive || isMuted || !setupComplete) return;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const raw = e.inputBuffer.getChannelData(0);
        const pcm16 = floatToInt16(raw);
        const b64 = bufferToBase64(pcm16.buffer);

        ws.send(JSON.stringify({
            realtimeInput: {
                audio: { data: b64, mimeType: `audio/pcm;rate=${CAPTURE_SAMPLE_RATE}` },
            },
        }));
    };

    source.connect(captureProcessor);
    const silence = captureCtx.createGain();
    silence.gain.value = 0;
    captureProcessor.connect(silence);
    silence.connect(captureCtx.destination);
}

// ── Audio Playback ───────────────────────────────────────────────────────────

function queueAudio(base64Data) {
    if (!playbackCtx) {
        playbackCtx = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
    }

    const bytes = base64ToBytes(base64Data);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x7FFF;
    }

    const buf = playbackCtx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
    buf.getChannelData(0).set(float32);

    const src = playbackCtx.createBufferSource();
    src.buffer = buf;
    src.connect(playbackCtx.destination);

    const now = playbackCtx.currentTime;
    const start = Math.max(now + 0.05, nextPlayTime);
    src.start(start);
    nextPlayTime = start + buf.duration;
}

// ── Audio Helpers ────────────────────────────────────────────────────────────

function floatToInt16(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
}

function bufferToBase64(arrayBuf) {
    const bytes = new Uint8Array(arrayBuf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

// ── Server config ────────────────────────────────────────────────────────────

async function fetchConfig() {
    console.log('[Call] Fetching call config…');
    
    // Get selected language
    const languageSelect = document.getElementById('language-select');
    const language = languageSelect?.value || 'en-IN';
    
    const res = await fetch(`/api/call-config?language=${encodeURIComponent(language)}`);
    if (!res.ok) {
        const body = await res.text();
        console.error('[Call] Config fetch failed:', res.status, body);
        throw new Error('Failed to fetch call config');
    }
    const data = await res.json();
    console.log('[Call] Config received — token:', data.token?.substring(0, 30) + '…', 'wsUrl:', data.wsUrl, 'model:', data.model);
    if (!data.token) throw new Error('Missing token in response');
    return data;
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function showOverlay() {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function hideOverlay() {
    overlay.classList.remove('active', 'speaking');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
}

function toggleMute() {
    isMuted = !isMuted;
    if (muteBtn) {
        muteBtn.classList.toggle('muted', isMuted);
        muteBtn.querySelector('i').className = isMuted
            ? 'fa-solid fa-microphone-slash'
            : 'fa-solid fa-microphone';
        muteBtn.querySelector('span').textContent = isMuted ? 'Unmute' : 'Mute';
    }
}

function resetMuteUI() {
    if (muteBtn) {
        muteBtn.classList.remove('muted');
        muteBtn.querySelector('i').className = 'fa-solid fa-microphone';
        muteBtn.querySelector('span').textContent = 'Mute';
    }
}

function startTimer() {
    callStart = Date.now();
    timerHandle = setInterval(() => {
        const s = Math.floor((Date.now() - callStart) / 1000);
        const m = String(Math.floor(s / 60)).padStart(2, '0');
        const sec = String(s % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${m}:${sec}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
    if (timerEl) timerEl.textContent = '00:00';
}

function resetTranscription() {
    if (transcriptionEl) transcriptionEl.innerHTML = '';
}

function appendTranscript(role, text) {
    if (!transcriptionEl || !text.trim()) return;

    const last = transcriptionEl.querySelector(`.transcript-line.${role}:last-child`);
    if (last) {
        last.querySelector('.transcript-text').textContent += ' ' + text.trim();
    } else {
        const line = document.createElement('div');
        line.className = `transcript-line ${role}`;
        const label = document.createElement('span');
        label.className = 'transcript-label';
        label.textContent = role === 'you' ? 'You' : 'AI';
        const txt = document.createElement('span');
        txt.className = 'transcript-text';
        txt.textContent = text.trim();
        line.appendChild(label);
        line.appendChild(txt);
        transcriptionEl.appendChild(line);
    }
    transcriptionEl.scrollTop = transcriptionEl.scrollHeight;
}

function friendlyError(err) {
    const msg = err?.message || '';
    if (msg.includes('Permission') || msg.includes('NotAllowed')) return 'Microphone access denied';
    if (msg.includes('NotFound')) return 'No microphone found';
    if (msg.includes('timed out')) return 'Connection timed out';
    if (msg.includes('1008') || msg.includes('1003')) return 'Model setup failed — check API key';
    return 'Connection failed — try again';
}
