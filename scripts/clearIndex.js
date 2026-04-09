import { Index } from '@upstash/vector';
import * as dotenv from 'dotenv';
dotenv.config();

async function clearIndex() {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

    if (!url || !token) {
        console.error('Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN in environment.');
        process.exit(1);
    }

    const index = new Index({ url, token });

    try {
        console.log('Clearing Upstash Vector Index...');
        await index.reset();
        console.log('Successfully cleared Upstash Vector Index!');
    } catch (error) {
        console.error('Failed to clear index:', error);
    }
}

clearIndex();
