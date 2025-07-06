const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const OrderHistory = require('../models/OrderHistory');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { createNotification } = require('./notificationController');

// @desc    Create new booking
// @route   POST /api/client/bookings
// @access  Private (Client only)
const createBooking = asyncHandler(async (req, res, next) => {
  const {
    serviceId,
    scheduledDate,
    serviceLocation,
    clientNotes,
    additionalRequirements
  } = req.body;

  // Check if service exists and is active
  const service = await Service.findById(serviceId).populate('vendor');
  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  if (service.status !== 'active') {
    return next(new ErrorResponse('Service is not available for booking', 400));
  }

  // Check if scheduled date is in the future
  if (new Date(scheduledDate) <= new Date()) {
    return next(new ErrorResponse('Scheduled date must be in the future', 400));
  }

  // Create booking
  const booking = await Order.create({
    client: req.user.id, // Use client ID from JWT token
    vendor: service.vendor._id,
    service: serviceId,
    title: service.title,
    description: service.description,
    basePrice: service.pricing.basePrice,
    totalAmount: service.pricing.basePrice, // Will be updated if there are additional charges
    scheduledDate,
    estimatedDuration: service.duration.estimated,
    serviceLocation,
    clientNotes,
    status: 'pending'
  });

  // Create order history entry
  await OrderHistory.create({
    order: booking._id,
    status: 'pending',
    notes: 'Booking created',
    updatedBy: req.user.id,
    updatedByType: 'client'
  });

  // Create notification for vendor
  await createNotification({
    recipient: service.vendor._id,
    type: 'new_order',
    title: 'New Booking Received',
    message: `You have received a new booking for ${service.title}`,
    relatedOrder: booking._id,
    actionUrl: `/vendor/orders/${booking._id}`
  });

  // Populate the created booking
  const populatedBooking = await Order.findById(booking._id)
    .populate('vendor', 'firstName lastName businessInfo phone email')
    .populate('service', 'title category images');

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: populatedBooking
  });
});

