const User = require('../models/User');
const Organization = require('../models/Organization');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');
const { validationResult } = require('express-validator');
const {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../validation/authValidation');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res, next) => {
  // Validate input
  await Promise.all(validateRegistration.map(validation => validation.run(req)));
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return next(new ErrorResponse('Validation failed', 400, errors.array()));
  }

  const { email, password, userType, firstName, lastName, phone, companyName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorResponse('User already exists with this email', 400));
  }

  // Create organization for vendor and client users
  let organization = null;
  let organizationRole = null;

  if (userType === 'vendor' || userType === 'client') {
    // Set organization role based on user type
    organizationRole = userType === 'vendor' ? 'vendor_owner' : 'client_owner';
  }

  // Create user with step 1 information
  const userData = {
    email,
    password,
    userType,
    firstName,
    lastName,
    phone,
    registrationStep: 1
  };

  const user = await User.create(userData);

  // Create organization after user creation (now we have the user ID)
  if (userType === 'vendor' || userType === 'client') {
    // Extract domain from email for organization
    const domain = email.split('@')[1];

    // Create organization
    organization = await Organization.create({
      name: companyName || `${firstName} ${lastName}'s Organization`,
      ownerId: user._id, // Now we can provide the user ID
      organizationType: userType,
      domain: domain
    });

    // Update user with organization details
    user.organizationId = organization._id;
    user.organizationRole = organizationRole;
    await user.save();

    console.log(`🔧 AuthController: Created ${userType} organization:`, organization._id);
  }

  // Generate email verification token
  const emailToken = user.getEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  try {
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${emailToken}`;
    
    // Commenting out email sending for now
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Account Verification',
    //   message: `Please verify your account by clicking: ${verificationUrl}`
    // });

    sendTokenResponse(user, 201, res, 'User registered successfully. Please check your email for verification.');
  } catch (error) {
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res, next) => {
  try {
    console.log('\n=== Login Process Started ===');
    console.log('Request body:', { ...req.body, password: '***' });
    
    // Validate input
    console.log('Validating input...');
    await Promise.all(validateLogin.map(validation => validation.run(req)));
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return next(new ErrorResponse('Validation failed', 400, errors.array()));
    }

    const { email, password } = req.body;
    console.log('Looking up user:', email);

    // Check for user
    const user = await User.findOne({ email }).select('+password +organizationRole');
    console.log('User lookup result:', user ? {
      id: user._id,
      email: user.email,
      userType: user.userType,
      organizationRole: user.organizationRole,
      isActive: user.isActive,
      hasPassword: !!user.password
    } : 'No user found');

    if (!user) {
      console.log('No user found with email:', email);
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if password matches
    console.log('Checking password match...');
    const isMatch = await user.matchPassword(password);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      console.log('Password does not match');
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if user is active
    console.log('User active status:', user.isActive);
    if (!user.isActive) {
      console.log('User account is not active');
      return next(new ErrorResponse('Account is deactivated', 401));
    }

    // Update last login
    console.log('Updating last login timestamp');
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    console.log('Generating tokens and sending response');
    sendTokenResponse(user, 200, res, 'Login successful');
    console.log('=== Login Process Completed ===\n');
  } catch (error) {
    console.error('Login process error:', error);
    next(error);
  }
});

// @desc    Log user out / clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'User logged out successfully'
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token is required', 400));
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ErrorResponse('Invalid refresh token', 401));
    }

    sendTokenResponse(user, 200, res, 'Token refreshed successfully');
  } catch (error) {
    return next(new ErrorResponse('Invalid refresh token', 401));
  }
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res, next) => {
  await Promise.all(validateForgotPassword.map(validation => validation.run(req)));
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return next(new ErrorResponse('Validation failed', 400, errors.array()));
  }

  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }

  // Get reset token
  const resetToken = user.getPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  // Create reset url
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

  const message = `You are receiving this email because you have requested the reset of a password. Please click the link below to reset your password: \n\n ${resetUrl}`;

  try {
    // Mock email sending for development
    console.log('📧 Mock Email - Password Reset:');
    console.log('  To:', user.email);
    console.log('  Subject: Password reset token');
    console.log('  Message:', message);
    console.log('\n🔗 RESET LINK FOR TESTING:');
    console.log('  ' + resetUrl);
    console.log('\n📋 Copy the above link to test the password reset flow');
    
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Password reset token',
    //   message
    // });

    res.status(200).json({
      success: true,
      message: 'Password reset link generated successfully. Check the server console for the reset link (for testing purposes).'
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
const resetPassword = asyncHandler(async (req, res, next) => {
  await Promise.all(validateResetPassword.map(validation => validation.run(req)));
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return next(new ErrorResponse('Validation failed', 400, errors.array()));
  }

  const user = await User.findOne({
    passwordResetToken: req.params.resettoken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid token', 400));
  }

  // Set new password
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  sendTokenResponse(user, 200, res, 'Password reset successful');
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({
    emailVerificationToken: req.params.token,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired token', 400));
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;

  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res, 'Email verified successfully');
});

// @desc    Verify phone
// @route   POST /api/auth/verify-phone
// @access  Public
const verifyPhone = asyncHandler(async (req, res, next) => {
  const { phone, code } = req.body;

  const user = await User.findOne({
    phone,
    phoneVerificationCode: code,
    phoneVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired verification code', 400));
  }

  user.isPhoneVerified = true;
  user.phoneVerificationCode = undefined;
  user.phoneVerificationExpires = undefined;

  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res, 'Phone verified successfully');
});

// @desc    Resend verification
// @route   POST /api/auth/resend-verification
// @access  Private
const resendVerification = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (user.isEmailVerified) {
    return next(new ErrorResponse('Email is already verified', 400));
  }

  const emailToken = user.getEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  try {
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${emailToken}`;
    
    // Mock email sending for development
    console.log('📧 Mock Email - Account Verification:');
    console.log('  To:', user.email);
    console.log('  Subject: Account Verification');
    console.log('  Message: Please verify your account by clicking:', verificationUrl);
    
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Account Verification',
    //   message: `Please verify your account by clicking: ${verificationUrl}`
    // });

    res.status(200).json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      registrationStep: user.registrationStep,
      isRegistrationComplete: user.isRegistrationComplete,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      organizationId: user.organizationId,
      organizationRole: user.organizationRole
    }
  });
});

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res, message) => {
  try {
    console.log('\n=== Token Response Generation Started ===');
    console.log('User data for token:', {
      id: user._id,
      email: user.email,
      userType: user.userType,
      organizationRole: user.organizationRole,
      approvalStatus: user.approvalStatus
    });

    // Create tokens
    console.log('Generating access token...');
    const accessToken = user.getSignedJwtToken();
    console.log('Generating refresh token...');
    const refreshToken = user.getRefreshToken();

    console.log('Tokens generated:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });

    console.log('Preparing response with tokens');
    const response = {
      success: true,
      message,
      token: accessToken,
      refreshToken,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        organizationRole: user.organizationRole,
        approvalStatus: user.approvalStatus,
        rejectionReason: user.rejectionReason,
        organizationId: user.organizationId,
        organizationRole: user.organizationRole,
        registrationStep: user.registrationStep,
        isRegistrationComplete: user.isRegistrationComplete
      }
    };
    console.log('Response data:', { ...response, token: '***', refreshToken: '***' });

    res.status(statusCode).json(response);
    
    console.log('=== Token Response Generation Completed ===\n');
  } catch (error) {
    console.error('Token response generation error:', error);
    throw error;
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyPhone,
  resendVerification,
  getCurrentUser
};