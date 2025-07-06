const mongoose = require('mongoose');

const sowSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'SOW title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'SOW description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  
  // Optional link to requirement for future use
  requirementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
    required: false
  },
  
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client ID is required']
  },
  
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vendor ID is required']
  },
  
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  
  estimatedCost: {
    amount: {
      type: Number,
      required: [true, 'Estimated cost amount is required'],
      min: [0, 'Cost cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR']
    }
  },
  
  status: {
    type: String,
    enum: ['draft', 'submitted', 'pm_approval_pending', 'internal_approved', 'sent_to_vendor', 'vendor_accepted', 'vendor_rejected', 'cancelled'],
    default: 'draft'
  },
  
  // Approval workflow tracking
  approvals: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['approved', 'rejected'],
      required: true
    },
    comments: {
      type: String,
      maxlength: [500, 'Comments cannot be more than 500 characters']
    },
    role: {
      type: String,
      enum: ['client_admin', 'client_account', 'vendor_admin', 'vendor_account'],
      required: true
    }
  }],
  
  // Vendor response details
  vendorResponse: {
    status: {
      type: String,
      enum: ['accepted', 'rejected', 'pending'],
      default: 'pending'
    },
    responseDate: Date,
    comments: {
      type: String,
      maxlength: [1000, 'Vendor comments cannot be more than 1000 characters']
    },
    proposedChanges: {
      type: String,
      maxlength: [1000, 'Proposed changes cannot be more than 1000 characters']
    }
  },
  
  // Organization tracking
  clientOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  vendorOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Audit fields
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

// Indexes for better performance
sowSchema.index({ clientId: 1, status: 1 });
sowSchema.index({ vendorId: 1, status: 1 });
sowSchema.index({ clientOrganizationId: 1 });
sowSchema.index({ vendorOrganizationId: 1 });
sowSchema.index({ createdAt: -1 });

// Virtual for formatted status
sowSchema.virtual('statusDisplay').get(function() {
  if (!this.status) {
    return 'Unknown Status';
  }
  return this.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

// Ensure virtuals are serialized
sowSchema.set('toJSON', { virtuals: true });
sowSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SOW', sowSchema); 