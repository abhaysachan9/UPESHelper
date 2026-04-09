/**
 * scripts/index.js
 * Reads crawled-data/pages.json, chunks the content, and upserts
 * into Upstash Vector DB.
 * Usage: node scripts/index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertChunks } from '../server/services/vectorDb.js';

// ─── Load env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !(key in process.env)) process.env[key] = val;
    });
}

// ─── Config ───────────────────────────────────────────────────────────────────
const INPUT_FILE = path.join(rootDir, 'crawled-data', 'pages.json');
const CHUNK_SIZE = 500;   // characters per chunk
const CHUNK_OVERLAP = 100;  // overlap to preserve context at boundaries

// ─── Chunker ──────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks of roughly CHUNK_SIZE characters,
 * trying to break at sentence boundaries.
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
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

// ─── Indexer ──────────────────────────────────────────────────────────────────

async function index() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌  No crawled data found at: ${INPUT_FILE}`);
        console.error('   Run "npm run crawl" first.');
        process.exit(1);
    }

    const pages = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    console.log(`\n📚  Indexing ${pages.length} pages into Upstash Vector DB...\n`);

    const allChunks = [];

    for (const page of pages) {
        const textChunks = chunkText(page.text);
        textChunks.forEach((chunk, i) => {
            allChunks.push({
                id: `${encodeURIComponent(page.url)}_chunk_${i}`,
                text: chunk,
                metadata: {
                    url: page.url,
                    title: page.title,
                    chunkIndex: i,
                    crawledAt: page.crawledAt,
                },
            });
        });
    }

    console.log(`   Total chunks to index: ${allChunks.length}`);
    console.log('   Upserting to Upstash...\n');

    await upsertChunks(allChunks);

    console.log(`\n✅  Indexing complete! ${allChunks.length} chunks are now in the vector DB.\n`);
}

index().catch(err => {
    console.error('❌  Indexing failed:', err.message);
    process.exit(1);
});
