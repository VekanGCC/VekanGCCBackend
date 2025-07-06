const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  requirement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
    required: true
  },
  
  resource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
    required: true
  },
  
  status: {
    type: String,
    enum: ['applied', 'pending', 'shortlisted', 'interview', 'accepted', 'rejected', 'offer_created', 'offer_accepted', 'onboarded', 'did_not_join', 'withdrawn'],
    default: 'applied'
  },
  
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  },
  
  proposedRate: {
    amount: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    type: {
      type: String,
      enum: ['hourly', 'fixed'],
      default: 'hourly'
    }
  },
  
  availability: {
    startDate: Date,
    hoursPerWeek: Number
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
  },
  
  // Organization field for applications (both vendor and client)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true // Required for both vendor and client applications
  },
  
  // Workflow fields
  workflowInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkflowInstance'
  },
  workflowStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'cancelled'],
    default: 'not_started'
  },
  currentWorkflowStep: {
    type: Number,
    default: 1
  },
  workflowMetadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Ensure one application per resource per requirement
applicationSchema.index({ requirement: 1, resource: 1 }, { unique: true });

// Other indexes for better performance
applicationSchema.index({ status: 1 });
applicationSchema.index({ createdBy: 1 });
applicationSchema.index({ updatedBy: 1 });
applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ organizationId: 1 });

// Compound indexes for common query patterns
applicationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ organizationId: 1, requirement: 1, status: 1 });
applicationSchema.index({ organizationId: 1, resource: 1, status: 1 });
applicationSchema.index({ requirement: 1, status: 1, createdAt: -1 });
applicationSchema.index({ resource: 1, status: 1, createdAt: -1 });
applicationSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
applicationSchema.index({ organizationId: 1, 'availability.startDate': 1 });
applicationSchema.index({ status: 1, 'proposedRate.amount': 1 });

module.exports = mongoose.model('Application', applicationSchema);