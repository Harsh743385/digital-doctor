const { query, queryOne, run } = require('../database/connection');

const FIELD_TYPES = [
  { type: 'text', label: 'Single Line Text', category: 'Basic', icon: 'fa-font', hasOptions: false },
  { type: 'textarea', label: 'Multi-line Text Area', category: 'Basic', icon: 'fa-paragraph', hasOptions: false },
  { type: 'number', label: 'Numeric Value', category: 'Numeric', icon: 'fa-hashtag', hasOptions: false },
  { type: 'email', label: 'Email Address', category: 'Contact', icon: 'fa-envelope', hasOptions: false },
  { type: 'phone', label: 'Phone Number', category: 'Contact', icon: 'fa-phone', hasOptions: false },
  { type: 'date', label: 'Date Picker', category: 'Date & Time', icon: 'fa-calendar', hasOptions: false },
  { type: 'time', label: 'Time Picker', category: 'Date & Time', icon: 'fa-clock', hasOptions: false },
  { type: 'datetime', label: 'Date & Time Picker', category: 'Date & Time', icon: 'fa-calendar-alt', hasOptions: false },
  { type: 'dropdown', label: 'Dropdown Select', category: 'Choice', icon: 'fa-caret-square-down', hasOptions: true },
  { type: 'radio', label: 'Radio Buttons', category: 'Choice', icon: 'fa-dot-circle', hasOptions: true },
  { type: 'checkbox', label: 'Checkboxes (Multiple)', category: 'Choice', icon: 'fa-check-square', hasOptions: true },
  { type: 'multiselect', label: 'Multi-Select Dropdown', category: 'Choice', icon: 'fa-list-ul', hasOptions: true },
  { type: 'file', label: 'File Attachment', category: 'Media', icon: 'fa-file-upload', hasOptions: false },
  { type: 'image', label: 'Image / Photo', category: 'Media', icon: 'fa-image', hasOptions: false },
  { type: 'boolean', label: 'Yes/No Switch (Boolean)', category: 'Choice', icon: 'fa-toggle-on', hasOptions: false }
];

// Helper: safe JSON parsing
function safeJson(val, fallback = {}) {
  if (typeof val === 'object' && val !== null) return val;
  try {
    return JSON.parse(val || (Array.isArray(fallback) ? '[]' : '{}'));
  } catch (e) {
    return fallback;
  }
}

