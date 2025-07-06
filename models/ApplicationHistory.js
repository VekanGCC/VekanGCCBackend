const mongoose = require('mongoose');

const applicationHistorySchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  
  previousStatus: {
    type: String,
    enum: ['applied', 'pending', 'shortlisted', 'interview', 'accepted', 'rejected', 'offer_created', 'offer_accepted', 'onboarded', 'did_not_join', 'withdrawn', 'deleted', null]
  },
  
  status: {
    type: String,
    enum: ['applied', 'pending', 'shortlisted', 'interview', 'accepted', 'rejected', 'offer_created', 'offer_accepted', 'onboarded', 'did_not_join', 'withdrawn', 'deleted'],
    required: true
  },
  
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  },
  
  // Enhanced decision tracking fields
  decisionReason: {
    category: {
      type: String,
      enum: [
        // Original categories (for client evaluation of vendor)
        'technical_skills', 'experience', 'rate', 'availability', 'cultural_fit', 'timeline', 'better_opportunity', 'resource_unavailable',
        // New categories (for vendor evaluation of client offer)
        'rate_acceptable', 'availability_matches', 'location_acceptable', 'joining_date_ok', 'project_scope_good', 'client_reputation',
        'rate_too_low', 'availability_conflict', 'location_issue', 'joining_date_conflict', 'project_scope_issue', 'client_reputation_concern',
        'other'
      ],
      required: false
    },
    details: {
      type: String,
      maxlength: [500, 'Decision details cannot be more than 500 characters']
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: false
    },
    criteria: [{
      type: String,
      enum: [
        // Original criteria (for client evaluation of vendor)
        'technical_skills', 'experience_level', 'rate_alignment', 'availability', 'cultural_fit', 'communication', 'portfolio', 'references', 'certifications',
        // New criteria (for vendor evaluation of client offer)
        'rate_evaluation', 'availability_check', 'location_assessment', 'joining_date_review', 'project_scope_analysis', 'client_reputation_check', 'contract_terms_review', 'resource_availability', 'financial_viability',
        'other'
      ]
    }],
    notes: {
      type: String,
      maxlength: [1000, 'Decision notes cannot be more than 1000 characters']
    }
  },
  
  // Notification preferences
  notifyCandidate: {
    type: Boolean,
    default: false
  },
  
  notifyClient: {
    type: Boolean,
    default: false
  },
  
  // Follow-up actions
  followUpRequired: {
    type: Boolean,
    default: false
  },
  
  followUpDate: {
    type: Date,
    required: false
  },
  
  followUpNotes: {
    type: String,
    maxlength: [500, 'Follow-up notes cannot be more than 500 characters']
  },
  
  // Track who created this history entry
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Track who last updated this history entry
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Organization field for application history (both vendor and client)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true // Required for both vendor and client application history
  }
}, {
  timestamps: true
});

// Indexes for better performance
applicationHistorySchema.index({ application: 1, createdAt: -1 });
applicationHistorySchema.index({ createdBy: 1 });
applicationHistorySchema.index({ updatedBy: 1 });
applicationHistorySchema.index({ organizationId: 1 });
applicationHistorySchema.index({ 'decisionReason.category': 1 });

module.exports = mongoose.model('ApplicationHistory', applicationHistorySchema);