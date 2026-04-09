/**
 * server/services/gemini.js
 * Google Gemini API integration for answer generation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let _genAI = null;
let _model = null;

function getModel() {
    if (_model) return _model;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY in environment.');
    }

    _genAI = new GoogleGenerativeAI(apiKey);
    _model = _genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
    return _model;
}

/**
 * Build a strict RAG system prompt that limits answers to provided context.
 */
function buildPrompt(question, contextChunks) {
    const context = contextChunks
        .map((c, i) => `[${i + 1}] ${c.text}`)
        .join('\n\n');

    return `You are UPES Helper — a smart university assistant for UPES (University of Petroleum and Energy Studies). 
Your role is to answer student questions ONLY based on the provided knowledge base context below.

RULES:
- Answer ONLY from the provided context. Do NOT use outside knowledge.
- If the context doesn't contain enough information to answer, say: "I don't have enough information about this in my knowledge base. Please contact UPES directly at admissions@upes.ac.in or visit upes.ac.in."
- Be highly detailed, thorough, and provide comprehensive information from the context. Do not be vague or brief! 
- Format your answer in clear, readable markdown. Use bullet points and headers to organize the response extensively where applicable.
- Do NOT mention "context", "documents", or "chunks" in your response.

─── KNOWLEDGE BASE CONTEXT ───────────────────────────────────────────
${context}
──────────────────────────────────────────────────────────────────────

Student Question: ${question}

Answer:`;
}

/**
 * Generate an answer using Gemini with the provided context chunks.
 * @param {string} question
 * @param {Array<{text: string, metadata: object}>} contextChunks
 * @returns {Promise<string>}
 */
export async function generateAnswer(question, contextChunks) {
    const model = getModel();
    const prompt = buildPrompt(question, contextChunks);

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
}
