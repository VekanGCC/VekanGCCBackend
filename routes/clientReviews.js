const express = require('express');
const router = express.Router();
const {
  createReview,
  getClientReviews,
  getReview,
  updateReview,
  deleteReview,
  getEligibleOrdersForReview
} = require('../controllers/clientReviewController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and client-only
router.use(protect);
router.use(authorize('client'));

// Review routes
router.route('/')
  .get(getClientReviews)
  .post(createReview);

router.get('/eligible-orders', getEligibleOrdersForReview);

router.route('/:id')
  .get(getReview)
  .put(updateReview)
  .delete(deleteReview);

module.exports = router;