const express = require('express');
const router = express.Router();
const {
  getUserGrowthReport,
  getRevenueReport,
  getServicePerformanceReport,
  getVendorPerformanceReport,
  getClientActivityReport
} = require('../controllers/adminReportController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and admin-only
router.use(protect);
router.use(authorize('admin', 'superadmin'));

// Report routes
router.get('/user-growth', getUserGrowthReport);
router.get('/revenue', getRevenueReport);
router.get('/service-performance', getServicePerformanceReport);
router.get('/vendor-performance', getVendorPerformanceReport);
router.get('/client-activity', getClientActivityReport);

module.exports = router;