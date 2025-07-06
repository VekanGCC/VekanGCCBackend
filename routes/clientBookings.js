const express = require('express');
const router = express.Router();
const {
  createBooking,
  getClientBookings,
  getBooking,
  updateBooking,
  cancelBooking,
  getBookingStatistics
} = require('../controllers/clientBookingController');
const { getClientOrderHistory } = require('../controllers/orderHistoryController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and client-only
router.use(protect);
router.use(authorize('client'));

// Booking routes
router.route('/')
  .get(getClientBookings)
  .post(createBooking);

router.get('/statistics', getBookingStatistics);

router.route('/:id')
  .get(getBooking)
  .put(updateBooking);

router.put('/:id/cancel', cancelBooking);
router.get('/:id/history', getClientOrderHistory);

module.exports = router;