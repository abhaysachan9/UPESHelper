/**
 * server/handlers/health.js
 * Simple health-check endpoint.
 */

export function handleHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
}
