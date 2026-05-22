const { pool } = require('../server/db/connection');
async function test() {
  try {
    const res = await pool.query("SELECT * FROM message_logs WHERE whatsapp_chat_id = '51445437038725@lid' ORDER BY created_at ASC");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