// ── Categories ───────────────────────────────────────────────────────────────
async function getCategories(req, res) {
  try {
    const categories = await query(`
      SELECT c.*, COUNT(f.id) AS field_count
      FROM field_categories c
      LEFT JOIN fields f ON f.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function createCategory(req, res) {
  try {
    const { name, slug, description, sort_order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, msg: 'Category name is required' });
    }

    const catSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await queryOne('SELECT id FROM field_categories WHERE slug = ?', [catSlug]);
    if (existing) {
      return res.status(400).json({ success: false, msg: 'Category with this slug already exists' });
    }

    const result = await run(`
      INSERT INTO field_categories (name, slug, description, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [name.trim(), catSlug, description || null, parseInt(sort_order, 10) || 0]);

    const created = await queryOne('SELECT * FROM field_categories WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, msg: 'Category created successfully', data: created });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description, sort_order, is_active } = req.body;

    const existing = await queryOne('SELECT id FROM field_categories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, msg: 'Category not found' });
    }

    await run(`
      UPDATE field_categories
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      sort_order !== undefined ? parseInt(sort_order, 10) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    ]);

    const updated = await queryOne('SELECT * FROM field_categories WHERE id = ?', [id]);
    res.json({ success: true, msg: 'Category updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    // Set category_id to NULL on child fields first
    await run('UPDATE fields SET category_id = NULL WHERE category_id = ?', [id]);
    await run('DELETE FROM field_categories WHERE id = ?', [id]);
    res.json({ success: true, msg: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

// ── Fields ───────────────────────────────────────────────────────────────────
async function getFieldTypes(req, res) {
  res.json({ success: true, data: FIELD_TYPES });
}

async function getFields(req, res) {
  try {
    const { category_id, field_type, search, is_active } = req.query;

    let sql = `
      SELECT f.*, c.name AS category_name, c.slug AS category_slug,
             (SELECT COUNT(*) FROM form_fields ff WHERE ff.field_id = f.id) AS usage_count
      FROM fields f
      LEFT JOIN field_categories c ON c.id = f.category_id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      sql += ' AND f.category_id = ?';
      params.push(category_id);
    }
    if (field_type) {
      sql += ' AND f.field_type = ?';
      params.push(field_type);
    }
    if (is_active !== undefined && is_active !== '') {
      sql += ' AND f.is_active = ?';
      params.push(is_active === '1' || is_active === 'true' ? 1 : 0);
    }
    if (search && search.trim()) {
      sql += ' AND (f.name LIKE ? OR f.label LIKE ? OR f.description LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY f.category_id ASC, f.label ASC';

    const rawFields = await query(sql, params);
    const fields = rawFields.map(f => ({
      ...f,
      options: safeJson(f.options, []),
      validation_rules: safeJson(f.validation_rules, {}),
      error_messages: safeJson(f.error_messages, {})
    }));

    res.json({ success: true, data: fields, total: fields.length });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function getFieldById(req, res) {
  try {
    const { id } = req.params;
    const field = await queryOne(`
      SELECT f.*, c.name AS category_name,
             (SELECT COUNT(*) FROM form_fields ff WHERE ff.field_id = f.id) AS usage_count
      FROM fields f
      LEFT JOIN field_categories c ON c.id = f.category_id
      WHERE f.id = ?
    `, [id]);

    if (!field) {
      return res.status(404).json({ success: false, msg: 'Field not found' });
    }

    field.options = safeJson(field.options, []);
    field.validation_rules = safeJson(field.validation_rules, {});
    field.error_messages = safeJson(field.error_messages, {});

    res.json({ success: true, data: field });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function createField(req, res) {
  try {
    const {
      name, label, description, field_type, is_required,
      default_value, placeholder, validation_rules, error_messages,
      min_value, max_value, min_length, max_length,
      options, category_id, is_active
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, msg: 'Field system name is required' });
    }
    if (!label || !label.trim()) {
      return res.status(400).json({ success: false, msg: 'Field label is required' });
    }

    const fieldName = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/(^_|_$)/g, '');
    const validTypes = FIELD_TYPES.map(t => t.type);
    if (!validTypes.includes(field_type)) {
      return res.status(400).json({ success: false, msg: `Invalid field type. Must be one of: ${validTypes.join(', ')}` });
    }

    const existing = await queryOne('SELECT id FROM fields WHERE name = ?', [fieldName]);
    if (existing) {
      return res.status(400).json({ success: false, msg: `A field with name "${fieldName}" already exists` });
    }

    // Format options if array or string
    let formattedOptions = '[]';
    if (options) {
      if (typeof options === 'string') {
        try {
          formattedOptions = JSON.stringify(JSON.parse(options));
        } catch (e) {
          // Parse comma/newline separated
          const parsed = options.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(s => ({ label: s, value: s }));
          formattedOptions = JSON.stringify(parsed);
        }
      } else if (Array.isArray(options)) {
        formattedOptions = JSON.stringify(options);
      }
    }

    const vRules = typeof validation_rules === 'string' ? validation_rules : JSON.stringify(validation_rules || {});
    const eMsgs = typeof error_messages === 'string' ? error_messages : JSON.stringify(error_messages || {});

    const result = await run(`
      INSERT INTO fields (
        name, label, description, field_type, is_required,
        default_value, placeholder, validation_rules, error_messages,
        min_value, max_value, min_length, max_length,
        options, category_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      fieldName,
      label.trim(),
      description || null,
      field_type,
      is_required ? 1 : 0,
      default_value !== undefined ? default_value : null,
      placeholder || null,
      vRules,
      eMsgs,
      min_value !== '' && min_value !== undefined && min_value !== null ? parseFloat(min_value) : null,
      max_value !== '' && max_value !== undefined && max_value !== null ? parseFloat(max_value) : null,
      min_length !== '' && min_length !== undefined && min_length !== null ? parseInt(min_length, 10) : null,
      max_length !== '' && max_length !== undefined && max_length !== null ? parseInt(max_length, 10) : null,
      formattedOptions,
      category_id ? parseInt(category_id, 10) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1
    ]);

    // Audit log
    await run(`
      INSERT INTO audit_logs (table_name, record_id, action, user_id, user_name, changes)
      VALUES ('fields', ?, 'create', ?, ?, ?)
    `, [
      result.lastInsertRowid,
      req.session?.user?.id || 1,
      req.session?.user?.full_name || 'Admin',
      JSON.stringify({ name: fieldName, field_type })
    ]);

    const created = await queryOne('SELECT * FROM fields WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, msg: 'Field created successfully', data: created });
  } catch (err) {
    console.error('Error creating field:', err);
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function updateField(req, res) {
  try {
    const { id } = req.params;
    const {
      label, description, field_type, is_required,
      default_value, placeholder, validation_rules, error_messages,
      min_value, max_value, min_length, max_length,
      options, category_id, is_active
    } = req.body;

    const existing = await queryOne('SELECT * FROM fields WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, msg: 'Field not found' });
    }

    let formattedOptions = existing.options;
    if (options !== undefined) {
      if (typeof options === 'string') {
        try {
          formattedOptions = JSON.stringify(JSON.parse(options));
        } catch (e) {
          const parsed = options.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(s => ({ label: s, value: s }));
          formattedOptions = JSON.stringify(parsed);
        }
      } else if (Array.isArray(options)) {
        formattedOptions = JSON.stringify(options);
      }
    }

    const vRules = validation_rules !== undefined
      ? (typeof validation_rules === 'string' ? validation_rules : JSON.stringify(validation_rules))
      : existing.validation_rules;

    const eMsgs = error_messages !== undefined
      ? (typeof error_messages === 'string' ? error_messages : JSON.stringify(error_messages))
      : existing.error_messages;

    await run(`
      UPDATE fields
      SET label = COALESCE(?, label),
          description = COALESCE(?, description),
          field_type = COALESCE(?, field_type),
          is_required = COALESCE(?, is_required),
          default_value = COALESCE(?, default_value),
          placeholder = COALESCE(?, placeholder),
          validation_rules = ?,
          error_messages = ?,
          min_value = ?,
          max_value = ?,
          min_length = ?,
          max_length = ?,
          options = ?,
          category_id = COALESCE(?, category_id),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      label ? label.trim() : null,
      description !== undefined ? description : null,
      field_type || null,
      is_required !== undefined ? (is_required ? 1 : 0) : null,
      default_value !== undefined ? default_value : null,
      placeholder !== undefined ? placeholder : null,
      vRules,
      eMsgs,
      min_value !== '' && min_value !== undefined && min_value !== null ? parseFloat(min_value) : null,
      max_value !== '' && max_value !== undefined && max_value !== null ? parseFloat(max_value) : null,
      min_length !== '' && min_length !== undefined && min_length !== null ? parseInt(min_length, 10) : null,
      max_length !== '' && max_length !== undefined && max_length !== null ? parseInt(max_length, 10) : null,
      formattedOptions,
      category_id !== undefined ? (category_id ? parseInt(category_id, 10) : null) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    ]);

    // Audit log
    await run(`
      INSERT INTO audit_logs (table_name, record_id, action, user_id, user_name, changes)
      VALUES ('fields', ?, 'update', ?, ?, ?)
    `, [
      id,
      req.session?.user?.id || 1,
      req.session?.user?.full_name || 'Admin',
      JSON.stringify({ label, field_type, is_active })
    ]);

    const updated = await queryOne('SELECT * FROM fields WHERE id = ?', [id]);
    res.json({ success: true, msg: 'Field updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

async function deleteField(req, res) {
  try {
    const { id } = req.params;

    // Check if field is used in active forms
    const usage = await queryOne('SELECT COUNT(*) AS c FROM form_fields WHERE field_id = ?', [id]);
    if (usage && usage.c > 0) {
      // Soft-delete instead of hard-delete to maintain form integrity
      await run('UPDATE fields SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?', [id]);
      return res.json({
        success: true,
        msg: `Field is used in ${usage.c} form(s). It has been deactivated instead of deleted.`
      });
    }

    await run('DELETE FROM fields WHERE id = ?', [id]);
    res.json({ success: true, msg: 'Field deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
}

module.exports = {
  FIELD_TYPES,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getFieldTypes,
  getFields,
  getFieldById,
  createField,
  updateField,
  deleteField
};
