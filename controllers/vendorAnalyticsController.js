const Order = require('../models/Order');
const Service = require('../models/Service');
const Review = require('../models/Review');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get vendor analytics overview
// @route   GET /api/vendor/analytics/overview
// @access  Private (Vendor only)
const getAnalyticsOverview = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;
  
  // Get date ranges for comparisons
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // Revenue metrics
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
  
  // Order metrics
  const totalOrders = await Order.countDocuments({ vendor: vendorId });
  const completedOrders = await Order.countDocuments({ 
    vendor: vendorId, 
    status: 'completed' 
  });
  const pendingOrders = await Order.countDocuments({ 
    vendor: vendorId, 
    status: 'pending' 
  });
  
  // Customer metrics
  const totalCustomers = await Order.distinct('client', { vendor: vendorId }).length;
  const newCustomersThisMonth = await Order.aggregate([
    { 
      $match: { 
        vendor: vendorId,
        createdAt: { $gte: startOfMonth }
      } 
    },
    { $group: { _id: '$client' } },
    { $group: { _id: null, count: { $sum: 1 } } }
  ]);
  
  // Service metrics
  const totalServices = await Service.countDocuments({ vendor: vendorId });
  const activeServices = await Service.countDocuments({ 
    vendor: vendorId, 
    status: 'active' 
  });
  
  // Review metrics
  const reviewStats = await Review.aggregate([
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
  const revenueGrowth = lastMonthRevenue[0]?.total > 0
    ? ((thisMonthRevenue[0]?.total || 0 - lastMonthRevenue[0]?.total) / lastMonthRevenue[0]?.total * 100).toFixed(1)
    : thisMonthRevenue[0]?.total > 0 ? 100 : 0;
  
  res.status(200).json({
    success: true,
    data: {
      revenue: {
        total: totalRevenue[0]?.total || 0,
        thisMonth: thisMonthRevenue[0]?.total || 0,
        growth: parseFloat(revenueGrowth)
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        pending: pendingOrders,
        completionRate: totalOrders > 0 ? (completedOrders / totalOrders * 100).toFixed(1) : 0
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth[0]?.count || 0
      },
      services: {
        total: totalServices,
        active: activeServices
      },
      reviews: {
        averageRating: reviewStats[0]?.averageRating || 0,
        totalReviews: reviewStats[0]?.totalReviews || 0
      }
    }
  });
});

// @desc    Get revenue analytics
// @route   GET /api/vendor/analytics/revenue
// @access  Private (Vendor only)
const getRevenueAnalytics = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;
  const { period = 'month', startDate, endDate } = req.query;
  
  let dateRange;
  let groupBy;
  let format;
  
  // Set date range based on period
  if (startDate && endDate) {
    dateRange = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    switch (period) {
      case 'week':
        dateRange = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        format = '%Y-%m-%d';
        break;
      case 'year':
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        format = '%Y-%m';
        break;
      default: // month
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        format = '%Y-%m-%d';
    }
  }
  
  // Get revenue data
  const revenueData = await Order.aggregate([
    {
      $match: {
        vendor: vendorId,
        status: 'completed',
        createdAt: dateRange
      }
    },
    {
      $group: {
        _id: groupBy,
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
        date: { $first: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 0,
        date: { $dateToString: { format, date: '$date' } },
        revenue: 1,
        orders: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
  
  // Get revenue by service category
  const revenueByCategory = await Order.aggregate([
    {
      $match: {
        vendor: vendorId,
        status: 'completed',
        createdAt: dateRange
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
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        revenue: 1,
        orders: 1
      }
    },
    { $sort: { revenue: -1 } }
  ]);
  
  // Get revenue by payment method
  const revenueByPaymentMethod = await Order.aggregate([
    {
      $match: {
        vendor: vendorId,
        status: 'completed',
        createdAt: dateRange
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        paymentMethod: { $ifNull: ['$_id', 'unknown'] },
        revenue: 1,
        orders: 1
      }
    },
    { $sort: { revenue: -1 } }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      timeline: revenueData,
      byCategory: revenueByCategory,
      byPaymentMethod: revenueByPaymentMethod
    }
  });
});

// @desc    Get customer analytics
// @route   GET /api/vendor/analytics/customers
// @access  Private (Vendor only)
const getCustomerAnalytics = asyncHandler(async (req, res, next) => {
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
        _id: 0,
        customerId: '$_id',
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
    {
      $project: {
        _id: 0,
        date: { 
          $dateToString: { 
            format: '%Y-%m', 
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: 1
              }
            }
          }
        },
        newCustomers: 1
      }
    },
    { $sort: { date: 1 } }
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

// @desc    Get service analytics
// @route   GET /api/vendor/analytics/services
// @access  Private (Vendor only)
const getServiceAnalytics = asyncHandler(async (req, res, next) => {
  // Get vendor ID from JWT token
  const vendorId = req.user.id;
  
  // Get service performance
  const servicePerformance = await Order.aggregate([
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
        _id: 0,
        serviceId: '$_id',
        serviceName: '$serviceInfo.title',
        category: '$serviceInfo.category',
        totalOrders: 1,
        totalRevenue: 1,
        averageOrderValue: 1
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
  
  // Get category performance
  const categoryPerformance = await Order.aggregate([
    { $match: { vendor: vendorId, status: 'completed' } },
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
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        totalOrders: 1,
        totalRevenue: 1
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
  
  // Get service growth
  const serviceGrowth = await Service.aggregate([
    { $match: { vendor: vendorId } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: { 
          $dateToString: { 
            format: '%Y-%m', 
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: 1
              }
            }
          }
        },
        count: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      servicePerformance,
      categoryPerformance,
      serviceGrowth
    }
  });
});

module.exports = {
  getAnalyticsOverview,
  getRevenueAnalytics,
  getCustomerAnalytics,
  getServiceAnalytics
};