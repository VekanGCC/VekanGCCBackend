const Service = require('../models/Service');
const User = require('../models/User');
const Review = require('../models/Review');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Browse all available services
// @route   GET /api/client/services
// @access  Private (Client only)
const browseServices = asyncHandler(async (req, res, next) => {
  const {
    category,
    location,
    priceMin,
    priceMax,
    rating,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 12,
    search
  } = req.query;

  // Build query
  let query = { status: 'active', isVisible: true };

  if (category) {
    query.category = category;
  }

  if (location) {
    query.$or = [
      { 'serviceArea.cities': { $regex: location, $options: 'i' } },
      { 'serviceArea.specificAreas': { $regex: location, $options: 'i' } }
    ];
  }

  if (priceMin || priceMax) {
    query['pricing.basePrice'] = {};
    if (priceMin) query['pricing.basePrice'].$gte = parseFloat(priceMin);
    if (priceMax) query['pricing.basePrice'].$lte = parseFloat(priceMax);
  }

  if (rating) {
    query['stats.averageRating'] = { $gte: parseFloat(rating) };
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
    .populate('vendor', 'firstName lastName businessInfo')
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

// @desc    Get single service details
// @route   GET /api/client/services/:id
// @access  Private (Client only)
const getServiceDetails = asyncHandler(async (req, res, next) => {
  const service = await Service.findOne({
    _id: req.params.id,
    status: 'active',
    isVisible: true
  }).populate('vendor', 'firstName lastName businessInfo address phone email');

  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  // Get recent reviews for this service
  const reviews = await Review.find({
    service: service._id,
    status: 'approved'
  })
    .populate('client', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(5);

  // Check if user has saved this service
  const user = await User.findById(req.user.id);
  const isSaved = user.savedServices?.includes(service._id) || false;

  res.status(200).json({
    success: true,
    data: {
      service,
      reviews,
      isSaved
    }
  });
});

// @desc    Get service reviews
// @route   GET /api/client/services/:id/reviews
// @access  Private (Client only)
const getServiceReviews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, rating } = req.query;

  let query = {
    service: req.params.id,
    status: 'approved'
  };

  if (rating) {
    query.rating = parseInt(rating);
  }

  const reviews = await Review.find(query)
    .populate('client', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Review.countDocuments(query);

  // Get rating distribution
  const ratingDistribution = await Review.aggregate([
    { $match: { service: req.params.id, status: 'approved' } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    },
    ratingDistribution
  });
});

// @desc    Save/unsave service
// @route   PUT /api/client/services/:id/save
// @access  Private (Client only)
const toggleSaveService = asyncHandler(async (req, res, next) => {
  const serviceId = req.params.id;
  
  // Check if service exists
  const service = await Service.findById(serviceId);
  if (!service) {
    return next(new ErrorResponse('Service not found', 404));
  }

  // Get user from JWT token
  const user = await User.findById(req.user.id);
  
  // Initialize savedServices array if it doesn't exist
  if (!user.savedServices) {
    user.savedServices = [];
  }

  const isCurrentlySaved = user.savedServices.includes(serviceId);

  if (isCurrentlySaved) {
    // Remove from saved services
    user.savedServices = user.savedServices.filter(
      id => id.toString() !== serviceId
    );
  } else {
    // Add to saved services
    user.savedServices.push(serviceId);
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: isCurrentlySaved ? 'Service removed from saved list' : 'Service saved successfully',
    data: {
      isSaved: !isCurrentlySaved
    }
  });
});

// @desc    Get service categories
// @route   GET /api/client/services/categories
// @access  Private (Client only)
const getServiceCategories = asyncHandler(async (req, res, next) => {
  const categories = await Service.aggregate([
    { $match: { status: 'active', isVisible: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: categories
  });
});

// @desc    Get featured services
// @route   GET /api/client/services/featured
// @access  Private (Client only)
const getFeaturedServices = asyncHandler(async (req, res, next) => {
  const { limit = 8 } = req.query;

  // Get services with high ratings and good number of reviews
  const featuredServices = await Service.find({
    status: 'active',
    isVisible: true,
    'stats.averageRating': { $gte: 4.5 },
    'stats.totalReviews': { $gte: 5 }
  })
    .populate('vendor', 'firstName lastName businessInfo')
    .sort({ 'stats.averageRating': -1, 'stats.totalReviews': -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: featuredServices
  });
});

// @desc    Search services
// @route   GET /api/client/services/search
// @access  Private (Client only)
const searchServices = asyncHandler(async (req, res, next) => {
  const { q, category, location, page = 1, limit = 12 } = req.query;

  if (!q) {
    return next(new ErrorResponse('Search query is required', 400));
  }

  // Build search query
  let query = {
    status: 'active',
    isVisible: true,
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { tags: { $in: [new RegExp(q, 'i')] } }
    ]
  };

  if (category) {
    query.category = category;
  }

  if (location) {
    query.$and = [
      query.$and || {},
      {
        $or: [
          { 'serviceArea.cities': { $regex: location, $options: 'i' } },
          { 'serviceArea.specificAreas': { $regex: location, $options: 'i' } }
        ]
      }
    ];
  }

  const services = await Service.find(query)
    .populate('vendor', 'firstName lastName businessInfo')
    .sort({ 'stats.averageRating': -1, 'stats.totalReviews': -1 })
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

module.exports = {
  browseServices,
  getServiceDetails,
  getServiceReviews,
  toggleSaveService,
  getServiceCategories,
  getFeaturedServices,
  searchServices
};