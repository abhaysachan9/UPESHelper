/**
 * server/utils/http.js
 * Utility helpers for raw Node.js HTTP handling.
 */

/**
 * Read and parse the JSON body from an incoming request.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<object>}
 */
export function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(data || '{}'));
            } catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}
