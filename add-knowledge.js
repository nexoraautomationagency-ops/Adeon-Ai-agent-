require('dotenv').config();
const { supabase } = require('./server/db/connection');
const { getEmbedding } = require('./server/services/ai-utils');

/**
 * 🎓 TEACH YOUR AI - MANUAL UPDATE TEMPLATE
 * Edit the "category" and "text" below to update your AI's brain.
 */

// --- 🟢 LAYER EXAMPLES 🟢 ---
// Layer 1: Database (Student/Payment Data)
// Layer 2: FAQ (Fees, Classes, Schedules)
// Layer 3: Style (Singlish, Tone, Emoji usage)
// Layer 4: SOP (Registration Flow, Bank Details)

const infoToAdd = [
  {
    category: "SOP", // <--- CHANGE THIS (FAQ, STYLE, or SOP)
    text: `GREETING: ආයුබෝවන් 😊 Excel Science Academy වෙත ඔබව සාදරයෙන් පිළිගනිමු.`
  }
];

// --- ⚙️ SYNC LOGIC (Do not change) ---
async function addKnowledge(text, category) {
  if (!text) return;
  console.log(`🧠 Syncing [${category.toUpperCase()}]...`);
  try {
    const embedding = await getEmbedding(text);
    if (!embedding) return;

    const { pool } = require('./server/db/connection');
    // Wipes only THIS category so you can replace it with your new text
    await pool.query('DELETE FROM knowledge_base WHERE LOWER(category) = $1', [category.toLowerCase()]);

    await supabase.from('knowledge_base').insert([{
      content: text,
      category: category.toLowerCase(),
      embedding: embedding,
      metadata: { added_at: new Date().toISOString() }
    }]);
    console.log(`✅ Success! [${category}] is now updated.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function run() {
  for (const item of infoToAdd) {
    await addKnowledge(item.text, item.category);
  }
  process.exit(0);
}

run();
