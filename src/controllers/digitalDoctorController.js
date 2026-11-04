const { query, queryOne, run } = require('../database/connection');

function safeJson(val, fallback = {}) {
  if (typeof val === 'object' && val !== null) return val;
  try {
    return JSON.parse(val || (Array.isArray(fallback) ? '[]' : '{}'));
  } catch (e) {
    return fallback;
  }
}

// ── 1. Doctor Initial Assessment (PDF Pages 1-3) ─────────────────────────────
async function listInitialAssessments(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query(
      `SELECT * FROM doctor_initial_assessments WHERE patient_id = ? ORDER BY assessment_date DESC, assessment_time DESC`,
      [patient_id]
    );

    const data = rows.map(r => ({
      ...r,
      allergies: safeJson(r.allergies_json, {}),
      habit_history: safeJson(r.habit_history_json, {}),
      past_medical_history: safeJson(r.past_medical_history_json, {}),
      obstetrics_gynaecology: safeJson(r.obstetrics_gynaecology_json, {}),
      medication_reconciliation: safeJson(r.medication_reconciliation_json, []),
      general_exam: safeJson(r.general_exam_json, {}),
      systemic_exam: safeJson(r.systemic_exam_json, {}),
      wells_dvt: safeJson(r.wells_dvt_json, {}),
      informant_declaration: safeJson(r.informant_declaration_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveInitialAssessment(req, res) {
  try {
    const b = req.body;
    const patient_id = b.patient_id || 3177250;
    const hospital_id = b.hospital_id || 431;
    const id = b.id;

    const assessment_date = b.assessment_date || new Date().toISOString().substring(0, 10);
    const assessment_time = b.assessment_time || '09:00';
    const department = b.department || 'General Surgery';
    const admitting_consultant = b.admitting_consultant || req.session?.user?.full_name || 'Dr. Sanghavi';

    const allergies_json = typeof b.allergies === 'string' ? b.allergies : JSON.stringify(b.allergies || {});
    const habit_history_json = typeof b.habit_history === 'string' ? b.habit_history : JSON.stringify(b.habit_history || {});
    const past_medical_history_json = typeof b.past_medical_history === 'string' ? b.past_medical_history : JSON.stringify(b.past_medical_history || {});
    const obstetrics_gynaecology_json = typeof b.obstetrics_gynaecology === 'string' ? b.obstetrics_gynaecology : JSON.stringify(b.obstetrics_gynaecology || {});
    const medication_reconciliation_json = typeof b.medication_reconciliation === 'string' ? b.medication_reconciliation : JSON.stringify(b.medication_reconciliation || []);
    const general_exam_json = typeof b.general_exam === 'string' ? b.general_exam : JSON.stringify(b.general_exam || {});
    const systemic_exam_json = typeof b.systemic_exam === 'string' ? b.systemic_exam : JSON.stringify(b.systemic_exam || {});
    const wells_dvt_json = typeof b.wells_dvt === 'string' ? b.wells_dvt : JSON.stringify(b.wells_dvt || {});
    const informant_declaration_json = typeof b.informant_declaration === 'string' ? b.informant_declaration : JSON.stringify(b.informant_declaration || {});

    if (id) {
      await run(`
        UPDATE doctor_initial_assessments SET
          assessment_date = ?, assessment_time = ?, department = ?, admitting_consultant = ?,
          allergies_json = ?, chief_complaints = ?, past_history_illness = ?, personal_history_habits = ?,
          occupational_history = ?, diet = ?, physical_activity = ?, habit_history_json = ?,
          past_medical_history_json = ?, past_medical_others = ?, obstetrics_gynaecology_json = ?,
          pertinent_family_history = ?, medication_reconciliation_json = ?, general_exam_json = ?,
          systemic_exam_json = ?, provisional_diagnosis = ?, investigations_advised = ?,
          plan_of_treatment = ?, significant_weight_loss = ?, diet_instructions = ?,
          wells_dvt_json = ?, informant_declaration_json = ?, consultant_name = ?,
          medical_officer_name = ?, updated_at = datetime('now')
        WHERE id = ? AND patient_id = ?
      `, [
        assessment_date, assessment_time, department, admitting_consultant,
        allergies_json, b.chief_complaints || '', b.past_history_illness || '', b.personal_history_habits || '',
        b.occupational_history || '', b.diet || '', b.physical_activity || '', habit_history_json,
        past_medical_history_json, b.past_medical_others || '', obstetrics_gynaecology_json,
        b.pertinent_family_history || '', medication_reconciliation_json, general_exam_json,
        systemic_exam_json, b.provisional_diagnosis || '', b.investigations_advised || '',
        b.plan_of_treatment || '', b.significant_weight_loss || '', b.diet_instructions || '',
        wells_dvt_json, informant_declaration_json, b.consultant_name || admitting_consultant,
        b.medical_officer_name || '', id, patient_id
      ]);
      return res.json({ status: true, msg: 'Doctor Initial Assessment updated successfully', id });
    }

    const result = await run(`
      INSERT INTO doctor_initial_assessments (
        patient_id, hospital_id, assessment_date, assessment_time, department, admitting_consultant,
        allergies_json, chief_complaints, past_history_illness, personal_history_habits,
        occupational_history, diet, physical_activity, habit_history_json,
        past_medical_history_json, past_medical_others, obstetrics_gynaecology_json,
        pertinent_family_history, medication_reconciliation_json, general_exam_json,
        systemic_exam_json, provisional_diagnosis, investigations_advised,
        plan_of_treatment, significant_weight_loss, diet_instructions,
        wells_dvt_json, informant_declaration_json, consultant_name, medical_officer_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient_id, hospital_id, assessment_date, assessment_time, department, admitting_consultant,
      allergies_json, b.chief_complaints || '', b.past_history_illness || '', b.personal_history_habits || '',
      b.occupational_history || '', b.diet || '', b.physical_activity || '', habit_history_json,
      past_medical_history_json, b.past_medical_others || '', obstetrics_gynaecology_json,
      b.pertinent_family_history || '', medication_reconciliation_json, general_exam_json,
      systemic_exam_json, b.provisional_diagnosis || '', b.investigations_advised || '',
      b.plan_of_treatment || '', b.significant_weight_loss || '', b.diet_instructions || '',
      wells_dvt_json, informant_declaration_json, b.consultant_name || admitting_consultant, b.medical_officer_name || ''
    ]);

    res.json({ status: true, msg: 'Doctor Initial Assessment recorded successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteInitialAssessment(req, res) {
  try {
    const id = req.body.id || req.query.id;
    await run('DELETE FROM doctor_initial_assessments WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Initial Assessment deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 2. Consultant Progress Notes (PDF Page 4) ──────────────────────────────
async function listProgressNotes(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query(
      `SELECT * FROM doctor_progress_notes WHERE patient_id = ? ORDER BY note_date DESC, note_time DESC`,
      [patient_id]
    );
    res.json({ status: true, data: rows });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveProgressNotes(req, res) {
  try {
    const b = req.body;
    const patient_id = b.patient_id || 3177250;
    const hospital_id = b.hospital_id || 431;
    const note_date = b.note_date || new Date().toISOString().substring(0, 10);
    const note_time = b.note_time || '10:00';
    const particulars = b.particulars || '';
    const consultant_name = b.consultant_name || req.session?.user?.full_name || 'Attending Consultant';
    const signature = b.signature || consultant_name;

    const result = await run(`
      INSERT INTO doctor_progress_notes (patient_id, hospital_id, note_date, note_time, particulars, consultant_name, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [patient_id, hospital_id, note_date, note_time, particulars, consultant_name, signature]);

    res.json({ status: true, msg: 'Consultant progress note added', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteProgressNotes(req, res) {
  try {
    const id = req.body.id || req.query.id;
    await run('DELETE FROM doctor_progress_notes WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 3. Cross Reference / Referral Visit Notes (PDF Pages 5-6) ───────────────
async function listCrossReferences(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query(
      `SELECT * FROM doctor_cross_references WHERE patient_id = ? ORDER BY created_at DESC`,
      [patient_id]
    );
    res.json({ status: true, data: rows });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveCrossReference(req, res) {
  try {
    const b = req.body;
    const patient_id = b.patient_id || 3177250;
    const hospital_id = b.hospital_id || 431;

    const result = await run(`
      INSERT INTO doctor_cross_references (
        patient_id, hospital_id, reason_for_cross_reference, cross_reference_type, visit_type,
        relatives_informed_date, relatives_informed_time, relatives_informed_by,
        patient_relative_signature, referring_consultant_name, referring_consultant_signature,
        ward, informed_on_date, informed_on_time, informed_through, informed_by,
        referred_consultant_name, referred_consultant_phone, speciality, visit_date, visit_time,
        referred_doctor_notes, impression, advice, refer_again_status, refer_again_days,
        referred_consultant_signature, attending_consultant_signature, follow_up_note, follow_up_date, follow_up_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient_id, hospital_id, b.reason_for_cross_reference || '', b.cross_reference_type || 'Elective',
      b.visit_type || 'Consultation Only', b.relatives_informed_date || '', b.relatives_informed_time || '',
      b.relatives_informed_by || '', b.patient_relative_signature || '', b.referring_consultant_name || '',
      b.referring_consultant_signature || '', b.ward || '', b.informed_on_date || '', b.informed_on_time || '',
      b.informed_through || 'Phone', b.informed_by || '', b.referred_consultant_name || '',
      b.referred_consultant_phone || '', b.speciality || '', b.visit_date || '', b.visit_time || '',
      b.referred_doctor_notes || '', b.impression || '', b.advice || '', b.refer_again_status || 'The Patient does not need to be referred again.',
      b.refer_again_days ? parseInt(b.refer_again_days, 10) : null, b.referred_consultant_signature || '',
      b.attending_consultant_signature || '', b.follow_up_note || '', b.follow_up_date || '', b.follow_up_time || ''
    ]);

    res.json({ status: true, msg: 'Cross reference recorded successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteCrossReference(req, res) {
  try {
    const id = req.body.id || req.query.id;
    await run('DELETE FROM doctor_cross_references WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Cross reference deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 4. Medical Officer Handover Sheet (PDF Page 7) ──────────────────────────
async function listMoHandovers(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query(
      `SELECT * FROM doctor_mo_handovers WHERE patient_id = ? ORDER BY handover_date DESC`,
      [patient_id]
    );
    res.json({ status: true, data: rows });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveMoHandover(req, res) {
  try {
    const b = req.body;
    const patient_id = b.patient_id || 3177250;
    const hospital_id = b.hospital_id || 431;

    const result = await run(`
      INSERT INTO doctor_mo_handovers (
        patient_id, hospital_id, handover_date, patient_name, diagnosis,
        morning_shift_notes, evening_shift_notes, night_shift_notes, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient_id, hospital_id, b.handover_date || new Date().toISOString().substring(0, 10),
      b.patient_name || '', b.diagnosis || '', b.morning_shift_notes || '',
      b.evening_shift_notes || '', b.night_shift_notes || '', b.recorded_by || req.session?.user?.full_name || 'Medical Officer'
    ]);

    res.json({ status: true, msg: 'MO Handover saved', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteMoHandover(req, res) {
  try {
    const id = req.body.id || req.query.id;
    await run('DELETE FROM doctor_mo_handovers WHERE id = ?', [id]);
    res.json({ status: true, msg: 'MO Handover deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 5. Primary SBAR Scale by Medical Officer (PDF Page 8) ───────────────────
async function listSbarHandovers(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query(
      `SELECT * FROM doctor_sbar_handovers WHERE patient_id = ? ORDER BY handover_date DESC, id DESC`,
      [patient_id]
    );
    res.json({ status: true, data: rows });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveSbarHandover(req, res) {
  try {
    const b = req.body;
    const patient_id = b.patient_id || 3177250;
    const hospital_id = b.hospital_id || 431;

    const result = await run(`
      INSERT INTO doctor_sbar_handovers (
        patient_id, hospital_id, shift, handover_date, room_bed_no, current_condition,
        condition_day_night, primary_diagnosis, procedure_done, investigation_done,
        comorbid_conditions, collect_reports_of, inform_gc_to_doctor, plan_discharge,
        given_by_eid, given_by_time, taken_by_eid, taken_by_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient_id, hospital_id, b.shift || 'Morning', b.handover_date || new Date().toISOString().substring(0, 10),
      b.room_bed_no || '', b.current_condition || '', b.condition_day_night || '',
      b.primary_diagnosis || '', b.procedure_done || '', b.investigation_done || '',
      b.comorbid_conditions || '', b.collect_reports_of || '', b.inform_gc_to_doctor || '',
      b.plan_discharge || 'No', b.given_by_eid || '', b.given_by_time || '',
      b.taken_by_eid || '', b.taken_by_time || ''
    ]);

    res.json({ status: true, msg: 'Doctor SBAR Handover saved', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteSbarHandover(req, res) {
  try {
    const id = req.body.id || req.query.id;
    await run('DELETE FROM doctor_sbar_handovers WHERE id = ?', [id]);
    res.json({ status: true, msg: 'SBAR Handover deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 6. Blood Transfusion & Adverse Effects Form (PDF Page 9) ────────────────
async function listBloodTransfusions(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query(
      `SELECT * FROM doctor_blood_transfusions WHERE patient_id = ? ORDER BY transfusion_date DESC, transfusion_time DESC`,
      [patient_id]
    );

    const data = rows.map(r => ({
      ...r,
      vitals_flowsheet: safeJson(r.vitals_flowsheet_json, []),
      adverse_reactions: safeJson(r.adverse_reactions_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveBloodTransfusion(req, res) {
  try {
    const b = req.body;
    const patient_id = b.patient_id || 3177250;
    const hospital_id = b.hospital_id || 431;

    const vitals_flowsheet_json = typeof b.vitals_flowsheet === 'string' ? b.vitals_flowsheet : JSON.stringify(b.vitals_flowsheet || []);
    const adverse_reactions_json = typeof b.adverse_reactions === 'string' ? b.adverse_reactions : JSON.stringify(b.adverse_reactions || {});

    const result = await run(`
      INSERT INTO doctor_blood_transfusions (
        patient_id, hospital_id, transfusion_date, transfusion_time, ip_no, ward,
        diagnosis, indication, patient_blood_group, history_previous_bt, previous_adverse_reaction_nature,
        order_component_type, order_units, order_flow_rate, order_diagnosis, order_indication,
        consultant_signature, transfusion_number, transfusion_record_date, blood_bag_no, product_blood_group,
        product_name, compatibility, blood_bank_name, expiry_date, blood_checked_by_doctor, doctor_eid,
        doctor_signature, unit_nurse, bt_started_at, bt_stopped_at, adverse_reaction_flag,
        vitals_flowsheet_json, adverse_reactions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient_id, hospital_id, b.transfusion_date || new Date().toISOString().substring(0, 10),
      b.transfusion_time || '11:00', b.ip_no || '', b.ward || '', b.diagnosis || '', b.indication || '',
      b.patient_blood_group || '', b.history_previous_bt || 'No', b.previous_adverse_reaction_nature || '',
      b.order_component_type || 'PRC', b.order_units ? parseInt(b.order_units, 10) : 1, b.order_flow_rate || '',
      b.order_diagnosis || '', b.order_indication || '', b.consultant_signature || '',
      b.transfusion_number || '1', b.transfusion_record_date || '', b.blood_bag_no || '', b.product_blood_group || '',
      b.product_name || 'PRC', b.compatibility || 'Yes', b.blood_bank_name || '', b.expiry_date || '',
      b.blood_checked_by_doctor || '', b.doctor_eid || '', b.doctor_signature || '', b.unit_nurse || '',
      b.bt_started_at || '', b.bt_stopped_at || '', b.adverse_reaction_flag || 'No Adverse Reaction',
      vitals_flowsheet_json, adverse_reactions_json
    ]);

    res.json({ status: true, msg: 'Blood Transfusion record saved', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteBloodTransfusion(req, res) {
  try {
    const id = req.body.id || req.query.id;
    await run('DELETE FROM doctor_blood_transfusions WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Blood Transfusion record deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 7. Official Printable NABH PDF Preview ──────────────────────────────────
async function printPdf(req, res) {
  try {
    const formType = req.params.formType || req.query.formType || 'initial-assessment';
    const patient_id = req.query.patient_id || 3177250;
    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [patient_id]) || {
      uhid: 'AS6767',
      ipd_number: 'IP/2026-2027/1619',
      full_name: 'JAGDISHBHAI AHUJA',
      age: '42 Y, 2 M, 12 D',
      gender: 'Male',
      ward: 'ICU Ward A',
      bed_number: 'ICU-04'
    };

    let record = null;
    if (formType === 'initial-assessment') {
      const row = await queryOne('SELECT * FROM doctor_initial_assessments WHERE patient_id = ? ORDER BY id DESC', [patient_id]);
      if (row) {
        record = {
          ...row,
          allergies: safeJson(row.allergies_json, {}),
          habit_history: safeJson(row.habit_history_json, {}),
          past_medical_history: safeJson(row.past_medical_history_json, {}),
          obstetrics_gynaecology: safeJson(row.obstetrics_gynaecology_json, {}),
          medication_reconciliation: safeJson(row.medication_reconciliation_json, []),
          general_exam: safeJson(row.general_exam_json, {}),
          systemic_exam: safeJson(row.systemic_exam_json, {}),
          wells_dvt: safeJson(row.wells_dvt_json, {}),
          informant_declaration: safeJson(row.informant_declaration_json, {})
        };
      }
    } else if (formType === 'progress-notes') {
      record = await query('SELECT * FROM doctor_progress_notes WHERE patient_id = ? ORDER BY note_date ASC, note_time ASC', [patient_id]);
    } else if (formType === 'cross-reference') {
      record = await queryOne('SELECT * FROM doctor_cross_references WHERE patient_id = ? ORDER BY id DESC', [patient_id]);
    } else if (formType === 'mo-handover') {
      record = await queryOne('SELECT * FROM doctor_mo_handovers WHERE patient_id = ? ORDER BY id DESC', [patient_id]);
    } else if (formType === 'sbar-handover') {
      record = await query('SELECT * FROM doctor_sbar_handovers WHERE patient_id = ? ORDER BY id DESC', [patient_id]);
    } else if (formType === 'blood-transfusion') {
      const row = await queryOne('SELECT * FROM doctor_blood_transfusions WHERE patient_id = ? ORDER BY id DESC', [patient_id]);
      if (row) {
        record = {
          ...row,
          vitals_flowsheet: safeJson(row.vitals_flowsheet_json, []),
          adverse_reactions: safeJson(row.adverse_reactions_json, {})
        };
      }
    }

    res.render('doctor/print-pdf', {
      title: 'NABH Medical Form Print | Anand Surgical Hospital',
      patient,
      formType,
      record
    });
  } catch (err) {
    res.status(500).send(`Error rendering printable PDF: ${err.message}`);
  }
}

module.exports = {
  listInitialAssessments,
  saveInitialAssessment,
  deleteInitialAssessment,
  listProgressNotes,
  saveProgressNotes,
  deleteProgressNotes,
  listCrossReferences,
  saveCrossReference,
  deleteCrossReference,
  listMoHandovers,
  saveMoHandover,
  deleteMoHandover,
  listSbarHandovers,
  saveSbarHandover,
  deleteSbarHandover,
  listBloodTransfusions,
  saveBloodTransfusion,
  deleteBloodTransfusion,
  printPdf
};

