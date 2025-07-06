const express = require('express');
const router = express.Router();
const {
  getDashboardOverview,
  getRecentOrders,
  getRevenueAnalytics,
  getServicePerformance,
  getCustomerInsights,
  getOrderStatusDistribution,
  getRecentReviews,
  getNotificationSummary
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and vendor-only
router.use(protect);
router.use(authorize('vendor'));

// Dashboard overview
router.get('/overview', getDashboardOverview);

// Orders
router.get('/recent-orders', getRecentOrders);
router.get('/order-status', getOrderStatusDistribution);

// Analytics
router.get('/revenue-analytics', getRevenueAnalytics);
router.get('/service-performance', getServicePerformance);
router.get('/customer-insights', getCustomerInsights);

// Reviews
router.get('/recent-reviews', getRecentReviews);

// Notifications
router.get('/notifications', getNotificationSummary);

module.exports = router;