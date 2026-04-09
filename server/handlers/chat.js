/**
 * server/handlers/chat.js
 * POST /api/chat — Receives a user question, retrieves context from
 * Upstash Vector via RAG, and returns a Gemini-generated answer.
 */

import { retrieveContext } from '../services/vectorDb.js';
import { generateAnswer } from '../services/gemini.js';
import { readBody } from '../utils/http.js';

export async function handleChat(req, res) {
    // 1. Parse request body
    let body;
    try {
        body = await readBody(req);
    } catch {
        return badRequest(res, 'Invalid request body');
    }

    const { message } = body;
    if (!message || typeof message !== 'string' || !message.trim()) {
        return badRequest(res, '"message" field is required');
    }

    const question = message.trim();
    console.log(`\n💬 User: ${question}`);

    try {
        // 2. Retrieve relevant context from vector DB
        const contextChunks = await retrieveContext(question);

        if (!contextChunks || contextChunks.length === 0) {
            const noContextAnswer = {
                answer: "I'm sorry, I couldn't find relevant information in the knowledge base for your question. Please try rephrasing or ask about topics like fees, admission, courses, hostel, scholarships, or campus services.",
                sources: [],
            };
            return jsonResponse(res, 200, noContextAnswer);
        }

        // 3. Generate answer using Gemini with retrieved context
        const answer = await generateAnswer(question, contextChunks);
        const seenUrls = new Set();
        const sources = contextChunks
            .filter(c => c.metadata?.url && !seenUrls.has(c.metadata.url) && seenUrls.add(c.metadata.url))
            .map(c => ({ url: c.metadata.url, title: c.metadata.title || '' }));

        console.log(`✅ Answer generated (${contextChunks.length} context chunks)`);

        return jsonResponse(res, 200, { answer, sources });
    } catch (err) {
        console.error('Chat handler error:', err);
        return jsonResponse(res, 500, { error: 'Failed to generate a response. Please try again.' });
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function badRequest(res, message) {
    return jsonResponse(res, 400, { error: message });
}

function jsonResponse(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
}
