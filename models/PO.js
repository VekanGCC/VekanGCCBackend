const mongoose = require('mongoose');

const poSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    required: [true, 'PO number is required'],
    unique: true,
    trim: true
  },
  
  sowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOW',
    required: [true, 'SOW ID is required']
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
    required: [true, 'PO start date is required']
  },
  
  endDate: {
    type: Date,
    required: [true, 'PO end date is required']
  },
  
  totalAmount: {
    amount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR']
    }
  },
  
  paymentTerms: {
    type: String,
    required: [true, 'Payment terms are required'],
    enum: ['net_15', 'net_30', 'net_45', 'net_60', 'net_90'],
    default: 'net_30'
  },
  

  
  status: {
    type: String,
    enum: ['draft', 'submitted', 'finance_approved', 'sent_to_vendor', 'vendor_accepted', 'vendor_rejected', 'cancelled', 'active', 'completed'],
    default: 'draft'
  },
  
  // Finance approval details
  financeApproval: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    date: Date,
    comments: {
      type: String,
      maxlength: [500, 'Finance approval comments cannot be more than 500 characters']
    }
  },
  
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
    }
  },
  
  // Payment tracking
  paymentTracking: {
    totalInvoiced: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPaymentDate: Date
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
poSchema.index({ clientId: 1, status: 1 });
poSchema.index({ vendorId: 1, status: 1 });
poSchema.index({ sowId: 1 });
poSchema.index({ poNumber: 1 }, { unique: true });
poSchema.index({ clientOrganizationId: 1 });
poSchema.index({ vendorOrganizationId: 1 });
poSchema.index({ createdAt: -1 });

// Virtual for formatted status
poSchema.virtual('statusDisplay').get(function() {
  return this.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

// Virtual for payment terms display
poSchema.virtual('paymentTermsDisplay').get(function() {
  return this.paymentTerms.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

// Pre-save middleware to generate PO number
poSchema.pre('save', async function(next) {
  if (this.isNew && !this.poNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('PO').countDocuments({ 
      createdAt: { 
        $gte: new Date(year, 0, 1), 
        $lt: new Date(year + 1, 0, 1) 
      } 
    });
    this.poNumber = `PO-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Ensure virtuals are serialized
poSchema.set('toJSON', { virtuals: true });
poSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PO', poSchema); 