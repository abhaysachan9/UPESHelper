/**
 * public/js/app.js — Main entry point
 */

import { initTheme } from './modules/theme.js';
import { initChat } from './modules/chat.js';
import { initTyping } from './modules/typing.js';
import { initVoice } from './modules/voice.js';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initChat();
    initTyping();
    initVoice();
});
