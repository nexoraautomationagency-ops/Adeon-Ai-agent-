const { pool } = require('../server/db/connection');

async function fix() {
  try {
    await pool.query("DELETE FROM student_classes WHERE student_id IN (SELECT id FROM students WHERE phone IN ('0760592637', '0770718013')) AND class_id = 23");
    await pool.query("UPDATE students SET monthly_fee = 500 WHERE phone IN ('0760592637', '0770718013')");
    console.log('Fixed dashboard data');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
fix();
