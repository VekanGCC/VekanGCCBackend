const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');

// @desc    Get client settings
// @route   GET /api/client/settings
// @access  Private (Client only)
const getClientSettings = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password');

  // Extract only the settings-related fields
  const settings = {
    notifications: user.notifications || {
      email: true,
      sms: false,
      app: true
    },
    preferences: user.preferences || {
      categories: [],
      budget: {
        min: 0,
        max: 0
      },
      notifications: {
        email: true,
        sms: false
      }
    },
    savedServices: user.savedServices || []
  };

  res.status(200).json({
    success: true,
    data: settings
  });
});

// @desc    Update client settings
// @route   PUT /api/client/settings
// @access  Private (Client only)
const updateClientSettings = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return next(new ErrorResponse('Validation failed', 400, errors.array()));
  }

  const {
    notifications,
    preferences
  } = req.body;

  // Build settings object with only provided fields
  const settingsToUpdate = {};
  
  if (notifications) settingsToUpdate.notifications = notifications;
  if (preferences) settingsToUpdate.preferences = preferences;

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
      preferences: user.preferences
    }
  });
});

// @desc    Get client notification preferences
// @route   GET /api/client/settings/notifications
// @access  Private (Client only)
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

// @desc    Update client notification preferences
// @route   PUT /api/client/settings/notifications
// @access  Private (Client only)
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

// @desc    Update client preferences
// @route   PUT /api/client/settings/preferences
// @access  Private (Client only)
const updateClientPreferences = asyncHandler(async (req, res, next) => {
  const { categories, budget } = req.body;

  const preferencesToUpdate = {};
  
  if (categories) preferencesToUpdate['preferences.categories'] = categories;
  if (budget) preferencesToUpdate['preferences.budget'] = budget;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    preferencesToUpdate,
    { new: true, runValidators: true }
  ).select('preferences');

  res.status(200).json({
    success: true,
    message: 'Preferences updated successfully',
    data: user.preferences
  });
});

module.exports = {
  getClientSettings,
  updateClientSettings,
  getNotificationPreferences,
  updateNotificationPreferences,
  updateClientPreferences
};