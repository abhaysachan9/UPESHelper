/**
 * scripts/testCall.js
 * Diagnostic: tests Gemini Live API WebSocket connection from Node.js
 */
import { loadEnv } from '../server/env.js';
import { GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';

loadEnv();

const apiKey = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.1-flash-live-preview';

const WS_CONSTRAINED = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
const WS_REGULAR_V1ALPHA = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const WS_REGULAR_V1BETA = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

async function testEphemeralToken() {
    console.log('\n=== Test 1: Ephemeral Token + BidiGenerateContentConstrained (v1alpha) ===');
    try {
        const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

        console.log('Creating ephemeral token...');
        const tokenResponse = await client.authTokens.create({
            config: {
                uses: 1,
                expireTime,
                newSessionExpireTime,
                liveConnectConstraints: {
                    model: MODEL,
                    config: {
                        responseModalities: ['AUDIO'],
                        systemInstruction: 'You are a test assistant. Say hello.',
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
        console.log('Token created:', token?.substring(0, 40) + '…');

        return await testWebSocket(
            `${WS_CONSTRAINED}?access_token=${token}`,
            { setup: { model: `models/${MODEL}`, generationConfig: { responseModalities: ['AUDIO'] } } }
        );
    } catch (err) {
        console.error('Token creation failed:', err.message);
        return false;
    }
}

async function testApiKeyV1Alpha() {
    console.log('\n=== Test 2: API Key + BidiGenerateContent (v1alpha) ===');
    return await testWebSocket(
        `${WS_REGULAR_V1ALPHA}?key=${apiKey}`,
        {
            setup: {
                model: `models/${MODEL}`,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
                },
                systemInstruction: { parts: [{ text: 'You are a test assistant. Say hello.' }] },
            },
        }
    );
}

async function testApiKeyV1Beta() {
    console.log('\n=== Test 3: API Key + BidiGenerateContent (v1beta) ===');
    return await testWebSocket(
        `${WS_REGULAR_V1BETA}?key=${apiKey}`,
        {
            setup: {
                model: `models/${MODEL}`,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
                },
                systemInstruction: { parts: [{ text: 'You are a test assistant. Say hello.' }] },
            },
        }
    );
}

function testWebSocket(url, setupMessage) {
    return new Promise((resolve) => {
        console.log('Connecting to:', url.substring(0, 120) + '…');
        const ws = new WebSocket(url);

        const timeout = setTimeout(() => {
            console.error('❌ TIMED OUT after 15s, readyState:', ws.readyState);
            ws.close();
            resolve(false);
        }, 15000);

        ws.on('open', () => {
            console.log('✓ WebSocket opened');
            console.log('Sending setup:', JSON.stringify(setupMessage).substring(0, 200) + '…');
            ws.send(JSON.stringify(setupMessage));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            console.log('✓ Message received:', JSON.stringify(msg).substring(0, 300));

            if (msg.setupComplete) {
                clearTimeout(timeout);
                console.log('✅ SUCCESS — Setup complete!');
                ws.close();
                resolve(true);
            }
            if (msg.error) {
                clearTimeout(timeout);
                console.error('❌ Server error:', JSON.stringify(msg.error));
                ws.close();
                resolve(false);
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            console.error('❌ WebSocket error:', err.message);
            resolve(false);
        });

        ws.on('close', (code, reason) => {
            clearTimeout(timeout);
            console.log('WebSocket closed — code:', code, 'reason:', reason?.toString() || '(none)');
        });
    });
}

async function main() {
    console.log('API Key:', apiKey?.substring(0, 12) + '…');
    console.log('Model:', MODEL);

    const r1 = await testEphemeralToken();
    const r2 = await testApiKeyV1Alpha();
    const r3 = await testApiKeyV1Beta();

    console.log('\n=== RESULTS ===');
    console.log('Ephemeral Token (v1alpha constrained):', r1 ? '✅ PASS' : '❌ FAIL');
    console.log('API Key (v1alpha):', r2 ? '✅ PASS' : '❌ FAIL');
    console.log('API Key (v1beta):', r3 ? '✅ PASS' : '❌ FAIL');
}

main();
