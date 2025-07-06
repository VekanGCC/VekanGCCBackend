const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // User who receives the notification
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Type of notification
  type: {
    type: String,
    enum: [
      'new_order',
      'order_status_change',
      'order_cancelled',
      'payment_received',
      'new_review',
      'review_response',
      'service_approved',
      'service_rejected',
      'account_update',
      'system_notification',
      'new_application',
      'application_status_change'
    ],
    required: true
  },
  
  // Title of notification
  title: {
    type: String,
    required: true
  },
  
  // Message content
  message: {
    type: String,
    required: true
  },
  
  // Related entities
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  relatedService: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  relatedReview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedRequirement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement'
  },
  
  // Status
  isRead: {
    type: Boolean,
    default: false
  },
  
  // Action URL (frontend route to navigate to)
  actionUrl: {
    type: String
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);