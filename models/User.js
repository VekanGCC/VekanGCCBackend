const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  // Step 1 - Basic Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  userType: {
    type: String,
    enum: ['vendor', 'client', 'admin'],
    required: [true, 'User type is required']
  },
  
  // Company Information
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  contactPerson: {
    type: String,
    required: [true, 'Contact person is required'],
    trim: true
  },
  gstNumber: {
    type: String,
    required: [true, 'GST number is required'],
    trim: true
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true
  },
  numberOfResources: {
    type: Number,
    default: 1,
    min: [1, 'Number of resources must be at least 1']
  },
  numberOfRequirements: {
    type: Number,
    default: 1,
    min: [1, 'Number of requirements must be at least 1']
  },
  
  // Payment Terms
  paymentTerms: {
    type: String,
    enum: ['net_15', 'net_30', 'net_45', 'net_60', 'net_90'],
    default: 'net_30'
  },
  
  // Business Information
  businessInfo: {
    companyName: String,
    businessType: String,
    registrationNumber: String,
    taxId: String
  },
  
  // Organization fields (for all users)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  organizationRole: {
    type: String,
    enum: ['admin_owner', 'admin_employee', 'admin_account', 'vendor_owner', 'vendor_employee', 'vendor_account', 'client_owner', 'client_employee', 'client_account'],
    required: false
  },
  
  // Legacy role field removed - use organizationRole instead
  
  // Admin permissions
  permissions: {
    manageUsers: { type: Boolean, default: false },
    manageServices: { type: Boolean, default: false },
    manageTransactions: { type: Boolean, default: false },
    manageContent: { type: Boolean, default: false },
    viewAnalytics: { type: Boolean, default: false },
    approveEntities: { type: Boolean, default: false }
  },
  
  // Step 2 - Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  dateOfBirth: {
    type: Date,
    required: false
  },
  
  // Client preferences
  preferences: {
    categories: [{
      type: String
    }],
    budget: {
      min: Number,
      max: Number
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Registration Progress
  registrationStep: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  
  isRegistrationComplete: {
    type: Boolean,
    default: false
  },
  
  // Account Status
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Approval status
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    maxlength: 1000
  },
  
  // Verification Codes
  verificationCodes: {
    email: {
      code: String,
      expiresAt: Date
    },
    phone: {
      code: String,
      expiresAt: Date
    }
  },
  
  // Password Reset Fields
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // New fields from the code block
  currentStep: {
    type: Number,
    default: 0
  },
  otp: {
    type: String,
    select: false
  },
  otpExpiry: {
    type: Date,
    select: false
  }
}, {
  timestamps: true
});

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ organizationRole: 1 });

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  console.log('matchPassword called with:', {
    enteredPassword,
    storedHash: this.password
  });
  
  try {
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log('bcrypt.compare result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Error in matchPassword:', error);
    throw error;
  }
};

// Generate and return JWT token
userSchema.methods.getSignedJwtToken = function() {
  console.log('Generating JWT token for user:', {
    id: this._id,
    email: this.email,
    userType: this.userType,
    organizationRole: this.organizationRole
  });
  
  try {
    const token = jwt.sign(
      { 
        id: this._id,
        email: this.email,
        userType: this.userType,
        organizationRole: this.organizationRole 
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      {
        expiresIn: '30d'  // 30 days
      }
    );
    console.log('JWT token generated successfully');
    return token;
  } catch (error) {
    console.error('Error generating JWT token:', error);
    throw error;
  }
};

// Generate refresh token
userSchema.methods.getRefreshToken = function() {
  console.log('Generating refresh token for user:', {
    id: this._id,
    tokenType: 'refresh'
  });
  
  try {
    const token = jwt.sign(
      { 
        id: this._id,
        tokenType: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_here',
      {
        expiresIn: '7d'  // 7 days
      }
    );
    console.log('Refresh token generated successfully');
    return token;
  } catch (error) {
    console.error('Error generating refresh token:', error);
    throw error;
  }
};

// Generate email verification token
userSchema.methods.getEmailVerificationToken = function() {
  const verificationToken = Math.random().toString(36).substring(2, 15) + 
                           Math.random().toString(36).substring(2, 15);
  
  this.verificationCodes.email.code = verificationToken;
  this.verificationCodes.email.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Generate phone verification code
userSchema.methods.getPhoneVerificationCode = function() {
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.verificationCodes.phone.code = verificationCode;
  this.verificationCodes.phone.expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return verificationCode;
};

// Generate password reset token
userSchema.methods.getPasswordResetToken = function() {
  const resetToken = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
  
  this.passwordResetToken = resetToken;
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);