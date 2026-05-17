const { dbAll, closeDb, initDb } = require('./server/db/connection');

async function checkDb() {
  await initDb();
  console.log("--- Tutors ---");
  const tutors = await dbAll('SELECT id, name, email, phone, role FROM tutors');
  console.table(tutors);

  console.log("--- Settings ---");
  const settings = await dbAll('SELECT id, tutor_id, auto_reply_enabled FROM settings');
  console.table(settings);
  
  await closeDb();
}
checkDb().catch(console.error);
