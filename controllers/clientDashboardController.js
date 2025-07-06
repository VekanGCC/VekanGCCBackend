const User = require('../models/User');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Review = require('../models/Review');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get client dashboard overview
// @route   GET /api/client/dashboard/overview
// @access  Private (Client only)
const getClientDashboardOverview = asyncHandler(async (req, res, next) => {
  // Get client ID from JWT token
  const clientId = req.user.id;

  // Get current date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get booking statistics
  const totalBookings = await Order.countDocuments({ client: clientId });
  const activeBookings = await Order.countDocuments({ 
    client: clientId, 
    status: { $in: ['confirmed', 'in_progress'] }
  });
  const completedBookings = await Order.countDocuments({ 
    client: clientId, 
    status: 'completed' 
  });
  const upcomingBookings = await Order.countDocuments({
    client: clientId,
    status: { $in: ['confirmed', 'in_progress'] },
    scheduledDate: { $gte: now }
  });

  // Get monthly bookings comparison
  const thisMonthBookings = await Order.countDocuments({
    client: clientId,
    createdAt: { $gte: startOfMonth }
  });

  const lastMonthBookings = await Order.countDocuments({
    client: clientId,
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
  });

  // Calculate total spent
  const totalSpent = await Order.aggregate([
    { $match: { client: clientId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  const thisMonthSpent = await Order.aggregate([
    { 
      $match: { 
        client: clientId, 
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  // Get favorite services (most booked)
  const favoriteServices = await Order.aggregate([
    { $match: { client: clientId } },
    { $group: { _id: '$service', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 3 },
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
        bookingCount: '$count'
      }
    }
  ]);

  // Get pending reviews count
  const pendingReviews = await Order.countDocuments({
    client: clientId,
    status: 'completed',
    _id: { 
      $nin: await Review.distinct('order', { client: clientId })
    }
  });

  // Calculate growth percentage
  const bookingGrowth = lastMonthBookings > 0 
    ? ((thisMonthBookings - lastMonthBookings) / lastMonthBookings * 100).toFixed(1)
    : thisMonthBookings > 0 ? 100 : 0;

  res.status(200).json({
    success: true,
    data: {
      bookings: {
        total: totalBookings,
        active: activeBookings,
        completed: completedBookings,
        upcoming: upcomingBookings,
        thisMonth: thisMonthBookings,
        growth: parseFloat(bookingGrowth)
      },
      spending: {
        total: totalSpent[0]?.total || 0,
        thisMonth: thisMonthSpent[0]?.total || 0
      },
      favoriteServices,
      pendingReviews,
      quickStats: {
        savedServices: await Service.countDocuments({ 
          _id: { $in: req.user.savedServices || [] }
        }),
        totalReviews: await Review.countDocuments({ client: clientId })
      }
    }
  });
});

// @desc    Get client's recent bookings
// @route   GET /api/client/dashboard/recent-bookings
// @access  Private (Client only)
const getRecentBookings = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;
  
  // Get client ID from JWT token
  const bookings = await Order.find({ client: req.user.id })
    .populate('vendor', 'firstName lastName businessInfo')
    .populate('service', 'title category images')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: bookings
  });
});

// @desc    Get upcoming bookings
// @route   GET /api/client/dashboard/upcoming-bookings
// @access  Private (Client only)
const getUpcomingBookings = asyncHandler(async (req, res, next) => {
  const now = new Date();
  
  // Get client ID from JWT token
  const upcomingBookings = await Order.find({
    client: req.user.id,
    status: { $in: ['confirmed', 'in_progress'] },
    scheduledDate: { $gte: now }
  })
    .populate('vendor', 'firstName lastName businessInfo phone')
    .populate('service', 'title category')
    .sort({ scheduledDate: 1 });

  res.status(200).json({
    success: true,
    data: upcomingBookings
  });
});

// @desc    Get booking history with filters
// @route   GET /api/client/dashboard/booking-history
// @access  Private (Client only)
const getBookingHistory = asyncHandler(async (req, res, next) => {
  const {
    status,
    category,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    dateFrom,
    dateTo
  } = req.query;

  // Build query - use client ID from JWT token
  let query = { client: req.user.id };

  if (status) {
    query.status = status;
  }

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // Execute query with pagination
  let bookingsQuery = Order.find(query)
    .populate('vendor', 'firstName lastName businessInfo')
    .populate('service', 'title category images')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Add category filter if specified
  if (category) {
    bookingsQuery = bookingsQuery.populate({
      path: 'service',
      match: { category: category },
      select: 'title category images'
    });
  }

  const bookings = await bookingsQuery;
  const total = await Order.countDocuments(query);

  res.status(200).json({
    success: true,
    data: bookings.filter(booking => booking.service), // Filter out null services if category filter applied
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get spending analytics
// @route   GET /api/client/dashboard/spending-analytics
// @access  Private (Client only)
const getSpendingAnalytics = asyncHandler(async (req, res, next) => {
  const { period = 'month' } = req.query;
  // Get client ID from JWT token
  const clientId = req.user.id;

  let dateRange;
  let groupBy;

  switch (period) {
    case 'week':
      dateRange = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'year':
      dateRange = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      break;
    default: // month
      dateRange = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }

  const spendingData = await Order.aggregate([
    {
      $match: {
        client: clientId,
        status: 'completed',
        createdAt: { $gte: dateRange }
      }
    },
    {
      $group: {
        _id: groupBy,
        totalSpent: { $sum: '$totalAmount' },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  // Get spending by category
  const categorySpending = await Order.aggregate([
    {
      $match: {
        client: clientId,
        status: 'completed',
        createdAt: { $gte: dateRange }
      }
    },
    {
      $lookup: {
        from: 'services',
        localField: 'service',
        foreignField: '_id',
        as: 'serviceInfo'
      }
    },
    { $unwind: '$serviceInfo' },
    {
      $group: {
        _id: '$serviceInfo.category',
        totalSpent: { $sum: '$totalAmount' },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { totalSpent: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      timeline: spendingData,
      byCategory: categorySpending
    }
  });
});

// @desc    Get saved services
// @route   GET /api/client/dashboard/saved-services
// @access  Private (Client only)
const getSavedServices = asyncHandler(async (req, res, next) => {
  // Get user with saved services from JWT token
  const user = await User.findById(req.user.id).populate({
    path: 'savedServices',
    populate: {
      path: 'vendor',
      select: 'firstName lastName businessInfo'
    }
  });

  res.status(200).json({
    success: true,
    data: user.savedServices || []
  });
});

// @desc    Get client's reviews
// @route   GET /api/client/dashboard/my-reviews
// @access  Private (Client only)
const getMyReviews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  // Get client ID from JWT token
  const reviews = await Review.find({ client: req.user.id })
    .populate('service', 'title category')
    .populate('vendor', 'firstName lastName businessInfo')
    .populate('order', 'orderNumber scheduledDate')
    .sort({ createdAt: -1 })
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

// @desc    Get services requiring reviews
// @route   GET /api/client/dashboard/pending-reviews
// @access  Private (Client only)
const getPendingReviews = asyncHandler(async (req, res, next) => {
  // Get client ID from JWT token
  // Get completed orders that don't have reviews yet
  const reviewedOrderIds = await Review.distinct('order', { client: req.user.id });
  
  const pendingReviewOrders = await Order.find({
    client: req.user.id,
    status: 'completed',
    _id: { $nin: reviewedOrderIds }
  })
    .populate('service', 'title category images')
    .populate('vendor', 'firstName lastName businessInfo')
    .sort({ completedAt: -1 });

  res.status(200).json({
    success: true,
    data: pendingReviewOrders
  });
});

// @desc    Get recommended services
// @route   GET /api/client/dashboard/recommendations
// @access  Private (Client only)
const getRecommendations = asyncHandler(async (req, res, next) => {
  // Get client ID from JWT token
  const clientId = req.user.id;

  // Get client's booking history to understand preferences
  const bookingHistory = await Order.find({ client: clientId })
    .populate('service', 'category');

  // Extract preferred categories
  const categoryPreferences = {};
  bookingHistory.forEach(booking => {
    if (booking.service?.category) {
      categoryPreferences[booking.service.category] = 
        (categoryPreferences[booking.service.category] || 0) + 1;
    }
  });

  // Get top 3 preferred categories
  const topCategories = Object.entries(categoryPreferences)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([category]) => category);

  // Get recommended services based on preferences and ratings
  const recommendations = await Service.find({
    category: { $in: topCategories.length > 0 ? topCategories : ['home_cleaning', 'plumbing', 'electrical'] },
    status: 'active',
    'stats.averageRating': { $gte: 4.0 }
  })
    .populate('vendor', 'firstName lastName businessInfo')
    .sort({ 'stats.averageRating': -1, 'stats.totalReviews': -1 })
    .limit(10);

  // Get trending services (most booked recently)
  const trendingServices = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        status: { $ne: 'cancelled' }
      }
    },
    { $group: { _id: '$service', bookingCount: { $sum: 1 } } },
    { $sort: { bookingCount: -1 } },
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
      $lookup: {
        from: 'users',
        localField: 'serviceInfo.vendor',
        foreignField: '_id',
        as: 'vendorInfo'
      }
    },
    { $unwind: '$vendorInfo' }
  ]);

  res.status(200).json({
    success: true,
    data: {
      personalized: recommendations,
      trending: trendingServices,
      categories: topCategories.length > 0 ? topCategories : ['home_cleaning', 'plumbing', 'electrical']
    }
  });
});

// @desc    Get client notifications
// @route   GET /api/client/dashboard/notifications
// @access  Private (Client only)
const getClientNotifications = asyncHandler(async (req, res, next) => {
  // Get client ID from JWT token
  const clientId = req.user.id;
  const now = new Date();

  // Get upcoming bookings (within 24 hours)
  const upcomingBookings = await Order.countDocuments({
    client: clientId,
    status: { $in: ['confirmed', 'in_progress'] },
    scheduledDate: { 
      $gte: now,
      $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }
  });

  // Get pending reviews
  const reviewedOrderIds = await Review.distinct('order', { client: clientId });
  const pendingReviews = await Order.countDocuments({
    client: clientId,
    status: 'completed',
    _id: { $nin: reviewedOrderIds }
  });

  // Get booking confirmations needed
  const pendingConfirmations = await Order.countDocuments({
    client: clientId,
    status: 'pending'
  });

  // Get completed bookings (last 7 days)
  const recentCompletions = await Order.countDocuments({
    client: clientId,
    status: 'completed',
    completedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });

  res.status(200).json({
    success: true,
    data: {
      upcomingBookings,
      pendingReviews,
      pendingConfirmations,
      recentCompletions,
      total: upcomingBookings + pendingReviews + pendingConfirmations + recentCompletions
    }
  });
});

module.exports = {
  getClientDashboardOverview,
  getRecentBookings,
  getUpcomingBookings,
  getBookingHistory,
  getSpendingAnalytics,
  getSavedServices,
  getMyReviews,
  getPendingReviews,
  getRecommendations,
  getClientNotifications
};