/**
 * Check auto-reminder conditions + unpaid list for Remind All
 * Run: node scripts/check-reminders.js
 */
require('dotenv').config({ path: './server/.env' });
const { initDb, dbAll, dbGet } = require('../server/db/connection');
const normalizationService = require('../server/services/normalization');

(async () => {
  await initDb();
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();
  const todayStr = now.toISOString().split('T')[0];

  console.log('\n=== Payment reminder diagnostic ===');
  console.log('Today:', todayStr, '| day:', currentDay, '| month:', currentMonth, '| year:', currentYear);

  const settingsRows = await dbAll('SELECT * FROM settings');
  for (const s of settingsRows) {
    const wouldRun =
      s.payment_reminder_enabled === 1 &&
      s.payment_reminder_day === currentDay &&
      s.last_reminder_date !== todayStr;

    const unpaid = await dbAll(
      `SELECT s.name, s.phone, p.amount, p.status
       FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE p.tutor_id = ? AND p.month = ? AND p.year = ? AND p.status = 'unpaid' AND s.status = 'active'`,
      [s.tutor_id, currentMonth, currentYear]
    );

    console.log(`\n--- Tutor ${s.tutor_id} ---`);
    console.log('  Auto enabled:', !!s.payment_reminder_enabled);
    console.log('  Reminder day (settings):', s.payment_reminder_day, wouldRun ? '✅ matches today' : '❌ does not match today');
    console.log('  Last reminder date:', s.last_reminder_date || '(never)');
    console.log('  Auto would send today:', wouldRun ? 'YES' : 'NO');
    console.log('  Unpaid active (Remind All targets):', unpaid.length);
    unpaid.slice(0, 5).forEach((u) => {
      console.log(`    - ${u.name} | Rs.${u.amount} | phone: ${u.phone || 'missing'}`);
    });
    if (unpaid.length > 5) console.log(`    ... and ${unpaid.length - 5} more`);
    console.log('  Bank (dashboard):', s.bank_name || '(empty)', '|', s.bank_account || '(empty)');
  }

  console.log('\nDone.\n');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
