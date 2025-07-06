const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true,
    unique: true
  },
  category: {
    type: String,
    required: [true, 'Skill category is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Skill description is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Add index for faster queries
skillSchema.index({ name: 1, category: 1 });

module.exports = mongoose.model('Skill', skillSchema); 