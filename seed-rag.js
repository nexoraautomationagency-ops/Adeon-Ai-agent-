require('dotenv').config({ path: './server/.env' });
const { supabase } = require('./server/db/connection');
const aiService = require('./server/services/ai');

async function seed() {
  const newEntries = [
    {
      category: 'FAQ',
      tutor_id: 2,
      content: 'Live Zoom links are sent to the WhatsApp group 15 minutes before the class starts 😊.',
      metadata: { source: 'Audit Remediation' }
    },
    {
      category: 'FAQ',
      tutor_id: 2,
      content: 'Class recordings are uploaded to the WhatsApp group media section after the class is over 😊.',
      metadata: { source: 'Audit Remediation' }
    },
    {
      category: 'FAQ',
      tutor_id: 2,
      content: 'If you left the WhatsApp group, please send a message to Sir to get the invite link again 😊.',
      metadata: { source: 'Audit Remediation' }
    },
    {
      category: 'STYLE',
      tutor_id: 2,
      content: 'Student: Address eka wenas karanna one\nAdmin: හරි 😊 අලුත් address එක එවන්න, මම update කරන්නම්.',
      metadata: { 
        intent: 'GENERAL', 
        source: 'Audit Remediation',
        student_message: 'Address eka wenas karanna one',
        ideal_reply: 'හරි 😊 අලුත් address එක එවන්න, මම update කරන්නම්.'
      }
    },
    {
      category: 'STYLE',
      tutor_id: 2,
      content: 'Student: Phone num eka change karanna one\nAdmin: හරි 😊 අලුත් number එක එවන්න, මම update කරන්නම්.',
      metadata: { 
        intent: 'GENERAL', 
        source: 'Audit Remediation',
        student_message: 'Phone num eka change karanna one',
        ideal_reply: 'හරි 😊 අලුත් number එක එවන්න, මම update කරන්නම්.'
      }
    }
  ];

  for (const entry of newEntries) {
    try {
      const embeddingText = entry.category === 'STYLE' ? entry.content : entry.content;
      const embedding = await aiService.getEmbedding(embeddingText);
      entry.embedding = embedding;

      const { error } = await supabase.from('knowledge_base').insert(entry);
      if (error) {
        console.error('Error inserting:', entry.content, error.message);
      } else {
        console.log('Inserted:', entry.content);
      }
    } catch (e) {
      console.error('Error generating embedding:', e.message);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

seed();
