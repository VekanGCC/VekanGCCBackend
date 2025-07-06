const express = require('express');
const router = express.Router();
const {
  getVendorReviews,
  getReview,
  respondToReview,
  reportReview,
  getReviewStatistics
} = require('../controllers/vendorReviewController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and vendor-only
router.use(protect);
router.use(authorize('vendor'));

// Review routes
router.get('/', getVendorReviews);
router.get('/statistics', getReviewStatistics);
router.get('/:id', getReview);
router.put('/:id/respond', respondToReview);
router.put('/:id/report', reportReview);

module.exports = router;