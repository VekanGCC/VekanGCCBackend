const express = require('express');
const router = express.Router();
const {
  getVendorSettings,
  updateVendorSettings,
  getNotificationPreferences,
  updateNotificationPreferences
} = require('../controllers/vendorSettingsController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and vendor-only
router.use(protect);
router.use(authorize('vendor'));

// Settings routes
router.route('/')
  .get(getVendorSettings)
  .put(updateVendorSettings);

// Notification preferences
router.route('/notifications')
  .get(getNotificationPreferences)
  .put(updateNotificationPreferences);

module.exports = router;