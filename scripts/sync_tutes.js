const { dbRun, dbAll, initDb } = require('../server/db/connection');

async function sync() {
  await initDb();
  console.log('Syncing missing tutes...');
  const missing = await dbAll("SELECT p.* FROM payments p LEFT JOIN tute_deliveries td ON td.payment_id = p.id WHERE p.status = 'paid' AND td.id IS NULL");
  console.log(`Found ${missing.length} missing records.`);
  
  for (const p of missing) {
    await dbRun('INSERT INTO tute_deliveries (tutor_id, student_id, payment_id, month, year, status) VALUES (?,?,?,?,?,?)', 
      [p.tutor_id, p.student_id, p.id, p.month, p.year, 'pending']);
  }
  
  console.log('✨ Sync complete.');
  process.exit(0);
}

sync().catch(err => {
    console.error(err);
    process.exit(1);
});
