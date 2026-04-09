/**
 * public/js/modules/theme.js
 * Dark/light toggle + font-size accessibility. Persists to localStorage.
 */

const THEME_KEY = 'upes-theme';
const FONT_KEY = 'upes-font';

export function initTheme() {
    const themeBtn = document.getElementById('theme-btn');
    const root = document.documentElement;

    // Restore saved theme
    if (localStorage.getItem(THEME_KEY) === 'dark') {
        root.setAttribute('data-theme', 'dark');
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    // Restore saved font size (default to medium / A++)
    const savedFont = localStorage.getItem(FONT_KEY) || 'medium';
    applyFont(savedFont);

    themeBtn.addEventListener('click', () => {
        const isDark = root.getAttribute('data-theme') === 'dark';
        root.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeBtn.innerHTML = isDark
            ? '<i class="fa-solid fa-moon"></i>'
            : '<i class="fa-solid fa-sun"></i>';
        localStorage.setItem(THEME_KEY, isDark ? 'light' : 'dark');
    });

    // Expose font setter for inline onclick
    window.setFontSize = (size) => {
        applyFont(size);
        localStorage.setItem(FONT_KEY, size);
    };
}

function applyFont(size) {
    const sizes = { small: '18px', medium: '22px', large: '26px' };
    document.documentElement.style.fontSize = sizes[size] || '22px';
    ['font-sm', 'font-md', 'font-lg'].forEach((id, i) => {
        document.getElementById(id)?.classList.toggle(
            'active', ['small', 'medium', 'large'][i] === size
        );
    });
}
