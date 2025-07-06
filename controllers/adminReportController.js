const User = require('../models/User');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Review = require('../models/Review');
const Transaction = require('../models/Transaction');
const Resource = require('../models/Resource');
const Requirement = require('../models/Requirement');
const Application = require('../models/Application');
const SOW = require('../models/SOW');
const PO = require('../models/PO');
const Invoice = require('../models/Invoice');
const VendorSkill = require('../models/VendorSkill');
const AdminSkill = require('../models/AdminSkill');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get user growth report
// @route   GET /api/admin/reports/user-growth
// @access  Private (Admin only)
const getUserGrowthReport = asyncHandler(async (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;
  
  let dateRange;
  let groupBy;
  
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
        break;
      case 'year':
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default: // month
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }
  }
  
  // Get user growth data
  const userGrowth = await User.aggregate([
    {
      $match: {
        createdAt: dateRange
      }
    },
    {
      $group: {
        _id: groupBy,
        totalUsers: { $sum: 1 },
        vendors: {
          $sum: { $cond: [{ $eq: ['$userType', 'vendor'] }, 1, 0] }
        },
        clients: {
          $sum: { $cond: [{ $eq: ['$userType', 'client'] }, 1, 0] }
        },
        date: { $first: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 0,
        date: { 
          $dateToString: { 
            format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', 
            date: '$date' 
          } 
        },
        totalUsers: 1,
        vendors: 1,
        clients: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
  
  // Get cumulative user counts
  const totalUsers = await User.countDocuments();
  const totalVendors = await User.countDocuments({ userType: 'vendor' });
  const totalClients = await User.countDocuments({ userType: 'client' });
  
  res.status(200).json({
    success: true,
    data: {
      growth: userGrowth,
      totals: {
        users: totalUsers,
        vendors: totalVendors,
        clients: totalClients
      }
    }
  });
});

// @desc    Get revenue report
// @route   GET /api/admin/reports/revenue
// @access  Private (Admin only)
const getRevenueReport = asyncHandler(async (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;
  
  let dateRange;
  let groupBy;
  
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
        break;
      case 'year':
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default: // month
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }
  }
  
  // Get revenue data
  const revenueData = await Order.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: dateRange
      }
    },
    {
      $group: {
        _id: groupBy,
        totalRevenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
        platformFees: { $sum: { $multiply: ['$totalAmount', 0.10] } }, // Assuming 10% platform fee
        date: { $first: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 0,
        date: { 
          $dateToString: { 
            format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', 
            date: '$date' 
          } 
        },
        totalRevenue: 1,
        orderCount: 1,
        platformFees: 1,
        vendorEarnings: { $subtract: ['$totalRevenue', '$platformFees'] }
      }
    },
    { $sort: { date: 1 } }
  ]);
  
  // Get revenue by category
  const revenueByCategory = await Order.aggregate([
    {
      $match: {
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
        totalRevenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        totalRevenue: 1,
        orderCount: 1
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
  
  // Get total revenue stats
  const totalRevenue = await Order.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  
  const totalOrders = await Order.countDocuments({ status: 'completed' });
  
  res.status(200).json({
    success: true,
    data: {
      timeline: revenueData,
      byCategory: revenueByCategory,
      totals: {
        revenue: totalRevenue[0]?.total || 0,
        orders: totalOrders,
        platformFees: (totalRevenue[0]?.total || 0) * 0.10, // Assuming 10% platform fee
        vendorEarnings: (totalRevenue[0]?.total || 0) * 0.90 // Assuming 90% to vendors
      }
    }
  });
});

// @desc    Get service performance report
// @route   GET /api/admin/reports/service-performance
// @access  Private (Admin only)
const getServicePerformanceReport = asyncHandler(async (req, res, next) => {
  // Get top performing services
  const topServices = await Service.aggregate([
    { $match: { status: 'active' } },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'service',
        as: 'orders'
      }
    },
    {
      $project: {
        _id: 1,
        title: 1,
        category: 1,
        vendor: 1,
        pricing: 1,
        stats: 1,
        orderCount: { $size: '$orders' },
        revenue: {
          $reduce: {
            input: '$orders',
            initialValue: 0,
            in: { 
              $add: [
                '$$value', 
                { $cond: [{ $eq: ['$$this.status', 'completed'] }, '$$this.totalAmount', 0] }
              ]
            }
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'vendor',
        foreignField: '_id',
        as: 'vendorInfo'
      }
    },
    { $unwind: '$vendorInfo' },
    {
      $project: {
        _id: 1,
        title: 1,
        category: 1,
        vendorName: { 
          $concat: ['$vendorInfo.firstName', ' ', '$vendorInfo.lastName'] 
        },
        basePrice: '$pricing.basePrice',
        averageRating: '$stats.averageRating',
        totalReviews: '$stats.totalReviews',
        orderCount: 1,
        revenue: 1
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 20 }
  ]);
  
  // Get service category distribution
  const categoryDistribution = await Service.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        averagePrice: { $avg: '$pricing.basePrice' }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        count: 1,
        averagePrice: 1
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Get service growth over time
  const serviceGrowth = await Service.aggregate([
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
      topServices,
      categoryDistribution,
      serviceGrowth
    }
  });
});

// @desc    Get vendor performance report
// @route   GET /api/admin/reports/vendor-performance
// @access  Private (Admin only)
const getVendorPerformanceReport = asyncHandler(async (req, res, next) => {
  // Get top performing vendors
  const topVendors = await User.aggregate([
    { $match: { userType: 'vendor', isActive: true } },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'vendor',
        as: 'orders'
      }
    },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'vendor',
        as: 'reviews'
      }
    },
    {
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        businessInfo: 1,
        orderCount: { $size: '$orders' },
        revenue: {
          $reduce: {
            input: '$orders',
            initialValue: 0,
            in: { 
              $add: [
                '$$value', 
                { $cond: [{ $eq: ['$$this.status', 'completed'] }, '$$this.totalAmount', 0] }
              ]
            }
          }
        },
        averageRating: { 
          $cond: [
            { $gt: [{ $size: '$reviews' }, 0] },
            { $avg: '$reviews.rating' },
            0
          ]
        },
        totalReviews: { $size: '$reviews' }
      }
    },
    {
      $project: {
        _id: 1,
        name: { $concat: ['$firstName', ' ', '$lastName'] },
        email: 1,
        businessName: '$businessInfo.companyName',
        orderCount: 1,
        revenue: 1,
        averageRating: 1,
        totalReviews: 1
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 20 }
  ]);
  
  // Get vendor registration trend
  const vendorGrowth = await User.aggregate([
    { $match: { userType: 'vendor' } },
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
      topVendors,
      vendorGrowth
    }
  });
});

