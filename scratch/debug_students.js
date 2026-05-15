const { dbAll, dbGet } = require('../server/db/connection');
require('dotenv').config();

async function check() {
  try {
    const tableInfo = await dbAll("PRAGMA table_info(students)");
    console.log('Table Info:', tableInfo);
    
    const sample = await dbAll("SELECT id, name, status, conversation_state FROM students LIMIT 5");
    console.log('Sample Students:', sample);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
check();
