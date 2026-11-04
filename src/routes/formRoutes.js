const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const formSubmissionController = require('../controllers/formSubmissionController');
const { isAuthenticated } = require('../middleware/auth');

// Public or clinical form renderer
router.get('/forms/:slug', formSubmissionController.renderFormPage);

// Form submission with file/image attachments
router.post('/api/forms/:slug/submit', upload.any(), formSubmissionController.submitForm);

// Form submissions list and details
router.get('/api/forms/:formId/submissions', isAuthenticated, formSubmissionController.getSubmissions);
router.get('/api/submissions/:submissionId', isAuthenticated, formSubmissionController.getSubmissionDetail);

module.exports = router;
