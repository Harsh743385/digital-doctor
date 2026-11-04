const { query, queryOne, run } = require('./connection');

async function seedDoctor() {
  console.log('🌱 Seeding Digital Doctor clinical records (Anand Surgical Hospital)...');

  const existing = await queryOne('SELECT id FROM doctor_initial_assessments WHERE patient_id = 3177250');
  if (!existing) {
    const allergies = {
      blood_transfusion: false,
      drug: true,
      food: false,
      not_known: false,
      others: true,
      others_detail: 'Penicillin (mild rash)'
    };

    const habit_history = {
      cig: { opt: 'No', since: '', freq: '', quit: '' },
      tob: { opt: 'Yes', since: '10 years', freq: '3 times/day', quit: '6 months ago' },
      alc: { opt: 'No', since: '', freq: '', quit: '' },
      drg: { opt: 'No', since: '', freq: '', quit: '' }
    };

    const past_medical_history = {
      htn: { opt: 'Yes', since: '5 years', th: 'Tab Amlodipine 5mg OD' },
      dm:  { opt: 'No', since: '', th: '' },
      cad: { opt: 'No', since: '', th: '' },
      copd:{ opt: 'No', since: '', th: '' },
      tb:  { opt: 'No', since: '', th: '' },
      ca:  { opt: 'No', since: '', th: '' }
    };

    const general_exam = {
      spo2: '98',
      temp: '98.6',
      pulse: '76',
      bp: '128/82',
      rr: '18',
      weight: '72',
      height: '172',
      bmi: '24.3',
      pain_score: 2,
      pain_location: 'Right iliac fossa',
      ankle_oedema: 'No',
      emaciated: 'No',
      jaundice: 'No'
    };

    const systemic_exam = {
      cvs:  { nad: true, findings: 'S1 S2 heard, regular rhythm' },
      resp: { nad: true, findings: 'Bilateral vesicular breath sounds, no rales' },
      cns:  { nad: true, findings: 'Conscious, oriented to time, place and person' },
      gi:   { nad: false, findings: 'Tenderness over right lower quadrant, no guarding' },
      gu:   { nad: true, findings: 'Normal external genitalia' }
    };

    const wells_dvt = {
      active_cancer: false,
      paralysis: false,
      bedridden: false,
      tenderness: false,
      entire_leg_swollen: false,
      calf_swelling: false,
      pitting_oedema: false,
      superficial_veins: false,
      prev_dvt: false,
      alt_diagnosis: true, // -2
      total_score: -2
    };

    const informant_declaration = {
      name: 'Jagdishbhai Ahuja',
      relation: 'Self'
    };

    await run(`
      INSERT INTO doctor_initial_assessments (
        patient_id, hospital_id, assessment_date, assessment_time, department, admitting_consultant,
        allergies_json, chief_complaints, past_history_illness, personal_history_habits,
        occupational_history, diet, physical_activity, habit_history_json,
        past_medical_history_json, past_medical_others, general_exam_json,
        systemic_exam_json, provisional_diagnosis, investigations_advised,
        plan_of_treatment, significant_weight_loss, diet_instructions,
        wells_dvt_json, informant_declaration_json, consultant_name, medical_officer_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      3177250, 431, '2026-11-04', '08:30', 'General Surgery', 'Dr. Sanghavi',
      JSON.stringify(allergies),
      'Pain in right lower abdomen since 2 days, associated with nausea and low grade fever.',
      'No past history of major medical illness or previous surgeries.',
      'Non-smoker, occasional tobacco chewing.',
      'Businessman / Desk work',
      'Normal Vegetarian Diet',
      'Sedentary to moderate',
      JSON.stringify(habit_history),
      JSON.stringify(past_medical_history),
      'None',
      JSON.stringify(general_exam),
      JSON.stringify(systemic_exam),
      'Acute Appendicitis',
      'Complete Blood Count, Serum Creatinine, USG Abdomen & Pelvis, Chest X-Ray PA',
      'Admit to ICU/Ward A, IV Fluids DNS 100 ml/hr, IV Antibiotics, Pre-op surgical workup for Laparoscopic Appendectomy.',
      'No significant weight loss reported',
      'NPO (Nil per Oral) from 12 midnight for elective surgery',
      JSON.stringify(wells_dvt),
      JSON.stringify(informant_declaration),
      'Dr. Sanghavi, M.S.',
      'Dr. Patel (Resident Medical Officer)'
    ]);
    console.log('  ✅ Seeded Doctor Initial Assessment (Pages 1-3)');
  }

  // Seed Consultant Progress Note (Page 4)
  const existingNote = await queryOne('SELECT id FROM doctor_progress_notes WHERE patient_id = 3177250');
  if (!existingNote) {
    await run(`
      INSERT INTO doctor_progress_notes (patient_id, hospital_id, note_date, note_time, particulars, consultant_name, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      3177250, 431, '2026-11-04', '09:15',
      'Morning Consultant Rounds:\nPatient examined. Abdomen soft, tenderness localized to RIF. Vitals stable. CBC shows leukocytosis (TLC 13,800). USG confirms inflamed appendix (diameter 8.2mm). Plan for Laparoscopic Appendectomy at 2:00 PM today. Consent taken. Pre-anesthetic check done.',
      'Dr. Sanghavi',
      'Dr. Sanghavi, M.S.'
    ]);
    console.log('  ✅ Seeded Consultant Progress Note (Page 4)');
  }

  // Seed Cross Reference (Pages 5-6)
  const existingXref = await queryOne('SELECT id FROM doctor_cross_references WHERE patient_id = 3177250');
  if (!existingXref) {
    await run(`
      INSERT INTO doctor_cross_references (
        patient_id, hospital_id, reason_for_cross_reference, cross_reference_type, visit_type,
        relatives_informed_date, relatives_informed_time, relatives_informed_by,
        referring_consultant_name, ward, informed_on_date, informed_on_time, informed_through,
        referred_consultant_name, speciality, visit_date, visit_time,
        referred_doctor_notes, impression, advice, refer_again_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      3177250, 431,
      'Pre-operative cardiac risk clearance and blood pressure optimization before laparoscopic surgery.',
      'Elective', 'Consultation Only',
      '2026-11-04', '09:30', 'Dr. Sanghavi',
      'Dr. Sanghavi', 'ICU Ward A', '2026-11-04', '09:45', 'Phone',
      'Dr. K. Mehta', 'Cardiology', '2026-11-04', '10:30',
      'Cardiology evaluation done. ECG shows normal sinus rhythm. 2D Echo shows LVEF 60%, normal LV systolic function, mild concentric LVH. BP is controlled at 128/82 mmHg.',
      'Hypertensive Heart Disease with preserved ejection fraction.',
      'Low cardiac risk for non-cardiac surgery. Continue Tab Amlodipine 5mg. Monitor peri-operative blood pressure.',
      'The Patient does not need to be referred again.'
    ]);
    console.log('  ✅ Seeded Cross Reference Visit (Pages 5-6)');
  }

  // Seed MO Handover Sheet (Page 7)
  const existingMo = await queryOne('SELECT id FROM doctor_mo_handovers WHERE patient_id = 3177250');
  if (!existingMo) {
    await run(`
      INSERT INTO doctor_mo_handovers (
        patient_id, hospital_id, handover_date, patient_name, diagnosis,
        morning_shift_notes, evening_shift_notes, night_shift_notes, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      3177250, 431, '2026-11-04', 'JAGDISHBHAI AHUJA', 'Acute Appendicitis - Pre-Op',
      'Patient kept NPO. IV fluids running. Pre-op surgical checklist completed. PAC clearance received. Vitals stable.',
      'Post-op monitoring: Laparoscopic appendectomy completed at 3:30 PM. Recovered from anesthesia. Stable vitals.',
      'Overnight monitoring: Pain managed with IV analgesics. SpO2 99% on room air. Urine output adequate.',
      'Dr. Patel (MO)'
    ]);
    console.log('  ✅ Seeded MO Handover Sheet (Page 7)');
  }

  // Seed SBAR Handover (Page 8)
  const existingSbar = await queryOne('SELECT id FROM doctor_sbar_handovers WHERE patient_id = 3177250');
  if (!existingSbar) {
    await run(`
      INSERT INTO doctor_sbar_handovers (
        patient_id, hospital_id, shift, handover_date, room_bed_no, current_condition,
        condition_day_night, primary_diagnosis, procedure_done, investigation_done,
        comorbid_conditions, collect_reports_of, inform_gc_to_doctor, plan_discharge,
        given_by_eid, given_by_time, taken_by_eid, taken_by_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      3177250, 431, 'Morning', '2026-11-04', 'ICU-04',
      'Pre-op conscious, vitals stable, afebrile',
      'Mild RIF pain, no vomiting overnight',
      'Acute Appendicitis',
      'Scheduled for Lap Appendectomy at 2:00 PM',
      'CBC, RFT, USG Abdomen, 2D Echo',
      'Hypertension (5 years)',
      'Pre-op coagulation profile (PT/INR)',
      'Informed to Dr. Sanghavi',
      'No',
      'DR-MO-102', '08:00 AM', 'DR-MO-105', '08:05 AM'
    ]);
    console.log('  ✅ Seeded Doctor SBAR Handover (Page 8)');
  }

  // Seed Blood Transfusion (Page 9)
  const existingBt = await queryOne('SELECT id FROM doctor_blood_transfusions WHERE patient_id = 3177250');
  if (!existingBt) {
    const flowsheet = [
      { time: '0 Hrs', pulse: 78, temp: '98.4', bp: '120/80', rr: 18, rate: '20 drops/min', remarks: 'Started' },
      { time: '15 Min', pulse: 80, temp: '98.4', bp: '122/82', rr: 18, rate: '30 drops/min', remarks: 'Smooth' },
      { time: '30 Min', pulse: 78, temp: '98.5', bp: '120/80', rr: 18, rate: '30 drops/min', remarks: 'Stable' },
      { time: '60 Min', pulse: 80, temp: '98.6', bp: '120/80', rr: 18, rate: '30 drops/min', remarks: 'Stable' },
      { time: '90 Min', pulse: 78, temp: '98.6', bp: '120/80', rr: 18, rate: '30 drops/min', remarks: 'Stable' },
      { time: '120 Min', pulse: 76, temp: '98.6', bp: '118/78', rr: 17, rate: '30 drops/min', remarks: 'Completed' }
    ];

    await run(`
      INSERT INTO doctor_blood_transfusions (
        patient_id, hospital_id, transfusion_date, transfusion_time, ip_no, ward,
        diagnosis, indication, patient_blood_group, history_previous_bt, previous_adverse_reaction_nature,
        order_component_type, order_units, order_flow_rate, order_diagnosis, order_indication,
        consultant_signature, transfusion_number, transfusion_record_date, blood_bag_no, product_blood_group,
        product_name, compatibility, blood_bank_name, expiry_date, blood_checked_by_doctor, doctor_eid,
        doctor_signature, unit_nurse, bt_started_at, bt_stopped_at, adverse_reaction_flag, vitals_flowsheet_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      3177250, 431, '2026-11-04', '11:00', 'IP/2026-2027/1619', 'ICU Ward A',
      'Acute Appendicitis with mild anemia', 'Low Hemoglobin (Hb 9.2 g/dL) pre-op', 'B Positive',
      'No', 'None',
      'PRC', 1, '30 drops/min', 'Acute Appendicitis', 'Pre-op Blood Optimization',
      'Dr. Sanghavi, M.S.', '1', '2026-11-04', 'BAG-8921-ASH', 'B Positive',
      'Packed Red Cells (PRC)', 'Yes', 'Red Cross Blood Center', '2026-11-28',
      'Dr. Patel (Resident Medical Officer)', 'MO-804',
      'Dr. Patel', 'Staff Nurse Sister Mary', '11:15 AM', '01:30 PM',
      'No Adverse Reaction', JSON.stringify(flowsheet)
    ]);
    console.log('  ✅ Seeded Blood Transfusion Record (Page 9)');
  }

  console.log('🌱 Digital Doctor Seeding Completed Successfully!');
}

if (require.main === module) {
  seedDoctor().catch(console.error);
}

module.exports = seedDoctor;

