const Order = require('../models/Order');
const OrderHistory = require('../models/OrderHistory');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get order history
// @route   GET /api/vendor/orders/:id/history
// @access  Private (Vendor only)
const getOrderHistory = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only access their own orders
  });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  const history = await OrderHistory.find({ order: req.params.id })
    .populate('updatedBy', 'firstName lastName email userType')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: history
  });
});

// @desc    Get client order history
// @route   GET /api/client/bookings/:id/history
// @access  Private (Client only)
const getClientOrderHistory = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    client: req.user.id // Ensure client can only access their own bookings
  });

  if (!order) {
    return next(new ErrorResponse('Booking not found', 404));
  }

  const history = await OrderHistory.find({ order: req.params.id })
    .populate('updatedBy', 'firstName lastName email userType')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: history
  });
});

module.exports = {
  getOrderHistory,
  getClientOrderHistory
};