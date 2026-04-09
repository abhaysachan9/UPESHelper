/**
 * public/js/modules/voice.js
 * Web Speech API voice input. Gracefully degrades if unsupported.
 */

export function initVoice() {
    const voiceBtn = document.getElementById('voice-btn');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    if (!voiceBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    let listening = false;

    voiceBtn.addEventListener('click', () => {
        listening ? recognition.stop() : recognition.start();
    });

    recognition.addEventListener('start', () => {
        listening = true;
        voiceBtn.classList.add('listening');
        voiceBtn.title = 'Listening… click to stop';
        voiceBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    });

    recognition.addEventListener('result', (e) => {
        const t = e.results[0][0].transcript;
        input.value = t;
        // Trigger input event to resize + enable send
        input.dispatchEvent(new Event('input'));
        input.focus();
    });

    recognition.addEventListener('end', () => {
        listening = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.title = 'Voice input';
        voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    });

    recognition.addEventListener('error', (e) => {
        console.warn('Voice error:', e.error);
        listening = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    });
}
