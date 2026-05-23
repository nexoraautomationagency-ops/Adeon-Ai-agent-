/**
 * RAG Phase 1 — insert/update knowledge_base rows for tutor_id=2
 * Run: node scripts/seed-rag-phase1.js
 */
require('dotenv').config({ path: './server/.env' });
const { supabase } = require('../server/db/connection');
const { getEmbedding } = require('../server/services/ai-utils');

const TUTOR_ID = 2;

const UPDATES = [
  {
    match: { category: 'FAQ', topic: 'Discount Request' },
    content:
      'Q: Discount ekak denna puluwanda? / Scholarship thiyenawada?\nA: Standard discount නැහැ 😊. විශේෂයක් ඕනේ නම් Sir ට direct message එකක් දාන්න.',
    metadata: { topic: 'Discount Request', source: 'RAG Phase 1', updated_at: '2026-05-23' },
  },
  {
    match: { category: 'FAQ', contentLike: '%left the WhatsApp group%' },
    content:
      'Q: Group eken left wela ayeth join wenne kohomada?\nA: හරි 😊 Sir ට message එකක් දාන්න. Group invite link එක නැවත එවන්නම් 😊',
    metadata: { topic: 'Group Rejoin', source: 'RAG Phase 1', updated_at: '2026-05-23' },
  },
];

const INSERTS = [
  {
    category: 'FAQ',
    content:
      'Q: Class ekata join wenne kohomada? / Mata class ekata join wenn one\nA: හරි 😊 register වෙන්න ඔයාගේ විස්තර ටික message එකට එවන්න: Name, Grade, School, Phone, Month, Address. Payment කරලා receipt photo එක එවන්න. Verify වුණාට පැය 24ක් ඇතුළත confirm කරන්නම්.',
    metadata: { topic: 'How to Join Class', source: 'RAG Phase 1' },
  },
  {
    category: 'FAQ',
    content:
      'Q: Admission fee thiyenawada? / Registration fee ekak thiyenawada?\nA: නැහැ 😊 separate admission fee එකක් නැහැ. Monthly class fee විතරයි තියෙන්නේ.',
    metadata: { topic: 'Admission Fee', source: 'RAG Phase 1' },
  },
  {
    category: 'FAQ',
    content:
      'Q: Mama class eken ain wenawa / Class eken leave wenawa\nA: හරි 😊 leave කරන්න නම් Sir ට message එකක් දාන්න. Refund policy එකට අදාළව office එකෙන් confirm කරලා දෙන්නම් 😊',
    metadata: { topic: 'Leave Class', source: 'RAG Phase 1' },
  },
  {
    category: 'SOP',
    content: `SOP - Registration Payment Flow:
1. Student sends Name, Grade, School, Phone, Month, Address.
2. Admin sends bank details and fee for their grade.
3. Student pays and uploads receipt photo on WhatsApp.
4. Admin verifies within 24 hours and sends approval message.
5. Student is added to the official WhatsApp group.
Never say registration is complete before receipt is verified.`,
    metadata: { topic: 'Registration Payment Flow', source: 'RAG Phase 1' },
  },
  {
    category: 'SOP',
    content: `SOP - Student Leave Class:
If a student wants to leave or stop classes, do not process refunds yourself.
Tell them to message Sir directly. Mention refund policy is confirmed by office only.
Do not delete their data automatically in chat.`,
    metadata: { topic: 'Student Leave Class', source: 'RAG Phase 1' },
  },
];

