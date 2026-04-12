/**
 * public/js/modules/markdown.js
 * Minimal Markdown → HTML renderer (no external library needed).
 * Handles: headings, bold, italic, inline code, bullet/number lists, links, tables.
 */

/**
 * @param {string} text
 * @returns {string} HTML string
 */
export function renderMarkdown(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // ── Tables (before other block transforms so pipes aren't mangled) ──
    html = convertTables(html);

    // ── Block elements ────────────────────────────────────────

    html = html.replace(/^##### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/^---+$/gm, '<hr>');

    // ── Inline elements ───────────────────────────────────────

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **text** or __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic *text* or _text_ (not at line start to avoid clashing with list markers)
    html = html.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<em>$1</em>');
    html = html.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, '<em>$1</em>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // ── Lists ─────────────────────────────────────────────────

    // Unordered: *, -, •   (but NOT * inside inline text)
    html = html.replace(/^[*\-•] (.+)$/gm, '<li>$1</li>');

    // Ordered: 1. 2. etc.
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>\n?)+/gs, match => '<ul>' + match + '</ul>');

    // ── Paragraphs ────────────────────────────────────────────
    const blocks = html.split(/\n\n+/);
    html = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        if (/^<(h[1-6]|ul|ol|hr|pre|blockquote|div|table)/.test(block)) return block;
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean).join('\n');

    return html;
}

// ── Table helpers ─────────────────────────────────────────────

function parsePipeRow(line) {
    return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

function isSeparatorRow(line) {
    return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(line);
}

function isTableRow(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3;
}

function applyInlineFormatting(cell) {
    let s = cell;
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
}

function convertTables(html) {
    const lines = html.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
        // Pattern 1: header row + separator row (standard markdown table)
        if (
            isTableRow(lines[i]) &&
            i + 1 < lines.length &&
            isSeparatorRow(lines[i + 1])
        ) {
            const headers = parsePipeRow(lines[i]);
            i += 2;

            const rows = [];
            while (i < lines.length && isTableRow(lines[i]) && !isSeparatorRow(lines[i])) {
                rows.push(parsePipeRow(lines[i]));
                i++;
            }
            // Skip trailing separator rows between stacked tables
            while (i < lines.length && isSeparatorRow(lines[i])) i++;

            out.push(buildTableHtml(headers, rows));
            continue;
        }

        // Pattern 2: pipe-separated rows without a separator line (LLM sometimes omits it)
        // Detect 3+ consecutive pipe rows
        if (isTableRow(lines[i])) {
            let end = i + 1;
            while (end < lines.length && (isTableRow(lines[end]) || isSeparatorRow(lines[end]))) end++;

            const dataLines = [];
            for (let j = i; j < end; j++) {
                if (!isSeparatorRow(lines[j])) dataLines.push(lines[j]);
            }

            if (dataLines.length >= 2) {
                const headers = parsePipeRow(dataLines[0]);
                const rows = dataLines.slice(1).map(l => parsePipeRow(l));
                out.push(buildTableHtml(headers, rows));
                i = end;
                continue;
            }
        }

        out.push(lines[i]);
        i++;
    }

    return out.join('\n');
}

function buildTableHtml(headers, rows) {
    let t = '<div class="table-wrap"><table>';
    t += '<thead><tr>' + headers.map(h => `<th>${applyInlineFormatting(h)}</th>`).join('') + '</tr></thead>';
    t += '<tbody>';
    for (const row of rows) {
        t += '<tr>';
        for (let c = 0; c < headers.length; c++) {
            t += `<td>${applyInlineFormatting(row[c] ?? '')}</td>`;
        }
        t += '</tr>';
    }
    t += '</tbody></table></div>';
    return t;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
