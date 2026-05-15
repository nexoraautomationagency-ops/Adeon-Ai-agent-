const { initDb, dbRun, dbGet } = require('./connection');
const bcrypt = require('bcryptjs');

async function seed() {
  await initDb();
  const { migrate } = require('./migrate');
  await migrate();

  const securePassword = Math.random().toString(36).slice(-10);
  const passwordHash = bcrypt.hashSync(securePassword, 10);

  // Create tutor
  const adminPhone = (process.env.ADMIN_PHONE || '+94771234567').split(',')[0];
  const existing = await dbGet('SELECT id FROM tutors WHERE email = ?', ['admin@tutor.lk']);
  if (!existing) {
    await dbRun('INSERT INTO tutors (name, email, password_hash, phone, institute_name, role) VALUES (?,?,?,?,?,?)',
      ['Admin Tutor', 'admin@tutor.lk', passwordHash, adminPhone, 'Excel Science Academy', 'developer']);
    console.log(`
      🔐 INITIAL SETUP SUCCESSFUL
      📧 Email: admin@tutor.lk
      🔑 Password: ${securePassword}
      ⚠️  PLEASE CHANGE THIS PASSWORD IMMEDIATELY!
    `);
  }

  const tutor = await dbGet('SELECT id FROM tutors WHERE email = ?', ['admin@tutor.lk']);
  const tid = tutor.id;

  // Settings
  const existingSettings = await dbGet('SELECT id FROM settings WHERE tutor_id = ?', [tid]);
  if (!existingSettings) {
    await dbRun('INSERT INTO settings (tutor_id, auto_reply_enabled, welcome_message, ai_tone) VALUES (?,1,?,?)',
      [tid, 'Welcome to Excel Science Academy. How can we help you today?', 'friendly_sinhala_english']);
  }

  console.log('✅ Database initialized with Admin account');
  console.log('📧 Login: admin@tutor.lk / admin123');
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
  seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { seed };
