import { retrieveContext } from '../../server/services/vectorDb.js';
import { generateAnswer } from '../../server/services/gemini.js';

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
        const { message } = body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return new Response(JSON.stringify({ error: '"message" field is required' }), {
                status: 400,
                headers: JSON_HEADERS,
            });
        }

        const question = message.trim();
        console.log(`\n💬 [Netlify Function] User: ${question}`);

        const contextChunks = await retrieveContext(question);

        if (!contextChunks || contextChunks.length === 0) {
            return new Response(JSON.stringify({
                answer: "I'm sorry, I couldn't find relevant information in the knowledge base for your question. Please try rephrasing or ask about topics like fees, admission, courses, hostel, scholarships, or campus services.",
                sources: [],
            }), {
                status: 200,
                headers: JSON_HEADERS,
            });
        }

        const answer = await generateAnswer(question, contextChunks);
        const seenUrls = new Set();
        const sources = contextChunks
            .filter(c => c.metadata?.url && !seenUrls.has(c.metadata.url) && seenUrls.add(c.metadata.url))
            .map(c => ({ url: c.metadata.url, title: c.metadata.title || '' }));

        return new Response(JSON.stringify({ answer, sources }), {
            status: 200,
            headers: JSON_HEADERS,
        });

    } catch (err) {
        console.error('Netlify Chat handler error:', err);
        return new Response(JSON.stringify({ error: 'Failed to generate a response. Please try again.' }), {
            status: 500,
            headers: JSON_HEADERS,
        });
    }
};
