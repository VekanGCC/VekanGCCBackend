const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organization owner is required']
  },
  organizationType: {
    type: String,
    enum: ['vendor', 'client'],
    required: [true, 'Organization type is required']
  },
  domain: {
    type: String,
    required: [true, 'Email domain is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for performance
organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ domain: 1 });

module.exports = mongoose.model('Organization', organizationSchema); 