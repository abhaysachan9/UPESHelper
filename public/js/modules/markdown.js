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

    // Headings: ##### H5, #### H4, ### H3, ## H2, # H1
    html = html.replace(/^##### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');

    // ── Inline elements (before lists to handle bold in bullets) ───────

    // Inline code (before bold/italic to prevent conflicts)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **text** or __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic *text* or _text_ (but not list markers)
    html = html.replace(/(?<!^|\s)\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<!^|\s)_([^_\n]+)_/g, '<em>$1</em>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // ── Lists ─────────────────────────────────────────────────

    // Unordered lists with bullet points (*, -, •)
    html = html.replace(/^[*\-•] (.+)$/gm, '<li>$1</li>');
    
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>\n?)+/gs, match => {
        return '<ul>' + match + '</ul>';
    });

    // ── Paragraphs ────────────────────────────────────────────
    // Split by double newlines and wrap in paragraphs
    const blocks = html.split(/\n\n+/);
    html = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        // Don't wrap block-level elements
        if (/^<(h[1-6]|ul|ol|hr|pre|blockquote|div)/.test(block)) {
            return block;
        }
        // Replace single newlines with <br> within paragraphs
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).filter(b => b).join('\n');

    return html;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
