const path = require('path');
const fs = require('fs');
// Use inline WASM build to avoid missing external .wasm binary in serverless / Lambda bundles
const initSqlJs = require('sql.js/dist/sql-wasm-inline.js');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);

function findBundledDb() {
  const candidates = [
    path.join(__dirname, '../../data/presco.db'),
    path.join(process.cwd(), 'data/presco.db'),
    path.join(__dirname, '../data/presco.db'),
    path.join(__dirname, 'data/presco.db'),
    path.resolve('data/presco.db')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const LOCAL_DB_PATH = findBundledDb() || path.join(__dirname, '../../data/presco.db');
const DB_PATH = isServerless ? path.join('/tmp', 'presco.db') : LOCAL_DB_PATH;
let db = null;
let SQL = null;

async function getDatabase() {
  if (db) return db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      // Ignored in read-only environment
    }
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }

  const bundled = findBundledDb();

  // If in serverless and /tmp/presco.db does not exist, copy from bundled db if available
  if (isServerless && !fs.existsSync(DB_PATH)) {
    if (bundled) {
      try {
        fs.copyFileSync(bundled, DB_PATH);
        console.log(`Copied bundled DB from ${bundled} to ${DB_PATH}`);
      } catch (e) {
        console.warn('Could not copy bundled DB to /tmp:', e.message);
      }
    }
  }

  let targetBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    try {
      targetBuffer = fs.readFileSync(DB_PATH);
    } catch (e) {
      console.warn('Could not read DB_PATH:', e.message);
    }
  } else if (bundled) {
    try {
      targetBuffer = fs.readFileSync(bundled);
    } catch (e) {
      console.warn('Could not read bundled DB:', e.message);
    }
  }

  // Fallback to embedded default database if no file is present
  if (!targetBuffer) {
    try {
      const defaultB64 = require('./defaultDb');
      targetBuffer = Buffer.from(defaultB64, 'base64');
      if (isServerless) {
        try {
          fs.writeFileSync(DB_PATH, targetBuffer);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Could not load embedded default database:', e.message);
    }
  }

  if (targetBuffer) {
    db = new SQL.Database(targetBuffer);
  } else {
    db = new SQL.Database();
  }

  // Ensure tables exist; if database was newly initialized, run setup migrations
  try {
    const check = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    if (!check || check.length === 0 || !check[0].values || check[0].values.length === 0) {
      console.log('⚡ Initializing database schema...');
      const migrate = require('./migrate');
      const seed = require('./seed');
      const migrateDoctor = require('./migrateDoctor');
      const seedDoctor = require('./seedDoctor');
      await migrate();
      await seed();
      await migrateDoctor();
      await seedDoctor();
      saveDatabase(true);
    }
  } catch (err) {
    console.warn('Auto-schema check note:', err.message);
  }

  // Enable foreign keys and performance optimizations
  try {
    db.run('PRAGMA foreign_keys = ON;');
    db.run('PRAGMA synchronous = NORMAL;');
    db.run('PRAGMA cache_size = -64000;'); // 64MB cache
    db.run('PRAGMA temp_store = MEMORY;');
  } catch (e) {
    // Ignore pragma errors
  }

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
      try {
        fs.writeFileSync(DB_PATH, buffer);
      } catch (err) {
        // Ignored on read-only cloud filesystem
      }
    } else {
      if (isWriting) return;
      isWriting = true;
      fs.writeFile(DB_PATH, buffer, (err) => {
        isWriting = false;
        if (err) console.warn('Could not write database:', err.message);
      });
    }
  } catch (err) {
    console.warn('saveDatabase note:', err.message);
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