// @desc    Get client activity report
// @route   GET /api/admin/reports/client-activity
// @access  Private (Admin only)
const getClientActivityReport = asyncHandler(async (req, res, next) => {
  // Get top clients by spending
  const topClients = await User.aggregate([
    { $match: { userType: 'client', isActive: true } },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'client',
        as: 'orders'
      }
    },
    {
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        orderCount: { $size: '$orders' },
        totalSpent: {
          $reduce: {
            input: '$orders',
            initialValue: 0,
            in: { 
              $add: [
                '$$value', 
                { $cond: [{ $eq: ['$$this.status', 'completed'] }, '$$this.totalAmount', 0] }
              ]
            }
          }
        },
        registrationDate: '$createdAt'
      }
    },
    {
      $project: {
        _id: 1,
        name: { $concat: ['$firstName', ' ', '$lastName'] },
        email: 1,
        orderCount: 1,
        totalSpent: 1,
        registrationDate: 1
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 20 }
  ]);
  
  // Get client registration trend
  const clientGrowth = await User.aggregate([
    { $match: { userType: 'client' } },
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
  
  // Get client retention data
  const clientRetention = await Order.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$client',
        orderCount: { $sum: 1 },
        firstOrder: { $min: '$createdAt' },
        lastOrder: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 1,
        orderCount: 1,
        firstOrder: 1,
        lastOrder: 1,
        daysSinceFirstOrder: { 
          $divide: [
            { $subtract: [new Date(), '$firstOrder'] },
            1000 * 60 * 60 * 24
          ]
        },
        daysBetweenFirstAndLastOrder: {
          $divide: [
            { $subtract: ['$lastOrder', '$firstOrder'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    }
  ]);
  
  // Calculate retention metrics
  const repeatClients = clientRetention.filter(client => client.orderCount > 1).length;
  const totalClients = clientRetention.length;
  const retentionRate = totalClients > 0 ? (repeatClients / totalClients * 100).toFixed(1) : 0;
  
  res.status(200).json({
    success: true,
    data: {
      topClients,
      clientGrowth,
      retention: {
        totalClients,
        repeatClients,
        retentionRate: parseFloat(retentionRate),
        averageOrdersPerClient: totalClients > 0 
          ? clientRetention.reduce((sum, client) => sum + client.orderCount, 0) / totalClients 
          : 0
      }
    }
  });
});

// @desc    Get user registration and approval report
// @route   GET /api/admin/reports/user-registration
// @access  Private (Admin only)
const getUserRegistrationReport = asyncHandler(async (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;
  
  let dateRange;
  let groupBy;
  
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
        break;
      case 'year':
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default: // month
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }
  }
  
  // Get user registration timeline
  const timeline = await User.aggregate([
    {
      $match: {
        createdAt: dateRange
      }
    },
    {
      $group: {
        _id: groupBy,
        totalUsers: { $sum: 1 },
        vendors: {
          $sum: { $cond: [{ $eq: ['$userType', 'vendor'] }, 1, 0] }
        },
        clients: {
          $sum: { $cond: [{ $eq: ['$userType', 'client'] }, 1, 0] }
        },
        date: { $first: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 0,
        date: { 
          $dateToString: { 
            format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', 
            date: '$date' 
          } 
        },
        totalUsers: 1,
        vendors: 1,
        clients: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
  
  // Get approval statistics
  const approvalStats = await User.aggregate([
    {
      $group: {
        _id: '$approvalStatus',
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Get total counts
  const totals = await User.aggregate([
    {
      $group: {
        _id: null,
        users: { $sum: 1 },
        vendors: { $sum: { $cond: [{ $eq: ['$userType', 'vendor'] }, 1, 0] } },
        clients: { $sum: { $cond: [{ $eq: ['$userType', 'client'] }, 1, 0] } }
      }
    }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      timeline,
      approvalStats: approvalStats.reduce((acc, stat) => {
        acc[stat._id || 'pending'] = stat.count;
        return acc;
      }, {}),
      totals: totals[0] || { users: 0, vendors: 0, clients: 0 }
    }
  });
});

// @desc    Get resources analytics report
// @route   GET /api/admin/reports/resources
// @access  Private (Admin only)
const getResourcesReport = asyncHandler(async (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;
  
  let dateRange;
  if (startDate && endDate) {
    dateRange = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    switch (period) {
      case 'week':
        dateRange = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'year':
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        break;
      default: // month
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }
  }
  
  // Get resources by vendor
  const byVendor = await Resource.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'vendor',
        foreignField: '_id',
        as: 'vendorInfo'
      }
    },
    { $unwind: '$vendorInfo' },
    {
      $group: {
        _id: '$vendor',
        vendorName: { $first: { $concat: ['$vendorInfo.firstName', ' ', '$vendorInfo.lastName'] } },
        resourceCount: { $sum: 1 }
      }
    },
    { $sort: { resourceCount: -1 } },
    { $limit: 10 }
  ]);
  
  // Get resources by skill
  const bySkill = await Resource.aggregate([
    {
      $lookup: {
        from: 'adminskills',
        localField: 'skills',
        foreignField: '_id',
        as: 'skillInfo'
      }
    },
    { $unwind: '$skillInfo' },
    {
      $group: {
        _id: '$skillInfo._id',
        skillName: { $first: '$skillInfo.name' },
        resourceCount: { $sum: 1 }
      }
    },
    { $sort: { resourceCount: -1 } },
    { $limit: 10 }
  ]);
  
  // Get total counts
  const totalResources = await Resource.countDocuments();
  const activeVendors = await Resource.distinct('createdBy').then(vendors => vendors.length);
  const uniqueSkills = await Resource.aggregate([
    { $unwind: '$skills' },
    { $group: { _id: '$skills' } },
    { $count: 'total' }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      byVendor,
      bySkill,
      totalResources,
      activeVendors,
      uniqueSkills: uniqueSkills[0]?.total || 0,
      monthlyGrowth: 15 // Placeholder - calculate actual growth
    }
  });
});

// @desc    Get requirements analytics report
// @route   GET /api/admin/reports/requirements
// @access  Private (Admin only)
const getRequirementsReport = asyncHandler(async (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;
  
  let dateRange;
  if (startDate && endDate) {
    dateRange = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    switch (period) {
      case 'week':
        dateRange = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'year':
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        break;
      default: // month
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }
  }
  
  // Get requirements by client
  const byClient = await Requirement.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'clientInfo'
      }
    },
    { $unwind: '$clientInfo' },
    {
      $group: {
        _id: '$createdBy',
        clientName: { $first: { $concat: ['$clientInfo.firstName', ' ', '$clientInfo.lastName'] } },
        requirementCount: { $sum: 1 }
      }
    },
    { $sort: { requirementCount: -1 } },
    { $limit: 10 }
  ]);
  
  // Get requirements by status
  const byStatus = await Requirement.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Get total counts
  const totalRequirements = await Requirement.countDocuments();
  const activeClients = await Requirement.distinct('createdBy').then(clients => clients.length);
  const openRequirements = await Requirement.countDocuments({ status: 'open' });
  const completedRequirements = await Requirement.countDocuments({ status: 'completed' });
  
  res.status(200).json({
    success: true,
    data: {
      byClient,
      byStatus,
      totalRequirements,
      activeClients,
      openRequirements,
      completedRequirements
    }
  });
});

