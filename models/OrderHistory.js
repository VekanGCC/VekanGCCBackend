const mongoose = require('mongoose');

const orderHistorySchema = new mongoose.Schema({
  // Order reference
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  
  // Previous status
  previousStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded', null]
  },
  
  // New status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'],
    required: true
  },
  
  // Notes about the change
  notes: String,
  
  // Who made the change
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // User type who made the change
  updatedByType: {
    type: String,
    enum: ['client', 'vendor', 'admin'],
    required: true
  },
  
  // Changes made (JSON object)
  changes: {
    type: Object
  }
}, {
  timestamps: true
});

// Indexes for better performance
orderHistorySchema.index({ order: 1, createdAt: -1 });
orderHistorySchema.index({ updatedBy: 1 });

module.exports = mongoose.model('OrderHistory', orderHistorySchema);