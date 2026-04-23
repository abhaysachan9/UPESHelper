/**
 * scripts/indexSinglePage.js
 * Index a single page from pages-dynamic.json by URL
 * (without deleting old vectors - just adds new ones)
 * 
 * Usage: node scripts/indexSinglePage.js <URL>
 *   or:  npm run index:single -- <URL>
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

function loadProgress() {
    if (!fs.existsSync(PROGRESS_FILE)) return new Set();
    const ids = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    return new Set(ids);
}

function saveProgress(indexedIds) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...indexedIds]));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function indexSinglePage(url) {
    console.log(`\n📄  Indexing single page: ${url}\n`);

    // Load all pages from every crawl source
    let allPages = [];

    if (fs.existsSync(SITEMAP_FILE)) {
        const pages = JSON.parse(fs.readFileSync(SITEMAP_FILE, 'utf-8'));
        allPages.push(...pages);
    }

    if (fs.existsSync(LIST_FILE)) {
        const listPages = JSON.parse(fs.readFileSync(LIST_FILE, 'utf-8'));
        allPages.push(...listPages);
    }

    if (fs.existsSync(FEES_FILE)) {
        const feePages = JSON.parse(fs.readFileSync(FEES_FILE, 'utf-8'));
        allPages.push(...feePages);
    }

    // Find the page
    const page = allPages.find(p => p.url === url);

    if (!page) {
        console.error(`   ❌ Page not found in crawled data: ${url}`);
        console.error('   Make sure you have crawled this page first.');
        console.error('   Run: npm run crawl:sitemap  (or crawl:fees / crawl:dynamic)');
        process.exit(1);
    }

    console.log(`   ✅ Found: "${page.title}"`);
    console.log(`   📝 Content: ${page.text.length} characters`);
    console.log(`   🏷️  Type: ${page.dynamic ? 'Dynamic' : 'Static'}`);

    // Chunk the content
    const textChunks = chunkText(page.text);
    const chunks = textChunks.map((chunk, i) => {
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
                dynamic: page.dynamic || false,
            },
        };
    });

    console.log(`   📦 Chunks: ${chunks.length}`);
    console.log('');

    // Load progress
    const indexedIds = loadProgress();

    // Check if already indexed
    const alreadyIndexed = chunks.every(c => indexedIds.has(c.id));
    if (alreadyIndexed) {
        console.log(`   ℹ️  This page is already indexed.`);
        console.log(`   To re-index (update), use: npm run reindex -- ${url}`);
        console.log('');
        return;
    }

    // Index
    console.log('   ☁️  Uploading to Upstash...');
    
    try {
        await upsertChunks(chunks, (batch) => {
            for (const chunk of batch) indexedIds.add(chunk.id);
            saveProgress(indexedIds);
        }, indexedIds.size);

        console.log(`   ✅ Success! ${chunks.length} chunks indexed.`);
        console.log('');
    } catch (err) {
        console.error(`\n   ❌ Failed: ${err.message}`);
        console.log('');
        process.exit(1);
    }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const url = process.argv[2];
if (!url) {
    console.error('Usage: npm run index:single -- <URL>');
    console.error('Example: npm run index:single -- https://www.upes.ac.in/about');
    process.exit(1);
}

indexSinglePage(url).catch(err => {
    console.error('❌  Failed:', err.message);
    process.exit(1);
});
