/**
 * scripts/indexNew.js
 * Index only newly added pages (pages not already in the vector DB)
 * 
 * This script:
 * 1. Reads pages.json and pages-dynamic.json
 * 2. Checks which pages are already indexed (from index-progress.json)
 * 3. Only indexes pages that are new
 * 
 * Usage: node scripts/indexNew.js
 *   or:  npm run index:new
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
const SITEMAP_FILE = path.join(rootDir, 'crawled-data', 'pages.json');
const LIST_FILE = path.join(rootDir, 'crawled-data', 'pages-list.json');
const FEES_FILE = path.join(rootDir, 'crawled-data', 'pages-fees.json');
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

// ─── Get indexed URLs ─────────────────────────────────────────────────────────

function getIndexedUrls(indexedIds) {
    const urls = new Set();
    for (const id of indexedIds) {
        // Extract URL from chunk ID (format: "encodedURL_chunk_0")
        const match = id.match(/^(.+)_chunk_\d+$/);
        if (match) {
            const encodedUrl = match[1];
            const url = decodeURIComponent(encodedUrl);
            urls.add(url);
        }
    }
    return urls;
}

// ─── Indexer ──────────────────────────────────────────────────────────────────

async function indexNew() {
    const hasSitemap = fs.existsSync(SITEMAP_FILE);
    const hasList = fs.existsSync(LIST_FILE);
    const hasFees = fs.existsSync(FEES_FILE);

    if (!hasSitemap && !hasList && !hasFees) {
        console.error(`❌  No crawled data found.`);
        console.error('   Run "npm run crawl:sitemap" first.');
        process.exit(1);
    }

    const sitemapPages = hasSitemap
        ? JSON.parse(fs.readFileSync(SITEMAP_FILE, 'utf-8'))
        : [];
    const listPages = hasList
        ? JSON.parse(fs.readFileSync(LIST_FILE, 'utf-8'))
        : [];
    const feePages = hasFees
        ? JSON.parse(fs.readFileSync(FEES_FILE, 'utf-8'))
        : [];

    // Fees first (smallest, freshest, most user-facing), then list, then sitemap.
    // Keeps the highest-value content prioritised when Upstash's daily write
    // quota is tight.
    const allPages = [...feePages, ...listPages, ...sitemapPages];

    console.log(`\n📚  Indexing NEW pages only...`);
    console.log(`   Total pages available: ${allPages.length} (${feePages.length} fee combos + ${listPages.length} list + ${sitemapPages.length} sitemap)`);

    // Get already indexed URLs
    const indexedIds = loadProgress();
    const indexedUrls = getIndexedUrls(indexedIds);
    
    console.log(`   Already indexed: ${indexedUrls.size} pages (${indexedIds.size} chunks)`);

    // Filter to only new pages
    const newPages = allPages.filter(page => !indexedUrls.has(page.url));
    
    if (newPages.length === 0) {
        console.log(`\n✅  No new pages to index! All ${allPages.length} pages are already indexed.\n`);
        return;
    }

    console.log(`   🆕 New pages to index: ${newPages.length}`);
    console.log('');

    // Build chunks for new pages only
    const newChunks = [];
    for (const page of newPages) {
        const textChunks = chunkText(page.text);
        textChunks.forEach((chunk, i) => {
            const contextPrefix = `[${page.title}]\n`;
            newChunks.push({
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

    console.log(`   Total new chunks to index: ${newChunks.length}`);
    console.log('   Upserting to Upstash...\n');

    try {
        await upsertChunks(newChunks, (batch) => {
            for (const chunk of batch) indexedIds.add(chunk.id);
            saveProgress(indexedIds);
        }, indexedIds.size);

        console.log(`\n✅  Indexing complete! ${newPages.length} new pages (${newChunks.length} chunks) added to the vector DB.`);
        console.log(`   Total indexed: ${indexedUrls.size + newPages.length} pages (${indexedIds.size} chunks)\n`);
    } catch (err) {
        console.error(`\n❌  Indexing stopped: ${err.message}`);
        console.log(`\n📊  Progress saved! Run "npm run index:new" again to resume.\n`);
        process.exit(1);
    }
}

indexNew().catch(err => {
    console.error('❌  Indexing failed:', err.message);
    process.exit(1);
});
