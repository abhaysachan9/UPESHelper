/**
 * server/handlers/callConfig.js
 * GET /api/call-config — Creates a Gemini ephemeral token for the
 * client-side Live API voice call. The API key never leaves the server.
 */

import { GoogleGenAI } from '@google/genai';
import { retrieveContext } from '../services/vectorDb.js';

const MODEL = 'gemini-3.1-flash-live-preview';
const WS_URL =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

export async function handleCallConfig(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        return res.end();
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

        const contextChunks = await retrieveContext(
            'UPES university admissions fees courses programs hostel scholarships placements campus overview',
            10,
        );

        const context = contextChunks
            .map((c, i) => `[${i + 1}] ${c.text}`)
            .join('\n\n');

        const systemInstruction = [
            'You are UPES Helper — a friendly, knowledgeable voice assistant for UPES (University of Petroleum and Energy Studies).',
            'You are on a live voice call with a student or prospective student.',
            '',
            'RULES:',
            '- Answer ONLY from the provided knowledge base context below.',
            '- If the context lacks information, say you don\'t have that detail and suggest contacting UPES at admissions@upes.ac.in or visiting upes.ac.in.',
            '- Be conversational, warm, and concise — this is a voice call, not a text chat.',
            '- Use short sentences. Avoid markdown, bullet points, or numbered lists.',
            '- Speak naturally as if talking to a person.',
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
                        },
                    },
                },
            },
        });

        const token = tokenResponse.name;
        if (!token) throw new Error('Gemini authTokens.create() returned no token');

        console.log(`📞 Call config served (${contextChunks.length} context chunks, ephemeral token created)`);

        res.writeHead(200, corsHeaders());
        res.end(JSON.stringify({ token, wsUrl: WS_URL, model: MODEL }));
    } catch (err) {
        console.error('Call config error:', err);
        res.writeHead(500, corsHeaders());
        res.end(JSON.stringify({ error: 'Failed to get call configuration' }));
    }
}

function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}
