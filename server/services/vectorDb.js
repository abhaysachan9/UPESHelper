/**
 * server/services/vectorDb.js
 * Upstash Vector DB integration — query and upsert operations.
 */

import { Index } from '@upstash/vector';

let _index = null;

function getIndex() {
    if (_index) return _index;

    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

    if (!url || !token) {
        throw new Error(
            'Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN in environment.'
        );
    }

    _index = new Index({ url, token });
    return _index;
}

/**
 * Retrieve the top-k most relevant chunks for a query.
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<Array<{text: string, metadata: object, score: number}>>}
 */
export async function retrieveContext(query, topK = 5) {
    const index = getIndex();

    const results = await index.query({
        data: query,          // Upstash auto-embeds when using 'data' instead of 'vector'
        topK,
        includeMetadata: true,
        includeData: true,
    });

    const filtered = results.filter(r => r.score > 0.6);
    
    console.log(`\n--- UPSTASH RETRIEVAL FOR: "${query}" ---`);
    if (filtered.length === 0) {
        console.log("No chunks found with score > 0.6");
    } else {
        filtered.forEach((r, i) => {
            console.log(`\n[Chunk ${i+1}] Score: ${r.score}`);
            console.log(`Text: ${r.data || (r.metadata && r.metadata.text) ? (r.data || r.metadata.text).substring(0, 150) + "..." : "No text"}`);
            // If you want full text, you can change substring to full text:
            // console.log(`Text: ${r.data || r.metadata.text}`);
        });
    }
    console.log("-------------------------------------------\n");

    return filtered.map(r => ({
        text: r.data || r.metadata?.text || '',
        metadata: r.metadata || {},
        score: r.score,
    }));
}

/**
 * Retrieve index info (vector count, dimensions, etc.).
 * @returns {Promise<object>}
 */
export async function getIndexInfo() {
    const index = getIndex();
    return index.info();
}

/**
 * Delete vectors by their IDs.
 * @param {string[]} ids - Array of vector IDs to delete
 */
export async function deleteVectors(ids) {
    if (!ids.length) return;
    const index = getIndex();
    const BATCH = 100;
    for (let i = 0; i < ids.length; i += BATCH) {
        await index.delete(ids.slice(i, i + BATCH));
    }
}

/**
 * Upsert a list of document chunks into the vector DB.
 * @param {Array<{id: string, text: string, metadata: object}>} chunks
 * @param {function} [onBatch] - Called after each successful batch with the batch's chunks
 * @param {number} [startOffset=0] - Offset for log numbering (e.g. already-indexed count)
 */
export async function upsertChunks(chunks, onBatch, startOffset = 0) {
    const index = getIndex();

    const vectors = chunks.map(chunk => ({
        id: chunk.id,
        data: chunk.text,         // Upstash auto-embeds the text
        metadata: {
            text: chunk.text,
            ...chunk.metadata,
        },
    }));

    // Upsert in batches of 100
    const BATCH = 100;
    for (let i = 0; i < vectors.length; i += BATCH) {
        const batchSlice = vectors.slice(i, i + BATCH);
        await index.upsert(batchSlice);
        console.log(`   Indexed vectors ${startOffset + i + 1}–${startOffset + Math.min(i + BATCH, vectors.length)}`);
        if (onBatch) onBatch(chunks.slice(i, i + BATCH));
    }
}
