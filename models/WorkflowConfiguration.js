const mongoose = require('mongoose');

const workflowStepSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Step name is required'],
    trim: true
  },
  order: {
    type: Number,
    required: [true, 'Step order is required'],
    min: 1
  },
  role: {
    type: String,
    enum: ['client', 'vendor', 'admin', 'hr_admin', 'super_admin'],
    required: [true, 'Step role is required']
  },
  action: {
    type: String,
    enum: ['review', 'approve', 'reject', 'notify', 'escalate', 'interact'],
    required: [true, 'Step action is required']
  },
  required: {
    type: Boolean,
    default: true
  },
  autoAdvance: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'in_app'],
      required: true
    },
    template: String,
    recipients: [{
      type: String,
      enum: ['applicant', 'client', 'vendor', 'admin', 'hr_admin']
    }]
  }],
  conditions: {
    type: Object,
    default: {}
  }
});

const workflowConfigurationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workflow name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  applicationTypes: [{
    type: String,
    enum: ['client_applied', 'vendor_applied', 'both'],
    required: true
  }],
  steps: [workflowStepSchema],
  settings: {
    allowParallelProcessing: {
      type: Boolean,
      default: false
    },
    maxProcessingTime: {
      type: Number, // in hours
      default: 72
    },
    autoEscalateAfter: {
      type: Number, // in hours
      default: 24
    },
    requireComments: {
      type: Boolean,
      default: true
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Ensure steps are ordered correctly
workflowConfigurationSchema.pre('save', function(next) {
  if (this.steps && this.steps.length > 0) {
    this.steps.sort((a, b) => a.order - b.order);
  }
  next();
});

// Indexes for better performance
workflowConfigurationSchema.index({ isActive: 1, applicationTypes: 1 });
workflowConfigurationSchema.index({ isDefault: 1 });
workflowConfigurationSchema.index({ createdBy: 1 });

module.exports = mongoose.model('WorkflowConfiguration', workflowConfigurationSchema); 