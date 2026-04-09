/**
 * server/router.js
 * URL router — maps incoming request paths to handlers.
 */

import { serveStatic } from './static.js';
import { handleChat } from './handlers/chat.js';
import { handleHealth } from './handlers/health.js';

export async function router(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    // ── API routes ─────────────────────────────────────────────────────────────
    if (pathname === '/api/chat' && method === 'POST') {
        return handleChat(req, res);
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
