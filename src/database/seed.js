/**
 * Database Seed Script for Presco Digital Nursing Platform
 *
 * Populates default admin, categories, all 15 field types,
 * sample patients, demo form with sections and fields, and nursing records.
 */

const bcrypt = require('bcryptjs');
const { getDatabase, saveDatabase, query, queryOne, run } = require('./connection');

async function seed() {
  console.log('\n🌱 Starting Presco database seeding...\n');
  const db = await getDatabase();

  // Helper step runner
  async function runStep(label, fn) {
    try {
      await fn();
      console.log(`  ✔ ${label}`);
    } catch (err) {
      console.error(`  ✖ ${label}: ${err.message}`);
      throw err;
    }
  }

  // 1. Default Hospital
  await runStep('Hospital: Presco Hospital (ASH)', async () => {
    const existing = await queryOne('SELECT id FROM hospitals WHERE id = 1');
    if (!existing) {
      await run(`
        INSERT INTO hospitals (id, name, code, address, phone, is_active)
        VALUES (1, 'Presco Hospital', 'ASH', '123 Medical Center Way, Health City', '+91 79 4000 8000', 1)
      `);
    }
  });

  // 2. Admin & Nurse Users
  await runStep('Admin user: admin / admin123 and nurse1 / nurse123', async () => {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const existingAdmin = await queryOne('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!existingAdmin) {
      await run(`
        INSERT INTO users (username, email, password_hash, role, full_name, hospital_id, is_active)
        VALUES ('admin', 'admin@presco.local', ?, 'admin', 'System Administrator', 1, 1)
      `, [adminHash]);
    } else {
      await run(`UPDATE users SET password_hash = ? WHERE username = 'admin'`, [adminHash]);
    }

    const nurseHash = bcrypt.hashSync('nurse123', 10);
    const existingNurse = await queryOne('SELECT id FROM users WHERE username = ?', ['nurse1']);
    if (!existingNurse) {
      await run(`
        INSERT INTO users (username, email, password_hash, role, full_name, hospital_id, is_active)
        VALUES ('nurse1', 'nurse1@presco.local', ?, 'nurse', 'Sister Jane Nightingale', 1, 1)
      `, [nurseHash]);
    }
  });

  // 3. Field Categories
  const categoryMap = {};
  await runStep('Field categories (6 categories)', async () => {
    const categories = [
      { name: 'Personal Information', slug: 'personal-information', description: 'Patient demographic and personal identity details', sort_order: 1 },
      { name: 'Medical History',      slug: 'medical-history',      description: 'Past medical history, allergies, and surgical conditions', sort_order: 2 },
      { name: 'Vital Signs',          slug: 'vital-signs',          description: 'Physiological vitals and bedside clinical measurements',   sort_order: 3 },
      { name: 'Clinical Assessment',  slug: 'clinical-assessment',  description: 'GCS, Morse Fall, Braden Scale, and neurological checks',  sort_order: 4 },
      { name: 'Contact & Address',    slug: 'contact-address',      description: 'Primary and emergency contact information',                sort_order: 5 },
      { name: 'Nursing Procedures',   slug: 'nursing-procedures',   description: 'Care interventions, lines, drains, and nursing actions',   sort_order: 6 }
    ];

    for (const cat of categories) {
      const existing = await queryOne('SELECT id FROM field_categories WHERE slug = ?', [cat.slug]);
      if (!existing) {
        const res = await run(`
          INSERT INTO field_categories (name, slug, description, sort_order, is_active)
          VALUES (?, ?, ?, ?, 1)
        `, [cat.name, cat.slug, cat.description, cat.sort_order]);
        categoryMap[cat.slug] = res.lastInsertRowid;
      } else {
        categoryMap[cat.slug] = existing.id;
      }
    }
  });

  // 4. All 15 Field Types Seeded in Fields Master
  await runStep('All 15 Field Types in Fields Master', async () => {
    const fields = [
      // 1. TEXT
      {
        name: 'first_name', label: 'First Name', description: 'Patient legal first name',
        field_type: 'text', is_required: 1, placeholder: 'e.g. Jagdishbhai',
        min_length: 1, max_length: 80, category_id: categoryMap['personal-information']
      },
      {
        name: 'last_name', label: 'Last Name', description: 'Patient surname',
        field_type: 'text', is_required: 1, placeholder: 'e.g. Ahuja',
        min_length: 1, max_length: 80, category_id: categoryMap['personal-information']
      },
      {
        name: 'blood_pressure', label: 'Blood Pressure', description: 'Systolic/Diastolic blood pressure reading',
        field_type: 'text', is_required: 0, placeholder: '120/80',
        validation_rules: JSON.stringify({ pattern: '^\\d{2,3}/\\d{2,3}$' }),
        error_messages: JSON.stringify({ pattern: 'Format must be like 120/80' }),
        category_id: categoryMap['vital-signs']
      },

      // 2. TEXTAREA
      {
        name: 'chief_complaints', label: 'Chief Complaints', description: 'Primary symptoms and reasons for admission',
        field_type: 'textarea', is_required: 1, placeholder: 'Describe presenting symptoms, onset and severity...',
        max_length: 1000, category_id: categoryMap['clinical-assessment']
      },
      {
        name: 'address', label: 'Residential Address', description: 'Permanent residential address',
        field_type: 'textarea', is_required: 0, placeholder: 'Enter street, building, city, postal code',
        max_length: 500, category_id: categoryMap['contact-address']
      },

      // 3. NUMBER
      {
        name: 'temp_f', label: 'Body Temperature (°F)', description: 'Oral or axillary temperature in Fahrenheit',
        field_type: 'number', is_required: 0, placeholder: '98.6',
        min_value: 90.0, max_value: 110.0, category_id: categoryMap['vital-signs']
      },
      {
        name: 'pulse_bpm', label: 'Pulse Rate (BPM)', description: 'Radial or apical pulse rate per minute',
        field_type: 'number', is_required: 0, placeholder: '72',
        min_value: 30, max_value: 240, category_id: categoryMap['vital-signs']
      },
      {
        name: 'respiratory_rate', label: 'Respiratory Rate (/min)', description: 'Breaths per minute',
        field_type: 'number', is_required: 0, placeholder: '16',
        min_value: 8, max_value: 60, category_id: categoryMap['vital-signs']
      },
      {
        name: 'spo2_percent', label: 'Oxygen Saturation SpO₂ (%)', description: 'Pulse oximeter saturation percentage',
        field_type: 'number', is_required: 0, placeholder: '98',
        min_value: 50, max_value: 100, category_id: categoryMap['vital-signs']
      },
      {
        name: 'pain_score', label: 'Pain Score (VAS 0-10)', description: 'Visual Analogue Scale score from 0 (no pain) to 10 (worst)',
        field_type: 'number', is_required: 0, placeholder: '0', default_value: '0',
        min_value: 0, max_value: 10, category_id: categoryMap['clinical-assessment']
      },
      {
        name: 'weight_kg', label: 'Weight (kg)', description: 'Body weight in kilograms',
        field_type: 'number', is_required: 0, placeholder: '70.5',
        min_value: 1.0, max_value: 350.0, category_id: categoryMap['vital-signs']
      },

      // 4. EMAIL
      {
        name: 'email_address', label: 'Email Address', description: 'Patient or guardian notification email',
        field_type: 'email', is_required: 0, placeholder: 'patient@example.com',
        validation_rules: JSON.stringify({ pattern: '^[^@]+@[^@]+\\.[^@]+$' }),
        error_messages: JSON.stringify({ pattern: 'Please enter a valid email address' }),
        category_id: categoryMap['contact-address']
      },

      // 5. PHONE
      {
        name: 'phone_number', label: 'Contact Phone Number', description: 'Mobile or emergency contact number',
        field_type: 'phone', is_required: 1, placeholder: '+91 98765 43210',
        min_length: 10, max_length: 15, category_id: categoryMap['contact-address']
      },

      // 6. DATE
      {
        name: 'date_of_birth', label: 'Date of Birth', description: 'Date of birth for age calculation',
        field_type: 'date', is_required: 1, category_id: categoryMap['personal-information']
      },
      {
        name: 'admission_date', label: 'Admission Date', description: 'Hospital admission date',
        field_type: 'date', is_required: 1, category_id: categoryMap['personal-information']
      },

      // 7. TIME
      {
        name: 'assessment_time', label: 'Assessment Time', description: 'Time when observation was conducted',
        field_type: 'time', is_required: 1, category_id: categoryMap['clinical-assessment']
      },

      // 8. DATETIME
      {
        name: 'procedure_datetime', label: 'Scheduled Procedure Time', description: 'Scheduled date and time of OT or investigation',
        field_type: 'datetime', is_required: 0, category_id: categoryMap['nursing-procedures']
      },

      // 9. DROPDOWN
      {
        name: 'blood_group', label: 'Blood Group', description: 'ABO and Rh blood group',
        field_type: 'dropdown', is_required: 0,
        options: JSON.stringify([
          { label: 'A Positive (A+)', value: 'A+' },
          { label: 'A Negative (A-)', value: 'A-' },
          { label: 'B Positive (B+)', value: 'B+' },
          { label: 'B Negative (B-)', value: 'B-' },
          { label: 'AB Positive (AB+)', value: 'AB+' },
          { label: 'AB Negative (AB-)', value: 'AB-' },
          { label: 'O Positive (O+)', value: 'O+' },
          { label: 'O Negative (O-)', value: 'O-' },
          { label: 'Unknown', value: 'Unknown' }
        ]),
        category_id: categoryMap['medical-history']
      },
      {
        name: 'consciousness_level', label: 'Level of Consciousness (AVPU)', description: 'AVPU neurological responsiveness scale',
        field_type: 'dropdown', is_required: 1, default_value: 'Alert',
        options: JSON.stringify([
          { label: 'Alert (A)', value: 'Alert' },
          { label: 'Verbal Response (V)', value: 'Verbal' },
          { label: 'Pain Response (P)', value: 'Pain' },
          { label: 'Unresponsive (U)', value: 'Unresponsive' },
          { label: 'Sedated', value: 'Sedated' },
          { label: 'Confused', value: 'Confused' }
        ]),
        category_id: categoryMap['clinical-assessment']
      },

      // 10. RADIO
      {
        name: 'gender', label: 'Gender', description: 'Biological gender',
        field_type: 'radio', is_required: 1,
        options: JSON.stringify([
          { label: 'Male', value: 'Male' },
          { label: 'Female', value: 'Female' },
          { label: 'Other', value: 'Other' }
        ]),
        category_id: categoryMap['personal-information']
      },
      {
        name: 'triage_category', label: 'Triage Priority', description: 'Emergency triage color category',
        field_type: 'radio', is_required: 0,
        options: JSON.stringify([
          { label: 'Red (Immediate)', value: 'Red' },
          { label: 'Yellow (Urgent)', value: 'Yellow' },
          { label: 'Green (Non-urgent)', value: 'Green' },
          { label: 'Black (Expectant)', value: 'Black' }
        ]),
        category_id: categoryMap['clinical-assessment']
      },

      // 11. CHECKBOX
      {
        name: 'chronic_conditions', label: 'Pre-existing Conditions', description: 'Known comorbidities',
        field_type: 'checkbox', is_required: 0,
        options: JSON.stringify([
          { label: 'Diabetes Mellitus', value: 'diabetes' },
          { label: 'Hypertension', value: 'hypertension' },
          { label: 'COPD / Asthma', value: 'copd' },
          { label: 'Ischemic Heart Disease', value: 'ihd' },
          { label: 'Chronic Kidney Disease', value: 'ckd' },
          { label: 'Liver Cirrhosis', value: 'liver_disease' }
        ]),
        category_id: categoryMap['medical-history']
      },

      // 12. MULTISELECT
      {
        name: 'known_allergies', label: 'Known Drug & Food Allergies', description: 'Documented patient allergies',
        field_type: 'multiselect', is_required: 0,
        options: JSON.stringify([
          { label: 'No Known Drug Allergies (NKDA)', value: 'NKDA' },
          { label: 'Penicillin / Beta-lactams', value: 'penicillin' },
          { label: 'Sulfa Drugs', value: 'sulfa' },
          { label: 'NSAIDs / Aspirin', value: 'nsaid' },
          { label: 'Latex', value: 'latex' },
          { label: 'Iodinated Contrast', value: 'contrast' },
          { label: 'Peanuts / Shellfish', value: 'food' }
        ]),
        category_id: categoryMap['medical-history']
      },

      // 13. FILE
      {
        name: 'diagnostic_reports', label: 'Diagnostic Lab / Radiology Reports', description: 'PDF or scanned document attachments',
        field_type: 'file', is_required: 0, category_id: categoryMap['medical-history']
      },

      // 14. IMAGE
      {
        name: 'patient_photo', label: 'Patient Photograph', description: 'Headshot photograph for IPD identity badge',
        field_type: 'image', is_required: 0, category_id: categoryMap['personal-information']
      },
      {
        name: 'nurse_signature', label: 'Nurse Signature Canvas', description: 'Digital signature capture image',
        field_type: 'image', is_required: 0, category_id: categoryMap['nursing-procedures']
      },

      // 15. BOOLEAN
      {
        name: 'is_ambulatory', label: 'Is Patient Ambulatory?', description: 'Indicates if patient can walk without staff assistance',
        field_type: 'boolean', is_required: 0, default_value: 'true', category_id: categoryMap['clinical-assessment']
      },
      {
        name: 'fall_risk_flag', label: 'High Fall Risk Identified?', description: 'Flag for bedrails up and yellow wristband placement',
        field_type: 'boolean', is_required: 0, default_value: 'false', category_id: categoryMap['clinical-assessment']
      }
    ];

    for (const f of fields) {
      const existing = await queryOne('SELECT id FROM fields WHERE name = ?', [f.name]);
      if (!existing) {
        await run(`
          INSERT INTO fields (
            name, label, description, field_type, is_required, default_value, placeholder,
            validation_rules, error_messages, min_value, max_value, min_length, max_length,
            options, category_id, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          f.name, f.label, f.description, f.field_type, f.is_required || 0, f.default_value || null,
          f.placeholder || null, f.validation_rules || '{}', f.error_messages || '{}',
          f.min_value ?? null, f.max_value ?? null, f.min_length ?? null, f.max_length ?? null,
          f.options || '[]', f.category_id || null
        ]);
      }
    }
  });

  // 5. Sample Patients
  await runStep('Sample Patients (JAGDISHBHAI AHUJA AS6767 & Rajesh Kumar)', async () => {
    const p1 = await queryOne('SELECT id FROM patients WHERE uhid = ?', ['AS6767']);
    if (!p1) {
      await run(`
        INSERT INTO patients (
          id, uhid, ipd_number, full_name, age, gender, date_of_birth,
          admission_date, hospital_id, consultant_id, ward, bed_number,
          diagnosis, is_active
        ) VALUES (
          3177250, 'AS6767', 'IP/2026-2027/1619', 'JAGDISHBHAI AHUJA', '42 Y, 2 M, 12 D', 'Male', '1984-08-20',
          '2026-10-30', 431, 90259, 'ICU Ward A', 'ICU-04',
          'Acute Exacerbation of COPD with Type 2 Respiratory Failure', 1
        )
      `);
    }

    const p2 = await queryOne('SELECT id FROM patients WHERE uhid = ?', ['UHID-0001']);
    if (!p2) {
      await run(`
        INSERT INTO patients (
          uhid, ipd_number, full_name, age, gender, date_of_birth,
          admission_date, hospital_id, consultant_id, ward, bed_number,
          diagnosis, is_active
        ) VALUES (
          'UHID-0001', 'IPD-2024-0001', 'Rajesh Kumar', '45 Y', 'Male', '1979-05-15',
          '2026-11-01', 1, 90259, 'General Ward 2', 'GW-12',
          'Post-operative Appendectomy Day 2', 1
        )
      `);
    }
  });

  // 6. Sample Medicines Master for eMAR
  await runStep('Sample Medicines for eMAR', async () => {
    const meds = [
      { name: 'Inj. Ceftriaxone 1g IV', category: 'Antibiotic', dose: '1g', route: 'IV', frequency: 'BD (Twice daily)' },
      { name: 'Tab. Paracetamol 650mg PO', category: 'Antipyretic / Analgesic', dose: '650mg', route: 'Oral', frequency: 'TDS (Thrice daily)' },
      { name: 'Inj. Pantoprazole 40mg IV', category: 'Proton Pump Inhibitor', dose: '40mg', route: 'IV', frequency: 'OD (Once daily)' },
      { name: 'Inj. Ondansetron 4mg IV', category: 'Antiemetic', dose: '4mg', route: 'IV', frequency: 'SOS (As needed)' },
      { name: 'Inj. Tramadol 50mg in 100ml NS', category: 'Analgesic', dose: '50mg', route: 'IV Infusion', frequency: 'BD' },
      { name: 'Inj. Regular Human Insulin', category: 'Antidiabetic', dose: '6 Units', route: 'Subcutaneous', frequency: 'Before meals' },
      { name: 'Inj. Furosemide 20mg IV', category: 'Diuretic', dose: '20mg', route: 'IV', frequency: 'OD' },
      { name: 'Tab. Atorvastatin 20mg PO', category: 'Statin', dose: '20mg', route: 'Oral', frequency: 'HS (Night)' },
      { name: 'Inj. Enoxaparin 40mg SC', category: 'Anticoagulant', dose: '40mg', route: 'Subcutaneous', frequency: 'OD' },
      { name: 'Neb. Budecort 0.5mg + Levolin', category: 'Respiratory', dose: '1 respule', route: 'Nebulization', frequency: 'Q8H (8 hourly)' }
    ];

    for (const m of meds) {
      const existing = await queryOne('SELECT id FROM medicines WHERE name = ?', [m.name]);
      if (!existing) {
        await run(`
          INSERT INTO medicines (name, category, dose, route, frequency)
          VALUES (?, ?, ?, ?, ?)
        `, [m.name, m.category, m.dose, m.route, m.frequency]);
      }
    }
  });

  // 7. Seed Sample Dynamic Form with Sections & Fields
  await runStep('Dynamic Form: Inpatient Nursing Assessment & Admission', async () => {
    let form = await queryOne('SELECT id FROM forms WHERE slug = ?', ['inpatient-initial-assessment']);
    if (!form) {
      const res = await run(`
        INSERT INTO forms (
          name, slug, description, category, status, version, settings, created_by, published_at
        ) VALUES (
          'Inpatient Initial Assessment Form',
          'inpatient-initial-assessment',
          'Comprehensive initial nursing assessment and admission intake form for IPD patients.',
          'Nursing Assessment',
          'published',
          1,
          '{"allow_drafts":true,"theme":"teal","require_signature":true}',
          1,
          datetime('now')
        )
      `);
      const formId = res.lastInsertRowid;

      // Section 1: Demographics (2 columns)
      const sec1 = await run(`
        INSERT INTO form_sections (form_id, title, description, sort_order, columns)
        VALUES (?, 'Patient Demographics & Personal Details', 'Basic patient identity details', 1, 2)
      `, [formId]);

      // Section 2: Vitals (3 columns)
      const sec2 = await run(`
        INSERT INTO form_sections (form_id, title, description, sort_order, columns)
        VALUES (?, 'Bedside Vital Signs', 'Immediate measured physiological vitals', 2, 3)
      `, [formId]);

      // Section 3: Clinical Assessment (2 columns)
      const sec3 = await run(`
        INSERT INTO form_sections (form_id, title, description, sort_order, columns)
        VALUES (?, 'Clinical Assessment & Triage', 'Patient orientation, chief complaints, and fall risk', 3, 2)
      `, [formId]);

      // Attach fields
      const fNames = [
        { name: 'first_name', sec: sec1.lastInsertRowid, order: 1, span: 1 },
        { name: 'last_name', sec: sec1.lastInsertRowid, order: 2, span: 1 },
        { name: 'gender', sec: sec1.lastInsertRowid, order: 3, span: 1 },
        { name: 'date_of_birth', sec: sec1.lastInsertRowid, order: 4, span: 1 },
        { name: 'phone_number', sec: sec1.lastInsertRowid, order: 5, span: 1 },
        { name: 'blood_group', sec: sec1.lastInsertRowid, order: 6, span: 1 },

        { name: 'temp_f', sec: sec2.lastInsertRowid, order: 1, span: 1 },
        { name: 'pulse_bpm', sec: sec2.lastInsertRowid, order: 2, span: 1 },
        { name: 'blood_pressure', sec: sec2.lastInsertRowid, order: 3, span: 1 },
        { name: 'respiratory_rate', sec: sec2.lastInsertRowid, order: 4, span: 1 },
        { name: 'spo2_percent', sec: sec2.lastInsertRowid, order: 5, span: 1 },
        { name: 'pain_score', sec: sec2.lastInsertRowid, order: 6, span: 1 },

        { name: 'consciousness_level', sec: sec3.lastInsertRowid, order: 1, span: 1 },
        { name: 'triage_category', sec: sec3.lastInsertRowid, order: 2, span: 1 },
        { name: 'chief_complaints', sec: sec3.lastInsertRowid, order: 3, span: 2 },
        { name: 'known_allergies', sec: sec3.lastInsertRowid, order: 4, span: 2 },
        { name: 'is_ambulatory', sec: sec3.lastInsertRowid, order: 5, span: 1 },
        { name: 'fall_risk_flag', sec: sec3.lastInsertRowid, order: 6, span: 1 }
      ];

      for (const item of fNames) {
        const fieldRow = await queryOne('SELECT id FROM fields WHERE name = ?', [item.name]);
        if (fieldRow) {
          await run(`
            INSERT INTO form_fields (form_id, field_id, section_id, sort_order, column_span, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
          `, [formId, fieldRow.id, item.sec, item.order, item.span]);
        }
      }

      // Snapshot version 1
      await run(`
        INSERT INTO form_versions (form_id, version_number, snapshot, published_at)
        VALUES (?, 1, '{"version":1,"sections":3,"fields":18}', datetime('now'))
      `, [formId]);
    }
  });

  // 8. Seed Sample Digital Nursing Clinical Records for Patient 3177250
  await runStep('Sample Clinical Nursing Data for Jagdishbhai Ahuja', async () => {
    const today = new Date().toISOString().substring(0, 10);

    // Initial Assessment
    const existingAssess = await queryOne('SELECT id FROM nursing_assessments WHERE patient_id = 3177250');
    if (!existingAssess) {
      await run(`
        INSERT INTO nursing_assessments (
          patient_id, hospital_id, assessment_type, assessment_date, assessment_time,
          shift, nurse_name, temp_f, pulse_bpm, bp_sys, bp_dia, spo2, rr, weight_kg,
          pain_score, fall_risk_score, fall_risk_level, notes, interventions,
          meta_json, form_status
        ) VALUES (
          3177250, 431, 'initial', ?, '08:30',
          'Morning', 'Sister Jane Nightingale', 98.4, 88, 134, 86, 96, 20, 68.5,
          2, 35, 'Medium', 'Patient admitted with breathlessness, wheezing and dry cough.',
          'Oxygen support 2L/min via nasal prongs started, IV line maintained.',
          '{"consciousness":"Alert","rbs":142,"fall_action":"Side rails up, call bell within reach"}',
          'Completed'
        )
      `, [today]);
    }

    // Vitals
    const existingVitals = await queryOne('SELECT id FROM nursing_vitals WHERE patient_id = 3177250');
    if (!existingVitals) {
      await run(`
        INSERT INTO nursing_vitals (
          patient_id, hospital_id, vital_date, vital_time, shift,
          temp_f, pulse_bpm, bp_sys, bp_dia, spo2, rr, pain_score, blood_sugar,
          recorded_by, notes
        ) VALUES (
          3177250, 431, ?, '10:00', 'Morning',
          98.6, 82, 130, 82, 97, 18, 1, 138,
          'Sister Jane Nightingale', 'Patient resting comfortably. Wheezing decreased.'
        )
      `, [today]);
    }

    // eMAR Order & Administration
    const existingEmar = await queryOne('SELECT id FROM nursing_emar WHERE patient_id = 3177250');
    if (!existingEmar) {
      const resEmar = await run(`
        INSERT INTO nursing_emar (
          patient_id, hospital_id, medication_name, dose, route, frequency,
          start_date, end_date, status
        ) VALUES (
          3177250, 431, 'Inj. Ceftriaxone', '1g', 'IV', 'BD',
          ?, '2026-11-08', 'Active'
        )
      `, [today]);

      await run(`
        INSERT INTO nursing_emar_admins (
          emar_id, patient_id, hospital_id, scheduled_at, administered_at,
          status, administered_by_name, reason
        ) VALUES (
          ?, 3177250, 431, ? || ' 09:00', ? || ' 09:10',
          'Given', 'Sister Jane Nightingale', 'Morning dose administered via peripheral line'
        )
      `, [resEmar.lastInsertRowid, today, today]);
    }

    // I/O Chart
    const existingIo = await queryOne('SELECT id FROM nursing_io WHERE patient_id = 3177250');
    if (!existingIo) {
      await run(`
        INSERT INTO nursing_io (
          patient_id, hospital_id, io_date, io_time, shift,
          intake_type, intake_item, intake_amount_ml,
          output_type, output_item, output_amount_ml,
          remarks, recorded_by
        ) VALUES (
          3177250, 431, ?, '09:30', 'Morning',
          'IV Fluids', 'Normal Saline 0.9%', 500,
          'Urine', 'Clear Amber', 350,
          'Intake output balance maintained', 'Sister Jane'
        )
      `, [today]);
    }

    // Progress Notes
    const existingNotes = await queryOne('SELECT id FROM nursing_notes WHERE patient_id = 3177250');
    if (!existingNotes) {
      await run(`
        INSERT INTO nursing_notes (
          patient_id, hospital_id, note_date, note_time, shift,
          note_type, notes, nurse_name
        ) VALUES (
          3177250, 431, ?, '11:00', 'Morning',
          'Nursing Care', 'Patient attended by Dr. Narendra Shanghavi. Nebulization given on schedule. Patient oriented and communicative.',
          'Sister Jane Nightingale'
        )
      `, [today]);
    }

    // Diabetic Flow Record
    const existingDiabetic = await queryOne('SELECT id FROM nursing_diabetic WHERE patient_id = 3177250');
    if (!existingDiabetic) {
      await run(`
        INSERT INTO nursing_diabetic (
          patient_id, hospital_id, record_date, record_time, glucose_value,
          test_type, insulin_type, insulin_dose, remarks, recorded_by
        ) VALUES (
          3177250, 431, ?, '07:30', 142.0,
          'Fasting', 'Regular Human Insulin', '4 Units', 'Pre-breakfast reading', 'Sister Jane'
        )
      `, [today]);
    }
  });

  saveDatabase();
  console.log('\n─'.repeat(50));
  console.log('  ✅ Database seeding completed successfully!');
  console.log('─'.repeat(50));

  // Print Summary counts
  const usersCount = (await queryOne('SELECT COUNT(*) AS c FROM users')).c;
  const hospitalsCount = (await queryOne('SELECT COUNT(*) AS c FROM hospitals')).c;
  const categoriesCount = (await queryOne('SELECT COUNT(*) AS c FROM field_categories')).c;
  const fieldsCount = (await queryOne('SELECT COUNT(*) AS c FROM fields')).c;
  const formsCount = (await queryOne('SELECT COUNT(*) AS c FROM forms')).c;
  const patientsCount = (await queryOne('SELECT COUNT(*) AS c FROM patients')).c;
  const assessmentsCount = (await queryOne('SELECT COUNT(*) AS c FROM nursing_assessments')).c;

  console.log(`
  📊 Record Counts:
     Users: ${usersCount}
     Hospitals: ${hospitalsCount}
     Field Categories: ${categoriesCount}
     Fields (All 15 Types): ${fieldsCount}
     Dynamic Forms: ${formsCount}
     Patients: ${patientsCount}
     Nursing Assessments: ${assessmentsCount}
  `);
}

if (require.main === module) {
  seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
