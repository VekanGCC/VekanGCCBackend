const Order = require('../models/Order');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get vendor payment summary
// @route   GET /api/vendor/payments/summary
// @access  Private (Vendor only)
const getPaymentSummary = asyncHandler(async (req, res, next) => {
  const vendorId = req.user.id;
  
  // Get total earnings
  const totalEarnings = await Order.aggregate([
    { $match: { vendor: vendorId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  
  // Get pending payments
  const pendingPayments = await Order.aggregate([
    { 
      $match: { 
        vendor: vendorId, 
        status: 'completed',
        paymentStatus: { $ne: 'paid' }
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  
  // Get monthly earnings
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const monthlyEarnings = await Order.aggregate([
    { 
      $match: { 
        vendor: vendorId, 
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  
  // Get payment method breakdown
  const paymentMethodBreakdown = await Order.aggregate([
    { 
      $match: { 
        vendor: vendorId, 
        status: 'completed'
      } 
    },
    {
      $group: {
        _id: '$paymentMethod',
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        method: { $ifNull: ['$_id', 'unknown'] },
        total: 1,
        count: 1
      }
    }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      totalEarnings: totalEarnings[0]?.total || 0,
      pendingPayments: pendingPayments[0]?.total || 0,
      monthlyEarnings: monthlyEarnings[0]?.total || 0,
      paymentMethodBreakdown
    }
  });
});

// @desc    Get vendor payment history
// @route   GET /api/vendor/payments/history
// @access  Private (Vendor only)
const getPaymentHistory = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'paymentDate',
    sortOrder = 'desc',
    status,
    startDate,
    endDate
  } = req.query;
  
  // Build query
  let query = { 
    vendor: req.user.id,
    status: 'completed'
  };
  
  if (status) {
    query.paymentStatus = status;
  }
  
  if (startDate || endDate) {
    query.paymentDate = {};
    if (startDate) query.paymentDate.$gte = new Date(startDate);
    if (endDate) query.paymentDate.$lte = new Date(endDate);
  }
  
  // Execute query with pagination
  const payments = await Order.find(query)
    .populate('client', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Order.countDocuments(query);
  
  res.status(200).json({
    success: true,
    data: payments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get vendor payment methods
// @route   GET /api/vendor/payments/methods
// @access  Private (Vendor only)
const getPaymentMethods = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('paymentMethods');
  
  res.status(200).json({
    success: true,
    data: user.paymentMethods || []
  });
});

// @desc    Add vendor payment method
// @route   POST /api/vendor/payments/methods
// @access  Private (Vendor only)
const addPaymentMethod = asyncHandler(async (req, res, next) => {
  const { type, accountNumber, bankName, routingNumber, accountName } = req.body;
  
  if (!type) {
    return next(new ErrorResponse('Payment method type is required', 400));
  }
  
  // Validate based on type
  if (type === 'bank_account') {
    if (!accountNumber || !bankName || !routingNumber || !accountName) {
      return next(new ErrorResponse('All bank account details are required', 400));
    }
  }
  
  const user = await User.findById(req.user.id);
  
  // Initialize payment methods array if it doesn't exist
  if (!user.paymentMethods) {
    user.paymentMethods = [];
  }
  
  // Add new payment method
  user.paymentMethods.push({
    type,
    accountNumber,
    bankName,
    routingNumber,
    accountName,
    isDefault: user.paymentMethods.length === 0 // Make default if first method
  });
  
  await user.save();
  
  res.status(201).json({
    success: true,
    message: 'Payment method added successfully',
    data: user.paymentMethods
  });
});

// @desc    Update vendor payment method
// @route   PUT /api/vendor/payments/methods/:id
// @access  Private (Vendor only)
const updatePaymentMethod = asyncHandler(async (req, res, next) => {
  const { type, accountNumber, bankName, routingNumber, accountName, isDefault } = req.body;
  
  const user = await User.findById(req.user.id);
  
  // Find the payment method
  const methodIndex = user.paymentMethods.findIndex(
    method => method._id.toString() === req.params.id
  );
  
  if (methodIndex === -1) {
    return next(new ErrorResponse('Payment method not found', 404));
  }
  
  // Update fields
  if (type) user.paymentMethods[methodIndex].type = type;
  if (accountNumber) user.paymentMethods[methodIndex].accountNumber = accountNumber;
  if (bankName) user.paymentMethods[methodIndex].bankName = bankName;
  if (routingNumber) user.paymentMethods[methodIndex].routingNumber = routingNumber;
  if (accountName) user.paymentMethods[methodIndex].accountName = accountName;
  
  // Handle default status
  if (isDefault) {
    // Set all methods to non-default
    user.paymentMethods.forEach((method, index) => {
      user.paymentMethods[index].isDefault = false;
    });
    // Set this method as default
    user.paymentMethods[methodIndex].isDefault = true;
  }
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Payment method updated successfully',
    data: user.paymentMethods
  });
});

// @desc    Delete vendor payment method
// @route   DELETE /api/vendor/payments/methods/:id
// @access  Private (Vendor only)
const deletePaymentMethod = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  // Find the payment method
  const methodIndex = user.paymentMethods.findIndex(
    method => method._id.toString() === req.params.id
  );
  
  if (methodIndex === -1) {
    return next(new ErrorResponse('Payment method not found', 404));
  }
  
  // Check if it's the default method
  const isDefault = user.paymentMethods[methodIndex].isDefault;
  
  // Remove the method
  user.paymentMethods.splice(methodIndex, 1);
  
  // If it was the default and there are other methods, set a new default
  if (isDefault && user.paymentMethods.length > 0) {
    user.paymentMethods[0].isDefault = true;
  }
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Payment method deleted successfully',
    data: user.paymentMethods
  });
});

module.exports = {
  getPaymentSummary,
  getPaymentHistory,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod
};