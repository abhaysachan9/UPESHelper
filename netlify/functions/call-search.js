import { retrieveContext } from '../../server/services/vectorDb.js';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await req.json();
        const { query } = body;

        if (!query || typeof query !== 'string') {
            return new Response(JSON.stringify({ error: '"query" field is required' }), {
                status: 400,
                headers: JSON_HEADERS,
            });
        }

        console.log(`📞🔍 [Netlify] Call search: "${query}"`);

        const chunks = await retrieveContext(query.trim(), 5);
        const results = chunks.map(c => c.text).join('\n\n---\n\n');

        console.log(`📞✅ [Netlify] Call search returned ${chunks.length} chunks`);

        return new Response(JSON.stringify({ results, count: chunks.length }), {
            status: 200,
            headers: JSON_HEADERS,
        });
    } catch (err) {
        console.error('Netlify Call search error:', err);
        return new Response(JSON.stringify({ error: 'Search failed' }), {
            status: 500,
            headers: JSON_HEADERS,
        });
    }
};
