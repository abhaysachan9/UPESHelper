/**
 * scripts/clearIndex.js
 * Clears all vectors from the Upstash Vector index.
 * Usage: node scripts/clearIndex.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Index } from '@upstash/vector';

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function clearIndex() {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

    if (!url || !token) {
        console.error('Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN in environment.');
        process.exit(1);
    }

    const index = new Index({ url, token });

    console.log('🗑️  Clearing Upstash Vector Index...');
    await index.reset();
    console.log('✅ Successfully cleared Upstash Vector Index!');
}

clearIndex().catch(err => {
    console.error('❌ Failed to clear index:', err.message);
    process.exit(1);
});
