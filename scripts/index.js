/**
 * scripts/index.js
 * Reads crawled-data/pages.json, chunks the content, and upserts
 * into Upstash Vector DB.
 *
 * Supports resuming: if indexing is interrupted (e.g. daily write limit),
 * re-running will skip already-indexed chunks and continue from where it stopped.
 *
 * Usage: node scripts/index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertChunks } from '../server/services/vectorDb.js';
import { chunkText } from '../server/utils/chunker.js';

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
const DYNAMIC_INPUT_FILE = path.join(rootDir, 'crawled-data', 'pages-dynamic.json');
const PROGRESS_FILE = path.join(rootDir, 'crawled-data', 'index-progress.json');

// ─── Progress helpers ─────────────────────────────────────────────────────────

function loadProgress() {
    if (!fs.existsSync(PROGRESS_FILE)) return new Set();
    const ids = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    return new Set(ids);
}

function saveProgress(indexedIds) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...indexedIds]));
}

function clearProgress() {
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
}

// ─── Indexer ──────────────────────────────────────────────────────────────────

async function index() {
    const hasStatic = fs.existsSync(INPUT_FILE);
    const hasDynamic = fs.existsSync(DYNAMIC_INPUT_FILE);

    if (!hasStatic && !hasDynamic) {
        console.error(`❌  No crawled data found.`);
        console.error('   Run "npm run crawl" or "npm run crawl:dynamic:sitemap" first.');
        process.exit(1);
    }

    const pages = hasStatic
        ? JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'))
        : [];

    const dynamicPages = hasDynamic
        ? JSON.parse(fs.readFileSync(DYNAMIC_INPUT_FILE, 'utf-8'))
        : [];

    if (hasStatic) console.log(`📄  Found ${pages.length} static pages`);
    if (hasDynamic) console.log(`📄  Found ${dynamicPages.length} dynamic pages`);

    const allPages = [...pages, ...dynamicPages];
    console.log(`📄  Total pages to index: ${allPages.length} (${pages.length} static + ${dynamicPages.length} dynamic)`);

    // Build all chunks with page-level context prepended
    const allChunks = [];
    for (const page of allPages) {
        const textChunks = chunkText(page.text);
        textChunks.forEach((chunk, i) => {
            // Prepend page title so every chunk has page-level context for retrieval
            const contextPrefix = `[${page.title}]\n`;
            allChunks.push({
                id: `${encodeURIComponent(page.url)}_chunk_${i}`,
                text: contextPrefix + chunk,
                metadata: {
                    url: page.url,
                    title: page.title,
                    chunkIndex: i,
                    totalChunks: textChunks.length,
                    crawledAt: page.crawledAt,
                    dynamic: page.dynamic || false,
                },
            });
        });
    }

    // Check what's already indexed (from previous interrupted run)
    const indexedIds = loadProgress();
    const remainingChunks = allChunks.filter(c => !indexedIds.has(c.id));

    console.log(`\n📚  Indexing ${allPages.length} pages into Upstash Vector DB...`);
    console.log(`   Total chunks: ${allChunks.length}`);

    if (indexedIds.size > 0) {
        console.log(`   ✅ Already indexed (from previous run): ${indexedIds.size}`);
        console.log(`   ⏳ Remaining to index: ${remainingChunks.length}`);
    }

    if (remainingChunks.length === 0) {
        console.log(`\n✅  All ${allChunks.length} chunks are already indexed! Nothing to do.`);
        clearProgress();
        return;
    }

    console.log('   Upserting to Upstash...\n');

    try {
        await upsertChunks(remainingChunks, (batch) => {
            for (const chunk of batch) indexedIds.add(chunk.id);
            saveProgress(indexedIds);
        }, indexedIds.size);

        // All done — clean up progress file
        clearProgress();
        console.log(`\n✅  Indexing complete! ${allChunks.length} chunks are now in the vector DB.\n`);
    } catch (err) {
        const indexed = indexedIds.size;
        const remaining = allChunks.length - indexed;
        console.error(`\n❌  Indexing stopped: ${err.message}`);
        console.log(`\n📊  Progress saved! ${indexed}/${allChunks.length} chunks indexed (${remaining} remaining).`);
        console.log('   Run "npm run index" again to resume from where it stopped.\n');
        process.exit(1);
    }
}

index().catch(err => {
    console.error('❌  Indexing failed:', err.message);
    process.exit(1);
});
