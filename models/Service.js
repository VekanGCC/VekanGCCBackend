const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  // Basic information
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  
  // Vendor relationship
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Category and tags
  category: {
    type: String,
    required: [true, 'Service category is required'],
    enum: [
      'home_cleaning',
      'plumbing',
      'electrical',
      'gardening',
      'painting',
      'carpentry',
      'appliance_repair',
      'pest_control',
      'moving',
      'tutoring',
      'pet_care',
      'beauty',
      'fitness',
      'photography',
      'catering',
      'other'
    ]
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Pricing
  pricing: {
    type: {
      type: String,
      enum: ['fixed', 'hourly', 'custom'],
      required: true
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  // Service details
  duration: {
    estimated: {
      type: Number, // in hours
      required: true
    },
    minimum: Number,
    maximum: Number
  },
  
  // Availability
  availability: {
    days: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    timeSlots: [{
      start: String, // "09:00"
      end: String    // "17:00"
    }]
  },
  
  // Service area
  serviceArea: {
    type: {
      type: String,
      enum: ['city', 'radius', 'specific_areas'],
      default: 'city'
    },
    cities: [String],
    radius: Number, // in kilometers
    specificAreas: [String]
  },
  
  // Media
  images: [{
    url: String,
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Requirements and policies
  requirements: [String],
  cancellationPolicy: {
    type: String,
    maxlength: 500
  },
  
  // Status and visibility
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  
  // Statistics
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    completedOrders: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    },
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  
  // SEO
  slug: {
    type: String,
    unique: true
  },
  metaDescription: String,
  
  // Timestamps
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
serviceSchema.index({ vendor: 1, status: 1 });
serviceSchema.index({ category: 1, status: 1 });
serviceSchema.index({ 'serviceArea.cities': 1 });
serviceSchema.index({ slug: 1 });
serviceSchema.index({ createdAt: -1 });

// Generate slug before saving
serviceSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + this._id.toString().slice(-6);
  }
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Service', serviceSchema);