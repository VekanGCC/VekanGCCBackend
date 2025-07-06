const Review = require('../models/Review');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get vendor reviews
// @route   GET /api/vendor/reviews
// @access  Private (Vendor only)
const getVendorReviews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', rating } = req.query;

  // Use vendor ID from JWT token
  let query = { vendor: req.user.id };

  if (rating) {
    query.rating = parseInt(rating);
  }

  const reviews = await Review.find(query)
    .populate('client', 'firstName lastName')
    .populate('service', 'title category')
    .populate('order', 'orderNumber scheduledDate')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Review.countDocuments(query);

  // Get rating distribution
  const ratingDistribution = await Review.aggregate([
    { $match: { vendor: req.user.id } },
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

// @desc    Get single review
// @route   GET /api/vendor/reviews/:id
// @access  Private (Vendor only)
const getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only access their own reviews
  })
    .populate('client', 'firstName lastName email')
    .populate('service', 'title description category')
    .populate('order', 'orderNumber scheduledDate totalAmount');

  if (!review) {
    return next(new ErrorResponse('Review not found', 404));
  }

  // Mark as read if it wasn't
  if (!review.isRead) {
    review.isRead = true;
    await review.save();
  }

  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Respond to a review
// @route   PUT /api/vendor/reviews/:id/respond
// @access  Private (Vendor only)
const respondToReview = asyncHandler(async (req, res, next) => {
  const { comment } = req.body;

  if (!comment) {
    return next(new ErrorResponse('Response comment is required', 400));
  }

  const review = await Review.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only respond to their own reviews
  });

  if (!review) {
    return next(new ErrorResponse('Review not found', 404));
  }

  review.vendorResponse = {
    comment,
    respondedAt: Date.now()
  };

  await review.save();

  res.status(200).json({
    success: true,
    message: 'Response added successfully',
    data: review
  });
});

// @desc    Report a review
// @route   PUT /api/vendor/reviews/:id/report
// @access  Private (Vendor only)
const reportReview = asyncHandler(async (req, res, next) => {
  const { reportReason } = req.body;

  if (!reportReason) {
    return next(new ErrorResponse('Report reason is required', 400));
  }

  const review = await Review.findOne({
    _id: req.params.id,
    vendor: req.user.id // Ensure vendor can only report reviews about them
  });

  if (!review) {
    return next(new ErrorResponse('Review not found', 404));
  }

  review.isReported = true;
  review.reportReason = reportReason;

  await review.save();

  res.status(200).json({
    success: true,
    message: 'Review reported successfully',
    data: review
  });
});

// @desc    Get review statistics
// @route   GET /api/vendor/reviews/statistics
// @access  Private (Vendor only)
const getReviewStatistics = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  // Get overall statistics
  const overallStats = await Review.aggregate([
    { $match: { vendor: vendorId } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        fiveStarCount: { 
          $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] }
        },
        fourStarCount: { 
          $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] }
        },
        threeStarCount: { 
          $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] }
        },
        twoStarCount: { 
          $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] }
        },
        oneStarCount: { 
          $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] }
        }
      }
    }
  ]);

  // Get service-specific statistics
  const serviceStats = await Review.aggregate([
    { $match: { vendor: vendorId } },
    {
      $group: {
        _id: '$service',
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    },
    { $sort: { totalReviews: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'services',
        localField: '_id',
        foreignField: '_id',
        as: 'serviceInfo'
      }
    },
    { $unwind: '$serviceInfo' },
    {
      $project: {
        serviceName: '$serviceInfo.title',
        category: '$serviceInfo.category',
        totalReviews: 1,
        averageRating: 1
      }
    }
  ]);

  // Get monthly review trends
  const monthlyTrends = await Review.aggregate([
    { $match: { vendor: vendorId } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      overall: overallStats[0] || { 
        totalReviews: 0, 
        averageRating: 0,
        fiveStarCount: 0,
        fourStarCount: 0,
        threeStarCount: 0,
        twoStarCount: 0,
        oneStarCount: 0
      },
      serviceSpecific: serviceStats,
      monthlyTrends
    }
  });
});

module.exports = {
  getVendorReviews,
  getReview,
  respondToReview,
  reportReview,
  getReviewStatistics
};