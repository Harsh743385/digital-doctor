const { query, queryOne, run } = require('../database/connection');

function safeJson(val, fallback = {}) {
  if (typeof val === 'object' && val !== null) return val;
  try {
    return JSON.parse(val || (Array.isArray(fallback) ? '[]' : '{}'));
  } catch (e) {
    return fallback;
  }
}

// Helper to extract nested meta[...] keys from form body
function extractMeta(body) {
  const meta = {};
  if (body.meta && typeof body.meta === 'object') {
    Object.assign(meta, body.meta);
  }
  for (const [k, v] of Object.entries(body)) {
    const match = /^meta\[([a-zA-Z0-9_]+)\]$/.exec(k);
    if (match) {
      meta[match[1]] = v;
    }
  }
  return meta;
}

// ── 1. Assessments ──────────────────────────────────────────────────────────
async function listAssessments(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { all_dates, assessment_type, date } = req.body;

    let sql = 'SELECT * FROM nursing_assessments WHERE patient_id = ?';
    const params = [patient_id];

    if (!all_dates && date) {
      sql += ' AND assessment_date = ?';
      params.push(date);
    }
    if (assessment_type) {
      sql += ' AND assessment_type = ?';
      params.push(assessment_type);
    }

    sql += ' ORDER BY assessment_date DESC, assessment_time DESC';

    const rows = await query(sql, params);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveAssessment(req, res) {
  try {
    const body = req.body;
    const id = body.id;
    const patient_id = body.patient_id || 3177250;
    const hospital_id = body.hospital_id || 431;
    const meta = extractMeta(body);

    const assessment_type = body.assessment_type || 'initial';
    const assessment_date = body.assessment_date || new Date().toISOString().substring(0, 10);
    const assessment_time = body.assessment_time || '08:00';
    const shift = body.shift || 'Morning';
    const nurse_name = body.nurse_name || req.session?.user?.full_name || 'Staff Nurse';

    const temp_f = body.temp_f ? parseFloat(body.temp_f) : null;
    const pulse_bpm = body.pulse_bpm ? parseFloat(body.pulse_bpm) : null;
    const bp_sys = body.bp_sys ? parseFloat(body.bp_sys) : null;
    const bp_dia = body.bp_dia ? parseFloat(body.bp_dia) : null;
    const spo2 = body.spo2 ? parseFloat(body.spo2) : null;
    const rr = body.rr ? parseFloat(body.rr) : null;
    const weight_kg = body.weight_kg ? parseFloat(body.weight_kg) : null;
    const pain_score = body.pain_score !== undefined && body.pain_score !== '' ? parseInt(body.pain_score, 10) : null;
    const fall_risk_score = body.fall_risk_score ? parseInt(body.fall_risk_score, 10) : null;
    const fall_risk_level = body.fall_risk_level || null;
    const notes = body.notes || null;
    const interventions = body.interventions || null;
    const nurse_signature = body.nurse_signature || null;
    const form_status = body.form_status || 'Completed';

    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_assessments
        SET assessment_type = ?, assessment_date = ?, assessment_time = ?, shift = ?,
            nurse_name = ?, temp_f = ?, pulse_bpm = ?, bp_sys = ?, bp_dia = ?,
            spo2 = ?, rr = ?, weight_kg = ?, pain_score = ?, fall_risk_score = ?,
            fall_risk_level = ?, notes = ?, interventions = ?, nurse_signature = ?,
            meta_json = ?, form_status = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [
        assessment_type, assessment_date, assessment_time, shift, nurse_name,
        temp_f, pulse_bpm, bp_sys, bp_dia, spo2, rr, weight_kg,
        pain_score, fall_risk_score, fall_risk_level, notes, interventions,
        nurse_signature, JSON.stringify(meta), form_status, id
      ]);
    } else {
      const result = await run(`
        INSERT INTO nursing_assessments (
          patient_id, hospital_id, assessment_type, assessment_date, assessment_time,
          shift, nurse_name, temp_f, pulse_bpm, bp_sys, bp_dia, spo2, rr, weight_kg,
          pain_score, fall_risk_score, fall_risk_level, notes, interventions,
          nurse_signature, meta_json, form_status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        patient_id, hospital_id, assessment_type, assessment_date, assessment_time,
        shift, nurse_name, temp_f, pulse_bpm, bp_sys, bp_dia, spo2, rr, weight_kg,
        pain_score, fall_risk_score, fall_risk_level, notes, interventions,
        nurse_signature, JSON.stringify(meta), form_status, req.session?.user?.id || 1
      ]);
      savedId = result.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Assessment saved successfully', id: savedId });
  } catch (err) {
    console.error('Save assessment error:', err);
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteAssessment(req, res) {
  try {
    const id = req.body.id || req.params.id;
    await run('DELETE FROM nursing_assessments WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Assessment deleted successfully' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 2. eMAR (Electronic Medication Administration Record) ─────────────────────
async function listEmar(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const orders = await query(`
      SELECT * FROM nursing_emar
      WHERE patient_id = ?
      ORDER BY id DESC
    `, [patient_id]);

    const admins = await query(`
      SELECT * FROM nursing_emar_admins
      WHERE patient_id = ?
      ORDER BY scheduled_at ASC
    `, [patient_id]);

    const adminsByEmarId = {};
    for (const a of admins) {
      if (!adminsByEmarId[a.emar_id]) adminsByEmarId[a.emar_id] = [];
      adminsByEmarId[a.emar_id].push(a);
    }

    res.json({
      status: true,
      data: {
        orders,
        admins: adminsByEmarId
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveEmar(req, res) {
  try {
    const { id, patient_id = 3177250, hospital_id = 431, medication_name, dose, route, frequency, start_date, end_date } = req.body;

    if (!medication_name) {
      return res.status(400).json({ status: false, msg: 'Medication name is required' });
    }

    let savedId = id;
    if (id) {
      await run(`
        UPDATE nursing_emar
        SET medication_name = ?, dose = ?, route = ?, frequency = ?,
            start_date = ?, end_date = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [medication_name, dose, route, frequency, start_date, end_date || null, id]);
    } else {
      const resEmar = await run(`
        INSERT INTO nursing_emar (
          patient_id, hospital_id, medication_name, dose, route, frequency, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
      `, [patient_id, hospital_id, medication_name, dose, route, frequency, start_date || new Date().toISOString().substring(0, 10), end_date || null]);
      savedId = resEmar.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Medication order saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function stopEmar(req, res) {
  try {
    const { id, stop_reason } = req.body;
    await run(`
      UPDATE nursing_emar
      SET status = 'Stopped', stop_reason = ?, stopped_at = datetime('now'),
          stopped_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [stop_reason || 'Discontinued by Physician', req.session?.user?.full_name || 'Nurse', id]);

    res.json({ status: true, msg: 'Medication stopped' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteEmar(req, res) {
  try {
    const { id } = req.body;
    await run('DELETE FROM nursing_emar_admins WHERE emar_id = ?', [id]);
    await run('DELETE FROM nursing_emar WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Medication order deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function administerEmar(req, res) {
  try {
    const {
      emar_id, patient_id = 3177250, hospital_id = 431,
      scheduled_at, administered_at, status = 'Given',
      reason, signature
    } = req.body;

    const nurseName = req.session?.user?.full_name || 'Staff Nurse';
    const adminAt = administered_at || new Date().toISOString().replace('T', ' ').substring(0, 16);

    const result = await run(`
      INSERT INTO nursing_emar_admins (
        emar_id, patient_id, hospital_id, scheduled_at, administered_at,
        status, administered_by_name, reason, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [emar_id, patient_id, hospital_id, scheduled_at, adminAt, status, nurseName, reason || null, signature || null]);

    res.json({ status: true, msg: 'Administration recorded', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function searchMedicines(req, res) {
  try {
    const q = req.query.q || req.body.q || '';
    let sql = 'SELECT * FROM medicines';
    const params = [];
    if (q.trim()) {
      sql += ' WHERE name LIKE ? OR category LIKE ?';
      const term = `%${q.trim()}%`;
      params.push(term, term);
    }
    sql += ' ORDER BY name ASC LIMIT 25';

    const list = await query(sql, params);
    const formatted = list.map(m => ({
      id: m.id,
      text: m.name,
      dose: m.dose,
      route: m.route,
      frequency: m.frequency
    }));

    res.json({ status: true, data: formatted });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 3. eTAR (Electronic Treatment Administration Record) ─────────────────────
async function listEtar(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const orders = await query('SELECT * FROM nursing_etar WHERE patient_id = ? ORDER BY id DESC', [patient_id]);
    const admins = await query('SELECT * FROM nursing_etar_admins WHERE patient_id = ? ORDER BY scheduled_at ASC', [patient_id]);

    const adminsByEtarId = {};
    for (const a of admins) {
      if (!adminsByEtarId[a.etar_id]) adminsByEtarId[a.etar_id] = [];
      adminsByEtarId[a.etar_id].push(a);
    }

    res.json({ status: true, data: { orders, admins: adminsByEtarId } });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveEtar(req, res) {
  try {
    const { id, patient_id = 3177250, hospital_id = 431, treatment_name, category, frequency, start_date, end_date } = req.body;

    if (!treatment_name) {
      return res.status(400).json({ status: false, msg: 'Treatment name is required' });
    }

    let savedId = id;
    if (id) {
      await run(`
        UPDATE nursing_etar
        SET treatment_name = ?, category = ?, frequency = ?,
            start_date = ?, end_date = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [treatment_name, category, frequency, start_date, end_date || null, id]);
    } else {
      const resEtar = await run(`
        INSERT INTO nursing_etar (
          patient_id, hospital_id, treatment_name, category, frequency, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
      `, [patient_id, hospital_id, treatment_name, category || 'Nursing Care', frequency, start_date || new Date().toISOString().substring(0, 10), end_date || null]);
      savedId = resEtar.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Treatment order saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function administerEtar(req, res) {
  try {
    const { etar_id, patient_id = 3177250, hospital_id = 431, scheduled_at, administered_at, status = 'Done', notes, signature } = req.body;

    const nurseName = req.session?.user?.full_name || 'Staff Nurse';
    const adminAt = administered_at || new Date().toISOString().replace('T', ' ').substring(0, 16);

    const resAdmin = await run(`
      INSERT INTO nursing_etar_admins (
        etar_id, patient_id, hospital_id, scheduled_at, administered_at, status, administered_by_name, notes, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [etar_id, patient_id, hospital_id, scheduled_at, adminAt, status, nurseName, notes || null, signature || null]);

    res.json({ status: true, msg: 'Treatment administration recorded', id: resAdmin.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 4. Vitals Sheet ─────────────────────────────────────────────────────────
async function listVitals(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { all_dates, date } = req.body;

    let sql = 'SELECT * FROM nursing_vitals WHERE patient_id = ?';
    const params = [patient_id];

    if (!all_dates && date) {
      sql += ' AND vital_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY vital_date DESC, vital_time DESC';

    const rows = await query(sql, params);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveVitals(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      vital_date = new Date().toISOString().substring(0, 10),
      vital_time = '08:00', shift = 'Morning',
      temp_f, pulse_bpm, bp_sys, bp_dia, spo2, rr, pain_score, blood_sugar,
      recorded_by, notes
    } = body;

    const meta = extractMeta(body);
    const nurse = recorded_by || req.session?.user?.full_name || 'Staff Nurse';

    let savedId = id;
    if (id) {
      await run(`
        UPDATE nursing_vitals
        SET vital_date = ?, vital_time = ?, shift = ?, temp_f = ?, pulse_bpm = ?,
            bp_sys = ?, bp_dia = ?, spo2 = ?, rr = ?, pain_score = ?, blood_sugar = ?,
            recorded_by = ?, notes = ?, meta_json = ?
        WHERE id = ?
      `, [
        vital_date, vital_time, shift,
        temp_f ? parseFloat(temp_f) : null,
        pulse_bpm ? parseFloat(pulse_bpm) : null,
        bp_sys ? parseFloat(bp_sys) : null,
        bp_dia ? parseFloat(bp_dia) : null,
        spo2 ? parseFloat(spo2) : null,
        rr ? parseFloat(rr) : null,
        pain_score !== undefined && pain_score !== '' ? parseInt(pain_score, 10) : null,
        blood_sugar ? parseFloat(blood_sugar) : null,
        nurse, notes || null, JSON.stringify(meta), id
      ]);
    } else {
      const result = await run(`
        INSERT INTO nursing_vitals (
          patient_id, hospital_id, vital_date, vital_time, shift,
          temp_f, pulse_bpm, bp_sys, bp_dia, spo2, rr, pain_score, blood_sugar,
          recorded_by, notes, meta_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        patient_id, hospital_id, vital_date, vital_time, shift,
        temp_f ? parseFloat(temp_f) : null,
        pulse_bpm ? parseFloat(pulse_bpm) : null,
        bp_sys ? parseFloat(bp_sys) : null,
        bp_dia ? parseFloat(bp_dia) : null,
        spo2 ? parseFloat(spo2) : null,
        rr ? parseFloat(rr) : null,
        pain_score !== undefined && pain_score !== '' ? parseInt(pain_score, 10) : null,
        blood_sugar ? parseFloat(blood_sugar) : null,
        nurse, notes || null, JSON.stringify(meta)
      ]);
      savedId = result.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Vital signs saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteVitals(req, res) {
  try {
    const { id } = req.body;
    await run('DELETE FROM nursing_vitals WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Vitals record deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 5. ICU / CCU Chart ──────────────────────────────────────────────────────
async function listIcu(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { date, all_dates } = req.body;

    let sql = 'SELECT * FROM nursing_icu WHERE patient_id = ?';
    const params = [patient_id];

    if (!all_dates && date) {
      sql += ' AND chart_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY chart_date DESC';

    const rows = await query(sql, params);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveIcu(req, res) {
  try {
    const body = req.body;
    const { id, patient_id = 3177250, hospital_id = 431, chart_date = new Date().toISOString().substring(0, 10), chart_time = '08:00', diagnosis } = body;
    const meta = extractMeta(body);

    let savedId = id;
    if (id) {
      await run(`
        UPDATE nursing_icu
        SET chart_date = ?, chart_time = ?, diagnosis = ?, meta_json = ?
        WHERE id = ?
      `, [chart_date, chart_time, diagnosis || null, JSON.stringify(meta), id]);
    } else {
      const result = await run(`
        INSERT INTO nursing_icu (patient_id, hospital_id, chart_date, chart_time, diagnosis, meta_json, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [patient_id, hospital_id, chart_date, chart_time, diagnosis || null, JSON.stringify(meta), req.session?.user?.id || 1]);
      savedId = result.lastInsertRowid;
    }

    res.json({ status: true, msg: 'ICU chart saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function listIcuObs(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { date } = req.body;

    let sql = 'SELECT * FROM nursing_icu_obs WHERE patient_id = ?';
    const params = [patient_id];
    if (date) {
      sql += ' AND obs_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY obs_time ASC';

    const rows = await query(sql, params);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveIcuObs(req, res) {
  try {
    const body = req.body;
    const { id, patient_id = 3177250, hospital_id = 431, icu_id, obs_date = new Date().toISOString().substring(0, 10), obs_time = '08:00' } = body;
    const meta = extractMeta(body);

    let savedId = id;
    if (id) {
      await run('UPDATE nursing_icu_obs SET obs_date = ?, obs_time = ?, meta_json = ? WHERE id = ?', [obs_date, obs_time, JSON.stringify(meta), id]);
    } else {
      const resObs = await run(`
        INSERT INTO nursing_icu_obs (icu_id, patient_id, hospital_id, obs_date, obs_time, meta_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [icu_id || null, patient_id, hospital_id, obs_date, obs_time, JSON.stringify(meta)]);
      savedId = resObs.lastInsertRowid;
    }

    res.json({ status: true, msg: 'ICU observation saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 6. Progress Notes ───────────────────────────────────────────────────────
async function listNotes(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { date, all_dates } = req.body;

    let sql = 'SELECT * FROM nursing_notes WHERE patient_id = ?';
    const params = [patient_id];
    if (!all_dates && date) {
      sql += ' AND note_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY note_date DESC, note_time DESC';

    const rows = await query(sql, params);
    res.json({ status: true, data: rows });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveNotes(req, res) {
  try {
    const { id, patient_id = 3177250, hospital_id = 431, note_date = new Date().toISOString().substring(0, 10), note_time = '08:00', shift = 'Morning', note_type = 'General', notes, nurse_name, signature } = req.body;

    const nurse = nurse_name || req.session?.user?.full_name || 'Staff Nurse';
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_notes
        SET note_date = ?, note_time = ?, shift = ?, note_type = ?, notes = ?, nurse_name = ?, signature = ?
        WHERE id = ?
      `, [note_date, note_time, shift, note_type, notes, nurse, signature || null, id]);
    } else {
      const resNote = await run(`
        INSERT INTO nursing_notes (patient_id, hospital_id, note_date, note_time, shift, note_type, notes, nurse_name, signature)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [patient_id, hospital_id, note_date, note_time, shift, note_type, notes, nurse, signature || null]);
      savedId = resNote.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Progress note saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteNotes(req, res) {
  try {
    const { id } = req.body;
    await run('DELETE FROM nursing_notes WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 7. Intake & Output (I/O) Chart ──────────────────────────────────────────
async function listIo(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { date, all_dates } = req.body;

    let sql = 'SELECT * FROM nursing_io WHERE patient_id = ?';
    const params = [patient_id];
    if (!all_dates && date) {
      sql += ' AND io_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY io_date DESC, io_time DESC';

    const rows = await query(sql, params);
    res.json({ status: true, data: rows });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveIo(req, res) {
  try {
    const {
      id, patient_id = 3177250, hospital_id = 431,
      io_date = new Date().toISOString().substring(0, 10),
      io_time = '08:00', shift = 'Morning',
      intake_type, intake_item, intake_amount_ml = 0,
      output_type, output_item, output_amount_ml = 0,
      remarks, recorded_by, signature
    } = req.body;

    const nurse = recorded_by || req.session?.user?.full_name || 'Staff Nurse';
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_io
        SET io_date = ?, io_time = ?, shift = ?, intake_type = ?, intake_item = ?,
            intake_amount_ml = ?, output_type = ?, output_item = ?, output_amount_ml = ?,
            remarks = ?, recorded_by = ?, signature = ?
        WHERE id = ?
      `, [
        io_date, io_time, shift, intake_type || null, intake_item || null,
        parseFloat(intake_amount_ml) || 0, output_type || null, output_item || null,
        parseFloat(output_amount_ml) || 0, remarks || null, nurse, signature || null, id
      ]);
    } else {
      const resIo = await run(`
        INSERT INTO nursing_io (
          patient_id, hospital_id, io_date, io_time, shift,
          intake_type, intake_item, intake_amount_ml,
          output_type, output_item, output_amount_ml,
          remarks, recorded_by, signature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        patient_id, hospital_id, io_date, io_time, shift,
        intake_type || null, intake_item || null, parseFloat(intake_amount_ml) || 0,
        output_type || null, output_item || null, parseFloat(output_amount_ml) || 0,
        remarks || null, nurse, signature || null
      ]);
      savedId = resIo.lastInsertRowid;
    }

    res.json({ status: true, msg: 'I/O entry saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteIo(req, res) {
  try {
    const { id } = req.body;
    await run('DELETE FROM nursing_io WHERE id = ?', [id]);
    res.json({ status: true, msg: 'I/O entry deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 8. Diabetic Flow Chart ──────────────────────────────────────────────────
async function listDiabetic(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { date, all_dates } = req.body;

    let sql = 'SELECT * FROM nursing_diabetic WHERE patient_id = ?';
    const params = [patient_id];
    if (!all_dates && date) {
      sql += ' AND record_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY record_date DESC, record_time DESC';

    const rows = await query(sql, params);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveDiabetic(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      record_date = new Date().toISOString().substring(0, 10),
      record_time = '08:00', glucose_value, test_type,
      insulin_type, insulin_dose, remarks, recorded_by
    } = body;

    const meta = extractMeta(body);
    const nurse = recorded_by || req.session?.user?.full_name || 'Staff Nurse';
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_diabetic
        SET record_date = ?, record_time = ?, glucose_value = ?, test_type = ?,
            insulin_type = ?, insulin_dose = ?, remarks = ?, recorded_by = ?, meta_json = ?
        WHERE id = ?
      `, [
        record_date, record_time, parseFloat(glucose_value) || 0, test_type || null,
        insulin_type || null, insulin_dose || null, remarks || null, nurse, JSON.stringify(meta), id
      ]);
    } else {
      const resDiab = await run(`
        INSERT INTO nursing_diabetic (
          patient_id, hospital_id, record_date, record_time, glucose_value,
          test_type, insulin_type, insulin_dose, remarks, recorded_by, meta_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        patient_id, hospital_id, record_date, record_time, parseFloat(glucose_value) || 0,
        test_type || null, insulin_type || null, insulin_dose || null, remarks || null,
        nurse, JSON.stringify(meta)
      ]);
      savedId = resDiab.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Blood glucose reading saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function auditDiabetic(req, res) {
  try {
    const { id } = req.body;
    const auditedBy = req.session?.user?.full_name || 'Dr. deep joshi';
    await run(`
      UPDATE nursing_diabetic
      SET audited_by = ?, audited_at = datetime('now')
      WHERE id = ?
    `, [auditedBy, id]);

    res.json({ status: true, msg: 'Diabetic chart verified and signed by Doctor' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 9. Generic Nursing Records (Specialised Assessments, Safety, Handovers) ─
async function listRecords(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { kind, all_dates, date } = req.body;

    let sql = 'SELECT * FROM nursing_records WHERE patient_id = ?';
    const params = [patient_id];

    if (kind) {
      sql += ' AND record_kind = ?';
      params.push(kind);
    }
    if (!all_dates && date) {
      sql += ' AND record_date = ?';
      params.push(date);
    }

    sql += ' ORDER BY record_date DESC, record_time DESC';

    const rows = await query(sql, params);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));

    // Card counts for the sub bar
    const counts = {};
    const countRows = await query(`
      SELECT record_kind, COUNT(*) AS c
      FROM nursing_records
      WHERE patient_id = ?
      GROUP BY record_kind
    `, [patient_id]);
    countRows.forEach(cr => { counts[cr.record_kind] = cr.c; });

    res.json({ status: true, data: { rows: data, counts } });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveRecord(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      kind, record_kind,
      record_date = new Date().toISOString().substring(0, 10),
      record_time = '08:00', shift = 'Morning',
      title, recorded_by
    } = body;

    const rKind = kind || record_kind || 'general';
    const meta = extractMeta(body);
    const nurse = recorded_by || req.session?.user?.full_name || 'Staff Nurse';
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_records
        SET record_kind = ?, record_date = ?, record_time = ?, shift = ?,
            title = ?, recorded_by = ?, meta_json = ?, status = 'Completed'
        WHERE id = ?
      `, [rKind, record_date, record_time, shift, title || null, nurse, JSON.stringify(meta), id]);
    } else {
      const result = await run(`
        INSERT INTO nursing_records (
          patient_id, hospital_id, record_kind, record_date, record_time,
          shift, title, recorded_by, meta_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
      `, [patient_id, hospital_id, rKind, record_date, record_time, shift, title || null, nurse, JSON.stringify(meta)]);
      savedId = result.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Record saved successfully', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function deleteRecord(req, res) {
  try {
    const { id } = req.body;
    await run('DELETE FROM nursing_records WHERE id = ?', [id]);
    res.json({ status: true, msg: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 10. Handover (Shift / SBAR) ─────────────────────────────────────────────
async function listHandovers(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const { all_dates, date } = req.body;

    let sql = 'SELECT * FROM nursing_handovers WHERE patient_id = ?';
    const params = [patient_id];
    if (!all_dates && date) {
      sql += ' AND handover_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY handover_date DESC, handover_time DESC';

    const rows = await query(sql, params);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveHandover(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      handover_date = new Date().toISOString().substring(0, 10),
      handover_time = '08:00', shift = 'Morning',
      handover_from, handover_to,
      sbar_situation, sbar_background, sbar_assessment, sbar_recommendation
    } = body;

    const meta = extractMeta(body);
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_handovers
        SET handover_date = ?, handover_time = ?, shift = ?, handover_from = ?,
            handover_to = ?, sbar_situation = ?, sbar_background = ?,
            sbar_assessment = ?, sbar_recommendation = ?, meta_json = ?
        WHERE id = ?
      `, [
        handover_date, handover_time, shift, handover_from || null, handover_to || null,
        sbar_situation || null, sbar_background || null, sbar_assessment || null,
        sbar_recommendation || null, JSON.stringify(meta), id
      ]);
    } else {
      const resH = await run(`
        INSERT INTO nursing_handovers (
          patient_id, hospital_id, handover_date, handover_time, shift,
          handover_from, handover_to, sbar_situation, sbar_background,
          sbar_assessment, sbar_recommendation, meta_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        patient_id, hospital_id, handover_date, handover_time, shift,
        handover_from || req.session?.user?.full_name || 'Nurse Outgoing',
        handover_to || 'Nurse Incoming',
        sbar_situation || null, sbar_background || null, sbar_assessment || null,
        sbar_recommendation || null, JSON.stringify(meta)
      ]);
      savedId = resH.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Handover report saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 11. Risk Assessments (Morse, Braden, Caprini, etc.) ─────────────────────
async function listRisks(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query('SELECT * FROM nursing_risks WHERE patient_id = ? ORDER BY assessment_date DESC', [patient_id]);
    const data = rows.map(r => ({
      ...r,
      details: safeJson(r.details_json, {})
    }));
    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveRisk(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      risk_type = 'morse',
      assessment_date = new Date().toISOString().substring(0, 10),
      assessment_time = '08:00',
      score = 0, risk_level = 'Low', assessed_by
    } = body;

    const details = extractMeta(body);
    const nurse = assessed_by || req.session?.user?.full_name || 'Staff Nurse';
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_risks
        SET risk_type = ?, assessment_date = ?, assessment_time = ?,
            score = ?, risk_level = ?, details_json = ?, assessed_by = ?
        WHERE id = ?
      `, [risk_type, assessment_date, assessment_time, parseInt(score, 10) || 0, risk_level, JSON.stringify(details), nurse, id]);
    } else {
      const result = await run(`
        INSERT INTO nursing_risks (
          patient_id, hospital_id, risk_type, assessment_date, assessment_time,
          score, risk_level, details_json, assessed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [patient_id, hospital_id, risk_type, assessment_date, assessment_time, parseInt(score, 10) || 0, risk_level, JSON.stringify(details), nurse]);
      savedId = result.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Risk assessment saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 12. FAST HUG BID ────────────────────────────────────────────────────────
async function listFastHug(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query('SELECT * FROM nursing_fasthug WHERE patient_id = ? ORDER BY record_date DESC', [patient_id]);
    const data = rows.map(r => ({
      ...r,
      items: safeJson(r.items_json, {})
    }));
    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveFastHug(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      record_date = new Date().toISOString().substring(0, 10),
      record_time = '08:00', shift = 'Morning',
      notes, assessed_by
    } = body;

    const items = extractMeta(body);
    const nurse = assessed_by || req.session?.user?.full_name || 'Staff Nurse';
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_fasthug
        SET record_date = ?, record_time = ?, shift = ?, items_json = ?,
            assessed_by = ?, notes = ?
        WHERE id = ?
      `, [record_date, record_time, shift, JSON.stringify(items), nurse, notes || null, id]);
    } else {
      const resF = await run(`
        INSERT INTO nursing_fasthug (
          patient_id, hospital_id, record_date, record_time, shift,
          items_json, assessed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [patient_id, hospital_id, record_date, record_time, shift, JSON.stringify(items), nurse, notes || null]);
      savedId = resF.lastInsertRowid;
    }

    res.json({ status: true, msg: 'FAST HUG BID bundle saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 13. Restraint Administration ────────────────────────────────────────────
async function listRestraint(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query('SELECT * FROM nursing_restraint WHERE patient_id = ? ORDER BY record_date DESC', [patient_id]);
    const data = rows.map(r => ({
      ...r,
      observations: safeJson(r.observations_json, []),
      meta: safeJson(r.meta_json, {})
    }));
    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveRestraint(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      record_date = new Date().toISOString().substring(0, 10),
      start_time = '08:00', end_time, restraint_type, reason, doctor_order, status = 'Active'
    } = body;

    const meta = extractMeta(body);
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_restraint
        SET record_date = ?, start_time = ?, end_time = ?, restraint_type = ?,
            reason = ?, doctor_order = ?, meta_json = ?, status = ?
        WHERE id = ?
      `, [record_date, start_time, end_time || null, restraint_type || null, reason || null, doctor_order || null, JSON.stringify(meta), status, id]);
    } else {
      const resR = await run(`
        INSERT INTO nursing_restraint (
          patient_id, hospital_id, record_date, start_time, end_time,
          restraint_type, reason, doctor_order, meta_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [patient_id, hospital_id, record_date, start_time, end_time || null, restraint_type || null, reason || null, doctor_order || null, JSON.stringify(meta), status]);
      savedId = resR.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Restraint record saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 14. Care Plans ──────────────────────────────────────────────────────────
async function listCarePlans(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const rows = await query('SELECT * FROM nursing_careplans WHERE patient_id = ? ORDER BY plan_date DESC', [patient_id]);
    const data = rows.map(r => ({
      ...r,
      meta: safeJson(r.meta_json, {})
    }));
    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

async function saveCarePlan(req, res) {
  try {
    const body = req.body;
    const {
      id, patient_id = 3177250, hospital_id = 431,
      plan_date = new Date().toISOString().substring(0, 10),
      problem, goal, interventions, evaluation, status = 'Active', nurse_name
    } = body;

    const meta = extractMeta(body);
    const nurse = nurse_name || req.session?.user?.full_name || 'Staff Nurse';
    let savedId = id;

    if (id) {
      await run(`
        UPDATE nursing_careplans
        SET plan_date = ?, problem = ?, goal = ?, interventions = ?,
            evaluation = ?, status = ?, nurse_name = ?, meta_json = ?
        WHERE id = ?
      `, [plan_date, problem, goal || null, interventions || null, evaluation || null, status, nurse, JSON.stringify(meta), id]);
    } else {
      const resPlan = await run(`
        INSERT INTO nursing_careplans (
          patient_id, hospital_id, plan_date, problem, goal,
          interventions, evaluation, status, nurse_name, meta_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [patient_id, hospital_id, plan_date, problem, goal || null, interventions || null, evaluation || null, status, nurse, JSON.stringify(meta)]);
      savedId = resPlan.lastInsertRowid;
    }

    res.json({ status: true, msg: 'Care plan saved', id: savedId });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── 15. Dates Strip (Orange Dots indicator) ─────────────────────────────────
async function listDates(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const kind = req.body.kind || 'assessment';

    let table = 'nursing_assessments';
    let dateCol = 'assessment_date';

    if (kind === 'vitals') { table = 'nursing_vitals'; dateCol = 'vital_date'; }
    else if (kind === 'io') { table = 'nursing_io'; dateCol = 'io_date'; }
    else if (kind === 'notes') { table = 'nursing_notes'; dateCol = 'note_date'; }
    else if (kind === 'diabetic') { table = 'nursing_diabetic'; dateCol = 'record_date'; }
    else if (kind === 'icu') { table = 'nursing_icu'; dateCol = 'chart_date'; }
    else if (kind === 'record') { table = 'nursing_records'; dateCol = 'record_date'; }
    else if (kind === 'handover') { table = 'nursing_handovers'; dateCol = 'handover_date'; }
    else if (kind === 'restraint') { table = 'nursing_restraint'; dateCol = 'record_date'; }

    const rows = await query(`
      SELECT DISTINCT ${dateCol} AS dt
      FROM ${table}
      WHERE patient_id = ? AND ${dateCol} IS NOT NULL
    `, [patient_id]);

    const dates = rows.map(r => r.dt.substring(0, 10));
    res.json({ status: true, data: dates });
  } catch (err) {
    res.json({ status: true, data: [] });
  }
}

// ── 16. Consolidated Clinical Report ────────────────────────────────────────
async function getReport(req, res) {
  try {
    const patient_id = req.body.patient_id || req.query.patient_id || 3177250;
    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [patient_id]);
    const assessments = await query('SELECT * FROM nursing_assessments WHERE patient_id = ? ORDER BY assessment_date DESC LIMIT 5', [patient_id]);
    const vitals = await query('SELECT * FROM nursing_vitals WHERE patient_id = ? ORDER BY vital_date DESC, vital_time DESC LIMIT 10', [patient_id]);
    const emar = await query('SELECT * FROM nursing_emar WHERE patient_id = ? AND status = "Active"', [patient_id]);
    const notes = await query('SELECT * FROM nursing_notes WHERE patient_id = ? ORDER BY note_date DESC LIMIT 5', [patient_id]);

    res.json({
      status: true,
      data: {
        patient,
        assessments: assessments.map(a => ({ ...a, meta: safeJson(a.meta_json) })),
        vitals,
        activeMedications: emar,
        latestNotes: notes
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, msg: err.message });
  }
}

// ── PDF Mock / Preview Endpoints ────────────────────────────────────────────
async function previewPdf(req, res) {
  res.send(`
    <html>
      <head>
        <title>Presco Digital Nursing - Clinical Document Preview</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111827; }
          .header { border-bottom: 2px solid #0D9488; padding-bottom: 15px; margin-bottom: 20px; }
          .header h2 { margin: 0; color: #0D9488; }
          .badge { background: #E6FAF5; color: #0D9488; padding: 4px 10px; border-radius: 999px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PRESCO HOSPITAL &amp; HEALTHCARE</h2>
          <div>Digital Nursing Clinical Summary Document</div>
        </div>
        <p><span class="badge">PRINT RECORD PREVIEW</span></p>
        <p>Patient: <b>JAGDISHBHAI AHUJA</b> (UHID: AS6767 · IPD: IP/2026-2027/1619)</p>
        <p>Document generated on: <b>${new Date().toLocaleString()}</b></p>
        <hr/>
        <p>All clinical signatures and nursing observation logs are verified and archived.</p>
        <button onclick="window.print()" style="background:#0D9488;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">
          Print to PDF
        </button>
      </body>
    </html>
  `);
}

module.exports = {
  listAssessments, saveAssessment, deleteAssessment,
  listEmar, saveEmar, stopEmar, deleteEmar, administerEmar, searchMedicines,
  listEtar, saveEtar, administerEtar,
  listVitals, saveVitals, deleteVitals,
  listIcu, saveIcu, listIcuObs, saveIcuObs,
  listNotes, saveNotes, deleteNotes,
  listIo, saveIo, deleteIo,
  listDiabetic, saveDiabetic, auditDiabetic,
  listRecords, saveRecord, deleteRecord,
  listHandovers, saveHandover,
  listRisks, saveRisk,
  listFastHug, saveFastHug,
  listRestraint, saveRestraint,
  listCarePlans, saveCarePlan,
  listDates,
  getReport,
  previewPdf
};
