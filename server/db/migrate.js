const { initDb, dbExec } = require('./connection');

async function migrate() {
  await initDb();

  dbExec(`
    CREATE TABLE IF NOT EXISTS tutors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      institute_name TEXT DEFAULT 'My Tuition Class',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      whatsapp_id TEXT,
      grade TEXT,
      school TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      address TEXT,
      monthly_fee REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      name TEXT,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT DEFAULT 'Online',
      max_students INTEGER DEFAULT 50,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS student_classes (
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (student_id, class_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      status TEXT DEFAULT 'unpaid',
      paid_date DATETIME,
      payment_method TEXT,
      receipt_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS whatsapp_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      whatsapp_group_id TEXT,
      description TEXT,
      grade TEXT,
      subject TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS student_groups (
      student_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (student_id, group_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      student_id INTEGER,
      direction TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      content TEXT,
      whatsapp_chat_id TEXT,
      whatsapp_msg_id TEXT UNIQUE,
      is_group INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_type TEXT DEFAULT 'all',
      target_id TEXT,
      sent_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      scheduled_at DATETIME,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ai_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_hash TEXT UNIQUE NOT NULL,
      prompt_text TEXT NOT NULL,
      response_text TEXT NOT NULL,
      model TEXT DEFAULT 'gpt-4o-mini',
      tokens_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      template TEXT NOT NULL,
      variables TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL UNIQUE,
      auto_reply_enabled INTEGER DEFAULT 0,
      auto_reply_message TEXT DEFAULT 'Thank you for your message. Sir will reply soon.',
      welcome_message TEXT DEFAULT 'Welcome to our class!',
      payment_reminder_enabled INTEGER DEFAULT 1,
      payment_reminder_day INTEGER DEFAULT 1,
      ai_tone TEXT DEFAULT 'friendly_sinhala_english',
      timezone TEXT DEFAULT 'Asia/Colombo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
    );
  `);

  // Create indexes (separate exec calls for safety)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_students_tutor ON students(tutor_id)',
    'CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone)',
    'CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
    'CREATE INDEX IF NOT EXISTS idx_messages_tutor ON message_logs(tutor_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_created ON message_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_cache(prompt_hash)',
  ];
  indexes.forEach(sql => { try { dbExec(sql); } catch(e) { /* index may exist */ } });

  console.log('✅ Database migrated successfully');
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
  migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { migrate };
