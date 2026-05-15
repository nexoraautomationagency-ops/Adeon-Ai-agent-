const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * RAG Embedding Utility
 * Uses OpenAI text-embedding-3-small for vector search in Supabase
 */
async function getEmbedding(text) {
  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('[AI Utils] Embedding error:', err.message);
    return null;
  }
}

module.exports = { getEmbedding };
