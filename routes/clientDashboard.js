const express = require('express');
const router = express.Router();
const {
  getClientDashboardOverview,
  getRecentBookings,
  getUpcomingBookings,
  getBookingHistory,
  getSpendingAnalytics,
  getSavedServices,
  getMyReviews,
  getPendingReviews,
  getRecommendations,
  getClientNotifications
} = require('../controllers/clientDashboardController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and client-only
router.use(protect);
router.use(authorize('client'));

// Dashboard overview
router.get('/overview', getClientDashboardOverview);

// Bookings
router.get('/recent-bookings', getRecentBookings);
router.get('/upcoming-bookings', getUpcomingBookings);
router.get('/booking-history', getBookingHistory);

// Analytics
router.get('/spending-analytics', getSpendingAnalytics);

// Services
router.get('/saved-services', getSavedServices);
router.get('/recommendations', getRecommendations);

// Reviews
router.get('/my-reviews', getMyReviews);
router.get('/pending-reviews', getPendingReviews);

// Notifications
router.get('/notifications', getClientNotifications);

module.exports = router;