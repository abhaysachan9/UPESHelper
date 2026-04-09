/**
 * public/js/modules/typing.js
 * Rotating typewriter placeholder on the textarea.
 * Pauses while the user is typing.
 */

const PROMPTS = [
    'Ask about fees structure…',
    'Ask about hostel info…',
    'Ask about admission process…',
    'Ask about scholarships…',
    'Ask about courses offered…',
    'Ask about placement stats…',
    'Ask about campus life…',
    'Ask about academic calendar…',
];

export function initTyping() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    let idx = 0, char = 0, deleting = false, timer = null;

    function tick() {
        const str = PROMPTS[idx];
        if (deleting) {
            char--;
            input.placeholder = str.slice(0, char);
        } else {
            char++;
            input.placeholder = str.slice(0, char);
        }

        let delay = deleting ? 35 : 75;
        if (!deleting && char === str.length) { delay = 2400; deleting = true; }
        else if (deleting && char === 0) { deleting = false; idx = (idx + 1) % PROMPTS.length; delay = 450; }

        timer = setTimeout(tick, delay);
    }

    input.addEventListener('focus', () => clearTimeout(timer));
    input.addEventListener('blur', () => tick());

    tick();
}
