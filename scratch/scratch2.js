const { dbGet, closeDb, initDb } = require('./server/db/connection');

async function checkDb() {
  await initDb();
  console.log("--- LIMIT 1 ---");
  const t1 = await dbGet('SELECT * FROM tutors LIMIT 1');
  console.log(t1.id, t1.name, t1.role);

  console.log("--- DEV LIMIT 1 ---");
  const t2 = await dbGet("SELECT * FROM tutors WHERE role = 'developer' LIMIT 1");
  console.log(t2?.id, t2?.name, t2?.role);
  
  await closeDb();
}
checkDb().catch(console.error);
