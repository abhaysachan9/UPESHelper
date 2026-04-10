/**
 * server/services/vectorDb.js
 * Upstash Vector DB integration — query, upsert, and reranking.
 */

import { Index } from '@upstash/vector';

const QUERY_TIMEOUT_MS = 10_000;
const MIN_SCORE = 0.55;

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
 * Basic keyword-boost reranker.
 * Boosts chunks that contain exact query keywords in their text, then
 * re-sorts by the combined score.
 */
function rerankResults(results, query) {
    const queryLower = query.toLowerCase();
    const keywords = queryLower
        .split(/\s+/)
        .filter(w => w.length > 2)
        .map(w => w.replace(/[^a-z0-9]/g, ''));

    return results
        .map(r => {
            const text = (r.data || r.metadata?.text || '').toLowerCase();
            const title = (r.metadata?.title || '').toLowerCase();

            let boost = 0;
            let keywordHits = 0;

            for (const kw of keywords) {
                if (text.includes(kw)) {
                    keywordHits++;
                    boost += 0.03;
                }
                if (title.includes(kw)) {
                    keywordHits++;
                    boost += 0.05;
                }
            }

            if (queryLower.length > 3 && text.includes(queryLower)) {
                boost += 0.08;
            }
            if (queryLower.length > 3 && title.includes(queryLower)) {
                boost += 0.10;
            }

            const finalScore = Math.min(r.score + boost, 1.0);
            return { ...r, score: finalScore, keywordHits };
        })
        .sort((a, b) => b.score - a.score);
}

/**
 * Retrieve the top-k most relevant chunks for a query, with reranking.
 * Fetches extra candidates, applies keyword-boost reranking, and returns
 * the final top-k results.
 *
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<Array<{text: string, metadata: object, score: number}>>}
 */
export async function retrieveContext(query, topK = 5) {
    const index = getIndex();
    const candidateK = Math.max(topK * 3, 15);

    const queryPromise = index.query({
        data: query,
        topK: candidateK,
        includeMetadata: true,
        includeData: true,
    });

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Vector DB query timed out')), QUERY_TIMEOUT_MS),
    );

    const results = await Promise.race([queryPromise, timeoutPromise]);

    const filtered = results.filter(r => r.score > MIN_SCORE);
    const reranked = rerankResults(filtered, query).slice(0, topK);

    console.log(`\n--- UPSTASH RETRIEVAL FOR: "${query}" ---`);
    if (reranked.length === 0) {
        console.log(`No chunks found with score > ${MIN_SCORE}`);
    } else {
        reranked.forEach((r, i) => {
            const text = r.data || r.metadata?.text || '';
            console.log(`[Chunk ${i + 1}] Score: ${r.score.toFixed(3)} | Hits: ${r.keywordHits || 0} | ${text.substring(0, 120)}…`);
        });
    }
    console.log('-------------------------------------------\n');

    return reranked.map(r => ({
        text: r.data || r.metadata?.text || '',
        metadata: r.metadata || {},
        score: r.score,
    }));
}

/**
 * Run multiple diverse queries in parallel and return unique, reranked results.
 * Used by voice call config to pre-load broad context.
 *
 * @param {string[]} queries
 * @param {number} totalK - total chunks to return across all queries
 * @returns {Promise<Array<{text: string, metadata: object, score: number}>>}
 */
export async function retrieveBroadContext(queries, totalK = 15) {
    const perQuery = Math.ceil(totalK / queries.length) + 2;

    const allResults = await Promise.all(
        queries.map(q => retrieveContext(q, perQuery).catch(() => [])),
    );

    const seen = new Set();
    const merged = [];
    for (const results of allResults) {
        for (const r of results) {
            const key = r.text.substring(0, 100);
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(r);
            }
        }
    }

    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, totalK);
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
