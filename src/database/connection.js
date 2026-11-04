const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../../data/presco.db');
let db = null;
let SQL = null;

async function getDatabase() {
  if (db) return db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys and performance optimizations
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA synchronous = NORMAL;');
  db.run('PRAGMA cache_size = -64000;'); // 64MB cache
  db.run('PRAGMA temp_store = MEMORY;');

  return db;
}

let isDirty = false;
let saveDebounceTimer = null;
let isWriting = false;

function markDirtyAndScheduleSave(delayMs = 150) {
  isDirty = true;
  if (saveDebounceTimer) return;
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null;
    saveDatabase(false);
  }, delayMs);
}

function saveDatabase(sync = false) {
  if (!db || (!isDirty && !sync)) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    isDirty = false;
    if (sync) {
      fs.writeFileSync(DB_PATH, buffer);
    } else {
      if (isWriting) return;
      isWriting = true;
      fs.writeFile(DB_PATH, buffer, (err) => {
        isWriting = false;
        if (err) console.error('Error saving SQLite database:', err);
      });
    }
  } catch (err) {
    console.error('saveDatabase error:', err);
  }
}

// Helper: format db.exec results to array of objects
function formatExecResults(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

// Query helper - returns array of objects
async function query(sql, params = []) {
  const database = await getDatabase();
  if (!params || (Array.isArray(params) && params.length === 0)) {
    const res = database.exec(sql);
    return formatExecResults(res);
  }
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Query one row helper
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Run statement helper (INSERT / UPDATE / DELETE)
async function run(sql, params = []) {
  const database = await getDatabase();
  if (!params || (Array.isArray(params) && params.length === 0)) {
    database.run(sql);
  } else {
    database.run(sql, params);
  }
  const lastIdRes = database.exec("SELECT last_insert_rowid() AS id");
  const lastInsertRowid = (lastIdRes && lastIdRes[0] && lastIdRes[0].values[0]) ? lastIdRes[0].values[0][0] : null;
  const changes = database.getRowsModified();
  markDirtyAndScheduleSave();
  return { changes, lastInsertRowid };
}

// Auto-save periodically and on process exit
let saveInterval = null;
function startAutoSave(intervalMs = 5000) {
  if (saveInterval) return;
  saveInterval = setInterval(() => saveDatabase(false), intervalMs);
  process.on('exit', () => saveDatabase(true));
  process.on('SIGINT', () => { saveDatabase(true); process.exit(); });
  process.on('SIGTERM', () => { saveDatabase(true); process.exit(); });
}

module.exports = {
  getDatabase,
  saveDatabase,
  startAutoSave,
  query,
  queryOne,
  run,
  all: query,
  get: queryOne,
  DB_PATH
};
