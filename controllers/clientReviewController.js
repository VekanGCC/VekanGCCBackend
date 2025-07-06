const Review = require('../models/Review');
const Order = require('../models/Order');
const Service = require('../models/Service');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Create review for completed booking
// @route   POST /api/client/reviews
// @access  Private (Client only)
const createReview = asyncHandler(async (req, res, next) => {
  const {
    orderId,
    rating,
    title,
    comment,
    detailedRatings,
    images
  } = req.body;

  // Check if order exists and belongs to client
  const order = await Order.findOne({
    _id: orderId,
    client: req.user.id, // Use client ID from JWT token
    status: 'completed'
  }).populate('service vendor');

  if (!order) {
    return next(new ErrorResponse('Completed order not found', 404));
  }

  // Check if review already exists for this order
  const existingReview = await Review.findOne({ order: orderId });
  if (existingReview) {
    return next(new ErrorResponse('Review already exists for this order', 400));
  }

  // Create review
  const review = await Review.create({
    client: req.user.id, // Use client ID from JWT token
    vendor: order.vendor._id,
    service: order.service._id,
    order: orderId,
    rating,
    title,
    comment,
    detailedRatings,
    images
  });

  // Update service statistics
  const service = await Service.findById(order.service._id);
  if (service) {
    const allReviews = await Review.find({ 
      service: service._id, 
      status: 'approved' 
    });
    
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    service.stats.totalReviews = totalReviews;
    service.stats.averageRating = averageRating;
    await service.save();
  }

  const populatedReview = await Review.findById(review._id)
    .populate('service', 'title category')
    .populate('vendor', 'firstName lastName businessInfo')
    .populate('order', 'orderNumber scheduledDate');

  res.status(201).json({
    success: true,
    message: 'Review created successfully',
    data: populatedReview
  });
});

// @desc    Get client's reviews
// @route   GET /api/client/reviews
// @access  Private (Client only)
const getClientReviews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  // Get client ID from JWT token
  const reviews = await Review.find({ client: req.user.id })
    .populate('service', 'title category images')
    .populate('vendor', 'firstName lastName businessInfo')
    .populate('order', 'orderNumber scheduledDate')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Review.countDocuments({ client: req.user.id });

  res.status(200).json({
    success: true,
    data: reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single review
// @route   GET /api/client/reviews/:id
// @access  Private (Client only)
const getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findOne({
    _id: req.params.id,
    client: req.user.id // Ensure client can only access their own reviews
  })
    .populate('service', 'title category images')
    .populate('vendor', 'firstName lastName businessInfo')
    .populate('order', 'orderNumber scheduledDate totalAmount');

  if (!review) {
    return next(new ErrorResponse('Review not found', 404));
  }

  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Update review
// @route   PUT /api/client/reviews/:id
// @access  Private (Client only)
const updateReview = asyncHandler(async (req, res, next) => {
  const { rating, title, comment, detailedRatings, images } = req.body;

  const review = await Review.findOne({
    _id: req.params.id,
    client: req.user.id // Ensure client can only update their own reviews
  });

  if (!review) {
    return next(new ErrorResponse('Review not found', 404));
  }

  // Update review fields
  if (rating) review.rating = rating;
  if (title) review.title = title;
  if (comment) review.comment = comment;
  if (detailedRatings) review.detailedRatings = detailedRatings;
  if (images) review.images = images;

  await review.save();

  // Update service statistics
  const service = await Service.findById(review.service);
  if (service) {
    const allReviews = await Review.find({ 
      service: service._id, 
      status: 'approved' 
    });
    
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    service.stats.totalReviews = totalReviews;
    service.stats.averageRating = averageRating;
    await service.save();
  }

  const updatedReview = await Review.findById(review._id)
    .populate('service', 'title category')
    .populate('vendor', 'firstName lastName businessInfo')
    .populate('order', 'orderNumber scheduledDate');

  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: updatedReview
  });
});

// @desc    Delete review
// @route   DELETE /api/client/reviews/:id
// @access  Private (Client only)
const deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findOne({
    _id: req.params.id,
    client: req.user.id // Ensure client can only delete their own reviews
  });

  if (!review) {
    return next(new ErrorResponse('Review not found', 404));
  }

  await review.deleteOne();

  // Update service statistics
  const service = await Service.findById(review.service);
  if (service) {
    const allReviews = await Review.find({ 
      service: service._id, 
      status: 'approved' 
    });
    
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    service.stats.totalReviews = totalReviews;
    service.stats.averageRating = averageRating;
    await service.save();
  }

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully'
  });
});

// @desc    Get orders eligible for review
// @route   GET /api/client/reviews/eligible-orders
// @access  Private (Client only)
const getEligibleOrdersForReview = asyncHandler(async (req, res, next) => {
  // Get client ID from JWT token
  // Get orders that are completed but don't have reviews yet
  const reviewedOrderIds = await Review.distinct('order', { client: req.user.id });
  
  const eligibleOrders = await Order.find({
    client: req.user.id,
    status: 'completed',
    _id: { $nin: reviewedOrderIds }
  })
    .populate('service', 'title category images')
    .populate('vendor', 'firstName lastName businessInfo')
    .sort({ completedAt: -1 });

  res.status(200).json({
    success: true,
    data: eligibleOrders
  });
});

module.exports = {
  createReview,
  getClientReviews,
  getReview,
  updateReview,
  deleteReview,
  getEligibleOrdersForReview
};