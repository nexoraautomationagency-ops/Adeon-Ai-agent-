const { dbAll } = require('../server/db/connection');
async function check() {
  try {
    const rows = await dbAll("SELECT month, year, tutor_id FROM tute_deliveries");
    console.log('Summary:', rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
check();
