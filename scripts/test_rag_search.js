require('dotenv').config();
const { supabase } = require('../server/db/connection');
const { getEmbedding } = require('../server/services/ai-utils');

(async () => {
  console.log('Testing vector search...\n');

  // 1. Generate embedding for a test query
  const testQuery = 'Refund karanawada?';
  console.log('Query:', testQuery);
  const embedding = await getEmbedding(testQuery);
  if (!embedding) { console.log('ERROR: Could not generate embedding'); process.exit(1); }
  console.log('Embedding generated: ' + embedding.length + ' dimensions\n');

  // 2. Call the RPC function directly (same way retrieval.js does)
  const { data, error } = await supabase.rpc('match_knowledge_v2', {
    query_embedding: embedding,
    match_threshold: 0.45,
    match_count: 3,
    filter_category: 'FAQ',
    filter_tutor_id: 2
  });

  if (error) {
    console.log('RPC ERROR:', error.message);
    console.log('Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Results:', data.length);
    data.forEach((r, i) => {
      console.log('\n--- Result ' + (i+1) + ' ---');
      console.log('Score:', r.similarity?.toFixed(4));
      console.log('Content:', r.content?.substring(0, 120));
    });
  }

  // 3. Also test with NO tutor filter to see if that's the problem
  console.log('\n\n--- Testing WITHOUT tutor_id filter ---');
  const { data: data2, error: error2 } = await supabase.rpc('match_knowledge_v2', {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 5,
    filter_category: null,
    filter_tutor_id: null
  });

  if (error2) {
    console.log('RPC ERROR:', error2.message);
  } else {
    console.log('Results:', data2.length);
    data2.forEach((r, i) => {
      console.log('[' + r.category + '] score=' + r.similarity?.toFixed(4) + ' | "' + r.content?.substring(0, 80) + '..."');
    });
  }

  process.exit(0);
})();
