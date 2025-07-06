const mongoose = require('mongoose');

const adminSkillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
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

// Indexes for better performance
adminSkillSchema.index({ name: 1 });
adminSkillSchema.index({ isActive: 1 });

module.exports = mongoose.model('AdminSkill', adminSkillSchema);