// @desc    Get applications analytics report
// @route   GET /api/admin/reports/applications
// @access  Private (Admin only)
const getApplicationsReport = asyncHandler(async (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;
  
  let dateRange;
  let groupBy;
  
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
        break;
      case 'year':
        dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default: // month
        dateRange = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }
  }
  
  // Get applications by status
  const byStatus = await Application.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Get applications timeline
  const timeline = await Application.aggregate([
    {
      $match: {
        createdAt: dateRange
      }
    },
    {
      $group: {
        _id: groupBy,
        count: { $sum: 1 },
        date: { $first: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 0,
        date: { 
          $dateToString: { 
            format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', 
            date: '$date' 
          } 
        },
        count: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
  
  // Get total counts
  const totalApplications = await Application.countDocuments();
  const pendingApplications = await Application.countDocuments({ status: 'pending' });
  const approvedApplications = await Application.countDocuments({ status: 'approved' });
  const rejectedApplications = await Application.countDocuments({ status: 'rejected' });
  
  res.status(200).json({
    success: true,
    data: {
      byStatus,
      timeline,
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications
    }
  });
});

// @desc    Get skills analytics report
// @route   GET /api/admin/reports/skills
// @access  Private (Admin only)
const getSkillsReport = asyncHandler(async (req, res, next) => {
  // Get top skills for resources
  const topSkillsForResources = await Resource.aggregate([
    {
      $lookup: {
        from: 'adminskills',
        localField: 'skills',
        foreignField: '_id',
        as: 'skillInfo'
      }
    },
    { $unwind: '$skillInfo' },
    {
      $group: {
        _id: '$skillInfo._id',
        skillName: { $first: '$skillInfo.name' },
        resourceCount: { $sum: 1 }
      }
    },
    { $sort: { resourceCount: -1 } },
    { $limit: 10 }
  ]);
  
  // Get top skills for requirements
  const topSkillsForRequirements = await Requirement.aggregate([
    {
      $lookup: {
        from: 'adminskills',
        localField: 'skills',
        foreignField: '_id',
        as: 'skillInfo'
      }
    },
    { $unwind: '$skillInfo' },
    {
      $group: {
        _id: '$skillInfo._id',
        skillName: { $first: '$skillInfo.name' },
        requirementCount: { $sum: 1 }
      }
    },
    { $sort: { requirementCount: -1 } },
    { $limit: 10 }
  ]);
  
  // Get total counts
  const totalSkills = await AdminSkill.countDocuments();
  const highDemandSkills = topSkillsForRequirements.length;
  const skillsWithResources = topSkillsForResources.length;
  const skillShortages = Math.max(0, highDemandSkills - skillsWithResources);
  
  res.status(200).json({
    success: true,
    data: {
      topSkillsForResources,
      topSkillsForRequirements,
      totalSkills,
      highDemandSkills,
      skillsWithResources,
      skillShortages
    }
  });
});

// @desc    Get financial report
// @route   GET /api/admin/reports/financial
// @access  Private (Admin only)
const getFinancialReport = asyncHandler(async (req, res, next) => {
  // Get document counts
  const sowCount = await SOW.countDocuments();
  const poCount = await PO.countDocuments();
  const invoiceCount = await Invoice.countDocuments();
  
  // Get invoice statistics
  const invoiceStats = await Invoice.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      sowCount,
      poCount,
      invoiceCount,
      invoiceStats: invoiceStats.reduce((acc, stat) => {
        acc[stat._id || 'pending'] = stat.count;
        return acc;
      }, {})
    }
  });
});

