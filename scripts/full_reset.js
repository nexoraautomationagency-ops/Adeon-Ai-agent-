const { dbExec, closeDb, supabase } = require('../server/db/connection');

async function fullReset() {
  console.log('🔄 FULL SYSTEM RESET STARTING...\n');

  // 1. Clear database tables
  const tables = [
    'message_logs',
    'billing_logs',
    'payments',
    'students',
  ];

  for (const table of tables) {
    try {
      await dbExec(`DELETE FROM ${table}`);
      console.log(`  ✅ Cleared: ${table}`);
    } catch (e) {
      console.log(`  ⚠️ Skipped: ${table} (${e.message})`);
    }
  }

  // 2. Clear receipts from Supabase Storage
  try {
    const { data: files, error } = await supabase.storage.from('receipts').list();
    if (!error && files && files.length > 0) {
      const filenames = files.map(f => f.name);
      await supabase.storage.from('receipts').remove(filenames);
      console.log(`  ✅ Cleared: ${filenames.length} receipts from storage`);
    } else {
      console.log('  ✅ Receipts storage: already empty');
    }
  } catch (e) {
    console.log(`  ⚠️ Receipts storage error: ${e.message}`);
  }

  // 3. Clear RAG knowledge base
  try {
    await dbExec('DELETE FROM knowledge_base');
    console.log('  ✅ Cleared: knowledge_base (RAG)');
  } catch (e) {
    console.log(`  ⚠️ Skipped: knowledge_base (${e.message})`);
  }

  console.log('\n🎉 SYSTEM RESET COMPLETE — Fresh start ready!');
  await closeDb();
}

fullReset();
