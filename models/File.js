const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  path: {
    type: String,
    required: [true, 'File path is required']
  },
  mimetype: {
    type: String,
    required: [true, 'MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  extension: {
    type: String,
    required: [true, 'File extension is required']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader is required']
  },
  entityType: {
    type: String,
    enum: ['user', 'resource', 'requirement', 'application', 'vendor', 'client'],
    required: [true, 'Entity type is required']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Entity ID is required']
  },
  category: {
    type: String,
    enum: ['profile', 'document', 'certificate', 'contract', 'invoice', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvalNotes: {
    type: String
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: Date,
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    type: Object
  }
}, {
  timestamps: true
});

// Indexes for better performance
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ entityType: 1, entityId: 1 });
fileSchema.index({ category: 1 });
fileSchema.index({ approvalStatus: 1 });
fileSchema.index({ createdAt: -1 });

// Virtual for file URL
fileSchema.virtual('url').get(function() {
  return `/uploads/${this.filename}`;
});

// Ensure virtual fields are serialized
fileSchema.set('toJSON', { virtuals: true });
fileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('File', fileSchema); 