// @desc    Get monthly growth report
// @route   GET /api/admin/reports/monthly-growth
// @access  Private (Admin only)
const getMonthlyGrowthReport = asyncHandler(async (req, res, next) => {
  const { period = 'year' } = req.query;
  
  let dateRange;
  if (period === 'year') {
    dateRange = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
  } else {
    dateRange = { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) };
  }
  
  // Get monthly growth for all entities
  const timeline = await Promise.all([
    // Users growth
    User.aggregate([
      { $match: { createdAt: dateRange } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          users: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: { 
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
          users: 1
        }
      },
      { $sort: { month: 1 } }
    ]),
    
    // Resources growth
    Resource.aggregate([
      { $match: { createdAt: dateRange } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          resources: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: { 
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
          resources: 1
        }
      },
      { $sort: { month: 1 } }
    ]),
    
    // Requirements growth
    Requirement.aggregate([
      { $match: { createdAt: dateRange } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          requirements: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: { 
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
          requirements: 1
        }
      },
      { $sort: { month: 1 } }
    ]),
    
    // Applications growth
    Application.aggregate([
      { $match: { createdAt: dateRange } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          applications: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: { 
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
          applications: 1
        }
      },
      { $sort: { month: 1 } }
    ])
  ]);
  
  // Merge all timelines
  const [usersTimeline, resourcesTimeline, requirementsTimeline, applicationsTimeline] = timeline;
  
  // Create combined timeline
  const allMonths = new Set([
    ...usersTimeline.map(item => item.month),
    ...resourcesTimeline.map(item => item.month),
    ...requirementsTimeline.map(item => item.month),
    ...applicationsTimeline.map(item => item.month)
  ]);
  
  const combinedTimeline = Array.from(allMonths).sort().map(month => ({
    month,
    users: usersTimeline.find(item => item.month === month)?.users || 0,
    resources: resourcesTimeline.find(item => item.month === month)?.resources || 0,
    requirements: requirementsTimeline.find(item => item.month === month)?.requirements || 0,
    applications: applicationsTimeline.find(item => item.month === month)?.applications || 0
  }));
  
  res.status(200).json({
    success: true,
    data: {
      timeline: combinedTimeline,
      overallGrowth: 25, // Placeholder - calculate actual growth
      userGrowth: 20,
      resourceGrowth: 30,
      requirementGrowth: 15,
      applicationGrowth: 40
    }
  });
});

