const express = require('express');
const router = express.Router();
const {
  getVendorOrders,
  getOrder,
  updateOrderStatus,
  addOrderNotes,
  getOrderStatistics
} = require('../controllers/orderController');
const { getOrderHistory } = require('../controllers/orderHistoryController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and vendor-only
router.use(protect);
router.use(authorize('vendor'));

// Order routes
router.get('/', getVendorOrders);
router.get('/statistics', getOrderStatistics);
router.get('/:id', getOrder);
router.put('/:id/status', updateOrderStatus);
router.put('/:id/notes', addOrderNotes);
router.get('/:id/history', getOrderHistory);

module.exports = router;