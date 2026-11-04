const { getDatabase, saveDatabase } = require('./connection');

async function migrateDoctor() {
  console.log('🩺 Migrating Digital Doctor tables and indexes...');
  const db = await getDatabase();

  const tables = [
    // 1. Initial Assessment on Admission (PDF Pages 1-3)
    `CREATE TABLE IF NOT EXISTS doctor_initial_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      assessment_date TEXT NOT NULL,
      assessment_time TEXT NOT NULL,
      department TEXT,
      admitting_consultant TEXT,
      allergies_json TEXT DEFAULT '{}',
      chief_complaints TEXT,
      past_history_illness TEXT,
      personal_history_habits TEXT,
      occupational_history TEXT,
      diet TEXT,
      physical_activity TEXT,
      habit_history_json TEXT DEFAULT '{}',
      past_medical_history_json TEXT DEFAULT '{}',
      past_medical_others TEXT,
      obstetrics_gynaecology_json TEXT DEFAULT '{}',
      pertinent_family_history TEXT,
      medication_reconciliation_json TEXT DEFAULT '[]',
      general_exam_json TEXT DEFAULT '{}',
      systemic_exam_json TEXT DEFAULT '{}',
      provisional_diagnosis TEXT,
      investigations_advised TEXT,
      plan_of_treatment TEXT,
      significant_weight_loss TEXT,
      diet_instructions TEXT,
      wells_dvt_json TEXT DEFAULT '{}',
      informant_declaration_json TEXT DEFAULT '{}',
      consultant_name TEXT,
      medical_officer_name TEXT,
      status TEXT DEFAULT 'Completed',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    // 2. Attending Consultant's Notes / Progress Notes (PDF Page 4)
    `CREATE TABLE IF NOT EXISTS doctor_progress_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      note_date TEXT NOT NULL,
      note_time TEXT NOT NULL,
      particulars TEXT NOT NULL,
      consultant_name TEXT NOT NULL,
      signature TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // 3. Cross Reference / Referral Visit Notes (PDF Pages 5-6)
    `CREATE TABLE IF NOT EXISTS doctor_cross_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      reason_for_cross_reference TEXT NOT NULL,
      cross_reference_type TEXT DEFAULT 'Elective',
      visit_type TEXT DEFAULT 'Consultation Only',
      relatives_informed_date TEXT,
      relatives_informed_time TEXT,
      relatives_informed_by TEXT,
      patient_relative_signature TEXT,
      referring_consultant_name TEXT,
      referring_consultant_signature TEXT,
      ward TEXT,
      informed_on_date TEXT,
      informed_on_time TEXT,
      informed_through TEXT,
      informed_by TEXT,
      referred_consultant_name TEXT,
      referred_consultant_phone TEXT,
      speciality TEXT,
      visit_date TEXT,
      visit_time TEXT,
      referred_doctor_notes TEXT,
      impression TEXT,
      advice TEXT,
      refer_again_status TEXT,
      refer_again_days INTEGER,
      referred_consultant_signature TEXT,
      attending_consultant_signature TEXT,
      follow_up_note TEXT,
      follow_up_date TEXT,
      follow_up_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // 4. Medical Officer Handover Sheet (PDF Page 7)
    `CREATE TABLE IF NOT EXISTS doctor_mo_handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      handover_date TEXT NOT NULL,
      patient_name TEXT,
      diagnosis TEXT,
      morning_shift_notes TEXT,
      evening_shift_notes TEXT,
      night_shift_notes TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // 5. Doctor SBAR Handover (PDF Page 8)
    `CREATE TABLE IF NOT EXISTS doctor_sbar_handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      shift TEXT NOT NULL CHECK(shift IN ('Morning','Evening','Night')),
      handover_date TEXT NOT NULL,
      room_bed_no TEXT,
      current_condition TEXT,
      condition_day_night TEXT,
      primary_diagnosis TEXT,
      procedure_done TEXT,
      investigation_done TEXT,
      comorbid_conditions TEXT,
      collect_reports_of TEXT,
      inform_gc_to_doctor TEXT,
      plan_discharge TEXT,
      given_by_eid TEXT,
      given_by_time TEXT,
      taken_by_eid TEXT,
      taken_by_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // 6. Blood Transfusion & Adverse Reaction (PDF Page 9)
    `CREATE TABLE IF NOT EXISTS doctor_blood_transfusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      transfusion_date TEXT NOT NULL,
      transfusion_time TEXT NOT NULL,
      ip_no TEXT,
      ward TEXT,
      diagnosis TEXT,
      indication TEXT,
      patient_blood_group TEXT,
      history_previous_bt TEXT DEFAULT 'No',
      previous_adverse_reaction_nature TEXT,
      order_component_type TEXT,
      order_units INTEGER,
      order_flow_rate TEXT,
      order_diagnosis TEXT,
      order_indication TEXT,
      consultant_signature TEXT,
      transfusion_number TEXT,
      transfusion_record_date TEXT,
      blood_bag_no TEXT,
      product_blood_group TEXT,
      product_name TEXT,
      compatibility TEXT DEFAULT 'Yes',
      blood_bank_name TEXT,
      expiry_date TEXT,
      blood_checked_by_doctor TEXT,
      doctor_eid TEXT,
      doctor_signature TEXT,
      unit_nurse TEXT,
      bt_started_at TEXT,
      bt_stopped_at TEXT,
      adverse_reaction_flag TEXT DEFAULT 'No Adverse Reaction',
      vitals_flowsheet_json TEXT DEFAULT '[]',
      adverse_reactions_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ];

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_doc_init_patient ON doctor_initial_assessments(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_doc_init_date ON doctor_initial_assessments(assessment_date)',
    'CREATE INDEX IF NOT EXISTS idx_doc_notes_patient ON doctor_progress_notes(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_doc_notes_date ON doctor_progress_notes(note_date)',
    'CREATE INDEX IF NOT EXISTS idx_doc_xref_patient ON doctor_cross_references(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_doc_mo_patient ON doctor_mo_handovers(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_doc_sbar_patient ON doctor_sbar_handovers(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_doc_sbar_date ON doctor_sbar_handovers(handover_date)',
    'CREATE INDEX IF NOT EXISTS idx_doc_bt_patient ON doctor_blood_transfusions(patient_id)'
  ];

  for (const sql of tables) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    db.run(sql);
    console.log(`  ✅ Table ready: ${tableName}`);
  }

  for (const sql of indexes) {
    const indexName = sql.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
    db.run(sql);
    console.log(`  ✅ Index ready: ${indexName}`);
  }

  saveDatabase(true);
  console.log('🩺 Digital Doctor migration completed successfully!');
}

if (require.main === module) {
  migrateDoctor().catch(console.error);
}

module.exports = migrateDoctor;

