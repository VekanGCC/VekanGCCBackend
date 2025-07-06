const express = require('express');
const router = express.Router();
const {
  getClientSettings,
  updateClientSettings,
  getNotificationPreferences,
  updateNotificationPreferences,
  updateClientPreferences
} = require('../controllers/clientSettingsController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and client-only
router.use(protect);
router.use(authorize('client'));

// Settings routes
router.route('/')
  .get(getClientSettings)
  .put(updateClientSettings);

// Notification preferences
router.route('/notifications')
  .get(getNotificationPreferences)
  .put(updateNotificationPreferences);

// Client preferences
router.route('/preferences')
  .put(updateClientPreferences);

module.exports = router;