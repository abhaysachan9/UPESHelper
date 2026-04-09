/**
 * server/index.js
 * Main HTTP server entry point — plain Node.js, no framework.
 */

import http from 'http';
import { router } from './router.js';
import { loadEnv } from './env.js';

loadEnv();

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  try {
    await router(req, res);
  } catch (err) {
    console.error('Unhandled server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 UPES Helper running at http://localhost:${PORT}\n`);
});
