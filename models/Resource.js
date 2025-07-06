const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Resource name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Resource description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Resource category is required']
  },
  
  skills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminSkill',
    required: [true, 'Resource skills are required']
  }],
  
  experience: {
    years: {
      type: Number,
      required: true,
      min: 0
    },
    level: {
      type: String,
      enum: ['junior', 'mid', 'senior', 'expert'],
      required: true
    }
  },
  
  availability: {
    status: {
      type: String,
      enum: ['available', 'partially_available', 'unavailable'],
      default: 'available'
    },
    hours_per_week: {
      type: Number,
      min: 0,
      max: 168
    },
    start_date: Date
  },
  
  rate: {
    hourly: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  location: {
    city: String,
    state: String,
    country: String,
    remote: {
      type: Boolean,
      default: true
    }
  },
  
  contact: {
    email: String,
    phone: String
  },
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Organization field for vendor resources
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false // Only required for vendor resources
  },
  
  // File attachment information
  attachment: {
    originalName: String,
    fileSize: Number,
    fileType: String,
    fileId: String,      // File ID for download
    filename: String, // Stored filename in uploads folder
    path: String     // File path in uploads folder
  }
}, {
  timestamps: true
});

// Indexes for better performance
resourceSchema.index({ category: 1, status: 1 });
resourceSchema.index({ skill: 1, status: 1 });
resourceSchema.index({ createdBy: 1 });
resourceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Resource', resourceSchema);