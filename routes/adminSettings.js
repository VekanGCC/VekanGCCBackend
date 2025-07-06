const express = require('express');
const router = express.Router();
const {
  getSystemSettings,
  updateSystemSettings,
  getEmailTemplates,
  updateEmailTemplate,
  getSystemLogs
} = require('../controllers/adminSettingsController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and admin-only
router.use(protect);
router.use(authorize('admin', 'superadmin'));

// System settings routes
router.route('/')
  .get(getSystemSettings)
  .put(updateSystemSettings);

// Email template routes
router.get('/email-templates', getEmailTemplates);
router.put('/email-templates/:id', updateEmailTemplate);

// System logs
router.get('/logs', getSystemLogs);

module.exports = router;