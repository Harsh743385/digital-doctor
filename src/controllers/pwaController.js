const { query } = require('../database/connection');

async function renderTab(req, res) {
  res.render('pwa/tab', {
    title: 'Presco Tab — Bedside EMR PWA',
    currentUser: req.session?.user || null
  });
}

async function getMe(req, res) {
  const user = req.session?.user;
  res.json({
    status: 1,
    user_id: user?.id || 1,
    user_name: user?.full_name || 'System Administrator',
    user_type: user?.role || 'admin',
    email_id: user?.email || 'admin@presco.local',
    mobile_no: '+91 79 4000 8000',
    hospital_id: user?.hospital_id || 1,
    hospital_name: 'Presco Hospital (ASH)',
    hospital_code: 'ASH',
    can_clone_pages: 1,
    want_float_register: 0,
    timestamp_in_seal: 1,
    eraser_password_hash: '',
    audit_password_hash: '',
    super_audit_password_hash: ''
  });
}

async function getPatients(req, res) {
  try {
    const rawPatients = await query(`
      SELECT p.*, h.name as hospital_name 
      FROM patients p 
      LEFT JOIN hospitals h ON p.hospital_id = h.id 
      WHERE p.is_active = 1
      ORDER BY p.id ASC
    `);

    const patients = rawPatients.map((p, idx) => {
      const names = (p.full_name || 'Patient').split(' ');
      const initials = names.map(n => n[0]).join('').substring(0, 2).toUpperCase();
      return {
        id: p.id,
        name: p.full_name,
        uhid: p.uhid,
        ipd: p.ipd_number,
        age: p.age || '42 Y',
        gender: p.gender || 'Male',
        bed: p.bed_number || 'Bed-01',
        bed_class: p.ward || 'General Ward',
        ward: p.ward || 'General Ward',
        consultant: 'Dr. Suresh Patel, MD',
        doctor_name: 'Dr. Suresh Patel, MD',
        provisional_diagnosis: p.diagnosis || 'Clinical Investigation',
        final_diagnosis: p.diagnosis || 'Clinical Investigation',
        admitted_at: p.admission_date || '2026-10-30',
        discharged_at: p.discharge_date || null,
        pmode_label: 'Cash / TPA',
        blood_group: 'B+ve',
        day: `Day ${idx + 2}`,
        initials,
        status: 'live',
        mlc: 0,
        allergic: 'None known',
        precautive: 'Fall Risk Assessment Score: Normal'
      };
    });

    res.json({
      status: 1,
      patients,
      total: patients.length,
      has_more: false,
      mode_counts: {
        live: patients.length,
        history: 0,
        cancelled: 0
      }
    });
  } catch (err) {
    console.error('Error fetching PWA patients:', err);
    res.status(500).json({ status: 0, error: err.message, patients: [] });
  }
}

async function getPatientCategoryCounts(req, res) {
  res.json({
    status: 1,
    counts: {},
    locks: {}
  });
}

async function getPaymentCategories(req, res) {
  res.json({
    status: 1,
    items: [],
    pmodeLabel: 'Cash / TPA'
  });
}

async function getCategories(req, res) {
  res.json({
    status: 1,
    categories: []
  });
}

async function getStamps(req, res) {
  res.json({
    status: 1,
    stamps: []
  });
}

async function getRegisterBooks(req, res) {
  res.json({
    status: 1,
    items: []
  });
}

module.exports = {
  renderTab,
  getMe,
  getPatients,
  getPatientCategoryCounts,
  getPaymentCategories,
  getCategories,
  getStamps,
  getRegisterBooks
};
