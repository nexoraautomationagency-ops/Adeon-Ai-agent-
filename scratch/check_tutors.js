const { dbAll, initDb, closeDb } = require('../server/db/connection');

async function check() {
  await initDb();
  const res = await dbAll('SELECT email, name FROM tutors');
  console.log('Tutors:', res);
  await closeDb();
}

check().catch(console.error);
