const { dbRun, supabase } = require('../server/db/connection');
const OpenAI = require('openai');
require('dotenv').config();

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

async function getEmbedding(text) {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function addKnowledge(content, category = 'FAQ') {
  try {
    console.log(`🧠 Generating embedding for: "${content.substring(0, 50)}..."`);
    const embedding = await getEmbedding(content);
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({
        content,
        category: category.toUpperCase(),
        embedding
      });

    if (error) throw error;
    console.log(`✅ Added to Knowledge Base (${category})`);
  } catch (err) {
    console.error('❌ Error adding knowledge:', err.message);
  }
}

// Example usage if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node add-knowledge.js "Content" [CATEGORY]');
  } else {
    addKnowledge(args[0], args[1] || 'FAQ').then(() => process.exit(0));
  }
}

module.exports = { addKnowledge };
