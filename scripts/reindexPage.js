/**
 * scripts/reindexPage.js
 * Re-crawl and re-index a single page by URL.
 * Deletes old vectors for that page from Upstash, re-scrapes,
 * re-chunks, re-indexes, and updates pages.json.
 *
 * Usage: node scripts/reindexPage.js <URL>
 *   or:  npm run reindex -- <URL>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeSinglePage } from './crawlSitemap.js';
import { upsertChunks, deleteVectors } from '../server/services/vectorDb.js';
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
const PAGES_FILE = path.join(rootDir, 'crawled-data', 'pages.json');

function buildChunkIds(url, count) {
    const prefix = encodeURIComponent(url);
    return Array.from({ length: count }, (_, i) => `${prefix}_chunk_${i}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function reindexPage(url) {
    console.log(`\n🔄  Re-indexing single page: ${url}\n`);

    // Step 1: Re-crawl the page
    console.log('   📡 Scraping page (Puppeteer)...');
    const page = await scrapeSinglePage(url);
    if (!page) {
        console.error('   ❌ Could not scrape page (no content, timeout, or error).');
        process.exit(1);
    }
    console.log(`   ✅ "${page.title.slice(0, 60)}" (${page.text.length} chars)`);

    // Step 2: Load pages.json and find old entry
    let pages = [];
    if (fs.existsSync(PAGES_FILE)) {
        pages = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8'));
    }

    const oldIndex = pages.findIndex(p => p.url === url);
    let oldChunkCount = 0;
    if (oldIndex !== -1) {
        oldChunkCount = chunkText(pages[oldIndex].text).length;
        console.log(`   📄 Found existing entry in pages.json (${oldChunkCount} old chunks)`);
    } else {
        console.log('   📄 New page — not in pages.json yet');
    }

    // Step 3: Delete old vectors from Upstash
    if (oldChunkCount > 0) {
        const oldIds = buildChunkIds(url, oldChunkCount);
        console.log(`   🗑️  Deleting ${oldIds.length} old vectors from Upstash...`);
        await deleteVectors(oldIds);
        console.log('   ✅ Old vectors deleted');
    }

    // Step 4: Chunk new content and upsert (with title context)
    const textChunks = chunkText(page.text);
    const newChunks = textChunks.map((chunk, i) => {
        const contextPrefix = `[${page.title}]\n`;
        return {
            id: `${encodeURIComponent(url)}_chunk_${i}`,
            text: contextPrefix + chunk,
            metadata: {
                url: page.url,
                title: page.title,
                chunkIndex: i,
                totalChunks: textChunks.length,
                crawledAt: page.crawledAt,
            },
        };
    });

    console.log(`   ☁️  Upserting ${newChunks.length} new vectors...`);
    await upsertChunks(newChunks);
    console.log('   ✅ New vectors indexed');

    // Step 5: Update pages.json
    if (oldIndex !== -1) {
        pages[oldIndex] = page;
    } else {
        pages.push(page);
    }
    fs.writeFileSync(PAGES_FILE, JSON.stringify(pages, null, 2), 'utf-8');
    console.log(`   💾 pages.json updated (${pages.length} total pages)`);

    console.log(`\n✅  Done! Page re-indexed: ${url}\n`);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const url = process.argv[2];
if (!url) {
    console.error('Usage: npm run reindex -- <URL>');
    console.error('Example: npm run reindex -- https://www.upes.ac.in/about');
    process.exit(1);
}

reindexPage(url).catch(err => {
    console.error('❌  Re-index failed:', err.message);
    process.exit(1);
});
