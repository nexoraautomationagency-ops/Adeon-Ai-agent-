const { pool } = require('../server/db/connection');
async function test() {
  try {
    await pool.query("INSERT INTO tutor_admins (tutor_id, name, phone) VALUES (2, 'Udam Admin', '266245794447615')");
    console.log('Admin added');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
