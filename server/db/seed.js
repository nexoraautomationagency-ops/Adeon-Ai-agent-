const { initDb, dbRun, dbGet } = require('./connection');
const bcrypt = require('bcryptjs');

async function seed() {
  await initDb();
  const { migrate } = require('./migrate');
  await migrate();

  const passwordHash = bcrypt.hashSync('admin123', 10);

  // Create tutor
  const existing = dbGet('SELECT id FROM tutors WHERE email = ?', ['admin@tutor.lk']);
  if (!existing) {
    dbRun('INSERT INTO tutors (name, email, password_hash, phone, institute_name) VALUES (?,?,?,?,?)',
      ['Demo Tutor', 'admin@tutor.lk', passwordHash, '+94771234567', 'Excel Science Academy']);
  }

  const tutor = dbGet('SELECT id FROM tutors WHERE email = ?', ['admin@tutor.lk']);
  const tid = tutor.id;

  // Settings
  const existingSettings = dbGet('SELECT id FROM settings WHERE tutor_id = ?', [tid]);
  if (!existingSettings) {
    dbRun('INSERT INTO settings (tutor_id, auto_reply_enabled, welcome_message, ai_tone) VALUES (?,1,?,?)',
      [tid, 'Ayubowan! 🙏 Welcome to Excel Science Academy.', 'friendly_sinhala_english']);
  }

  // Classes
  const cls = [
    [tid, 'Science', 'Grade 10', 'Saturday', '09:00', '11:00', 'Main Hall'],
    [tid, 'Science', 'Grade 11', 'Saturday', '14:00', '16:00', 'Main Hall'],
    [tid, 'Science', 'O/L Revision', 'Sunday', '09:00', '12:00', 'Main Hall'],
  ];
  cls.forEach(c => {
    const ex = dbGet('SELECT id FROM classes WHERE tutor_id=? AND subject=? AND grade=? AND day_of_week=?', [c[0],c[1],c[2],c[3]]);
    if (!ex) dbRun('INSERT INTO classes (tutor_id,subject,grade,day_of_week,start_time,end_time,location) VALUES (?,?,?,?,?,?,?)', c);
  });

  // Templates
  const templates = [
    [tid, 'Payment Reminder', 'payment', 'Hi {{student_name}} 👋\n\n{{month}} payment Rs.{{amount}} pending. 🙏\n\nThank you!', '["student_name","month","amount"]'],
    [tid, 'Class Cancelled', 'class', '📢 {{day}} {{subject}} class cancel. Next week normal. 🙏', '["day","subject"]'],
    [tid, 'Class Reminder', 'class', '📚 Tomorrow {{subject}} class {{time}} ta. Notes ganna enna! 👍', '["subject","time"]'],
    [tid, 'Welcome Student', 'general', 'Welcome {{student_name}}! 🎉\n📅 {{day}} - {{time}}\n💰 Fee: Rs.{{fee}} 😊', '["student_name","day","time","fee"]'],
    [tid, 'Payment Received', 'payment', 'Thank you {{student_name}}! 🙏\n{{month}} Rs.{{amount}} received ✅💪', '["student_name","month","amount"]'],
  ];
  templates.forEach(t => {
    const ex = dbGet('SELECT id FROM message_templates WHERE tutor_id=? AND name=?', [t[0], t[1]]);
    if (!ex) dbRun('INSERT INTO message_templates (tutor_id,name,category,template,variables,is_default) VALUES (?,?,?,?,?,1)', t);
  });

  // Students
  const students = [
    [tid, 'Kasun Perera', '+94771111111', 'Grade 10', 'Royal College', 3000],
    [tid, 'Dilini Silva', '+94772222222', 'Grade 10', 'Visakha Vidyalaya', 3000],
    [tid, 'Tharindu Fernando', '+94773333333', 'Grade 11', 'Ananda College', 3500],
    [tid, 'Nethmi Jayawardena', '+94774444444', 'Grade 11', 'Devi Balika', 3500],
    [tid, 'Ashan Bandara', '+94775555555', 'O/L Revision', "St. Joseph's College", 4000],
  ];
  students.forEach(s => {
    const ex = dbGet('SELECT id FROM students WHERE tutor_id=? AND phone=?', [s[0], s[2]]);
    if (!ex) dbRun('INSERT INTO students (tutor_id,name,phone,grade,school,monthly_fee,status) VALUES (?,?,?,?,?,?,?)', [...s, 'active']);
  });

  console.log('✅ Database seeded with sample data');
  console.log('📧 Login: admin@tutor.lk / admin123');
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
  seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { seed };
