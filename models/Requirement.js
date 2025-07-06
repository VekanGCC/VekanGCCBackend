const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Requirement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Requirement description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Requirement category is required']
  },
  
  skills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminSkill',
    required: [true, 'Requirement skills are required']
  }],
  
  experience: {
    minYears: {
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
  
  duration: {
    type: Number, // in weeks
    required: true,
    min: 1
  },
  
  budget: {
    charge: {
      type: Number,
      required: [true, 'Budget charge is required'],
      min: 0
    },
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
  
  location: {
    remote: {
      type: Boolean,
      default: true
    },
    onsite: {
      type: Boolean,
      default: false
    },
    city: String,
    state: String,
    country: String
  },
  
  startDate: {
    type: Date,
    required: true
  },
  
  endDate: {
    type: Date
  },
  
  status: {
    type: String,
    enum: ['draft', 'open', 'in_progress', 'on_hold', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
requirementSchema.index({ status: 1 });
requirementSchema.index({ category: 1, status: 1 });
requirementSchema.index({ 'skills': 1 });
requirementSchema.index({ createdBy: 1 });
requirementSchema.index({ organizationId: 1 });
requirementSchema.index({ assignedTo: 1 });
requirementSchema.index({ createdAt: -1 });

// Compound indexes for common query patterns
requirementSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
requirementSchema.index({ organizationId: 1, category: 1, status: 1 });
requirementSchema.index({ 'budget.charge': 1, status: 1 });
requirementSchema.index({ duration: 1, status: 1 });
requirementSchema.index({ title: 'text', description: 'text' }); // Text search index
requirementSchema.index({ organizationId: 1, 'skills': 1, status: 1 });
requirementSchema.index({ startDate: 1, status: 1 });
requirementSchema.index({ priority: 1, status: 1, createdAt: -1 });

// Pre-save middleware to debug budget field
requirementSchema.pre('save', function(next) {
  console.log('🔧 Backend Model: Pre-save budget field:', this.budget);
  console.log('🔧 Backend Model: Pre-save budget charge:', this.budget?.charge);
  next();
});

module.exports = mongoose.model('Requirement', requirementSchema);