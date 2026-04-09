const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

export default async () => {
    const enabled = process.env.ENABLE_VOICE_CALL !== 'false';
    return new Response(JSON.stringify({ enabled }), {
        status: 200,
        headers: JSON_HEADERS,
    });
};
