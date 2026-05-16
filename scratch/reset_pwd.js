const { dbRun, initDb, closeDb } = require('../server/db/connection');
const bcrypt = require('bcryptjs');

async function reset() {
  await initDb();
  const hash = bcrypt.hashSync('admin123', 10);
  const res = await dbRun('UPDATE tutors SET password_hash = ? WHERE email = ?', [hash, 'adeonsolutionsglobal@gmail.com']);
  console.log('Update result:', res);
  await closeDb();
}

reset().catch(console.error);
