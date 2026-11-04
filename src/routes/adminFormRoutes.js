const express = require('express');
const router = express.Router();
const formBuilderController = require('../controllers/formBuilderController');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// Forms CRUD
router.get('/forms', formBuilderController.getForms);
router.get('/forms/:id', formBuilderController.getFormById);
router.post('/forms', isAuthenticated, requireRole('admin'), formBuilderController.createForm);
router.put('/forms/:id', isAuthenticated, requireRole('admin'), formBuilderController.updateForm);
router.delete('/forms/:id', isAuthenticated, requireRole('admin'), formBuilderController.deleteForm);

// Form Sections
router.post('/forms/:form_id/sections', isAuthenticated, requireRole('admin'), formBuilderController.createSection);
router.put('/forms/sections/:sectionId', isAuthenticated, requireRole('admin'), formBuilderController.updateSection);
router.delete('/forms/sections/:sectionId', isAuthenticated, requireRole('admin'), formBuilderController.deleteSection);
router.post('/forms/:form_id/sections/reorder', isAuthenticated, requireRole('admin'), formBuilderController.reorderSections);

// Fields inside Form
router.post('/forms/:form_id/fields', isAuthenticated, requireRole('admin'), formBuilderController.addFieldToForm);
router.put('/forms/form-fields/:formFieldId', isAuthenticated, requireRole('admin'), formBuilderController.updateFormField);
router.delete('/forms/form-fields/:formFieldId', isAuthenticated, requireRole('admin'), formBuilderController.removeFieldFromForm);
router.post('/forms/:form_id/fields/reorder', isAuthenticated, requireRole('admin'), formBuilderController.reorderFormFields);

// Publishing & Versions
router.post('/forms/:id/publish', isAuthenticated, requireRole('admin'), formBuilderController.publishForm);
router.get('/forms/:id/versions', formBuilderController.getFormVersions);
router.get('/forms/versions/:versionId', formBuilderController.getFormVersionSnapshot);
router.post('/forms/:id/rollback/:versionId', isAuthenticated, requireRole('admin'), formBuilderController.rollbackFormVersion);
router.post('/forms/:id/clone', isAuthenticated, requireRole('admin'), formBuilderController.cloneForm);

module.exports = router;