// @desc    Create custom report
// @route   POST /api/admin/reports/custom-reporting
// @access  Private (Admin only)
const createCustomReport = asyncHandler(async (req, res, next) => {
  const {
    dataSource, // 'users', 'resources', 'requirements', 'applications', 'skills', 'financial'
    timeRange, // 'week', 'month', 'quarter', 'year', 'custom'
    startDate,
    endDate,
    filters, // { field: 'status', operator: 'equals', value: 'active' }
    groupBy, // ['userType', 'status'] - fields to group by
    aggregations, // [{ field: 'count', type: 'sum' }, { field: 'amount', type: 'average' }]
    sortBy, // { field: 'createdAt', order: 'desc' }
    limit,
    includeFields, // ['name', 'email', 'status'] - fields to include
    excludeFields // ['password', 'token'] - fields to exclude
  } = req.body;

  // Validate data source
  const validDataSources = ['users', 'resources', 'requirements', 'applications', 'skills', 'financial'];
  if (!validDataSources.includes(dataSource)) {
    return next(new ErrorResponse('Invalid data source', 400));
  }

  // Build date range
  let dateRange = {};
  if (timeRange === 'custom' && startDate && endDate) {
    dateRange = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        dateRange = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'month':
        dateRange = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case 'quarter':
        dateRange = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case 'year':
        dateRange = { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
        break;
      default:
        dateRange = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }
  }

  // Build match stage
  const matchStage = { createdAt: dateRange };
  
  // Apply custom filters
  if (filters && Array.isArray(filters)) {
    filters.forEach(filter => {
      const { field, operator, value } = filter;
      switch (operator) {
        case 'equals':
          matchStage[field] = value;
          break;
        case 'not_equals':
          matchStage[field] = { $ne: value };
          break;
        case 'contains':
          matchStage[field] = { $regex: value, $options: 'i' };
          break;
        case 'greater_than':
          matchStage[field] = { $gt: value };
          break;
        case 'less_than':
          matchStage[field] = { $lt: value };
          break;
        case 'in':
          matchStage[field] = { $in: Array.isArray(value) ? value : [value] };
          break;
        case 'not_in':
          matchStage[field] = { $nin: Array.isArray(value) ? value : [value] };
          break;
      }
    });
  }

  // Build aggregation pipeline
  const pipeline = [{ $match: matchStage }];

  // Build group stage if grouping is specified
  if (groupBy && Array.isArray(groupBy) && groupBy.length > 0) {
    const groupId = {};
    groupBy.forEach(field => {
      groupId[field] = `$${field}`;
    });

    const groupStage = { _id: groupId };
    
    // Add aggregations
    if (aggregations && Array.isArray(aggregations)) {
      aggregations.forEach(agg => {
        switch (agg.type) {
          case 'count':
            groupStage[agg.field || 'count'] = { $sum: 1 };
            break;
          case 'sum':
            groupStage[agg.field] = { $sum: `$${agg.sourceField}` };
            break;
          case 'average':
            groupStage[agg.field] = { $avg: `$${agg.sourceField}` };
            break;
          case 'min':
            groupStage[agg.field] = { $min: `$${agg.sourceField}` };
            break;
          case 'max':
            groupStage[agg.field] = { $max: `$${agg.sourceField}` };
            break;
        }
      });
    } else {
      // Default count if no aggregations specified
      groupStage.count = { $sum: 1 };
    }

    pipeline.push({ $group: groupStage });
  }

  // Build project stage for field selection
  if (includeFields || excludeFields) {
    const projectStage = {};
    
    if (includeFields && Array.isArray(includeFields)) {
      includeFields.forEach(field => {
        projectStage[field] = 1;
      });
    }
    
    if (excludeFields && Array.isArray(excludeFields)) {
      excludeFields.forEach(field => {
        projectStage[field] = 0;
      });
    }
    
    if (Object.keys(projectStage).length > 0) {
      pipeline.push({ $project: projectStage });
    }
  }

  // Add sort stage
  if (sortBy && sortBy.field) {
    const sortOrder = sortBy.order === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortBy.field]: sortOrder } });
  }

  // Add limit stage
  if (limit && limit > 0) {
    pipeline.push({ $limit: limit });
  }

  // Execute query based on data source
  let result;
  let totalCount;
  
  switch (dataSource) {
    case 'users':
      result = await User.aggregate(pipeline);
      totalCount = await User.countDocuments(matchStage);
      break;
    case 'resources':
      result = await Resource.aggregate(pipeline);
      totalCount = await Resource.countDocuments(matchStage);
      break;
    case 'requirements':
      result = await Requirement.aggregate(pipeline);
      totalCount = await Requirement.countDocuments(matchStage);
      break;
    case 'applications':
      result = await Application.aggregate(pipeline);
      totalCount = await Application.countDocuments(matchStage);
      break;
    case 'skills':
      result = await AdminSkill.aggregate(pipeline);
      totalCount = await AdminSkill.countDocuments(matchStage);
      break;
    case 'financial':
      // For financial, we might need to join multiple collections
      result = await Invoice.aggregate(pipeline);
      totalCount = await Invoice.countDocuments(matchStage);
      break;
  }

  res.status(200).json({
    success: true,
    data: {
      report: result,
      metadata: {
        dataSource,
        timeRange,
        totalCount,
        filteredCount: result.length,
        filters: filters || [],
        groupBy: groupBy || [],
        aggregations: aggregations || [],
        sortBy: sortBy || null,
        limit: limit || null
      }
    }
  });
});

