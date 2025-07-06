const express = require('express');
const router = express.Router();
const {
  getPaymentSummary,
  getPaymentHistory,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod
} = require('../controllers/vendorPaymentController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and vendor-only
router.use(protect);
router.use(authorize('vendor'));

// Payment summary and history
router.get('/summary', getPaymentSummary);
router.get('/history', getPaymentHistory);

// Payment methods
router.route('/methods')
  .get(getPaymentMethods)
  .post(addPaymentMethod);

router.route('/methods/:id')
  .put(updatePaymentMethod)
  .delete(deletePaymentMethod);

module.exports = router;