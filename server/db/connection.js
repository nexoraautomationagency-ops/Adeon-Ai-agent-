const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/tutor.db');

let db = null;
let saveTimer = null;

async function initDb() {
  if (db) return db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like behavior and foreign keys
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

// Save database to disk (call after writes)
function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[DB] Save error:', err.message);
  }
}

// Force save immediately
function saveDbNow() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[DB] Save error:', err.message);
  }
}

function closeDb() {
  if (db) {
    saveDbNow();
    db.close();
    db = null;
  }
}

// Helper: run a statement and return { changes, lastInsertRowid }
function dbRun(sql, params = []) {
  const d = getDb();
  d.run(sql, params);
  const changes = d.getRowsModified();
  const lastId = d.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = lastId.length > 0 ? lastId[0].values[0][0] : 0;
  saveDb();
  return { changes, lastInsertRowid };
}

// Helper: get one row
function dbGet(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
  }
  stmt.free();
  return row;
}

// Helper: get all rows
function dbAll(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);
  const rows = [];
  const cols = stmt.getColumnNames();
  while (stmt.step()) {
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// Helper: execute raw SQL (for migrations)
function dbExec(sql) {
  const d = getDb();
  d.exec(sql);
  saveDb();
}

module.exports = { initDb, getDb, closeDb, saveDb, saveDbNow, dbRun, dbGet, dbAll, dbExec };
