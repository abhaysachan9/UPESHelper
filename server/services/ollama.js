/**
 * server/services/ollama.js
 * Ollama Cloud API fallback for answer generation when Gemini is unavailable.
 * Uses qwen3-coder-next via https://ollama.com/api/chat
 */

const OLLAMA_CLOUD_URL = "https://ollama.com/api/chat";
const OLLAMA_MODEL = "qwen3-coder-next";
const OLLAMA_TIMEOUT_MS = 60_000;

/**
 * Generate an answer using Ollama Cloud as a fallback.
 * @param {string} prompt - The full prompt (same one built for Gemini)
 * @returns {Promise<string>}
 */
export async function generateWithOllama(prompt) {
  const apiKey = process.env.OLLAMA_KEY;
  if (!apiKey) {
    throw new Error("Missing OLLAMA_KEY in environment.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(OLLAMA_CLOUD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Ollama Cloud API error ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = await res.json();
    const content = data?.message?.content;
    if (!content) {
      throw new Error("Ollama Cloud returned empty response");
    }

    return content;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `Ollama Cloud API timed out after ${OLLAMA_TIMEOUT_MS / 1000}s`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