// @desc    Get available report templates
// @route   GET /api/admin/reports/templates-reporting
// @access  Private (Admin only)
const getReportTemplates = asyncHandler(async (req, res, next) => {
  const templates = [
    {
      id: 'user-growth-by-type',
      name: 'User Growth by Type',
      description: 'Track user registration growth by user type over time',
      dataSource: 'users',
      defaultTimeRange: 'month',
      defaultGroupBy: ['userType'],
      defaultAggregations: [{ field: 'count', type: 'count' }],
      defaultSortBy: { field: 'createdAt', order: 'desc' }
    },
    {
      id: 'resource-availability',
      name: 'Resource Availability Analysis',
      description: 'Analyze resource availability and status distribution',
      dataSource: 'resources',
      defaultTimeRange: 'month',
      defaultGroupBy: ['status', 'availability.status'],
      defaultAggregations: [{ field: 'count', type: 'count' }],
      defaultSortBy: { field: 'count', order: 'desc' }
    },
    {
      id: 'requirement-status-trends',
      name: 'Requirement Status Trends',
      description: 'Monitor requirement status changes over time',
      dataSource: 'requirements',
      defaultTimeRange: 'month',
      defaultGroupBy: ['status', 'priority'],
      defaultAggregations: [{ field: 'count', type: 'count' }],
      defaultSortBy: { field: 'createdAt', order: 'desc' }
    },
    {
      id: 'application-conversion-rates',
      name: 'Application Conversion Rates',
      description: 'Track application status progression and conversion rates',
      dataSource: 'applications',
      defaultTimeRange: 'month',
      defaultGroupBy: ['status'],
      defaultAggregations: [{ field: 'count', type: 'count' }],
      defaultSortBy: { field: 'count', order: 'desc' }
    },
    {
      id: 'skill-demand-analysis',
      name: 'Skill Demand Analysis',
      description: 'Analyze most requested skills and their demand',
      dataSource: 'requirements',
      defaultTimeRange: 'month',
      defaultGroupBy: ['skills'],
      defaultAggregations: [{ field: 'count', type: 'count' }],
      defaultSortBy: { field: 'count', order: 'desc' }
    },
    {
      id: 'financial-summary',
      name: 'Financial Summary Report',
      description: 'Comprehensive financial overview with revenue and payment tracking',
      dataSource: 'financial',
      defaultTimeRange: 'month',
      defaultGroupBy: ['paymentStatus'],
      defaultAggregations: [
        { field: 'count', type: 'count' },
        { field: 'totalAmount', type: 'sum', sourceField: 'invoiceAmount.amount' }
      ],
      defaultSortBy: { field: 'totalAmount', order: 'desc' }
    }
  ];

  res.status(200).json({
    success: true,
    data: templates
  });
});

// @desc    Save custom report template
// @route   POST /api/admin/reports/save-template-reporting
// @access  Private (Admin only)
const saveReportTemplate = asyncHandler(async (req, res, next) => {
  const {
    name,
    description,
    dataSource,
    timeRange,
    filters,
    groupBy,
    aggregations,
    sortBy,
    limit,
    includeFields,
    excludeFields,
    isPublic = false
  } = req.body;

  // Here you would save to a ReportTemplate model
  // For now, we'll return success
  res.status(200).json({
    success: true,
    data: {
      id: Date.now().toString(),
      name,
      description,
      dataSource,
      timeRange,
      filters,
      groupBy,
      aggregations,
      sortBy,
      limit,
      includeFields,
      excludeFields,
      isPublic,
      createdBy: req.user.id,
      createdAt: new Date()
    }
  });
});

module.exports = {
  getUserGrowthReport,
  getRevenueReport,
  getServicePerformanceReport,
  getVendorPerformanceReport,
  getClientActivityReport,
  getUserRegistrationReport,
  getResourcesReport,
  getRequirementsReport,
  getApplicationsReport,
  getSkillsReport,
  getFinancialReport,
  getMonthlyGrowthReport,
  createCustomReport,
  getReportTemplates,
  saveReportTemplate
};