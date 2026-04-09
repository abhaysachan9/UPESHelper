/**
 * scripts/indexStatus.js
 * Shows current indexing status: vectors in DB, local progress, etc.
 * Usage: node scripts/indexStatus.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIndexInfo } from '../server/services/vectorDb.js';

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

const PAGES_FILE = path.join(rootDir, 'crawled-data', 'pages.json');
const PROGRESS_FILE = path.join(rootDir, 'crawled-data', 'index-progress.json');

async function status() {
    console.log('\n📊  Indexing Status\n');

    // Local crawled data
    if (fs.existsSync(PAGES_FILE)) {
        const pages = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8'));
        console.log(`   📄 Crawled pages (pages.json): ${pages.length}`);
    } else {
        console.log('   📄 Crawled pages: none (run "npm run crawl" first)');
    }

    // Progress file
    if (fs.existsSync(PROGRESS_FILE)) {
        const ids = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
        console.log(`   💾 Saved progress: ${ids.length} chunks indexed (incomplete — run "npm run index" to resume)`);
    } else {
        console.log('   💾 Saved progress: none (no interrupted indexing)');
    }

    // Upstash Vector DB info
    try {
        const info = await getIndexInfo();
        console.log(`   ☁️  Vectors in Upstash DB: ${info.vectorCount}`);
        console.log(`   📐 Dimensions: ${info.dimension}`);
        if (info.pendingVectorCount > 0) {
            console.log(`   ⏳ Pending vectors: ${info.pendingVectorCount}`);
        }
    } catch (err) {
        console.log(`   ☁️  Upstash DB: could not connect (${err.message})`);
    }

    console.log('');
}

status().catch(err => {
    console.error('❌  Status check failed:', err.message);
    process.exit(1);
});