const STYLE_ROWS = [
  {
    content:
      'Student: Class ekata join wenne kohomada?\nAdmin: හරි 😊 register වෙන්න විස්තර ටික එවන්න: Name, Grade, School, Phone, Month, Address 😊',
    metadata: {
      intent: 'ADMISSION',
      source: 'RAG Phase 1',
      student_message: 'Class ekata join wenne kohomada?',
      ideal_reply:
        'හරි 😊 register වෙන්න විස්තර ටික එවන්න: Name, Grade, School, Phone, Month, Address 😊',
    },
  },
  {
    content:
      'Student: Mata class ekt join wenn one\nAdmin: හරි 😊 Name, Grade, School, Phone, Month, Address එවන්න. Payment + receipt එකත් එවන්න 😊',
    metadata: {
      intent: 'ADMISSION',
      source: 'RAG Phase 1',
      student_message: 'Mata class ekt join wenn one',
      ideal_reply:
        'හරි 😊 Name, Grade, School, Phone, Month, Address එවන්න. Payment + receipt එකත් එවන්න 😊',
    },
  },
  {
    content:
      'Student: Mama payment ek kara\nAdmin: හරි 😊 receipt photo එක WhatsApp එකට එවන්න. පැය 24ක් ඇතුළත verify කරලා confirm කරන්නම් 😊',
    metadata: {
      intent: 'PAYMENT',
      source: 'RAG Phase 1',
      student_message: 'Mama payment ek kara',
      ideal_reply:
        'හරි 😊 receipt photo එක WhatsApp එකට එවන්න. පැය 24ක් ඇතුළත verify කරලා confirm කරන්නම් 😊',
    },
  },
  {
    content:
      'Student: Mama receipt ek eww\nAdmin: හරි 😊 clear photo එක upload කරන්න. ලැබුණාට පැය 24ක් ඇතුළත confirm message එකක් එවන්නම් 😊',
    metadata: {
      intent: 'PAYMENT',
      source: 'RAG Phase 1',
      student_message: 'Mama receipt ek eww',
      ideal_reply:
        'හරි 😊 clear photo එක upload කරන්න. ලැබුණාට පැය 24ක් ඇතුළත confirm message එකක් එවන්නම් 😊',
    },
  },
  {
    content:
      'Student: Mama class eken ain wenawa\nAdmin: හරි 😊 Sir ට message එකක් දාන්න. Office එකෙන් leave/refund ගැන confirm කරලා දෙන්නම් 😊',
    metadata: {
      intent: 'OTHER',
      source: 'RAG Phase 1',
      student_message: 'Mama class eken ain wenawa',
      ideal_reply:
        'හරි 😊 Sir ට message එකක් දාන්න. Office එකෙන් leave/refund ගැන confirm කරලා දෙන්නම් 😊',
    },
  },
  {
    content:
      'Student: Group eken left wela ayeth join wenne kohomada?\nAdmin: හරි 😊 Sir ට message එකක් දාන්න. Group link එක නැවත එවන්නම් 😊',
    metadata: {
      intent: 'ADMISSION',
      source: 'RAG Phase 1',
      student_message: 'Group eken left wela ayeth join wenne kohomada?',
      ideal_reply: 'හරි 😊 Sir ට message එකක් දාන්න. Group link එක නැවත එවන්නම් 😊',
    },
  },
];

const INTENT_ROWS = [
  { content: 'Mata class ekata join wenn one', intent: 'ADMISSION' },
  { content: 'Class ekata join wenne kohomada', intent: 'ADMISSION' },
  { content: 'Mama payment ek kara', intent: 'PAYMENT' },
  { content: 'Receipt eka yawanne', intent: 'PAYMENT' },
  { content: 'Refund karanawada', intent: 'PAYMENT' },
  { content: 'Ada class thiyenawada', intent: 'SCHEDULE' },
  { content: 'Class time eka kiyatada', intent: 'SCHEDULE' },
  { content: 'Sirge details kiyanna', intent: 'OTHER' },
  { content: 'Mage details monawada', intent: 'OTHER' },
  { content: 'Mama class eken ain wenawa', intent: 'OTHER' },
  { content: 'Recording eka ganna puluwanda', intent: 'OTHER' },
  { content: 'Discount ekak denna puluwanda', intent: 'PAYMENT' },
];

