const path = require('path');
const fs = require('fs');
const { query, queryOne, run } = require('../database/connection');

// Safe, zero-dependency HTML sanitizer (XSS protection)
function sanitizeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*(["'])?[^"'>]*\1?/gi, '')
    .replace(/javascript:/gi, '');
}

function safeJson(val, fallback = {}) {
  if (typeof val === 'object' && val !== null) return val;
  try {
    return JSON.parse(val || (Array.isArray(fallback) ? '[]' : '{}'));
  } catch (e) {
    return fallback;
  }
}

// ── Render Form for User / Patient ──────────────────────────────────────────
async function renderFormPage(req, res) {
  try {
    const { slug } = req.params;
    const form = await queryOne('SELECT * FROM forms WHERE slug = ?', [slug]);

    if (!form) {
      return res.status(404).render('error', { title: 'Form Not Found', message: `No form found with slug "${slug}".` });
    }

    // Allow drafts to be previewed if preview query param is present
    const isPreview = req.query.preview === '1' || req.query.preview === 'true';
    if (form.status !== 'published' && !isPreview) {
      return res.status(403).render('error', {
        title: 'Form Unavailable',
        message: 'This form is currently in draft mode and is not accepting submissions.'
      });
    }

    form.settings = safeJson(form.settings, {});

    // Sections
    const sections = await query(`
      SELECT * FROM form_sections
      WHERE form_id = ?
      ORDER BY sort_order ASC, id ASC
    `, [form.id]);

    // Form fields
    const formFields = await query(`
      SELECT ff.id AS form_field_id, ff.section_id, ff.sort_order, ff.column_span,
             ff.overrides, ff.conditional_rules,
             f.id AS field_id, f.name, f.label, f.description, f.field_type,
             f.is_required, f.default_value, f.placeholder, f.validation_rules,
             f.error_messages, f.min_value, f.max_value, f.min_length, f.max_length,
             f.options
      FROM form_fields ff
      JOIN fields f ON f.id = ff.field_id
      WHERE ff.form_id = ? AND ff.is_active = 1
      ORDER BY ff.sort_order ASC, ff.id ASC
    `, [form.id]);

    const parsedFields = formFields.map(ff => {
      const overrides = safeJson(ff.overrides, {});
      return {
        ...ff,
        overrides,
        conditional_rules: safeJson(ff.conditional_rules, []),
        options: safeJson(ff.options, []),
        validation_rules: safeJson(ff.validation_rules, {}),
        error_messages: safeJson(ff.error_messages, {}),
        // Apply overrides if specified
        effective_label: overrides.label || ff.label,
        effective_required: overrides.is_required !== undefined ? overrides.is_required : ff.is_required,
        effective_placeholder: overrides.placeholder !== undefined ? overrides.placeholder : ff.placeholder,
        effective_help: overrides.description !== undefined ? overrides.description : ff.description
      };
    });

    const structuredSections = sections.map(sec => ({
      ...sec,
      conditional_rules: safeJson(sec.conditional_rules, []),
      fields: parsedFields.filter(f => f.section_id === sec.id)
    }));

    const unassigned = parsedFields.filter(f => !f.section_id);
    if (unassigned.length > 0) {
      structuredSections.push({
        id: 0,
        title: 'Additional Details',
        description: '',
        columns: 2,
        conditional_rules: [],
        fields: unassigned
      });
    }

    // Patients list for quick selection in clinical settings
    const patients = await query('SELECT id, uhid, full_name, age, gender, ward, bed_number FROM patients WHERE is_active = 1 ORDER BY full_name ASC');

    res.render('forms/renderer', {
      title: `${form.name} | Presco Form`,
      form,
      sections: structuredSections,
      patients,
      isPreview,
      currentUser: req.session?.user || null
    });
  } catch (err) {
    console.error('Render form error:', err);
    res.status(500).render('error', { title: 'Server Error', message: err.message });
  }
}

// ── Form Submission Handler ─────────────────────────────────────────────────
async function submitForm(req, res) {
  try {
    const { slug } = req.params;
    const form = await queryOne('SELECT * FROM forms WHERE slug = ?', [slug]);

    if (!form) {
      return res.status(404).json({ success: false, msg: 'Form not found' });
    }

    const isPreview = req.query.preview === '1' || req.body.__is_preview === '1';
    if (form.status !== 'published' && !isPreview) {
      return res.status(400).json({ success: false, msg: 'This form is not published yet.' });
    }

    // Get active fields in this form
    const formFields = await query(`
      SELECT ff.id AS form_field_id, ff.overrides,
             f.id AS field_id, f.name, f.label, f.field_type, f.is_required,
             f.min_value, f.max_value, f.min_length, f.max_length,
             f.validation_rules, f.error_messages
      FROM form_fields ff
      JOIN fields f ON f.id = ff.field_id
      WHERE ff.form_id = ? AND ff.is_active = 1
    `, [form.id]);

    const errors = {};
    const submissionData = {};

    // Process text / select inputs
    for (const ff of formFields) {
      const overrides = safeJson(ff.overrides, {});
      const isReq = overrides.is_required !== undefined ? overrides.is_required : ff.is_required;
      const vRules = safeJson(ff.validation_rules, {});
      const eMsgs = safeJson(ff.error_messages, {});

      let val = req.body[ff.name];

      // Handle multiselect / checkbox arrays
      if (Array.isArray(val)) {
        submissionData[ff.name] = val;
        if (isReq && val.length === 0) {
          errors[ff.name] = eMsgs.required || `${overrides.label || ff.label} is required.`;
        }
        continue;
      }

      // Handle boolean switch
      if (ff.field_type === 'boolean') {
        submissionData[ff.name] = val === 'true' || val === '1' || val === 'on' || val === true;
        continue;
      }

      // Handle file or image fields
      if (ff.field_type === 'file' || ff.field_type === 'image') {
        const fileObj = req.files ? req.files.find(f => f.fieldname === ff.name) : null;
        if (fileObj) {
          submissionData[ff.name] = `/uploads/${fileObj.filename}`;
        } else if (val) {
          submissionData[ff.name] = val; // existing uploaded path
        } else if (isReq) {
          errors[ff.name] = eMsgs.required || `${overrides.label || ff.label} file attachment is required.`;
        }
        continue;
      }

      // String sanitization & checks
      const strVal = val !== undefined && val !== null ? String(val).trim() : '';
      if (strVal !== '') {
        submissionData[ff.name] = sanitizeHtml(strVal);
      } else {
        submissionData[ff.name] = null;
      }

      // Required check
      if (isReq && (submissionData[ff.name] === null || submissionData[ff.name] === '')) {
        errors[ff.name] = eMsgs.required || `${overrides.label || ff.label} is required.`;
        continue;
      }

      if (submissionData[ff.name] !== null && submissionData[ff.name] !== '') {
        // Number range check
        if (ff.field_type === 'number') {
          const num = parseFloat(submissionData[ff.name]);
          if (isNaN(num)) {
            errors[ff.name] = 'Must be a valid number.';
          } else {
            if (ff.min_value !== null && num < ff.min_value) {
              errors[ff.name] = `Value must be at least ${ff.min_value}.`;
            }
            if (ff.max_value !== null && num > ff.max_value) {
              errors[ff.name] = `Value cannot exceed ${ff.max_value}.`;
            }
          }
        }

        // Email check
        if (ff.field_type === 'email') {
          const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
          if (!emailRegex.test(submissionData[ff.name])) {
            errors[ff.name] = eMsgs.pattern || 'Invalid email address.';
          }
        }

        // Length checks
        if (ff.min_length !== null && submissionData[ff.name].length < ff.min_length) {
          errors[ff.name] = `Must be at least ${ff.min_length} characters.`;
        }
        if (ff.max_length !== null && submissionData[ff.name].length > ff.max_length) {
          errors[ff.name] = `Cannot exceed ${ff.max_length} characters.`;
        }

        // Regex pattern check
        if (vRules.pattern) {
          try {
            const regex = new RegExp(vRules.pattern);
            if (!regex.test(submissionData[ff.name])) {
              errors[ff.name] = eMsgs.pattern || 'Format does not match required pattern.';
            }
          } catch (e) {
            // ignore regex syntax error
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({
        success: false,
        msg: 'Validation errors found in submitted form.',
        errors
      });
    }

    // Look up latest published version id
    const latestVersion = await queryOne(`
      SELECT id FROM form_versions
      WHERE form_id = ?
      ORDER BY version_number DESC LIMIT 1
    `, [form.id]);

    const patientId = req.body.patient_id ? parseInt(req.body.patient_id, 10) : null;
    const hospitalId = req.body.hospital_id ? parseInt(req.body.hospital_id, 10) : (req.session?.user?.hospital_id || 1);
    const userId = req.session?.user?.id || null;

    const result = await run(`
      INSERT INTO form_submissions (
        form_id, form_version_id, submitted_by, patient_id, hospital_id,
        data, status, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
    `, [
      form.id,
      latestVersion?.id || null,
      userId,
      patientId,
      hospitalId,
      JSON.stringify(submissionData),
      req.ip || '127.0.0.1',
      req.headers['user-agent'] || 'Browser'
    ]);

    const submissionId = result.lastInsertRowid;

    // Save uploaded files metadata
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const matchingField = formFields.find(f => f.name === file.fieldname);
        if (matchingField) {
          await run(`
            INSERT INTO form_submission_files (
              submission_id, field_id, file_name, original_name, mime_type, file_size, file_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            submissionId,
            matchingField.field_id,
            file.filename,
            file.originalname,
            file.mimetype,
            file.size,
            `/uploads/${file.filename}`
          ]);
        }
      }
    }

    res.status(201).json({
      success: true,
      msg: 'Form submitted successfully!',
      submission_id: submissionId,
      data: submissionData
    });
  } catch (err) {
    console.error('Submit form error:', err);
    res.status(500).json({ success: false, msg: err.message });
  }
}

// ── Submissions Review & Details ────────────────────────────────────────────
async function getSubmissions(req, res) {
  try {
    const { formId } = req.params;
    const { patient_id, date_from, date_to } = req.query;

    let sql = `
      SELECT s.*,
             p.uhid AS patient_uhid, p.full_name AS patient_name,
             u.full_name AS submitter_name,
             fv.version_number
      FROM form_submissions s
      LEFT JOIN patients p ON p.id = s.patient_id
      LEFT JOIN users u ON u.id = s.submitted_by
      LEFT JOIN form_versions fv ON fv.id = s.form_version_id
      WHERE s.form_id = ?
    `;
    const params = [formId];

    if (patient_id) {
      sql += ' AND s.patient_id = ?';
      params.push(patient_id);
    }
    if (date_from) {
      sql += ' AND date(s.created_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND date(s.created_at) <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY s.created_at DESC';

    const submissions = await query(sql, params);
    const parsed = submissions.map(s => ({
      ...s,
      data: safeJson(s.data, {})
    }));

    res.json({ success: true, data: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function getSubmissionDetail(req, res) {
  try {
    const { submissionId } = req.params;

    const submission = await queryOne(`
      SELECT s.*, f.name AS form_name, f.slug AS form_slug,
             p.uhid AS patient_uhid, p.full_name AS patient_name,
             u.full_name AS submitter_name,
             fv.version_number
      FROM form_submissions s
      JOIN forms f ON f.id = s.form_id
      LEFT JOIN patients p ON p.id = s.patient_id
      LEFT JOIN users u ON u.id = s.submitted_by
      LEFT JOIN form_versions fv ON fv.id = s.form_version_id
      WHERE s.id = ?
    `, [submissionId]);

    if (!submission) {
      return res.status(404).json({ success: false, msg: 'Submission not found' });
    }

    submission.data = safeJson(submission.data, {});

    // Uploaded files
    const files = await query(`
      SELECT sf.*, f.name AS field_name, f.label AS field_label
      FROM form_submission_files sf
      JOIN fields f ON f.id = sf.field_id
      WHERE sf.submission_id = ?
    `, [submissionId]);

    // Field labels for display mapping
    const formFields = await query(`
      SELECT f.name, f.label, f.field_type
      FROM form_fields ff
      JOIN fields f ON f.id = ff.field_id
      WHERE ff.form_id = ?
    `, [submission.form_id]);

    const fieldMap = {};
    formFields.forEach(f => { fieldMap[f.name] = f; });

    res.json({
      success: true,
      data: {
        ...submission,
        files,
        fieldMap
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

module.exports = {
  renderFormPage,
  submitForm,
  getSubmissions,
  getSubmissionDetail
};
