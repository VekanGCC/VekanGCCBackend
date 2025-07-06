const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true },
  userType: { 
    type: String, 
    required: true, 
    enum: ['vendor', 'client', 'admin'],
    default: 'vendor'
  },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  approvalStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  rejectionReason: { 
    type: String,
    required: function() {
      return this.approvalStatus === 'rejected';
    }
  },
  companyName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  gstNumber: { type: String, required: true },
  serviceType: { type: String, required: true },
  numberOfResources: { type: Number },
  numberOfRequirements: { type: Number },
  paymentTerms: { type: String },
  businessInfo: { type: Schema.Types.Mixed },
  currentStep: { type: Number, default: 1 },
  registrationComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

module.exports = { User, UserSchema }; 