const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Order identification
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Relationships
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  
  // Order details
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Pricing
  basePrice: {
    type: Number,
    required: true
  },
  additionalCharges: [{
    name: String,
    amount: Number
  }],
  discount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Status and timeline
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Scheduling
  scheduledDate: {
    type: Date,
    required: true
  },
  estimatedDuration: {
    type: Number, // in hours
    required: true
  },
  
  // Location
  serviceLocation: {
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Communication
  clientNotes: String,
  vendorNotes: String,
  
  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash']
  },
  paymentDate: Date,
  
  // Completion details
  completedAt: Date,
  completionNotes: String,
  
  // Cancellation
  cancelledAt: Date,
  cancellationReason: String,
  cancelledBy: {
    type: String,
    enum: ['client', 'vendor', 'admin']
  },
  
  // Refund
  refundAmount: Number,
  refundReason: String,
  refundDate: Date
}, {
  timestamps: true
});

// Index for better performance
orderSchema.index({ vendor: 1, status: 1 });
orderSchema.index({ client: 1, status: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ createdAt: -1 });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);