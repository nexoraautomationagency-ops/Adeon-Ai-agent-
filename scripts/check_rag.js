const { dbAll, initDb } = require('../server/db/connection');

async function check() {
  await initDb();
  const rows = await dbAll("SELECT category, content FROM knowledge_base WHERE content LIKE '%Class Details%' LIMIT 1");
  console.log('--- Current RAG Content ---');
  if (rows.length > 0) {
    console.log(rows[0].content);
  } else {
    console.log('❌ Template not found!');
  }
  process.exit(0);
}

check().catch(console.error);
