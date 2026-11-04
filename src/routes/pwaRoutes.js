const express = require('express');
const router = express.Router();
const pwaController = require('../controllers/pwaController');
const { requireAuth } = require('../middleware/auth');

// PWA Shell
router.get('/ipd', requireAuth, pwaController.renderTab);

// PWA Backing APIs (Relative to /pwa/)
router.get('/api/me', pwaController.getMe);
router.get('/api/patients', pwaController.getPatients);
router.get('/api/patients/:id/category-counts', pwaController.getPatientCategoryCounts);
router.get('/api/patients/:id/payment-categories', pwaController.getPaymentCategories);
router.get('/api/categories', pwaController.getCategories);
router.get('/api/stamps', pwaController.getStamps);
router.get('/api/register-books', pwaController.getRegisterBooks);

module.exports = router;
