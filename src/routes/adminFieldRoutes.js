const express = require('express');
const router = express.Router();
const fieldMasterController = require('../controllers/fieldMasterController');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// Categories
router.get('/field-categories', fieldMasterController.getCategories);
router.post('/field-categories', isAuthenticated, requireRole('admin'), fieldMasterController.createCategory);
router.put('/field-categories/:id', isAuthenticated, requireRole('admin'), fieldMasterController.updateCategory);
router.delete('/field-categories/:id', isAuthenticated, requireRole('admin'), fieldMasterController.deleteCategory);

// Field Types
router.get('/fields/types/list', fieldMasterController.getFieldTypes);

// Fields CRUD
router.get('/fields', fieldMasterController.getFields);
router.get('/fields/:id', fieldMasterController.getFieldById);
router.post('/fields', isAuthenticated, requireRole('admin'), fieldMasterController.createField);
router.put('/fields/:id', isAuthenticated, requireRole('admin'), fieldMasterController.updateField);
router.delete('/fields/:id', isAuthenticated, requireRole('admin'), fieldMasterController.deleteField);

module.exports = router;
