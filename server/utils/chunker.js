/**
 * server/utils/chunker.js
 * Shared text chunking utility for indexing scripts.
 */

const CHUNK_SIZE = 500;   // characters per chunk
const CHUNK_OVERLAP = 100;  // overlap to preserve context at boundaries

/**
 * Split text into overlapping chunks of roughly CHUNK_SIZE characters,
 * trying to break at sentence boundaries.
 */
export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
        if ((current + sentence).length > chunkSize && current.length > 0) {
            chunks.push(current.trim());
            // Keep overlap from end of current chunk
            const words = current.split(' ');
            const overlapWords = words.slice(Math.max(0, words.length - Math.ceil(overlap / 5)));
            current = overlapWords.join(' ') + ' ' + sentence;
        } else {
            current += sentence;
        }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
}
