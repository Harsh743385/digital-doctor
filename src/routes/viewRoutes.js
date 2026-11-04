const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { query, queryOne } = require('../database/connection');

// Home -> Dashboard (if authenticated) or Login
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// Dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const fieldsCount = (await queryOne('SELECT COUNT(*) AS c FROM fields WHERE is_active = 1'))?.c || 0;
    const formsCount = (await queryOne('SELECT COUNT(*) AS c FROM forms'))?.c || 0;
    const submissionsCount = (await queryOne('SELECT COUNT(*) AS c FROM form_submissions'))?.c || 0;
    const patientsCount = (await queryOne('SELECT COUNT(*) AS c FROM patients WHERE is_active = 1'))?.c || 0;
    const recentSubmissions = await query(`
      SELECT s.*, f.name AS form_name, f.slug AS form_slug, p.full_name AS patient_name
      FROM form_submissions s
      JOIN forms f ON f.id = s.form_id
      LEFT JOIN patients p ON p.id = s.patient_id
      ORDER BY s.created_at DESC LIMIT 5
    `);
    const recentForms = await query(`
      SELECT f.*,
             (SELECT COUNT(*) FROM form_fields ff WHERE ff.form_id = f.id) AS field_count
      FROM forms f
      ORDER BY f.updated_at DESC LIMIT 6
    `);

    res.render('dashboard', {
      title: 'Dashboard | Presco Digital Nursing & Form Builder',
      currentUser: req.session.user,
      stats: { fieldsCount, formsCount, submissionsCount, patientsCount },
      recentSubmissions,
      recentForms
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: err.message });
  }
});

// Field Master UI
router.get('/admin/fields', isAuthenticated, async (req, res) => {
  try {
    const categories = await query('SELECT * FROM field_categories ORDER BY sort_order ASC, name ASC');
    res.render('admin/fields', {
      title: 'Field Master Management | Presco',
      currentUser: req.session.user,
      categories
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: err.message });
  }
});

// Forms List UI
router.get('/admin/forms', isAuthenticated, async (req, res) => {
  try {
    res.render('admin/forms', {
      title: 'Dynamic Form Builder & Versioning | Presco',
      currentUser: req.session.user
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: err.message });
  }
});

// Dynamic Form Builder UI
router.get('/admin/forms/:id/builder', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const form = await queryOne('SELECT * FROM forms WHERE id = ? OR slug = ?', [id, id]);
    if (!form) {
      return res.status(404).render('error', { title: 'Not Found', message: 'Form not found' });
    }

    const categories = await query('SELECT * FROM field_categories ORDER BY sort_order ASC');

    res.render('admin/form-builder', {
      title: `Form Builder: ${form.name} | Presco`,
      currentUser: req.session.user,
      form,
      categories
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: err.message });
  }
});

// Form Submissions Review UI
router.get('/admin/forms/:id/submissions', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const form = await queryOne('SELECT * FROM forms WHERE id = ?', [id]);
    if (!form) {
      return res.status(404).render('error', { title: 'Not Found', message: 'Form not found' });
    }

    res.render('forms/submissions', {
      title: `Submissions: ${form.name} | Presco`,
      currentUser: req.session.user,
      form
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: err.message });
  }
});

// Integrated Presco Digital Nursing Workspace
router.get(['/cms/digital-nursing', '/nursing'], isAuthenticated, async (req, res) => {
  try {
    const requestedPatientId = req.query.patient_id || req.session?.currentPatientId || 3177250;
    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [requestedPatientId]) ||
                    await queryOne('SELECT * FROM patients WHERE is_active = 1 LIMIT 1') || {
      id: 3177250,
      uhid: 'AS6767',
      ipd_number: 'IP/2026-2027/1619',
      full_name: 'JAGDISHBHAI AHUJA',
      age: '42 Y, 2 M, 12 D',
      gender: 'Male',
      ward: 'ICU Ward A',
      bed_number: 'ICU-04'
    };

    req.session.currentPatientId = patient.id;
    const allPatients = await query('SELECT id, uhid, ipd_number, full_name, ward, bed_number FROM patients WHERE is_active = 1 ORDER BY id ASC');

    res.render('nursing/workspace', {
      title: 'Digital Nursing Workspace | Presco IPD',
      currentUser: req.session.user,
      patient,
      allPatients,
      hospital: { id: 431, name: 'Anand Surgical Hospital Pvt Ltd', code: 'ASH' }
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: err.message });
  }
});

// Integrated Presco Digital Doctor Workspace (NABH Clinical Documentation)
router.get(['/cms/digital-doctor', '/doctor', '/doctor/workspace'], isAuthenticated, async (req, res) => {
  try {
    const requestedPatientId = req.query.patient_id || req.session?.currentPatientId || 3177250;
    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [requestedPatientId]) ||
                    await queryOne('SELECT * FROM patients WHERE is_active = 1 LIMIT 1') || {
      id: 3177250,
      uhid: '1295669005',
      ipd_number: '20091567',
      full_name: 'DEMO PATIENT',
      age: '45 Y, 4 M',
      gender: 'Male',
      ward: 'Special Ward 1',
      bed_number: 'SW-01',
      admitting_consultant: 'Dr. Sanghavi'
    };

    req.session.currentPatientId = patient.id;
    const allPatients = await query('SELECT id, uhid, ipd_number, full_name, ward, bed_number FROM patients WHERE is_active = 1 ORDER BY id ASC');

    res.render('doctor/workspace', {
      title: 'Digital Doctor Workspace | Anand Surgical Hospital (Presco EMR)',
      currentUser: req.session.user,
      patient,
      allPatients,
      hospital: { id: 431, name: 'Anand Surgical Hospital Pvt Ltd', code: 'ASH' }
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: err.message });
  }
});

module.exports = router;
