const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  entityType: {
    type: String,
    required: true,
    enum: ['sow', 'po', 'invoice', 'payment', 'credit_note']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'entityType'
  },
  action: {
    type: String,
    required: true
  },
  actionType: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'status_change', 'approval', 'rejection', 'payment', 'credit_note']
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  changes: [{
    field: {
      type: String,
      required: true
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  }],
  performedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userType: {
      type: String,
      required: true,
      enum: ['client', 'vendor', 'admin']
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    organizationRole: {
      type: String,
      required: true
    },
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  performedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  comments: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  relatedEntities: [{
    entityType: {
      type: String,
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    relationship: {
      type: String,
      required: true
    }
  }],
  systemGenerated: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ 'performedBy.userId': 1 });
auditLogSchema.index({ 'performedBy.organizationId': 1 });
auditLogSchema.index({ performedAt: -1 });
auditLogSchema.index({ actionType: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1, performedAt: -1 });

// Compound index for common queries
auditLogSchema.index({ 
  entityType: 1, 
  entityId: 1, 
  actionType: 1, 
  performedAt: -1 
});

// Text index for search functionality
auditLogSchema.index({
  action: 'text',
  comments: 'text',
  'performedBy.firstName': 'text',
  'performedBy.lastName': 'text'
});

// Pre-save middleware to ensure data integrity
auditLogSchema.pre('save', function(next) {
  // Ensure performedAt is set
  if (!this.performedAt) {
    this.performedAt = new Date();
  }
  
  // Ensure version is incremented
  if (this.isModified()) {
    this.version += 1;
  }
  
  next();
});

// Static method to create audit log with user context
auditLogSchema.statics.createWithUser = function(auditData, user, req = null) {
  const auditLog = new this({
    ...auditData,
    performedBy: {
      userId: user._id,
      userType: user.organizationType || 'client',
      organizationId: user.organizationId,
      organizationRole: user.organizationRole,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    },
    ipAddress: req ? req.ip : null,
    userAgent: req ? req.get('User-Agent') : null
  });
  
  return auditLog.save();
};

// Static method to get audit trail for an entity
auditLogSchema.statics.getEntityAuditTrail = function(entityType, entityId, options = {}) {
  const query = { entityType, entityId };
  
  if (options.actionType) {
    query.actionType = options.actionType;
  }
  
  if (options.startDate || options.endDate) {
    query.performedAt = {};
    if (options.startDate) query.performedAt.$gte = new Date(options.startDate);
    if (options.endDate) query.performedAt.$lte = new Date(options.endDate);
  }
  
  return this.find(query)
    .sort({ performedAt: -1 })
    .limit(options.limit || 100)
    .populate('performedBy.userId', 'firstName lastName email')
    .populate('performedBy.organizationId', 'name');
};

// Static method to get audit summary for an entity
auditLogSchema.statics.getAuditSummary = function(entityType, entityId) {
  return this.aggregate([
    { $match: { entityType, entityId } },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        lastAction: { $first: '$$ROOT' },
        keyActions: {
          $push: {
            $cond: {
              if: { $in: ['$actionType', ['create', 'approval', 'rejection', 'payment']] },
              then: '$$ROOT',
              else: '$$REMOVE'
            }
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalActions: 1,
        lastAction: 1,
        keyActions: { $slice: ['$keyActions', 5] }
      }
    }
  ]);
};

// Instance method to get formatted changes
auditLogSchema.methods.getFormattedChanges = function() {
  if (!this.changes || this.changes.length === 0) {
    return 'No specific changes recorded';
  }
  
  return this.changes.map(change => 
    `${change.field}: ${this.formatValue(change.oldValue)} → ${this.formatValue(change.newValue)}`
  ).join(', ');
};

// Helper method to format values
auditLogSchema.methods.formatValue = function(value) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Virtual for user display name
auditLogSchema.virtual('performedBy.displayName').get(function() {
  return `${this.performedBy.firstName} ${this.performedBy.lastName}`;
});

// Ensure virtuals are included in JSON
auditLogSchema.set('toJSON', { virtuals: true });
auditLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AuditLog', auditLogSchema); 