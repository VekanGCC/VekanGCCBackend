const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true
  },
  
  poId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PO',
    required: [true, 'PO ID is required']
  },
  
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vendor ID is required']
  },
  
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client ID is required']
  },
  
  invoiceDate: {
    type: Date,
    required: [true, 'Invoice date is required'],
    default: Date.now
  },
  
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  
  invoiceAmount: {
    amount: {
      type: Number,
      required: [true, 'Invoice amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR']
    }
  },
  
  // Work summary and details
  workSummary: {
    type: String,
    required: [true, 'Work summary is required'],
    maxlength: [2000, 'Work summary cannot be more than 2000 characters']
  },
  
  // File upload information
  invoiceFile: {
    originalName: String,
    fileSize: Number,
    fileType: String,
    fileId: String,
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  
  // Payment details
  paymentDetails: {
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    paidDate: Date,
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'check', 'credit_card', 'other'],
      default: 'bank_transfer'
    },
    transactionId: String,
    notes: {
      type: String,
      maxlength: [500, 'Payment notes cannot be more than 500 characters']
    }
  },
  
  // Credit note information
  creditNote: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    reason: {
      type: String,
      maxlength: [500, 'Credit note reason cannot be more than 500 characters']
    },
    file: {
      originalName: String,
      fileSize: Number,
      fileType: String,
      fileId: String,
      filename: String,
      path: String
    },
    createdAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Approval details
  approvalDetails: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: Date,
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot be more than 500 characters']
    }
  },
  
  // Alerts and notifications
  alerts: [{
    date: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['due_date_approaching', 'overdue', 'payment_received', 'credit_note_issued'],
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: [200, 'Alert message cannot be more than 200 characters']
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  
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
invoiceSchema.index({ vendorId: 1, paymentStatus: 1 });
invoiceSchema.index({ clientId: 1, paymentStatus: 1 });
invoiceSchema.index({ poId: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ clientOrganizationId: 1 });
invoiceSchema.index({ vendorOrganizationId: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual for formatted status
invoiceSchema.virtual('statusDisplay').get(function() {
  return this.paymentStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

// Virtual for payment method display
invoiceSchema.virtual('paymentMethodDisplay').get(function() {
  return this.paymentDetails.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (this.paymentStatus === 'overdue' && this.dueDate) {
    const today = new Date();
    const dueDate = new Date(this.dueDate);
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Invoice').countDocuments({ 
      createdAt: { 
        $gte: new Date(year, 0, 1), 
        $lt: new Date(year + 1, 0, 1) 
      } 
    });
    this.invoiceNumber = `INV-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }
  
  // Calculate due date based on PO payment terms if not provided
  if (this.isNew && !this.dueDate) {
    try {
      const PO = mongoose.model('PO');
      const po = await PO.findById(this.poId);
      if (po) {
        const dueDate = new Date(this.invoiceDate);
        switch (po.paymentTerms) {
          case 'net_15':
            dueDate.setDate(dueDate.getDate() + 15);
            break;
          case 'net_30':
            dueDate.setDate(dueDate.getDate() + 30);
            break;
          case 'net_45':
            dueDate.setDate(dueDate.getDate() + 45);
            break;
          case 'net_60':
            dueDate.setDate(dueDate.getDate() + 60);
            break;
          case 'immediate':
            dueDate.setDate(dueDate.getDate());
            break;
          default:
            dueDate.setDate(dueDate.getDate() + 30); // Default to net 30
        }
        this.dueDate = dueDate;
      }
    } catch (error) {
      console.error('Error calculating due date:', error);
    }
  }
  
  next();
});

// Ensure virtuals are serialized
invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Invoice', invoiceSchema); 