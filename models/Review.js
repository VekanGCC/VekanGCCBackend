const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  
  // Review content
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5
  },
  title: {
    type: String,
    maxlength: [100, 'Review title cannot be more than 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    maxlength: [1000, 'Review comment cannot be more than 1000 characters']
  },
  
  // Detailed ratings
  detailedRatings: {
    quality: {
      type: Number,
      min: 1,
      max: 5
    },
    punctuality: {
      type: Number,
      min: 1,
      max: 5
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Media
  images: [{
    url: String,
    alt: String
  }],
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  
  // Vendor response
  vendorResponse: {
    comment: String,
    respondedAt: Date
  },
  
  // Flags and moderation
  isReported: {
    type: Boolean,
    default: false
  },
  reportReason: String,
  
  // Helpfulness
  helpfulVotes: {
    type: Number,
    default: 0
  },
  
  // Read status (for vendor notifications)
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
reviewSchema.index({ vendor: 1, status: 1 });
reviewSchema.index({ service: 1, status: 1 });
reviewSchema.index({ client: 1 });
reviewSchema.index({ order: 1 });
reviewSchema.index({ createdAt: -1 });

// Ensure one review per order
reviewSchema.index({ order: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);