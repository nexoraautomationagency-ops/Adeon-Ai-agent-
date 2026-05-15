const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey) {
  console.error('[DB] Missing Supabase credentials in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// For raw SQL queries (migrations and complex queries)
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Required for Supabase
  },
  max: 20, // Limit connections for production
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

async function initDb(retries = 5) {
  while (retries > 0) {
    try {
      const client = await pool.connect();
      console.log('✅ Connected to Supabase PostgreSQL');
      client.release();
      return; // Success
    } catch (err) {
      retries--;
      console.error(`❌ DB Connection failed (${retries} retries left):`, err.message);
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
    }
  }
}

function getDb() {
  return pool;
}

// Helper: run a statement (INSERT/UPDATE/DELETE)
async function dbRun(sql, params = []) {
  // Convert ? to $1, $2, etc. for PostgreSQL
  // Fix Bug 41: Robust placeholder replacement (? -> $n) that ignores '?' inside string literals
  let count = 0;
  let inString = false;
  let pgSql = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") inString = !inString;
    
    if (char === '?' && !inString) {
      count++;
      pgSql += `$${count}`;
    } else {
      pgSql += char;
    }
  }

  const res = await pool.query(pgSql, params);
  
  // Try to get last insert ID if it was an INSERT
  let lastInsertRowid = 0;
  if (res.rows && res.rows.length > 0) {
    lastInsertRowid = res.rows[0].id || 0;
  }

  return { 
    changes: res.rowCount, 
    lastInsertRowid: lastInsertRowid 
  };
}

// Helper: get one row
async function dbGet(sql, params = []) {
  // Fix Bug 41: Robust placeholder replacement (? -> $n) that ignores '?' inside string literals
  let count = 0;
  let inString = false;
  let pgSql = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") inString = !inString;
    
    if (char === '?' && !inString) {
      count++;
      pgSql += `$${count}`;
    } else {
      pgSql += char;
    }
  }

  const res = await pool.query(pgSql, params);
  return res.rows[0] || null;
}

// Helper: get all rows
async function dbAll(sql, params = []) {
  // Fix Bug 41: Robust placeholder replacement (? -> $n) that ignores '?' inside string literals
  let count = 0;
  let inString = false;
  let pgSql = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") inString = !inString;
    
    if (char === '?' && !inString) {
      count++;
      pgSql += `$${count}`;
    } else {
      pgSql += char;
    }
  }

  const res = await pool.query(pgSql, params);
  return res.rows;
}

// Helper: execute raw SQL (for migrations)
async function dbExec(sql) {
  await pool.query(sql);
}

function closeDb() {
  return pool.end();
}

module.exports = { 
  supabase, 
  pool, 
  initDb, 
  getDb, 
  closeDb, 
  dbRun, 
  dbGet, 
  dbAll, 
  dbExec 
};
