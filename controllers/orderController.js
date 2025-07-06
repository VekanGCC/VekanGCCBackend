const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const OrderHistory = require('../models/OrderHistory');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');
const { createNotification } = require('./notificationController');

// @desc    Get all orders for vendor
// @route   GET /api/vendor/orders
// @access  Private (Vendor only)
const getVendorOrders = asyncHandler(async (req, res, next) => {
  const {
    status,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search
  } = req.query;

  // Build query - use vendor ID from JWT token
  let query = { vendor: req.user.id };

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query with pagination
  const orders = await Order.find(query)
    .populate('client', 'firstName lastName email phone')
    .populate('service', 'title category')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Order.countDocuments(query);

  res.status(200).json({
    success: true,
    data: orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single order
// @route   GET /api/vendor/orders/:id
// @access  Private (Vendor only)
const getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only access their own orders
  })
    .populate('client', 'firstName lastName email phone address')
    .populate('service', 'title description category pricing')
    .populate('vendor', 'firstName lastName businessInfo');

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Update order status
// @route   PUT /api/vendor/orders/:id/status
// @access  Private (Vendor only)
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, notes } = req.body;

  const order = await Order.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only update their own orders
  });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Validate status transition
  const validTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: ['refunded'],
    cancelled: [],
    refunded: []
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(new ErrorResponse(`Cannot change status from ${order.status} to ${status}`, 400));
  }

  // Save previous status for history
  const previousStatus = order.status;
  
  // Update order status
  order.status = status;
  
  if (notes) {
    order.vendorNotes = notes;
  }

  // Set completion date if completed
  if (status === 'completed') {
    order.completedAt = new Date();
    order.paymentStatus = 'paid';
  }

  // Set cancellation details if cancelled
  if (status === 'cancelled') {
    order.cancelledAt = new Date();
    order.cancelledBy = 'vendor';
    if (notes) {
      order.cancellationReason = notes;
    }
  }

  await order.save();

  // Create order history entry
  await OrderHistory.create({
    order: order._id,
    previousStatus,
    status,
    notes: notes || `Status changed from ${previousStatus} to ${status}`,
    updatedBy: req.user.id,
    updatedByType: 'vendor',
    changes: {
      status: {
        from: previousStatus,
        to: status
      }
    }
  });

  // Create notification for client
  await createNotification({
    recipient: order.client,
    type: 'order_status_change',
    title: 'Order Status Updated',
    message: `Your order #${order.orderNumber} has been updated to ${status}`,
    relatedOrder: order._id,
    actionUrl: `/client/bookings/${order._id}`
  });

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Add order notes
// @route   PUT /api/vendor/orders/:id/notes
// @access  Private (Vendor only)
const addOrderNotes = asyncHandler(async (req, res, next) => {
  const { notes } = req.body;

  const order = await Order.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only update their own orders
  });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Save previous notes for history
  const previousNotes = order.vendorNotes;
  
  // Update order notes
  order.vendorNotes = notes;
  await order.save();

  // Create order history entry
  await OrderHistory.create({
    order: order._id,
    status: order.status,
    notes: 'Vendor notes updated',
    updatedBy: req.user.id,
    updatedByType: 'vendor',
    changes: {
      vendorNotes: {
        from: previousNotes,
        to: notes
      }
    }
  });

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Get order statistics
// @route   GET /api/vendor/orders/statistics
// @access  Private (Vendor only)
const getOrderStatistics = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  const stats = await Order.aggregate([
    { $match: { vendor: vendorId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  const totalOrders = await Order.countDocuments({ vendor: vendorId });
  const totalRevenue = await Order.aggregate([
    { $match: { vendor: vendorId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      statusBreakdown: stats
    }
  });
});

module.exports = {
  getVendorOrders,
  getOrder,
  updateOrderStatus,
  addOrderNotes,
  getOrderStatistics
};