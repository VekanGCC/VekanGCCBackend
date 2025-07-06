const User = require('../models/User');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Review = require('../models/Review');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get vendor dashboard overview
// @route   GET /api/vendor/dashboard/overview
// @access  Private (Vendor only)
const getDashboardOverview = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  // Get current date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get total services
  const totalServices = await Service.countDocuments({ vendor: vendorId });
  const activeServices = await Service.countDocuments({ 
    vendor: vendorId, 
    status: 'active' 
  });

  // Get orders statistics
  const totalOrders = await Order.countDocuments({ vendor: vendorId });
  const pendingOrders = await Order.countDocuments({ 
    vendor: vendorId, 
    status: 'pending' 
  });
  const completedOrders = await Order.countDocuments({ 
    vendor: vendorId, 
    status: 'completed' 
  });

  // Get monthly orders
  const thisMonthOrders = await Order.countDocuments({
    vendor: vendorId,
    createdAt: { $gte: startOfMonth }
  });

  const lastMonthOrders = await Order.countDocuments({
    vendor: vendorId,
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
  });

  // Calculate revenue
  const totalRevenue = await Order.aggregate([
    { $match: { vendor: vendorId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  const thisMonthRevenue = await Order.aggregate([
    { 
      $match: { 
        vendor: vendorId, 
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  const lastMonthRevenue = await Order.aggregate([
    { 
      $match: { 
        vendor: vendorId, 
        status: 'completed',
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  // Get average rating
  const ratingStats = await Review.aggregate([
    { $match: { vendor: vendorId } },
    { 
      $group: { 
        _id: null, 
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      } 
    }
  ]);

  // Calculate growth percentages
  const orderGrowth = lastMonthOrders > 0 
    ? ((thisMonthOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1)
    : thisMonthOrders > 0 ? 100 : 0;

  const revenueGrowth = lastMonthRevenue[0]?.total > 0
    ? ((thisMonthRevenue[0]?.total || 0 - lastMonthRevenue[0]?.total) / lastMonthRevenue[0]?.total * 100).toFixed(1)
    : thisMonthRevenue[0]?.total > 0 ? 100 : 0;

  res.status(200).json({
    success: true,
    data: {
      services: {
        total: totalServices,
        active: activeServices,
        inactive: totalServices - activeServices
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        completed: completedOrders,
        thisMonth: thisMonthOrders,
        growth: parseFloat(orderGrowth)
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        thisMonth: thisMonthRevenue[0]?.total || 0,
        growth: parseFloat(revenueGrowth)
      },
      rating: {
        average: ratingStats[0]?.averageRating || 0,
        totalReviews: ratingStats[0]?.totalReviews || 0
      }
    }
  });
});

// @desc    Get recent orders for vendor
// @route   GET /api/vendor/dashboard/recent-orders
// @access  Private (Vendor only)
const getRecentOrders = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;
  
  // Get vendor ID from JWT token
  const orders = await Order.find({ vendor: req.user.id })
    .populate('client', 'firstName lastName email')
    .populate('service', 'title')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: orders
  });
});

// @desc    Get revenue analytics
// @route   GET /api/vendor/dashboard/revenue-analytics
// @access  Private (Vendor only)
const getRevenueAnalytics = asyncHandler(async (req, res, next) => {
  const { period = 'month' } = req.query;
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

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

  const revenueData = await Order.aggregate([
    {
      $match: {
        vendor: vendorId,
        status: 'completed',
        createdAt: { $gte: dateRange }
      }
    },
    {
      $group: {
        _id: groupBy,
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: revenueData
  });
});

// @desc    Get service performance
// @route   GET /api/vendor/dashboard/service-performance
// @access  Private (Vendor only)
const getServicePerformance = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  const serviceStats = await Order.aggregate([
    { $match: { vendor: vendorId, status: 'completed' } },
    {
      $group: {
        _id: '$service',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    },
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
        totalOrders: 1,
        totalRevenue: 1,
        averageOrderValue: 1
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: serviceStats
  });
});

// @desc    Get customer insights
// @route   GET /api/vendor/dashboard/customer-insights
// @access  Private (Vendor only)
const getCustomerInsights = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  // Get total unique customers
  const uniqueCustomers = await Order.distinct('client', { vendor: vendorId });
  
  // Get repeat customers
  const customerOrderCounts = await Order.aggregate([
    { $match: { vendor: vendorId } },
    { $group: { _id: '$client', orderCount: { $sum: 1 } } },
    { $match: { orderCount: { $gt: 1 } } }
  ]);

  // Get top customers by revenue
  const topCustomers = await Order.aggregate([
    { $match: { vendor: vendorId, status: 'completed' } },
    {
      $group: {
        _id: '$client',
        totalSpent: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'customerInfo'
      }
    },
    { $unwind: '$customerInfo' },
    {
      $project: {
        customerName: {
          $concat: ['$customerInfo.firstName', ' ', '$customerInfo.lastName']
        },
        email: '$customerInfo.email',
        totalSpent: 1,
        orderCount: 1
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 }
  ]);

  // Get customer acquisition over time
  const customerAcquisition = await Order.aggregate([
    { $match: { vendor: vendorId } },
    {
      $group: {
        _id: {
          client: '$client',
          firstOrder: { $min: '$createdAt' }
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$_id.firstOrder' },
          month: { $month: '$_id.firstOrder' }
        },
        newCustomers: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Get customer retention rate
  const retentionRate = uniqueCustomers.length > 0 
    ? ((customerOrderCounts.length / uniqueCustomers.length) * 100).toFixed(1)
    : 0;
  
  res.status(200).json({
    success: true,
    data: {
      totalCustomers: uniqueCustomers.length,
      repeatCustomers: customerOrderCounts.length,
      retentionRate: parseFloat(retentionRate),
      topCustomers,
      customerAcquisition
    }
  });
});

// @desc    Get order status distribution
// @route   GET /api/vendor/dashboard/order-status
// @access  Private (Vendor only)
const getOrderStatusDistribution = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  const statusDistribution = await Order.aggregate([
    { $match: { vendor: vendorId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: statusDistribution
  });
});

// @desc    Get recent reviews
// @route   GET /api/vendor/dashboard/recent-reviews
// @access  Private (Vendor only)
const getRecentReviews = asyncHandler(async (req, res, next) => {
  const { limit = 5 } = req.query;
  
  // Get vendor ID from JWT token
  const reviews = await Review.find({ vendor: req.user.id })
    .populate('client', 'firstName lastName')
    .populate('service', 'title')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: reviews
  });
});

// @desc    Get notification summary
// @route   GET /api/vendor/dashboard/notifications
// @access  Private (Vendor only)
const getNotificationSummary = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  // Get pending orders (new orders that need attention)
  const pendingOrdersCount = await Order.countDocuments({
    vendor: vendorId,
    status: 'pending'
  });

  // Get unread reviews (assuming we have an isRead field)
  const unreadReviewsCount = await Review.countDocuments({
    vendor: vendorId,
    isRead: false
  });

  // Get services that need attention (low stock, inactive, etc.)
  const inactiveServicesCount = await Service.countDocuments({
    vendor: vendorId,
    status: 'inactive'
  });

  res.status(200).json({
    success: true,
    data: {
      pendingOrders: pendingOrdersCount,
      unreadReviews: unreadReviewsCount,
      inactiveServices: inactiveServicesCount,
      total: pendingOrdersCount + unreadReviewsCount + inactiveServicesCount
    }
  });
});

module.exports = {
  getDashboardOverview,
  getRecentOrders,
  getRevenueAnalytics,
  getServicePerformance,
  getCustomerInsights,
  getOrderStatusDistribution,
  getRecentReviews,
  getNotificationSummary
};