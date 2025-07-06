const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');

// @desc    Get vendor settings
// @route   GET /api/vendor/settings
// @access  Private (Vendor only)
const getVendorSettings = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password');

  // Extract only the settings-related fields
  const settings = {
    notifications: user.notifications || {
      email: true,
      sms: false,
      app: true
    },
    availability: user.availability || {
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timeSlots: [
        { start: '09:00', end: '17:00' }
      ]
    },
    serviceArea: user.serviceArea || {
      type: 'city',
      cities: [],
      radius: 0,
      specificAreas: []
    },
    paymentMethods: user.paymentMethods || {
      acceptCash: true,
      acceptCreditCard: true,
      acceptBankTransfer: false
    },
    cancellationPolicy: user.cancellationPolicy || 'standard',
    autoConfirmBookings: user.autoConfirmBookings || false
  };

  res.status(200).json({
    success: true,
    data: settings
  });
});

// @desc    Update vendor settings
// @route   PUT /api/vendor/settings
// @access  Private (Vendor only)
const updateVendorSettings = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return next(new ErrorResponse('Validation failed', 400, errors.array()));
  }

  const {
    notifications,
    availability,
    serviceArea,
    paymentMethods,
    cancellationPolicy,
    autoConfirmBookings
  } = req.body;

  // Build settings object with only provided fields
  const settingsToUpdate = {};
  
  if (notifications) settingsToUpdate.notifications = notifications;
  if (availability) settingsToUpdate.availability = availability;
  if (serviceArea) settingsToUpdate.serviceArea = serviceArea;
  if (paymentMethods) settingsToUpdate.paymentMethods = paymentMethods;
  if (cancellationPolicy) settingsToUpdate.cancellationPolicy = cancellationPolicy;
  if (autoConfirmBookings !== undefined) settingsToUpdate.autoConfirmBookings = autoConfirmBookings;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    settingsToUpdate,
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data: {
      notifications: user.notifications,
      availability: user.availability,
      serviceArea: user.serviceArea,
      paymentMethods: user.paymentMethods,
      cancellationPolicy: user.cancellationPolicy,
      autoConfirmBookings: user.autoConfirmBookings
    }
  });
});

// @desc    Get vendor notification preferences
// @route   GET /api/vendor/settings/notifications
// @access  Private (Vendor only)
const getNotificationPreferences = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('notifications');

  res.status(200).json({
    success: true,
    data: user.notifications || {
      email: true,
      sms: false,
      app: true
    }
  });
});

// @desc    Update vendor notification preferences
// @route   PUT /api/vendor/settings/notifications
// @access  Private (Vendor only)
const updateNotificationPreferences = asyncHandler(async (req, res, next) => {
  const { email, sms, app } = req.body;

  // Validate that at least one notification method is enabled
  if (email === false && sms === false && app === false) {
    return next(new ErrorResponse('At least one notification method must be enabled', 400));
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      notifications: {
        email: email !== undefined ? email : true,
        sms: sms !== undefined ? sms : false,
        app: app !== undefined ? app : true
      }
    },
    { new: true, runValidators: true }
  ).select('notifications');

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: user.notifications
  });
});

module.exports = {
  getVendorSettings,
  updateVendorSettings,
  getNotificationPreferences,
  updateNotificationPreferences
};