async function findByTopic(category, topic) {
  const { data } = await supabase
    .from('knowledge_base')
    .select('id')
    .eq('tutor_id', TUTOR_ID)
    .eq('category', category)
    .eq('metadata->>topic', topic)
    .limit(1);
  return data?.[0]?.id || null;
}

async function applyUpdates() {
  for (const row of UPDATES) {
    let id = null;
    if (row.match.topic) {
      id = await findByTopic(row.match.category, row.match.topic);
    } else if (row.match.contentLike) {
      const { data } = await supabase
        .from('knowledge_base')
        .select('id')
        .eq('tutor_id', TUTOR_ID)
        .eq('category', row.match.category)
        .ilike('content', row.match.contentLike)
        .limit(1);
      id = data?.[0]?.id || null;
    }
    if (!id) {
      console.log('[skip update] not found:', row.match);
      continue;
    }
    const embedding = await getEmbedding(row.content);
    const { error } = await supabase
      .from('knowledge_base')
      .update({ content: row.content, metadata: row.metadata, embedding })
      .eq('id', id);
    if (error) console.error('[update error]', id, error.message);
    else console.log('[updated]', row.match.topic || id);
  }
}

async function insertIfMissing(entry) {
  const topic = entry.metadata?.topic;
  if (topic) {
    const existing = await findByTopic(entry.category, topic);
    if (existing) {
      console.log('[skip insert] exists:', topic);
      return;
    }
  }
  const embedding = await getEmbedding(entry.content);
  const { error } = await supabase.from('knowledge_base').insert([
    {
      tutor_id: TUTOR_ID,
      category: entry.category,
      content: entry.content,
      metadata: entry.metadata,
      embedding,
    },
  ]);
  if (error) console.error('[insert error]', topic || entry.content.slice(0, 40), error.message);
  else console.log('[inserted]', topic || entry.category);
}

async function insertStyleIfMissing(row) {
  const key = row.metadata.student_message;
  const { data } = await supabase
    .from('knowledge_base')
    .select('id')
    .eq('tutor_id', TUTOR_ID)
    .eq('category', 'STYLE')
    .eq('metadata->>student_message', key)
    .limit(1);
  if (data?.length) {
    console.log('[skip style]', key);
    return;
  }
  const embedding = await getEmbedding(row.content);
  const { error } = await supabase.from('knowledge_base').insert([
    {
      tutor_id: TUTOR_ID,
      category: 'STYLE',
      content: row.content,
      metadata: row.metadata,
      embedding,
    },
  ]);
  if (error) console.error('[style error]', key, error.message);
  else console.log('[style]', key);
}

async function insertIntentIfMissing(row) {
  const { data } = await supabase
    .from('knowledge_base')
    .select('id')
    .eq('tutor_id', TUTOR_ID)
    .eq('category', 'INTENT')
    .eq('content', row.content)
    .limit(1);
  if (data?.length) {
    console.log('[skip intent]', row.content);
    return;
  }
  const embedding = await getEmbedding(row.content);
  const { error } = await supabase.from('knowledge_base').insert([
    {
      tutor_id: TUTOR_ID,
      category: 'INTENT',
      content: row.content,
      metadata: { intent: row.intent, source: 'RAG Phase 1' },
      embedding,
    },
  ]);
  if (error) console.error('[intent error]', row.content, error.message);
  else console.log('[intent]', row.content, '->', row.intent);
}

async function main() {
  console.log('RAG Phase 1 seed — tutor_id', TUTOR_ID);
  await applyUpdates();
  for (const entry of INSERTS) await insertIfMissing(entry);
  for (const row of STYLE_ROWS) await insertStyleIfMissing(row);
  for (const row of INTENT_ROWS) await insertIntentIfMissing(row);

  const { count } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', TUTOR_ID);
  console.log('\nDone. Total KB rows for tutor', TUTOR_ID + ':', count);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
