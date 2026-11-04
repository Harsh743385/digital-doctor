const { query, queryOne, run } = require('../database/connection');

function safeJson(val, fallback = {}) {
  if (typeof val === 'object' && val !== null) return val;
  try {
    return JSON.parse(val || (Array.isArray(fallback) ? '[]' : '{}'));
  } catch (e) {
    return fallback;
  }
}

// ── Forms Listing & Management ──────────────────────────────────────────────
async function getForms(req, res) {
  try {
    const { status, category, search } = req.query;

    let sql = `
      SELECT f.*,
             (SELECT COUNT(*) FROM form_sections s WHERE s.form_id = f.id) AS section_count,
             (SELECT COUNT(*) FROM form_fields ff WHERE ff.form_id = f.id) AS field_count,
             (SELECT COUNT(*) FROM form_submissions sub WHERE sub.form_id = f.id) AS submission_count,
             u.full_name AS creator_name
      FROM forms f
      LEFT JOIN users u ON u.id = f.created_by
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND f.status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND f.category = ?';
      params.push(category);
    }
    if (search && search.trim()) {
      sql += ' AND (f.name LIKE ? OR f.description LIKE ? OR f.slug LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY f.updated_at DESC';

    const forms = await query(sql, params);
    const formatted = forms.map(f => ({
      ...f,
      settings: safeJson(f.settings, {})
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function getFormById(req, res) {
  try {
    const { id } = req.params;
    const form = await queryOne(`
      SELECT f.*, u.full_name AS creator_name
      FROM forms f
      LEFT JOIN users u ON u.id = f.created_by
      WHERE f.id = ? OR f.slug = ?
    `, [id, id]);

    if (!form) {
      return res.status(404).json({ success: false, msg: 'Form not found' });
    }

    form.settings = safeJson(form.settings, {});

    // Fetch Sections
    const sections = await query(`
      SELECT * FROM form_sections
      WHERE form_id = ?
      ORDER BY sort_order ASC, id ASC
    `, [form.id]);

    // Fetch all Form Fields joined with Master Fields
    const formFields = await query(`
      SELECT ff.id AS form_field_id, ff.form_id, ff.section_id, ff.sort_order,
             ff.column_span, ff.overrides, ff.conditional_rules, ff.is_active AS form_field_active,
             f.id AS field_id, f.name, f.label, f.description, f.field_type,
             f.is_required, f.default_value, f.placeholder, f.validation_rules,
             f.error_messages, f.min_value, f.max_value, f.min_length, f.max_length,
             f.options, f.category_id,
             c.name AS category_name
      FROM form_fields ff
      JOIN fields f ON f.id = ff.field_id
      LEFT JOIN field_categories c ON c.id = f.category_id
      WHERE ff.form_id = ?
      ORDER BY ff.sort_order ASC, ff.id ASC
    `, [form.id]);

    // Parse JSON fields
    const parsedFields = formFields.map(ff => ({
      ...ff,
      overrides: safeJson(ff.overrides, {}),
      conditional_rules: safeJson(ff.conditional_rules, []),
      options: safeJson(ff.options, []),
      validation_rules: safeJson(ff.validation_rules, {}),
      error_messages: safeJson(ff.error_messages, {})
    }));

    // Group fields into their sections
    const sectionsWithFields = sections.map(sec => ({
      ...sec,
      conditional_rules: safeJson(sec.conditional_rules, []),
      fields: parsedFields.filter(f => f.section_id === sec.id)
    }));

    // Any unassigned fields
    const unassignedFields = parsedFields.filter(f => !f.section_id);

    // Fetch versions
    const versions = await query(`
      SELECT id, version_number, published_at, created_at
      FROM form_versions
      WHERE form_id = ?
      ORDER BY version_number DESC
    `, [form.id]);

    res.json({
      success: true,
      data: {
        ...form,
        sections: sectionsWithFields,
        unassignedFields,
        versions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function createForm(req, res) {
  try {
    const { name, slug, description, category, settings } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, msg: 'Form name is required' });
    }

    const formSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await queryOne('SELECT id FROM forms WHERE slug = ?', [formSlug]);
    if (existing) {
      return res.status(400).json({ success: false, msg: `Form with slug "${formSlug}" already exists` });
    }

    const userId = req.session?.user?.id || 1;
    const formSettings = typeof settings === 'string' ? settings : JSON.stringify(settings || { theme: 'teal', columns: 2 });

    const result = await run(`
      INSERT INTO forms (
        name, slug, description, category, status, version, settings, created_by, updated_by
      ) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?)
    `, [name.trim(), formSlug, description || null, category || 'General', formSettings, userId, userId]);

    const formId = result.lastInsertRowid;

    // Automatically create a default section for quick editing
    await run(`
      INSERT INTO form_sections (form_id, title, description, sort_order, columns)
      VALUES (?, 'General Details', 'Primary section fields', 1, 2)
    `, [formId]);

    const created = await queryOne('SELECT * FROM forms WHERE id = ?', [formId]);
    res.status(201).json({ success: true, msg: 'Form created successfully', data: created });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function updateForm(req, res) {
  try {
    const { id } = req.params;
    const { name, description, category, status, settings } = req.body;

    const existing = await queryOne('SELECT * FROM forms WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, msg: 'Form not found' });
    }

    const formSettings = settings !== undefined
      ? (typeof settings === 'string' ? settings : JSON.stringify(settings))
      : existing.settings;

    await run(`
      UPDATE forms
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          category = COALESCE(?, category),
          status = COALESCE(?, status),
          settings = ?,
          updated_by = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      category || null,
      status || null,
      formSettings,
      req.session?.user?.id || 1,
      id
    ]);

    const updated = await queryOne('SELECT * FROM forms WHERE id = ?', [id]);
    res.json({ success: true, msg: 'Form updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function deleteForm(req, res) {
  try {
    const { id } = req.params;

    // Remove child entries (cascaded by SQLite schema, but explicit for certainty)
    await run('DELETE FROM form_fields WHERE form_id = ?', [id]);
    await run('DELETE FROM form_sections WHERE form_id = ?', [id]);
    await run('DELETE FROM form_versions WHERE form_id = ?', [id]);
    await run('DELETE FROM forms WHERE id = ?', [id]);

    res.json({ success: true, msg: 'Form deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

// ── Sections Management ─────────────────────────────────────────────────────
async function createSection(req, res) {
  try {
    const { form_id } = req.params;
    const { title, description, sort_order, columns, conditional_rules } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, msg: 'Section title is required' });
    }

    const cols = parseInt(columns, 10) || 1;
    const maxOrderRow = await queryOne('SELECT MAX(sort_order) AS max_o FROM form_sections WHERE form_id = ?', [form_id]);
    const nextOrder = (maxOrderRow?.max_o ?? 0) + 1;

    const rules = typeof conditional_rules === 'string' ? conditional_rules : JSON.stringify(conditional_rules || []);

    const result = await run(`
      INSERT INTO form_sections (form_id, title, description, sort_order, columns, conditional_rules)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [form_id, title.trim(), description || null, sort_order ?? nextOrder, Math.min(Math.max(cols, 1), 4), rules]);

    const created = await queryOne('SELECT * FROM form_sections WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, msg: 'Section created successfully', data: created });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function updateSection(req, res) {
  try {
    const { sectionId } = req.params;
    const { title, description, columns, conditional_rules, sort_order } = req.body;

    const existing = await queryOne('SELECT * FROM form_sections WHERE id = ?', [sectionId]);
    if (!existing) {
      return res.status(404).json({ success: false, msg: 'Section not found' });
    }

    const rules = conditional_rules !== undefined
      ? (typeof conditional_rules === 'string' ? conditional_rules : JSON.stringify(conditional_rules))
      : existing.conditional_rules;

    await run(`
      UPDATE form_sections
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          columns = COALESCE(?, columns),
          conditional_rules = ?,
          sort_order = COALESCE(?, sort_order),
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      title ? title.trim() : null,
      description !== undefined ? description : null,
      columns ? parseInt(columns, 10) : null,
      rules,
      sort_order !== undefined ? parseInt(sort_order, 10) : null,
      sectionId
    ]);

    const updated = await queryOne('SELECT * FROM form_sections WHERE id = ?', [sectionId]);
    res.json({ success: true, msg: 'Section updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function deleteSection(req, res) {
  try {
    const { sectionId } = req.params;

    // Unassign fields in this section
    await run('UPDATE form_fields SET section_id = NULL WHERE section_id = ?', [sectionId]);
    await run('DELETE FROM form_sections WHERE id = ?', [sectionId]);

    res.json({ success: true, msg: 'Section deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function reorderSections(req, res) {
  try {
    const { form_id } = req.params;
    const { order } = req.body; // Array of section IDs in new order: [3, 1, 2]

    if (Array.isArray(order)) {
      for (let i = 0; i < order.length; i++) {
        await run('UPDATE form_sections SET sort_order = ? WHERE id = ? AND form_id = ?', [i + 1, order[i], form_id]);
      }
    }

    res.json({ success: true, msg: 'Sections reordered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

// ── Fields in Form Management ───────────────────────────────────────────────
async function addFieldToForm(req, res) {
  try {
    const { form_id } = req.params;
    const { field_id, section_id, column_span, overrides, conditional_rules } = req.body;

    if (!field_id) {
      return res.status(400).json({ success: false, msg: 'field_id is required' });
    }

    const field = await queryOne('SELECT id FROM fields WHERE id = ?', [field_id]);
    if (!field) {
      return res.status(404).json({ success: false, msg: 'Master field not found' });
    }

    const maxOrderRow = await queryOne('SELECT MAX(sort_order) AS max_o FROM form_fields WHERE form_id = ? AND section_id = ?', [form_id, section_id || null]);
    const nextOrder = (maxOrderRow?.max_o ?? 0) + 1;

    const ovr = typeof overrides === 'string' ? overrides : JSON.stringify(overrides || {});
    const rules = typeof conditional_rules === 'string' ? conditional_rules : JSON.stringify(conditional_rules || []);

    const result = await run(`
      INSERT INTO form_fields (form_id, field_id, section_id, sort_order, column_span, overrides, conditional_rules)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [form_id, field_id, section_id || null, nextOrder, parseInt(column_span, 10) || 1, ovr, rules]);

    // Touch form updated_at
    await run('UPDATE forms SET updated_at = datetime(\'now\') WHERE id = ?', [form_id]);

    const created = await queryOne(`
      SELECT ff.*, f.name, f.label, f.field_type
      FROM form_fields ff
      JOIN fields f ON f.id = ff.field_id
      WHERE ff.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({ success: true, msg: 'Field added to form', data: created });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function updateFormField(req, res) {
  try {
    const { formFieldId } = req.params;
    const { section_id, sort_order, column_span, overrides, conditional_rules, is_active } = req.body;

    const existing = await queryOne('SELECT * FROM form_fields WHERE id = ?', [formFieldId]);
    if (!existing) {
      return res.status(404).json({ success: false, msg: 'Form field not found' });
    }

    const ovr = overrides !== undefined
      ? (typeof overrides === 'string' ? overrides : JSON.stringify(overrides))
      : existing.overrides;

    const rules = conditional_rules !== undefined
      ? (typeof conditional_rules === 'string' ? conditional_rules : JSON.stringify(conditional_rules))
      : existing.conditional_rules;

    await run(`
      UPDATE form_fields
      SET section_id = COALESCE(?, section_id),
          sort_order = COALESCE(?, sort_order),
          column_span = COALESCE(?, column_span),
          overrides = ?,
          conditional_rules = ?,
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      section_id !== undefined ? (section_id ? parseInt(section_id, 10) : null) : null,
      sort_order !== undefined ? parseInt(sort_order, 10) : null,
      column_span ? parseInt(column_span, 10) : null,
      ovr,
      rules,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      formFieldId
    ]);

    await run('UPDATE forms SET updated_at = datetime(\'now\') WHERE id = ?', [existing.form_id]);

    const updated = await queryOne('SELECT * FROM form_fields WHERE id = ?', [formFieldId]);
    res.json({ success: true, msg: 'Form field updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function removeFieldFromForm(req, res) {
  try {
    const { formFieldId } = req.params;
    const existing = await queryOne('SELECT form_id FROM form_fields WHERE id = ?', [formFieldId]);
    if (!existing) {
      return res.status(404).json({ success: false, msg: 'Form field not found' });
    }

    await run('DELETE FROM form_fields WHERE id = ?', [formFieldId]);
    await run('UPDATE forms SET updated_at = datetime(\'now\') WHERE id = ?', [existing.form_id]);

    res.json({ success: true, msg: 'Field removed from form' });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function reorderFormFields(req, res) {
  try {
    const { form_id } = req.params;
    const { items } = req.body; // Array of { formFieldId, section_id, sort_order }

    if (Array.isArray(items)) {
      for (const it of items) {
        await run(`
          UPDATE form_fields
          SET section_id = ?, sort_order = ?
          WHERE id = ? AND form_id = ?
        `, [it.section_id || null, it.sort_order, it.formFieldId, form_id]);
      }
    }

    await run('UPDATE forms SET updated_at = datetime(\'now\') WHERE id = ?', [form_id]);
    res.json({ success: true, msg: 'Form fields reordered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

// ── Publish & Versioning ────────────────────────────────────────────────────
async function publishForm(req, res) {
  try {
    const { id } = req.params;
    const form = await queryOne('SELECT * FROM forms WHERE id = ?', [id]);
    if (!form) {
      return res.status(404).json({ success: false, msg: 'Form not found' });
    }

    // Build snapshot of sections and fields
    const sections = await query('SELECT * FROM form_sections WHERE form_id = ? ORDER BY sort_order ASC', [id]);
    const fields = await query(`
      SELECT ff.*, f.name, f.label, f.field_type, f.placeholder, f.is_required,
             f.default_value, f.validation_rules, f.error_messages, f.options,
             f.min_value, f.max_value, f.min_length, f.max_length
      FROM form_fields ff
      JOIN fields f ON f.id = ff.field_id
      WHERE ff.form_id = ? AND ff.is_active = 1
      ORDER BY ff.sort_order ASC
    `, [id]);

    const snapshot = {
      form: { id: form.id, name: form.name, slug: form.slug, settings: safeJson(form.settings) },
      sections: sections.map(s => ({ ...s, conditional_rules: safeJson(s.conditional_rules) })),
      fields: fields.map(f => ({
        ...f,
        overrides: safeJson(f.overrides),
        conditional_rules: safeJson(f.conditional_rules),
        options: safeJson(f.options),
        validation_rules: safeJson(f.validation_rules),
        error_messages: safeJson(f.error_messages)
      }))
    };

    const newVersionNumber = (form.version || 1) + (form.status === 'published' ? 1 : 0);

    const versionRes = await run(`
      INSERT INTO form_versions (form_id, version_number, snapshot, published_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [id, newVersionNumber, JSON.stringify(snapshot)]);

    await run(`
      UPDATE forms
      SET status = 'published',
          version = ?,
          published_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `, [newVersionNumber, id]);

    res.json({
      success: true,
      msg: `Form published successfully as Version ${newVersionNumber}`,
      data: {
        version: newVersionNumber,
        versionId: versionRes.lastInsertRowid
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function getFormVersions(req, res) {
  try {
    const { id } = req.params;
    const versions = await query(`
      SELECT id, form_id, version_number, published_at, created_at
      FROM form_versions
      WHERE form_id = ?
      ORDER BY version_number DESC
    `, [id]);

    res.json({ success: true, data: versions });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function getFormVersionSnapshot(req, res) {
  try {
    const { versionId } = req.params;
    const version = await queryOne('SELECT * FROM form_versions WHERE id = ?', [versionId]);
    if (!version) {
      return res.status(404).json({ success: false, msg: 'Version snapshot not found' });
    }

    version.snapshot = safeJson(version.snapshot);
    res.json({ success: true, data: version });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function rollbackFormVersion(req, res) {
  try {
    const { id, versionId } = req.params;
    const versionRow = await queryOne('SELECT * FROM form_versions WHERE id = ? AND form_id = ?', [versionId, id]);
    if (!versionRow) {
      return res.status(404).json({ success: false, msg: 'Target version not found for this form' });
    }

    const snapshot = safeJson(versionRow.snapshot);
    if (!snapshot || !snapshot.sections) {
      return res.status(400).json({ success: false, msg: 'Invalid version snapshot' });
    }

    // Clear current sections and form fields
    await run('DELETE FROM form_fields WHERE form_id = ?', [id]);
    await run('DELETE FROM form_sections WHERE form_id = ?', [id]);

    // Restore sections
    const secIdMap = {};
    for (const sec of snapshot.sections) {
      const res = await run(`
        INSERT INTO form_sections (form_id, title, description, sort_order, columns, conditional_rules)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, sec.title, sec.description, sec.sort_order, sec.columns, JSON.stringify(sec.conditional_rules || [])]);
      secIdMap[sec.id] = res.lastInsertRowid;
    }

    // Restore fields
    for (const f of snapshot.fields) {
      const newSecId = f.section_id ? secIdMap[f.section_id] || null : null;
      await run(`
        INSERT INTO form_fields (form_id, field_id, section_id, sort_order, column_span, overrides, conditional_rules, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, f.field_id, newSecId, f.sort_order, f.column_span || 1,
        JSON.stringify(f.overrides || {}), JSON.stringify(f.conditional_rules || []),
        f.is_active ?? 1
      ]);
    }

    await run(`
      UPDATE forms
      SET version = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [versionRow.version_number, id]);

    res.json({ success: true, msg: `Rolled back to Version ${versionRow.version_number} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function cloneForm(req, res) {
  try {
    const { id } = req.params;
    const source = await queryOne('SELECT * FROM forms WHERE id = ?', [id]);
    if (!source) {
      return res.status(404).json({ success: false, msg: 'Source form not found' });
    }

    const cloneName = `${source.name} (Copy)`;
    const cloneSlug = `${source.slug}-copy-${Date.now().toString().slice(-4)}`;

    const formRes = await run(`
      INSERT INTO forms (name, slug, description, category, status, version, settings, created_by, updated_by)
      VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?)
    `, [cloneName, cloneSlug, source.description, source.category, source.settings, req.session?.user?.id || 1, req.session?.user?.id || 1]);

    const newFormId = formRes.lastInsertRowid;

    // Clone sections
    const sections = await query('SELECT * FROM form_sections WHERE form_id = ?', [id]);
    const secMap = {};
    for (const s of sections) {
      const sRes = await run(`
        INSERT INTO form_sections (form_id, title, description, sort_order, columns, conditional_rules)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [newFormId, s.title, s.description, s.sort_order, s.columns, s.conditional_rules]);
      secMap[s.id] = sRes.lastInsertRowid;
    }

    // Clone fields
    const fields = await query('SELECT * FROM form_fields WHERE form_id = ?', [id]);
    for (const f of fields) {
      const newSecId = f.section_id ? secMap[f.section_id] || null : null;
      await run(`
        INSERT INTO form_fields (form_id, field_id, section_id, sort_order, column_span, overrides, conditional_rules, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [newFormId, f.field_id, newSecId, f.sort_order, f.column_span, f.overrides, f.conditional_rules, f.is_active]);
    }

    res.status(201).json({ success: true, msg: 'Form duplicated successfully', data: { id: newFormId, slug: cloneSlug } });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

module.exports = {
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  addFieldToForm,
  updateFormField,
  removeFieldFromForm,
  reorderFormFields,
  publishForm,
  getFormVersions,
  getFormVersionSnapshot,
  rollbackFormVersion,
  cloneForm
};
