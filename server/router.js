/**
 * server/router.js
 * URL router — maps incoming request paths to handlers.
 */

import { serveStatic } from './static.js';
import { handleChat } from './handlers/chat.js';
import { handleHealth } from './handlers/health.js';
import { handleCallConfig } from './handlers/callConfig.js';

export async function router(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    // ── API routes ─────────────────────────────────────────────────────────────
    if (pathname === '/api/chat' && method === 'POST') {
        return handleChat(req, res);
    }

    if (pathname === '/api/call-enabled' && method === 'GET') {
        const enabled = process.env.ENABLE_VOICE_CALL !== 'false';
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ enabled }));
    }

    if (pathname === '/api/call-config' && (method === 'GET' || method === 'OPTIONS')) {
        return handleCallConfig(req, res);
    }

    if (pathname === '/api/health' && method === 'GET') {
        return handleHealth(req, res);
    }

    // ── Static assets ──────────────────────────────────────────────────────────
    if (method === 'GET') {
        return serveStatic(req, res, pathname);
    }

    // ── 404 ────────────────────────────────────────────────────────────────────
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}
