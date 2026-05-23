const { initDb, dbExec, dbAll } = require('./connection');

async function migrate() {
  await initDb();

  console.log('[Migrate] Starting Supabase migration...');

  // 1. Create Tables
  await dbExec(`
    CREATE TABLE IF NOT EXISTS tutors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      institute_name TEXT DEFAULT 'My Tuition Class',
      role TEXT DEFAULT 'tutor',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      name TEXT,
      phone TEXT,
      whatsapp_id TEXT,
      grade TEXT,
      school TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      address TEXT,
      monthly_fee DOUBLE PRECISION DEFAULT 0,
      normalized_phone TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      conversation_state TEXT DEFAULT 'NEW_LEAD',
      missing_fields TEXT DEFAULT '[]',
      lead_score TEXT DEFAULT 'COLD',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tutor_id, normalized_phone)
    );

    CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      name TEXT,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT DEFAULT 'Online',
      max_students INTEGER DEFAULT 50,
      fee DOUBLE PRECISION DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_classes (
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (student_id, class_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      status TEXT DEFAULT 'unpaid',
      paid_date TIMESTAMP,
      payment_method TEXT,
      receipt_url TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS whatsapp_groups (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      whatsapp_group_id TEXT,
      description TEXT,
      grade TEXT,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      month TEXT,
      year INTEGER,
      subject TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_groups (
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (student_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      student_id INTEGER,
      direction TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      content TEXT,
      whatsapp_chat_id TEXT,
      whatsapp_msg_id TEXT UNIQUE,
      is_group INTEGER DEFAULT 0,
      is_ai INTEGER DEFAULT 0,
      detected_intent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_type TEXT DEFAULT 'all',
      target_id TEXT,
      sent_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      scheduled_at TIMESTAMP,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_cache (
      id SERIAL PRIMARY KEY,
      prompt_hash TEXT UNIQUE NOT NULL,
      prompt_text TEXT NOT NULL,
      response_text TEXT NOT NULL,
      model TEXT DEFAULT 'gpt-4o-mini',
      tokens_used INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS message_templates (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      template TEXT NOT NULL,
      variables TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL UNIQUE REFERENCES tutors(id) ON DELETE CASCADE,
      auto_reply_enabled INTEGER DEFAULT 0,
      auto_reply_message TEXT DEFAULT 'Thank you for your message. Sir will reply soon.',
      welcome_message TEXT DEFAULT 'Welcome to our class!',
      payment_reminder_enabled INTEGER DEFAULT 1,
      payment_reminder_day INTEGER DEFAULT 1,
      ai_tone TEXT DEFAULT 'friendly_sinhala_english',
      timezone TEXT DEFAULT 'Asia/Colombo',
      bank_name TEXT DEFAULT 'Bank of Ceylon (BOC)',
      bank_account TEXT DEFAULT '1234567890',
      bank_branch TEXT DEFAULT 'Colombo',
      bank_account_holder TEXT DEFAULT '',
      basic_fee DOUBLE PRECISION DEFAULT 0,
      tute_fee DOUBLE PRECISION DEFAULT 0,
      last_reminder_date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      status TEXT DEFAULT 'present',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, class_id, date)
    );

    CREATE TABLE IF NOT EXISTS knowledge_examples (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      intent TEXT NOT NULL,
      student_message TEXT NOT NULL,
      ideal_reply TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_feedback (
      id SERIAL PRIMARY KEY,
      message_log_id INTEGER NOT NULL REFERENCES message_logs(id) ON DELETE CASCADE,
      original_ai_reply TEXT NOT NULL,
      corrected_reply TEXT NOT NULL,
      correction_type TEXT,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      keywords TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tutor_admins (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tutor_id, phone)
    );

    CREATE TABLE IF NOT EXISTS tute_deliveries (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      tracking_code TEXT,
      photo_url TEXT,
      courier_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS billing_logs (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      chat_id TEXT,
      tokens_used INTEGER DEFAULT 0,
      model_name TEXT,
      cost_estimate DOUBLE PRECISION DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Fix Bug 31: Knowledge Base and Vector Search
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id SERIAL PRIMARY KEY,
      tutor_id INTEGER REFERENCES tutors(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      embedding vector(1536),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- RPC for Vector Search with Multitenancy
    DROP FUNCTION IF EXISTS match_knowledge_v2(vector, float, int, text, int);
    CREATE OR REPLACE FUNCTION match_knowledge_v2 (
      query_embedding vector(1536),
      match_threshold float,
      match_count int,
      filter_category text DEFAULT NULL,
      filter_tutor_id int DEFAULT NULL
    )
    RETURNS TABLE (
      id bigint,
      content text,
      category text,
      metadata jsonb,
      similarity float8
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        kb.id::bigint,
        kb.content::text,
        kb.category::text,
        kb.metadata::jsonb,
        (1 - (kb.embedding <=> query_embedding))::float8 AS similarity
      FROM knowledge_base kb
      WHERE kb.embedding IS NOT NULL
      AND (1 - (kb.embedding <=> query_embedding) > match_threshold)
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_tutor_id IS NULL OR kb.tutor_id IS NULL OR kb.tutor_id = filter_tutor_id)
      ORDER BY kb.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;

    -- RPC for Intent Matching with Multitenancy
    DROP FUNCTION IF EXISTS match_intents(vector, float, int, int);
    CREATE OR REPLACE FUNCTION match_intents (
      query_embedding vector(1536),
      match_threshold float,
      match_count int,
      filter_tutor_id int DEFAULT NULL
    )
    RETURNS TABLE (
      intent text,
      similarity float8
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        (kb.metadata->>'intent')::text as intent,
        (1 - (kb.embedding <=> query_embedding))::float8 AS similarity
      FROM knowledge_base kb
      WHERE kb.category = 'INTENT'
      AND kb.embedding IS NOT NULL
      AND (1 - (kb.embedding <=> query_embedding) > match_threshold)
      AND (filter_tutor_id IS NULL OR kb.tutor_id IS NULL OR kb.tutor_id = filter_tutor_id)
      ORDER BY kb.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
  `);

  // 2. Create Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_tutor_admins_phone ON tutor_admins(phone)',
    'CREATE INDEX IF NOT EXISTS idx_students_tutor ON students(tutor_id)',
    'CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone)',
    'CREATE INDEX IF NOT EXISTS idx_students_normalized_phone ON students(normalized_phone)',
    'CREATE INDEX IF NOT EXISTS idx_students_whatsapp_id ON students(whatsapp_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_record ON payments (student_id, month, year)',
    'CREATE INDEX IF NOT EXISTS idx_messages_tutor ON message_logs(tutor_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON message_logs(whatsapp_chat_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_created ON message_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_cache(prompt_hash)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_intent ON knowledge_examples(intent)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_base_tutor ON knowledge_base(tutor_id)',
    'CREATE INDEX IF NOT EXISTS idx_faqs_tutor ON faqs(tutor_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_groups_mapping ON whatsapp_groups (class_id, month, year)',
    'CREATE INDEX IF NOT EXISTS idx_tute_deliveries_student ON tute_deliveries(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_tute_deliveries_status ON tute_deliveries(status)',
  ];
  
  // 2. Indexes (moved below migrations)

  // 3. Handle Column Migrations (PostgreSQL style)
  const migrations = [
    { table: 'message_logs', column: 'is_ai', type: 'INTEGER DEFAULT 0' },
    { table: 'message_logs', column: 'detected_intent', type: 'TEXT' },
    { table: 'settings', column: 'last_reminder_date', type: 'TEXT' },
    { table: 'settings', column: 'basic_fee', type: 'DOUBLE PRECISION DEFAULT 0' },
    { table: 'settings', column: 'tute_fee', type: 'DOUBLE PRECISION DEFAULT 0' },
    { table: 'settings', column: 'final_grade', type: "INTEGER DEFAULT 11" },
    { table: 'settings', column: 'group_manual_approval', type: "INTEGER DEFAULT 0" },
    { table: 'whatsapp_groups', column: 'class_id', type: 'INTEGER' },
    { table: 'whatsapp_groups', column: 'month', type: 'TEXT' },
    { table: 'whatsapp_groups', column: 'year', type: 'INTEGER' },
    // Student AI conversation state columns (added in v2)
    { table: 'students', column: 'conversation_state', type: "TEXT DEFAULT 'NEW_LEAD'" },
    { table: 'students', column: 'missing_fields', type: "TEXT DEFAULT '[]'" },
    { table: 'students', column: 'lead_score', type: "TEXT DEFAULT 'COLD'" },
    // Classes fee column (added in v2)
    { table: 'classes', column: 'fee', type: 'DOUBLE PRECISION DEFAULT 0' },
    { table: 'students', column: 'normalized_phone', type: 'TEXT' },
    { table: 'knowledge_base', column: 'tutor_id', type: 'INTEGER REFERENCES tutors(id) ON DELETE CASCADE' },
    // Fix: persist registration month across multi-turn conversations
    { table: 'students', column: 'pending_month', type: 'TEXT' },
  ];

  for (const m of migrations) {
    try {
      // Check if column exists
      const checkSql = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${m.table}' AND column_name = '${m.column}'
      `;
      const exists = await dbAll(checkSql);
      
      if (exists.length === 0) {
        await dbExec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
        console.log(`✅ Added ${m.column} column to ${m.table}`);
      }
    } catch (e) {
      console.warn(`⚠️ Could not migrate ${m.table}.${m.column}:`, e.message);
    }
  }

  // Run index creation after columns are added
  for (const sql of indexes) {
    try { 
      await dbExec(sql); 
    } catch(e) { 
      console.warn('⚠️ Could not create index:', e.message);
    }
  }

  // 4. Ensure students table columns are nullable for leads
  try {
    await dbExec('ALTER TABLE students ALTER COLUMN name DROP NOT NULL');
    await dbExec('ALTER TABLE students ALTER COLUMN phone DROP NOT NULL');
  } catch (e) {}

  console.log('✅ Supabase Database migrated successfully');
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
  migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { migrate };
