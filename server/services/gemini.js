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

// Language code to language name mapping
const LANGUAGE_NAMES = {
    'en-IN': 'English',
    'hi-IN': 'Hindi (हिन्दी)',
    'es-ES': 'Spanish (Español)',
    'fr-FR': 'French (Français)',
    'de-DE': 'German (Deutsch)',
    'zh-CN': 'Chinese (中文)',
    'ja-JP': 'Japanese (日本語)',
    'ar-SA': 'Arabic (العربية)',
    'pt-BR': 'Portuguese (Português)',
    'ru-RU': 'Russian (Русский)',
    'ko-KR': 'Korean (한국어)',
    'it-IT': 'Italian (Italiano)',
    'nl-NL': 'Dutch (Nederlands)',
    'tr-TR': 'Turkish (Türkçe)',
    'vi-VN': 'Vietnamese (Tiếng Việt)',
    'th-TH': 'Thai (ไทย)',
    'bn-IN': 'Bengali (বাংলা)',
    'ta-IN': 'Tamil (தமிழ்)',
    'te-IN': 'Telugu (తెలుగు)',
    'mr-IN': 'Marathi (मराठी)',
};

/**
 * Build a strict RAG system prompt that limits answers to provided context.
 */
function buildPrompt(question, contextChunks, language = 'en-IN') {
    const context = contextChunks
        .map((c, i) => `[${i + 1}] ${c.text}`)
        .join('\n\n');

    const languageName = LANGUAGE_NAMES[language] || 'English';
    const languageInstruction = language !== 'en-IN' 
        ? `\n- CRITICAL LANGUAGE REQUIREMENT: You MUST respond ENTIRELY in ${languageName}. Every single word of your response must be in ${languageName}. Do NOT mix languages. Translate all information from the English context into ${languageName} naturally and accurately.`
        : '';

    return `You are UPES Helper — a smart university assistant for UPES (University of Petroleum and Energy Studies). 
Your role is to answer student questions ONLY based on the provided knowledge base context below.

RULES:
- Answer ONLY from the provided context. Do NOT use outside knowledge.
- If the context doesn't contain enough information to answer, respond appropriately in the user's language saying you don't have that information and suggest contacting UPES at admissions@upes.ac.in or visiting upes.ac.in.
- Be highly detailed, thorough, and provide comprehensive information from the context. Do not be vague or brief! 
- Format your answer in clear, readable markdown. Use bullet points and headers to organize the response extensively where applicable.
- Do NOT mention "context", "documents", or "chunks" in your response.${languageInstruction}

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
 * @param {string} language - Language code (e.g., 'en-IN', 'hi-IN', 'es-ES')
 * @returns {Promise<string>}
 */
export async function generateAnswer(question, contextChunks, language = 'en-IN') {
    const model = getModel();
    const prompt = buildPrompt(question, contextChunks, language);

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
}
