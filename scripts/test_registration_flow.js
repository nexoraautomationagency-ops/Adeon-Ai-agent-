const aiService = require('../server/services/ai');
const { dbRun, dbExec, dbGet } = require('../server/db/connection');

async function testFlow() {
  console.log('🧪 Starting Registration Flow Simulation...');
  
  const chatId = 'test_user_vps@c.us';
  const tutorId = 1;

  // Cleanup test user if exists
  await dbRun('DELETE FROM students WHERE whatsapp_id = ?', [chatId]);

  const turns = [
    { input: 'Hi', label: 'Greeting' },
    { input: 'I want to join the Grade 11 Science class', label: 'Admission Intent' },
    { input: 'Kamal Perera, Ananda College, 0771234567, May, 123 Main St Colombo', label: 'Data Submission' }
  ];

  for (const turn of turns) {
    console.log(`\n--- [TURN: ${turn.label}] ---`);
    console.log(`User: "${turn.input}"`);
    
    const response = await aiService.processMessage(turn.input, chatId, tutorId);
    
    console.log(`AI: "${response.text}"`);
    console.log(`Intent: ${response.intent} | Action: ${response.action}`);
    if (response.data) console.log(`Extracted Data: ${JSON.stringify(response.data)}`);
  }

  console.log('\n✅ Simulation Complete.');
  process.exit();
}

testFlow();
