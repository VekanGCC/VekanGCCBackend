const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Organization = require('../models/Organization');
const OTP = require('../models/OTP');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Add employee to vendor organization
// @route   POST /api/vendor/organization/add-employee
// @access  Private (vendor_owner only)
const addEmployee = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, phone, organizationRole } = req.body;

  // Check if current user is a vendor owner
  if (req.user.userType !== 'vendor' || !req.user.organizationId) {
    return next(new ErrorResponse('Only vendor owners can add employees', 403));
  }

  // Get organization details
  const organization = await Organization.findById(req.user.organizationId);
  if (!organization) {
    return next(new ErrorResponse('Organization not found', 404));
  }

  // Validate email domain
  const vendorDomain = organization.domain;
  const employeeDomain = email.split('@')[1];
  
  if (vendorDomain !== employeeDomain) {
    return next(new ErrorResponse(`Employee email must have the domain: ${vendorDomain}`, 400));
  }

  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorResponse('User with this email already exists', 400));
  }

  // Validate organization role
  const validRoles = ['vendor_employee', 'vendor_account'];
  if (organizationRole && !validRoles.includes(organizationRole)) {
    return next(new ErrorResponse('Invalid organization role', 400));
  }

  // Set default role if not provided
  const userRole = organizationRole || 'vendor_employee';

  // Create new employee user
  const employee = await User.create({
    email,
    password,
    firstName,
    lastName,
    phone,
    userType: 'vendor',
    organizationId: req.user.organizationId,
    organizationRole: userRole,
    companyName: organization.name, // Use organization name
    contactPerson: `${firstName} ${lastName}`,
    gstNumber: 'N/A', // Employee doesn't need GST
    serviceType: 'Employee',
    isEmailVerified: false,
    isActive: true // Employee is active but needs email verification
  });

  // Generate OTP for email verification
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save OTP
  await OTP.create({
    userId: employee._id,
    email: employee.email,
    otp,
    type: 'email_verification',
    expiresAt: otpExpiry
  });

  // TODO: Send email with OTP (when email service is set up)
  console.log(`OTP for ${email}: ${otp}`);

  res.status(201).json({
    success: true,
    message: 'Employee added successfully. OTP sent to email for verification.',
    data: {
      employee: {
        id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        organizationRole: employee.organizationRole,
        isActive: employee.isActive,
        isEmailVerified: employee.isEmailVerified
      },
      otp: otp // Remove this in production
    }
  });
});

// @desc    Get organization employees
// @route   GET /api/vendor/organization/employees
// @access  Private (vendor users)
const getEmployees = asyncHandler(async (req, res, next) => {
  // Check if user belongs to an organization
  if (!req.user.organizationId) {
    return next(new ErrorResponse('User does not belong to any organization', 404));
  }

  const employees = await User.find({
    organizationId: req.user.organizationId,
    userType: 'vendor'
  }).select('firstName lastName email phone organizationRole isActive isEmailVerified approvalStatus createdAt');

  res.status(200).json({
    success: true,
    count: employees.length,
    data: employees
  });
});

// @desc    Verify employee OTP
// @route   POST /api/vendor/organization/verify-otp
// @access  Public
const verifyEmployeeOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Find valid OTP
  const otpRecord = await OTP.findOne({
    userId: user._id,
    email,
    otp,
    type: 'email_verification',
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (!otpRecord) {
    return next(new ErrorResponse('Invalid or expired OTP', 400));
  }

  // Mark OTP as used
  otpRecord.isUsed = true;
  await otpRecord.save();

  // Activate user account
  user.isEmailVerified = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully. Account activated.',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified
      }
    }
  });
});

// @desc    Resend OTP to employee
// @route   POST /api/vendor/organization/resend-otp
// @access  Private (vendor_owner only)
const resendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  // Check if current user is a vendor owner
  if (req.user.userType !== 'vendor' || !req.user.organizationId) {
    return next(new ErrorResponse('Only vendor owners can resend OTP', 403));
  }

  // Find employee
  const employee = await User.findOne({
    email,
    organizationId: req.user.organizationId,
    userType: 'vendor'
  });

  if (!employee) {
    return next(new ErrorResponse('Employee not found', 404));
  }

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete old OTPs
  await OTP.deleteMany({
    userId: employee._id,
    email,
    type: 'email_verification'
  });

  // Save new OTP
  await OTP.create({
    userId: employee._id,
    email: employee.email,
    otp,
    type: 'email_verification',
    expiresAt: otpExpiry
  });

  // TODO: Send email with OTP (when email service is set up)
  console.log(`New OTP for ${email}: ${otp}`);

  res.status(200).json({
    success: true,
    message: 'OTP resent successfully',
    data: {
      otp: otp // Remove this in production
    }
  });
});

module.exports = {
  addEmployee,
  getEmployees,
  verifyEmployeeOTP,
  resendOTP
}; 