const mongoose = require('mongoose');

const pendingApprovalSchema = new mongoose.Schema({
  entityType: {
    type: String,
    required: true,
    enum: ['vendor', 'service', 'resource', 'client']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'  // Always reference User model since vendors/clients are in User table
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String,
  documents: [{
    type: String
  }],
  metadata: {
    type: Object
  }
}, {
  timestamps: true
});

// Indexes for better performance
pendingApprovalSchema.index({ entityType: 1, status: 1 });
pendingApprovalSchema.index({ submittedBy: 1 });
pendingApprovalSchema.index({ status: 1, submittedAt: -1 });

module.exports = mongoose.model('PendingApproval', pendingApprovalSchema);