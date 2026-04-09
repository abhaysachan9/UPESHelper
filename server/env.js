/**
 * server/env.js
 * Minimal .env loader — no external dependency needed for loading secrets.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export function loadEnv() {
    const envPath = path.join(rootDir, '.env');
    if (!fs.existsSync(envPath)) {
        console.warn('⚠️  No .env file found. Copy .env.example → .env and fill in your keys.');
        return;
    }

    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !(key in process.env)) {
            process.env[key] = val;
        }
    }
}
