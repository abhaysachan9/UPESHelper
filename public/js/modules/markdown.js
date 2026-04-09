/**
 * public/js/modules/markdown.js
 * Minimal Markdown → HTML renderer (no external library needed).
 * Handles: headings, bold, italic, inline code, bullet/number lists, links.
 */

/**
 * @param {string} text
 * @returns {string} HTML string
 */
export function renderMarkdown(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // ── Block elements ────────────────────────────────────────

    // Headings: ### H3, ## H2, # H1
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Unordered lists
    html = html.replace(/^[*\-] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\n?<li>)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // ── Inline elements ───────────────────────────────────────

    // Inline code (before bold/italic to prevent conflicts)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **text** or __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic *text* or _text_
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // ── Paragraphs ────────────────────────────────────────────
    // Convert double newlines to paragraph breaks, single newlines to <br>
    html = html
        .split(/\n{2,}/)
        .map(block => {
            // Don't wrap block-level elements
            if (/^<(h[1-6]|ul|ol|li|hr|pre)/.test(block.trim())) return block;
            return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        })
        .join('\n');

    return html;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
