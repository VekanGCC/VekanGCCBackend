const mongoose = require('mongoose');

const workflowStepInstanceSchema = new mongoose.Schema({
  stepId: {
    type: String,
    required: true
  },
  stepName: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'skipped', 'escalated'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  startedAt: Date,
  completedAt: Date,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  actionTaken: {
    type: String,
    enum: ['approved', 'rejected', 'reviewed', 'escalated', 'notified']
  },
  comments: {
    type: String,
    maxlength: [1000, 'Comments cannot be more than 1000 characters']
  },
  metadata: {
    type: Object,
    default: {}
  },
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'in_app']
    },
    sentAt: Date,
    recipient: String,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed']
    }
  }]
});

const workflowInstanceSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  workflowConfigurationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkflowConfiguration',
    required: true
  },
  currentStep: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'escalated'],
    default: 'active'
  },
  steps: [workflowStepInstanceSchema],
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  escalatedAt: Date,
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalationReason: String,
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for better performance
workflowInstanceSchema.index({ applicationId: 1 });
workflowInstanceSchema.index({ status: 1 });
workflowInstanceSchema.index({ currentStep: 1 });
workflowInstanceSchema.index({ 'steps.assignedTo': 1 });

module.exports = mongoose.model('WorkflowInstance', workflowInstanceSchema); 