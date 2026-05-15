const { dbRun, dbAll } = require('../server/db/connection');
const { getEmbedding } = require('../server/services/ai-utils');

async function auditAndFix() {
  console.log('🔍 Starting RAG Audit & Optimization...');

  try {
    // 1. SEED INTENT TRIGGERS (CRITICAL GAP)
    console.log('[1/3] Seeding Intent Triggers...');
    const intents = [
      // ADMISSION
      { intent: 'ADMISSION', content: 'How to join the class? registration details please' },
      { intent: 'ADMISSION', content: 'I want to register as a new student' },
      { intent: 'ADMISSION', content: 'Mata class ekata join wenna ona. kohomada register wenne?' },
      { intent: 'ADMISSION', content: 'Mama aluth student kenek. details denna' },
      
      // PAYMENT
      { intent: 'PAYMENT', content: 'Bank details please? How to pay the fees?' },
      { intent: 'PAYMENT', content: 'Mata payment details ewanna. fees keeyada?' },
      { intent: 'PAYMENT', content: 'I have sent the payment receipt. check please' },
      { intent: 'PAYMENT', content: 'Slip eka ewwa. register karanna' },

      // SCHEDULE
      { intent: 'SCHEDULE', content: 'When is the next class? what time is it?' },
      { intent: 'SCHEDULE', content: 'Heta class thiyenawada? welawa keeyada?' },
      { intent: 'SCHEDULE', content: 'Class schedule eka ewanna puluwanda?' },

      // TECHNICAL / MATERIALS
      { intent: 'OTHER', content: 'Zoom link eka wada na. audio issues' },
      { intent: 'OTHER', content: 'Mata tute eka labune na. PDF eka ewanna' },
      { intent: 'OTHER', content: 'Recording eka balන්නේ kohomada?' }
    ];

    for (const item of intents) {
      const embedding = await getEmbedding(item.content);
      await dbRun(
        'INSERT INTO knowledge_base (tutor_id, content, category, embedding, metadata) VALUES (?, ?, ?, ?, ?)',
        [1, item.content, 'INTENT', JSON.stringify(embedding), JSON.stringify({ intent: item.intent })]
      );
    }
    console.log(`   ✅ Seeded ${intents.length} Intent triggers.`);

    // 2. DELETE REDUNDANT ENTRIES
    console.log('[2/3] Removing duplicate/conflicting records...');
    // Delete IDs found in audit (91, 96 are siblings duplicates)
    const toDelete = [91, 96]; 
    for (const id of toDelete) {
      await dbRun('DELETE FROM knowledge_base WHERE id = ?', [id]);
    }
    console.log(`   ✅ Deleted redundant IDs: ${toDelete.join(', ')}`);

    // 3. STANDARDIZE FAQ VARIABLES
    console.log('[3/3] Standardizing FAQ Variables...');
    // Example: Update any FAQ that mentions fees to use placeholders
    await dbRun(`
      UPDATE knowledge_base 
      SET content = REPLACE(content, 'Rs. 1500', 'Rs. [Grade 11 Fee]')
      WHERE category = 'FAQ' AND content LIKE '%Rs. 1500%'
    `);
    
    await dbRun(`
      UPDATE knowledge_base 
      SET content = REPLACE(content, 'Rs. 1200', 'Rs. [Grade 6-9 Fee]')
      WHERE category = 'FAQ' AND content LIKE '%Rs. 1200%'
    `);

    console.log('\n✨ RAG Audit & Fix Complete!');
  } catch (err) {
    console.error('❌ Audit Failed:', err);
  } finally {
    process.exit();
  }
}

auditAndFix();