// @desc    Get all client bookings
// @route   GET /api/client/bookings
// @access  Private (Client only)
const getClientBookings = asyncHandler(async (req, res, next) => {
  const {
    status,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query - use client ID from JWT token
  let query = { client: req.user.id };

  if (status) {
    query.status = status;
  }

  // Execute query with pagination
  const bookings = await Order.find(query)
    .populate('vendor', 'firstName lastName businessInfo phone email')
    .populate('service', 'title category images')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Order.countDocuments(query);

  res.status(200).json({
    success: true,
    data: bookings,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single booking
// @route   GET /api/client/bookings/:id
// @access  Private (Client only)
const getBooking = asyncHandler(async (req, res, next) => {
  const booking = await Order.findOne({
    _id: req.params.id,
    client: req.user.id // Ensure client can only access their own bookings
  })
    .populate('vendor', 'firstName lastName businessInfo phone email address')
    .populate('service', 'title description category pricing images');

  if (!booking) {
    return next(new ErrorResponse('Booking not found', 404));
  }

  res.status(200).json({
    success: true,
    data: booking
  });
});

// @desc    Update booking
// @route   PUT /api/client/bookings/:id
// @access  Private (Client only)
const updateBooking = asyncHandler(async (req, res, next) => {
  const { scheduledDate, serviceLocation, clientNotes } = req.body;

  const booking = await Order.findOne({
    _id: req.params.id,
    client: req.user.id // Ensure client can only update their own bookings
  });

  if (!booking) {
    return next(new ErrorResponse('Booking not found', 404));
  }

  // Only allow updates for pending bookings
  if (booking.status !== 'pending') {
    return next(new ErrorResponse('Cannot update booking that is not pending', 400));
  }

  // Track changes for history
  const changes = {};
  
  // Update allowed fields
  if (scheduledDate) {
    if (new Date(scheduledDate) <= new Date()) {
      return next(new ErrorResponse('Scheduled date must be in the future', 400));
    }
    changes.scheduledDate = {
      from: booking.scheduledDate,
      to: scheduledDate
    };
    booking.scheduledDate = scheduledDate;
  }

  if (serviceLocation) {
    changes.serviceLocation = {
      from: booking.serviceLocation,
      to: serviceLocation
    };
    booking.serviceLocation = serviceLocation;
  }

  if (clientNotes) {
    changes.clientNotes = {
      from: booking.clientNotes,
      to: clientNotes
    };
    booking.clientNotes = clientNotes;
  }

  await booking.save();

  // Create order history entry
  await OrderHistory.create({
    order: booking._id,
    status: booking.status,
    notes: 'Booking details updated by client',
    updatedBy: req.user.id,
    updatedByType: 'client',
    changes
  });

  // Create notification for vendor
  await createNotification({
    recipient: booking.vendor,
    type: 'order_status_change',
    title: 'Booking Updated',
    message: `A client has updated their booking details for order #${booking.orderNumber}`,
    relatedOrder: booking._id,
    actionUrl: `/vendor/orders/${booking._id}`
  });

  const updatedBooking = await Order.findById(booking._id)
    .populate('vendor', 'firstName lastName businessInfo phone email')
    .populate('service', 'title category images');

  res.status(200).json({
    success: true,
    message: 'Booking updated successfully',
    data: updatedBooking
  });
});

// @desc    Cancel booking
// @route   PUT /api/client/bookings/:id/cancel
// @access  Private (Client only)
const cancelBooking = asyncHandler(async (req, res, next) => {
  const { cancellationReason } = req.body;

  const booking = await Order.findOne({
    _id: req.params.id,
    client: req.user.id // Ensure client can only cancel their own bookings
  });

  if (!booking) {
    return next(new ErrorResponse('Booking not found', 404));
  }

  // Check if booking can be cancelled
  if (!['pending', 'confirmed'].includes(booking.status)) {
    return next(new ErrorResponse('Cannot cancel booking in current status', 400));
  }

  // Save previous status for history
  const previousStatus = booking.status;

  // Update booking status
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = 'client';
  booking.cancellationReason = cancellationReason || 'Cancelled by client';

  await booking.save();

  // Create order history entry
  await OrderHistory.create({
    order: booking._id,
    previousStatus,
    status: 'cancelled',
    notes: cancellationReason || 'Cancelled by client',
    updatedBy: req.user.id,
    updatedByType: 'client',
    changes: {
      status: {
        from: previousStatus,
        to: 'cancelled'
      },
      cancellationReason: {
        from: null,
        to: cancellationReason || 'Cancelled by client'
      }
    }
  });

  // Create notification for vendor
  await createNotification({
    recipient: booking.vendor,
    type: 'order_cancelled',
    title: 'Booking Cancelled',
    message: `A client has cancelled their booking for order #${booking.orderNumber}`,
    relatedOrder: booking._id,
    actionUrl: `/vendor/orders/${booking._id}`
  });

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully',
    data: booking
  });
});

// @desc    Get booking statistics for client
// @route   GET /api/client/bookings/statistics
// @access  Private (Client only)
const getBookingStatistics = asyncHandler(async (req, res, next) => {
  // Get client ID from JWT token
  const clientId = req.user.id;

  const stats = await Order.aggregate([
    { $match: { client: clientId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  const totalBookings = await Order.countDocuments({ client: clientId });
  const totalSpent = await Order.aggregate([
    { $match: { client: clientId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  // Get monthly booking trends
  const monthlyTrends = await Order.aggregate([
    { $match: { client: clientId } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        bookings: { $sum: 1 },
        spent: { $sum: '$totalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalBookings,
      totalSpent: totalSpent[0]?.total || 0,
      statusBreakdown: stats,
      monthlyTrends
    }
  });
});

module.exports = {
  createBooking,
  getClientBookings,
  getBooking,
  updateBooking,
  cancelBooking,
  getBookingStatistics
};