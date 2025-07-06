const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getUserNotifications = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, unreadOnly = false } = req.query;
  
  // Get user ID from JWT token
  let query = { recipient: req.user.id };
  
  if (unreadOnly === 'true') {
    query.isRead = false;
  }
  
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({ 
    recipient: req.user.id,
    isRead: false
  });
  
  res.status(200).json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationAsRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user.id // Ensure user can only mark their own notifications
  });
  
  if (!notification) {
    return next(new ErrorResponse('Notification not found', 404));
  }
  
  notification.isRead = true;
  await notification.save();
  
  res.status(200).json({
    success: true,
    data: notification
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllNotificationsAsRead = asyncHandler(async (req, res, next) => {
  await Notification.updateMany(
    { recipient: req.user.id, isRead: false },
    { isRead: true }
  );
  
  res.status(200).json({
    success: true,
    message: 'All notifications marked as read'
  });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user.id // Ensure user can only delete their own notifications
  });
  
  if (!notification) {
    return next(new ErrorResponse('Notification not found', 404));
  }
  
  await notification.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

// @desc    Get notification count
// @route   GET /api/notifications/count
// @access  Private
const getNotificationCount = asyncHandler(async (req, res, next) => {
  const unreadCount = await Notification.countDocuments({ 
    recipient: req.user.id,
    isRead: false
  });
  
  res.status(200).json({
    success: true,
    data: {
      unreadCount
    }
  });
});

// Helper function to create a notification (for internal use)
const createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationCount,
  createNotification
};