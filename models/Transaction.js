const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['payment', 'refund', 'payout', 'fee', 'other']
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled']
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  relatedService: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'other']
  },
  paymentDetails: {
    type: Object
  },
  description: String,
  notes: String,
  processedAt: Date,
  platformFee: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ client: 1 });
transactionSchema.index({ vendor: 1 });
transactionSchema.index({ relatedOrder: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);