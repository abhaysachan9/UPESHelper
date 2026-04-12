/**
 * server/handlers/callConfig.js
 * GET /api/call-config — Creates a Gemini ephemeral token for the
 * client-side Live API voice call. The API key never leaves the server.
 */

import { GoogleGenAI } from '@google/genai';
import { retrieveBroadContext, retrieveContext } from '../services/vectorDb.js';
import { readBody } from '../utils/http.js';
import { URL } from 'url';

const MODEL = 'gemini-3.1-flash-live-preview';
const WS_URL =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

const SEARCH_TOOL = {
    functionDeclarations: [{
        name: 'search_knowledge_base',
        description: 'Search the UPES knowledge base for specific information. Use this tool whenever the user asks about something not covered in your pre-loaded context, such as specific fee structures, course details, admission criteria, scholarship details, hostel fees, exam schedules, or any specific factual question about UPES.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: {
                    type: 'STRING',
                    description: 'The search query to look up in the UPES knowledge base. Use the user\'s question rephrased as a clear search query.',
                },
            },
            required: ['query'],
        },
    }],
};

// Language code to language name mapping + BCP-47 codes for Live API speech output
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

export async function handleCallConfig(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        return res.end();
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

        // Extract language from query parameter
        const url = new URL(req.url, `http://${req.headers.host}`);
        const language = url.searchParams.get('language') || 'en-IN';
        const languageName = LANGUAGE_NAMES[language] || 'English';

        const contextChunks = await retrieveBroadContext([
            'UPES university admissions fees courses programs scholarships',
            'UPES Vice Chancellor Chancellor leadership administration faculty',
            'UPES hostel accommodation campus facilities student life',
            'UPES placements recruitment companies packages salary',
            'UPES examinations results academic calendar important dates',
        ], 20);

        const context = contextChunks
            .map((c, i) => `[${i + 1}] ${c.text}`)
            .join('\n\n');

        const languageInstruction = language !== 'en-IN' 
            ? `\n- CRITICAL LANGUAGE REQUIREMENT: You MUST speak ENTIRELY in ${languageName}. Every single word you say must be in ${languageName}. Do NOT mix languages or use English words. Translate all information from the English context into ${languageName} naturally and fluently. Think in ${languageName} and respond in ${languageName}.`
            : '';

        const systemInstruction = [
            'You are UPES Helper — a friendly, knowledgeable voice assistant for UPES (University of Petroleum and Energy Studies).',
            'You are on a live voice call with a student or prospective student.',
            '',
            'RULES:',
            '- You have a search_knowledge_base tool. Use it whenever the user asks about specific topics like fees, courses, admission details, scholarships, hostel information, placements, exam schedules, or any factual question about UPES that needs precise data.',
            '- When you decide to search, say something natural like "Let me look that up for you" or "One moment, let me check that" BEFORE calling the tool.',
            '- After getting search results, answer based on what you found. If the search returns no results, say you don\'t have that detail and suggest contacting UPES at admissions@upes.ac.in or visiting upes.ac.in.',
            '- You also have some pre-loaded general context below for quick answers to common questions.',
            '- Be conversational, warm, and concise — this is a voice call, not a text chat.',
            '- Use short sentences. Avoid markdown, bullet points, or numbered lists.',
            '- Speak naturally as if talking to a person.' + languageInstruction,
            '',
            '─── PRE-LOADED GENERAL CONTEXT ───',
            context,
            '──────────────────────────────────',
        ].join('\n');

        const client = new GoogleGenAI({
            apiKey,
            httpOptions: { apiVersion: 'v1alpha' },
        });

        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

        const tokenResponse = await client.authTokens.create({
            config: {
                uses: 1,
                expireTime,
                newSessionExpireTime,
                liveConnectConstraints: {
                    model: MODEL,
                    config: {
                        responseModalities: ['AUDIO'],
                        systemInstruction,
                        tools: [SEARCH_TOOL],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: 'Aoede' },
                            },
                            languageCode: language,
                        },
                    },
                },
            },
        });

        const token = tokenResponse.name;
        if (!token) throw new Error('Gemini authTokens.create() returned no token');

        console.log(`📞 Call config served [${language}] (${contextChunks.length} context chunks, ephemeral token created)`);

        res.writeHead(200, corsHeaders());
        res.end(JSON.stringify({ token, wsUrl: WS_URL, model: MODEL }));
    } catch (err) {
        console.error('Call config error:', err);
        res.writeHead(500, corsHeaders());
        res.end(JSON.stringify({ error: 'Failed to get call configuration' }));
    }
}

/**
 * POST /api/call-search — Vector DB search endpoint used by the client
 * during a live voice call when Gemini triggers the search_knowledge_base tool.
 */
export async function handleCallSearch(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        return res.end();
    }

    try {
        let body;
        try {
            body = await readBody(req);
        } catch {
            res.writeHead(400, corsHeaders());
            return res.end(JSON.stringify({ error: 'Invalid request body' }));
        }

        const { query } = body;
        if (!query || typeof query !== 'string') {
            res.writeHead(400, corsHeaders());
            return res.end(JSON.stringify({ error: '"query" field is required' }));
        }

        console.log(`📞🔍 Call search: "${query}"`);

        const chunks = await retrieveContext(query.trim(), 5);
        const results = chunks.map(c => c.text).join('\n\n---\n\n');

        console.log(`📞✅ Call search returned ${chunks.length} chunks`);

        res.writeHead(200, corsHeaders());
        res.end(JSON.stringify({ results, count: chunks.length }));
    } catch (err) {
        console.error('Call search error:', err);
        res.writeHead(500, corsHeaders());
        res.end(JSON.stringify({ error: 'Search failed' }));
    }
}

function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}
