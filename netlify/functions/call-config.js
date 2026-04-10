import { GoogleGenAI } from '@google/genai';
import { retrieveBroadContext } from '../../server/services/vectorDb.js';

const MODEL = 'gemini-3.1-flash-live-preview';
const WS_URL =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const LANGUAGE_NAMES = {
    'en-IN': 'English', 'hi-IN': 'Hindi', 'es-ES': 'Spanish', 'fr-FR': 'French',
    'de-DE': 'German', 'zh-CN': 'Chinese', 'ja-JP': 'Japanese', 'ar-SA': 'Arabic',
    'pt-BR': 'Portuguese', 'ru-RU': 'Russian', 'ko-KR': 'Korean', 'it-IT': 'Italian',
};

export default async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

        const url = new URL(req.url);
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
            ? `\n- CRITICAL LANGUAGE REQUIREMENT: You MUST speak ENTIRELY in ${languageName}. Do NOT mix languages.`
            : '';

        const systemInstruction = [
            'You are UPES Helper — a friendly, knowledgeable voice assistant for UPES (University of Petroleum and Energy Studies).',
            'You are on a live voice call with a student or prospective student.',
            '',
            'RULES:',
            '- Answer ONLY from the provided knowledge base context below.',
            '- If the context lacks information, say you don\'t have that detail and suggest contacting UPES at admissions@upes.ac.in or visiting upes.ac.in.',
            '- Be conversational, warm, and concise — this is a voice call, not a text chat.',
            '- Use short sentences. Avoid markdown, bullet points, or numbered lists.',
            '- Speak naturally as if talking to a person.' + languageInstruction,
            '',
            '─── KNOWLEDGE BASE CONTEXT ───',
            context,
            '──────────────────────────────',
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

        return new Response(JSON.stringify({ token, wsUrl: WS_URL, model: MODEL }), {
            status: 200,
            headers: JSON_HEADERS,
        });
    } catch (err) {
        console.error('Call config error:', err);
        return new Response(JSON.stringify({ error: 'Failed to get call configuration' }), {
            status: 500,
            headers: JSON_HEADERS,
        });
    }
};
