/**
 * server/utils/chunker.js
 * Shared text chunking utility for indexing scripts.
 */

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// Abbreviations common on university sites that shouldn't trigger sentence splits
const ABBREVIATIONS = [
    'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr', 'St', 'No',
    'vs', 'etc', 'approx', 'dept', 'govt', 'univ',
    'e\.g', 'i\.e', 'viz',
    'B\.Tech', 'M\.Tech', 'B\.Sc', 'M\.Sc', 'Ph\.D', 'B\.A', 'M\.A',
    'B\.Com', 'M\.Com', 'B\.B\.A', 'M\.B\.A', 'B\.Des', 'M\.Des',
    'B\.Pharm', 'M\.Pharm', 'B\.Arch', 'M\.Arch', 'LL\.B', 'LL\.M',
    'Rs', 'INR', 'Fig', 'Vol', 'Ref',
];

// Build a regex that matches abbreviation dots (to protect them from sentence splitting)
const ABBR_PATTERN = new RegExp(
    `\\b(${ABBREVIATIONS.join('|')})\\.`,
    'g'
);
const PLACEHOLDER = '⟨DOT⟩';

/**
 * Split text into sentences, handling abbreviations gracefully.
 */
function splitSentences(text) {
    // Protect abbreviation dots
    let protected_ = text.replace(ABBR_PATTERN, `$1${PLACEHOLDER}`);

    // Protect decimal numbers (e.g., "2.5 lakh", "3.0 GPA")
    protected_ = protected_.replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER}$2`);

    // Split on sentence-ending punctuation followed by whitespace or end
    const sentences = protected_.split(/(?<=[.!?])\s+/);

    // Restore protected dots
    return sentences
        .map(s => s.replace(new RegExp(PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '.').trim())
        .filter(s => s.length > 0);
}

/**
 * Split text into overlapping chunks of roughly CHUNK_SIZE characters,
 * breaking at sentence boundaries when possible.
 */
export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    if (!text || text.trim().length === 0) return [];

    const sentences = splitSentences(text);
    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
        // If adding this sentence would exceed the limit and we have content, flush
        if ((current + ' ' + sentence).length > chunkSize && current.length > 0) {
            chunks.push(current.trim());

            // Build overlap from the end of the current chunk
            const overlapText = current.slice(-overlap);
            // Try to start overlap at a word boundary
            const wordBoundary = overlapText.indexOf(' ');
            const cleanOverlap = wordBoundary > 0 ? overlapText.slice(wordBoundary + 1) : overlapText;
            current = cleanOverlap + ' ' + sentence;
        } else {
            current += (current.length > 0 ? ' ' : '') + sentence;
        }
    }

    if (current.trim()) chunks.push(current.trim());

    // Safety: if we still have oversized chunks (e.g. a single huge sentence),
    // force-split them at word boundaries
    const finalChunks = [];
    for (const chunk of chunks) {
        if (chunk.length <= chunkSize * 1.5) {
            finalChunks.push(chunk);
        } else {
            // Force split at word boundaries
            const words = chunk.split(' ');
            let part = '';
            for (const word of words) {
                if ((part + ' ' + word).length > chunkSize && part.length > 0) {
                    finalChunks.push(part.trim());
                    const overlapText = part.slice(-overlap);
                    const wb = overlapText.indexOf(' ');
                    part = (wb > 0 ? overlapText.slice(wb + 1) : '') + ' ' + word;
                } else {
                    part += (part.length > 0 ? ' ' : '') + word;
                }
            }
            if (part.trim()) finalChunks.push(part.trim());
        }
    }

    return finalChunks;
}
