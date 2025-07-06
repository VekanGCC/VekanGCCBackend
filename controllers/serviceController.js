const Service = require('../models/Service');
const Order = require('../models/Order');
const Review = require('../models/Review');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');

// @desc    Get all services for vendor
// @route   GET /api/vendor/services
// @access  Private (Vendor only)
const getVendorServices = asyncHandler(async (req, res, next) => {
  const {
    status,
    category,
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

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Execute query with pagination
  const services = await Service.find(query)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Service.countDocuments(query);

  res.status(200).json({
    success: true,
    data: services,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single service
// @route   GET /api/vendor/services/:id
// @access  Private (Vendor only)
const getService = asyncHandler(async (req, res, next) => {
  const service = await Service.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only access their own services
  });

  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  res.status(200).json({
    success: true,
    data: service
  });
});

// @desc    Create new service
// @route   POST /api/vendor/services
// @access  Private (Vendor only)
const createService = asyncHandler(async (req, res, next) => {
  // Add vendor to req.body from JWT token
  req.body.vendor = req.user.id;

  const service = await Service.create(req.body);

  res.status(201).json({
    success: true,
    data: service
  });
});

// @desc    Update service
// @route   PUT /api/vendor/services/:id
// @access  Private (Vendor only)
const updateService = asyncHandler(async (req, res, next) => {
  let service = await Service.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only update their own services
  });

  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  service = await Service.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: service
  });
});

// @desc    Delete service
// @route   DELETE /api/vendor/services/:id
// @access  Private (Vendor only)
const deleteService = asyncHandler(async (req, res, next) => {
  const service = await Service.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only delete their own services
  });

  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  // Check if service has active orders
  const activeOrders = await Order.countDocuments({
    service: req.params.id,
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  });

  if (activeOrders > 0) {
    return next(new ErrorResponse('Cannot delete service with active orders', 400));
  }

  await service.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Service deleted successfully'
  });
});

// @desc    Toggle service status
// @route   PUT /api/vendor/services/:id/toggle-status
// @access  Private (Vendor only)
const toggleServiceStatus = asyncHandler(async (req, res, next) => {
  const service = await Service.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only toggle their own services
  });

  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  service.status = service.status === 'active' ? 'inactive' : 'active';
  await service.save();

  res.status(200).json({
    success: true,
    data: service
  });
});

// @desc    Get service analytics
// @route   GET /api/vendor/services/:id/analytics
// @access  Private (Vendor only)
const getServiceAnalytics = asyncHandler(async (req, res, next) => {
  const service = await Service.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only access their own service analytics
  });

  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  // Get order statistics
  const orderStats = await Order.aggregate([
    { $match: { service: service._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  // Get monthly order trends
  const monthlyTrends = await Order.aggregate([
    { $match: { service: service._id } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Get review statistics
  const reviewStats = await Review.aggregate([
    { $match: { service: service._id, status: 'approved' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      service,
      orderStats,
      monthlyTrends,
      reviewStats: reviewStats[0] || { averageRating: 0, totalReviews: 0 }
    }
  });
});

module.exports = {
  getVendorServices,
  getService,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  getServiceAnalytics
};