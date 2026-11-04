const { getDatabase, saveDatabase, run, queryOne } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

const demoPatients = [
  {
    uhid: '00012345',
    ipd_number: 'IPD-9876',
    full_name: 'Mr. IQBAL IBRAHIM KUKDA',
    age: '54 Y',
    gender: 'Male',
    ward: 'General Ward',
    bed_number: 'GW-12',
    diagnosis: 'Acute gastroenteritis with severe dehydration',
    admission_date: '2026-11-01',
    hospital_id: 1,
    consultant_id: 90259
  },
  {
    uhid: '00012346',
    ipd_number: 'IPD-9881',
    full_name: 'Mrs. PRIYA SHARMA',
    age: '37 Y',
    gender: 'Female',
    ward: 'ICU',
    bed_number: 'ICU-03',
    diagnosis: 'Post-operative Observation & Critical Monitoring',
    admission_date: '2026-11-02',
    hospital_id: 1,
    consultant_id: 90259
  },
  {
    uhid: '00012347',
    ipd_number: 'IPD-9882',
    full_name: 'Mr. RAJESH KUMAR PATEL',
    age: '61 Y',
    gender: 'Male',
    ward: 'Surgical Ward',
    bed_number: 'SW-08',
    diagnosis: 'Acute Appendicitis - Post Laparoscopic Appendectomy',
    admission_date: '2026-11-01',
    hospital_id: 1,
    consultant_id: 90259
  },
  {
    uhid: '00012348',
    ipd_number: 'IPD-9885',
    full_name: 'Ms. ANJALI VERMA',
    age: '29 Y',
    gender: 'Female',
    ward: 'Maternity Ward',
    bed_number: 'MW-02',
    diagnosis: 'Full-term Pregnancy - Normal Delivery Post-natal Care',
    admission_date: '2026-11-03',
    hospital_id: 1,
    consultant_id: 90259
  },
  {
    uhid: '00012349',
    ipd_number: 'IPD-9890',
    full_name: 'Mr. MOHAMMED FAROOQ',
    age: '45 Y',
    gender: 'Male',
    ward: 'General Ward',
    bed_number: 'GW-15',
    diagnosis: 'Unstable Angina & Acute Coronary Syndrome',
    admission_date: '2026-11-02',
    hospital_id: 1,
    consultant_id: 90259
  },
  {
    uhid: '00012350',
    ipd_number: 'IPD-9892',
    full_name: 'Mrs. SUNITA DESAI',
    age: '52 Y',
    gender: 'Female',
    ward: 'Cardiac Care Unit',
    bed_number: 'CW-04',
    diagnosis: 'CAD Evaluation - Triple Vessel Disease Post Angiography',
    admission_date: '2026-11-01',
    hospital_id: 1,
    consultant_id: 90259
  },
  {
    uhid: '00012351',
    ipd_number: 'IPD-9895',
    full_name: 'Mr. VIKRAM SINGH',
    age: '38 Y',
    gender: 'Male',
    ward: 'Orthopedic Ward',
    bed_number: 'OW-11',
    diagnosis: 'Femur Shaft Fracture - Closed Reduction & Internal Fixation',
    admission_date: '2026-10-31',
    hospital_id: 1,
    consultant_id: 90259
  },
  {
    uhid: '00012352',
    ipd_number: 'IPD-9897',
    full_name: 'Master ARJUN MEHTA',
    age: '9 Y',
    gender: 'Male',
    ward: 'Pediatric Ward',
    bed_number: 'PW-06',
    diagnosis: 'Dengue Fever with Thrombocytopenia under monitoring',
    admission_date: '2026-11-03',
    hospital_id: 1,
    consultant_id: 90259
  }
];

async function seedDemoPatients() {
  console.log('Inserting demo patients...');
  await getDatabase();

  for (const pt of demoPatients) {
    const existing = await queryOne('SELECT id FROM patients WHERE uhid = ? OR ipd_number = ?', [pt.uhid, pt.ipd_number]);
    if (!existing) {
      await run(`
        INSERT INTO patients (uhid, ipd_number, full_name, age, gender, admission_date, hospital_id, consultant_id, ward, bed_number, diagnosis, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        pt.uhid,
        pt.ipd_number,
        pt.full_name,
        pt.age,
        pt.gender,
        pt.admission_date,
        pt.hospital_id,
        pt.consultant_id,
        pt.ward,
        pt.bed_number,
        pt.diagnosis
      ]);
      console.log(`+ Added patient: ${pt.full_name} (${pt.uhid})`);
    } else {
      console.log(`- Patient already exists: ${pt.full_name}`);
    }
  }

  saveDatabase(true);

  // Sync back to data/presco.db if needed and update defaultDb.js
  const dbPath = path.join(__dirname, '../data/presco.db');
  const db = await getDatabase();
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('Saved data/presco.db successfully');

  // Update defaultDb.js
  const b64 = Buffer.from(data).toString('base64');
  fs.writeFileSync(path.join(__dirname, '../src/database/defaultDb.js'), 'module.exports = ' + JSON.stringify(b64) + ';\n');
  console.log('Updated src/database/defaultDb.js with new demo patients');
}

seedDemoPatients().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

