require('dotenv').config();
const { supabase } = require('../server/db/connection');

(async () => {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, category, content, embedding, tutor_id')
    .order('id', { ascending: true });

  if (error) { console.error(error); process.exit(1); }

  console.log('Total rows:', data.length);

  const cats = {};
  data.forEach(r => {
    const cat = r.category || 'NULL';
    if (!cats[cat]) cats[cat] = { total: 0, withEmb: 0, noEmb: 0 };
    cats[cat].total++;
    if (r.embedding) cats[cat].withEmb++;
    else cats[cat].noEmb++;
  });

  console.log('\n--- Category Breakdown ---');
  Object.entries(cats).forEach(([cat, v]) => {
    console.log(cat + ': ' + v.total + ' rows (' + v.withEmb + ' with embedding, ' + v.noEmb + ' WITHOUT)');
  });

  console.log('\n--- Sample per category ---');
  Object.keys(cats).forEach(cat => {
    const sample = data.find(r => r.category === cat);
    const preview = (sample.content || '').substring(0, 100).replace(/\n/g, ' ');
    console.log('[' + cat + '] tutor_id=' + sample.tutor_id + ' | has_embedding=' + !!sample.embedding + ' | "' + preview + '..."');
  });

  process.exit(0);
})();
