const { pool } = require('../server/db/connection');
async function test() {
  try {
    const res = await pool.query("SELECT * FROM classes WHERE tutor_id = 1 AND grade = '8'");
    console.log(res.rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
