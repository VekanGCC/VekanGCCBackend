const mongoose = require('mongoose');

const vendorSkillSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Organization field for vendor skills
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false // Only required for vendor skills
  },
  
  skill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminSkill',
    required: [true, 'Skill reference is required']
  },
  category: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Skill description is required'],
    trim: true
  },
  yearsOfExperience: {
    type: Number,
    required: [true, 'Years of experience is required'],
    min: [0, 'Years of experience cannot be negative']
  },
  proficiency: {
    type: String,
    required: [true, 'Proficiency level is required'],
    enum: ['beginner', 'intermediate', 'advanced', 'expert']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewNotes: {
    type: String,
    trim: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for faster queries
vendorSkillSchema.index({ vendor: 1, skill: 1 });
vendorSkillSchema.index({ status: 1 });
vendorSkillSchema.index({ category: 1 });
vendorSkillSchema.index({ organizationId: 1 });

module.exports = mongoose.model('VendorSkill', vendorSkillSchema); 