const express = require('express');
const router = express.Router();
const {
  getAnalyticsOverview,
  getRevenueAnalytics,
  getCustomerAnalytics,
  getServiceAnalytics
} = require('../controllers/vendorAnalyticsController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and vendor-only
router.use(protect);
router.use(authorize('vendor'));

// Analytics routes
router.get('/overview', getAnalyticsOverview);
router.get('/revenue', getRevenueAnalytics);
router.get('/customers', getCustomerAnalytics);
router.get('/services', getServiceAnalytics);

module.exports = router;