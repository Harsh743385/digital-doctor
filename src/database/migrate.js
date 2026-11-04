const path = require('path');
const fs = require('fs');
const { getDatabase, saveDatabase } = require('./connection');

async function migrate() {
  console.log('🚀 Starting database migration...\n');
  const db = await getDatabase();

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'nurse' CHECK(role IN ('admin','nurse','doctor')),
      full_name TEXT NOT NULL,
      hospital_id INTEGER,
      api_token TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      address TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uhid TEXT NOT NULL,
      ipd_number TEXT,
      full_name TEXT NOT NULL,
      age TEXT,
      gender TEXT,
      date_of_birth TEXT,
      admission_date TEXT,
      discharge_date TEXT,
      hospital_id INTEGER,
      consultant_id INTEGER,
      ward TEXT,
      bed_number TEXT,
      diagnosis TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS field_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      field_type TEXT NOT NULL CHECK(field_type IN (
        'text','textarea','number','email','phone','date','time','datetime',
        'dropdown','radio','checkbox','multiselect','file','image','boolean'
      )),
      is_required INTEGER DEFAULT 0,
      default_value TEXT,
      placeholder TEXT,
      validation_rules TEXT DEFAULT '{}',
      error_messages TEXT DEFAULT '{}',
      min_value REAL,
      max_value REAL,
      min_length INTEGER,
      max_length INTEGER,
      options TEXT DEFAULT '[]',
      category_id INTEGER REFERENCES field_categories(id) ON DELETE SET NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','unpublished','archived')),
      version INTEGER DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS form_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      snapshot TEXT NOT NULL DEFAULT '{}',
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS form_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      columns INTEGER DEFAULT 1 CHECK(columns BETWEEN 1 AND 4),
      conditional_rules TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS form_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES form_sections(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      overrides TEXT DEFAULT '{}',
      conditional_rules TEXT DEFAULT '[]',
      column_span INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL REFERENCES forms(id),
      form_version_id INTEGER REFERENCES form_versions(id),
      submitted_by INTEGER REFERENCES users(id),
      patient_id INTEGER REFERENCES patients(id),
      hospital_id INTEGER REFERENCES hospitals(id),
      data TEXT NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted','draft')),
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS form_submission_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES fields(id),
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      file_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      assessment_type TEXT DEFAULT 'initial',
      assessment_date TEXT,
      assessment_time TEXT,
      shift TEXT,
      nurse_name TEXT,
      temp_f REAL,
      pulse_bpm REAL,
      bp_sys REAL,
      bp_dia REAL,
      spo2 REAL,
      rr REAL,
      weight_kg REAL,
      pain_score INTEGER,
      fall_risk_score INTEGER,
      fall_risk_level TEXT,
      notes TEXT,
      interventions TEXT,
      nurse_signature TEXT,
      meta_json TEXT DEFAULT '{}',
      form_status TEXT DEFAULT 'Completed',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_emar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      medication_name TEXT NOT NULL,
      dose TEXT,
      route TEXT,
      frequency TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'Active',
      stop_reason TEXT,
      stopped_at TEXT,
      stopped_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_emar_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emar_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL,
      administered_at TEXT,
      status TEXT NOT NULL DEFAULT 'Given',
      administered_by_name TEXT,
      reason TEXT,
      signature TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_etar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      treatment_name TEXT NOT NULL,
      category TEXT,
      frequency TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_etar_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etar_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL,
      administered_at TEXT,
      status TEXT NOT NULL DEFAULT 'Done',
      administered_by_name TEXT,
      notes TEXT,
      signature TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      vital_date TEXT NOT NULL,
      vital_time TEXT NOT NULL,
      shift TEXT,
      temp_f REAL,
      pulse_bpm REAL,
      bp_sys REAL,
      bp_dia REAL,
      spo2 REAL,
      rr REAL,
      pain_score INTEGER,
      blood_sugar REAL,
      recorded_by TEXT,
      notes TEXT,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_icu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      chart_date TEXT NOT NULL,
      chart_time TEXT,
      diagnosis TEXT,
      meta_json TEXT DEFAULT '{}',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_icu_obs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icu_id INTEGER,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      obs_date TEXT,
      obs_time TEXT,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      note_date TEXT NOT NULL,
      note_time TEXT NOT NULL,
      shift TEXT,
      note_type TEXT DEFAULT 'General',
      notes TEXT NOT NULL,
      nurse_name TEXT,
      signature TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_io (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      io_date TEXT NOT NULL,
      io_time TEXT NOT NULL,
      shift TEXT,
      intake_type TEXT,
      intake_item TEXT,
      intake_amount_ml REAL DEFAULT 0,
      output_type TEXT,
      output_item TEXT,
      output_amount_ml REAL DEFAULT 0,
      remarks TEXT,
      recorded_by TEXT,
      signature TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_diabetic (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      record_time TEXT NOT NULL,
      glucose_value REAL NOT NULL,
      test_type TEXT,
      insulin_type TEXT,
      insulin_dose TEXT,
      remarks TEXT,
      recorded_by TEXT,
      audited_by TEXT,
      audited_at TEXT,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      record_kind TEXT NOT NULL,
      record_date TEXT NOT NULL,
      record_time TEXT,
      shift TEXT,
      title TEXT,
      recorded_by TEXT,
      meta_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'Completed',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      handover_date TEXT NOT NULL,
      handover_time TEXT NOT NULL,
      shift TEXT,
      handover_from TEXT,
      handover_to TEXT,
      sbar_situation TEXT,
      sbar_background TEXT,
      sbar_assessment TEXT,
      sbar_recommendation TEXT,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      risk_type TEXT NOT NULL,
      assessment_date TEXT NOT NULL,
      assessment_time TEXT,
      score INTEGER DEFAULT 0,
      risk_level TEXT,
      details_json TEXT DEFAULT '{}',
      assessed_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_fasthug (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      record_time TEXT NOT NULL,
      shift TEXT,
      items_json TEXT DEFAULT '{}',
      assessed_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_restraint (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      restraint_type TEXT,
      reason TEXT,
      doctor_order TEXT,
      observations_json TEXT DEFAULT '[]',
      meta_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nursing_careplans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      plan_date TEXT NOT NULL,
      problem TEXT NOT NULL,
      goal TEXT,
      interventions TEXT,
      evaluation TEXT,
      status TEXT DEFAULT 'Active',
      nurse_name TEXT,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      dose TEXT,
      route TEXT,
      frequency TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER,
      action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
      user_id INTEGER,
      user_name TEXT,
      changes TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ];

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_fields_category ON fields(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_fields_type ON fields(field_type)',
    'CREATE INDEX IF NOT EXISTS idx_fields_active ON fields(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_fields_name ON fields(name)',
    'CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status)',
    'CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug)',
    'CREATE INDEX IF NOT EXISTS idx_form_fields_form ON form_fields(form_id)',
    'CREATE INDEX IF NOT EXISTS idx_form_fields_field ON form_fields(field_id)',
    'CREATE INDEX IF NOT EXISTS idx_form_sections_form ON form_sections(form_id)',
    'CREATE INDEX IF NOT EXISTS idx_form_versions_form ON form_versions(form_id)',
    'CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id)',
    'CREATE INDEX IF NOT EXISTS idx_form_submissions_patient ON form_submissions(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_assessments_patient ON nursing_assessments(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_assessments_hospital ON nursing_assessments(hospital_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_emar_patient ON nursing_emar(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_emar_admins ON nursing_emar_admins(emar_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_vitals_patient ON nursing_vitals(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_io_patient ON nursing_io(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_notes_patient ON nursing_notes(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_nursing_records_kind ON nursing_records(record_kind)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id)',
    'CREATE INDEX IF NOT EXISTS idx_patients_uhid ON patients(uhid)',
    'CREATE INDEX IF NOT EXISTS idx_patients_hospital ON patients(hospital_id)',
  ];

  for (const sql of tables) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    try {
      db.run(sql);
      console.log(`  ✅ Table: ${tableName}`);
    } catch (err) {
      console.error(`  ❌ Table: ${tableName} - ${err.message}`);
    }
  }

  console.log('');

  for (const sql of indexes) {
    const indexName = sql.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
    try {
      db.run(sql);
      console.log(`  ✅ Index: ${indexName}`);
    } catch (err) {
      console.error(`  ❌ Index: ${indexName} - ${err.message}`);
    }
  }

  saveDatabase();
  console.log('\n✅ Migration completed successfully!\n');
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
