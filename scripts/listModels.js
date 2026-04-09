import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Missing GEMINI_API_KEY');
        return;
    }
    
    // Instead of using the SDK to list models (which may or may not support it depending on version),
    // let's just make a REST call to v1beta to list models
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Available models:");
        data.models.forEach(m => {
            console.log(`- ${m.name}`);
        });
    } catch (e) {
        console.error(e);
    }
}

listModels();
