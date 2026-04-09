import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function testGeneration() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Missing GEMINI_API_KEY');
        return;
    }
    
    try {
        const _genAI = new GoogleGenerativeAI(apiKey);
        const _model = _genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
        
        const result = await _model.generateContent("Hello, what model are you?");
        const response = result.response;
        console.log("Success! Response:");
        console.log(response.text());
    } catch (e) {
        console.error("Test failed:");
        console.error(e);
    }
}

testGeneration();
