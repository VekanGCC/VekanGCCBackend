const User = require('../models/User');
const UserAddress = require('../models/UserAddress');
const UserBankDetails = require('../models/UserBankDetails');
const UserStatutoryCompliance = require('../models/UserStatutoryCompliance');
const Organization = require('../models/Organization');
const OTP = require('../models/OTP');
const Resource = require('../models/Resource');
const Application = require('../models/Application');
const Requirement = require('../models/Requirement');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../utils/sendEmail');
const crypto = require('crypto');
const {
  validateVendorStep2,
  validateVendorStep3,
  validateVendorStep4
} = require('../validation/vendorValidation');

// @desc    Get vendor registration status
// @route   GET /api/vendor/registration-status
// @access  Private (Vendor only)
const getRegistrationStatus = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      registrationStep: user.registrationStep,
      isRegistrationComplete: user.isRegistrationComplete,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      completedSteps: {
        step1: true,
        step2: !!user.firstName && !!user.lastName && !!user.phone,
        step3: !!user.address?.street && !!user.address?.city,
        step4: !!user.preferences?.categories?.length,
        step5: !!user.documents?.identificationDocument
      }
    }
  });
});

// @desc    Save registration step (Unified, like client)
// @route   POST /api/vendor/create
// @access  Public
const saveStep = asyncHandler(async (req, res, next) => {
  const { step, data } = req.body;
  let user;

  if (step === 1) {
    // Step 1: Create new vendor with basic info
    const { email, password, companyName, contactPerson, gstNumber, serviceType, numberOfResources, firstName, lastName, phone } = data;
    
    console.log('🔧 VendorController: Step 1 - Creating vendor with data:', {
      email,
      companyName,
      contactPerson,
      gstNumber,
      serviceType,
      numberOfResources,
      firstName,
      lastName,
      phone
    });
    
    // Check if user already exists
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      console.log('🔧 VendorController: User already exists with email:', email);
      return next(new ErrorResponse('Email already registered', 400));
    }

    // Extract domain from email for organization
    const emailDomain = email.split('@')[1];
    console.log('🔧 VendorController: Email domain extracted:', emailDomain);
    
    try {
      // Create new user first (without organization)
      console.log('🔧 VendorController: Creating user first...');
      const userData = {
        email: email.toLowerCase(),
        password,
        companyName,
        contactPerson,
        gstNumber,
        serviceType,
        numberOfResources,
        firstName,
        lastName,
        phone,
        userType: 'vendor',
        registrationStep: 1
      };
      console.log('🔧 VendorController: User data to create:', { ...userData, password: '***' });
      
      user = await User.create(userData);
      console.log('🔧 VendorController: User created successfully:', user._id);

      // Create organization with the user as owner
      console.log('🔧 VendorController: Creating organization with owner...');
      const organization = await Organization.create({
        name: companyName || `${firstName} ${lastName} Organization`,
        ownerId: user._id, // Set owner immediately
        organizationType: 'vendor',
        domain: emailDomain,
        status: 'active'
      });
      console.log('🔧 VendorController: Organization created successfully:', organization._id);

      // Update user with organization details
      console.log('🔧 VendorController: Updating user with organization details...');
      user.organizationId = organization._id;
      user.organizationRole = 'vendor_owner';
      await user.save();
      console.log('🔧 VendorController: User updated with organization details');

      // Generate and store OTP in user table (for organization owners)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = otp;
      user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save();
      
      // Send OTP via email (currently just logging)
      console.log(`🔧 VendorController: OTP for ${email}: ${otp}`);
      console.log(`🔧 VendorController: Organization created: ${organization._id} for vendor: ${user._id}`);
      
      res.status(201).json({
        success: true,
        message: 'Vendor created successfully. OTP sent to email.',
        data: {
          email: user.email,
          registrationStep: user.registrationStep,
          organizationId: organization._id
        }
      });
    } catch (error) {
      console.error('🔧 VendorController: Error during vendor creation:', error);
      return next(new ErrorResponse(`Vendor creation failed: ${error.message}`, 500));
    }
  } else if (step === 2) {
    // Step 2: Verify OTP
    const { email, otp } = data;
    user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiry');
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }
    if (!user.otp || user.otp !== otp) {
      return next(new ErrorResponse('No OTP found. Please request a new OTP.', 400));
    }
    if (user.otpExpiry < Date.now()) {
      return next(new ErrorResponse('OTP expired', 400));
    }
    user.isEmailVerified = true;
    user.registrationStep = 2;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        email: user.email,
        registrationStep: user.registrationStep
      }
    });
  } else {
    // Other steps: Update existing user
    const { email } = data;
    user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }
    switch (step) {
      case 3:
        // Address and Bank details
        console.log('Vendor Step 3 - Received data:', data);
        console.log('Vendor Step 3 - Address data:', data.address);
        console.log('Vendor Step 3 - Bank data:', data.bankDetails);
        
        const addressResult = await UserAddress.findOneAndUpdate(
          { userId: user._id },
          { ...data.address, userId: user._id },
          { upsert: true, new: true }
        );
        console.log('Vendor Step 3 - Address saved:', addressResult);
        
        const bankResult = await UserBankDetails.findOneAndUpdate(
          { userId: user._id },
          { ...data.bankDetails, userId: user._id },
          { upsert: true, new: true }
        );
        console.log('Vendor Step 3 - Bank details saved:', bankResult);
        break;
      case 4:
        // Statutory and compliance details
        await UserStatutoryCompliance.findOneAndUpdate(
          { userId: user._id },
          { ...data, userId: user._id },
          { upsert: true, new: true }
        );
        break;
      case 5:
        // Documents and final completion
        user.documents = data.documents;
        user.isRegistrationComplete = true;
        await UserStatutoryCompliance.findOneAndUpdate(
          { userId: user._id },
          { ...data, userId: user._id },
          { upsert: true, new: true }
        );
        break;
    }
    user.registrationStep = Math.max(user.registrationStep, step);
    await user.save();
    res.status(200).json({
      success: true,
      message: `Step ${step} completed successfully`,
      data: {
        email: user.email,
        registrationStep: user.registrationStep,
        isRegistrationComplete: user.isRegistrationComplete
      }
    });
  }
});

// @desc    Upload vendor documents
// @route   POST /api/vendor/upload-documents
// @access  Private (Vendor only)
const uploadDocuments = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorResponse('No files uploaded', 400));
  }

  const documents = {};

  // Process uploaded files
  if (req.files.profileImage) {
    documents.profileImage = req.files.profileImage[0].path;
  }
  if (req.files.identificationDocument) {
    documents.identificationDocument = req.files.identificationDocument[0].path;
  }
  if (req.files.businessCertificate) {
    documents.businessCertificate = req.files.businessCertificate[0].path;
  }
  if (req.files.insuranceCertificate) {
    documents.insuranceCertificate = req.files.insuranceCertificate[0].path;
  }

  // Update user documents
  user.documents = { ...user.documents, ...documents };

  // Check if all required documents are uploaded
  if (user.documents.businessCertificate && user.documents.insuranceCertificate) {
    user.registrationStep = Math.max(user.registrationStep, 5);
    user.isRegistrationComplete = true;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Documents uploaded successfully',
    data: {
      documents: user.documents,
      registrationStep: user.registrationStep,
      isRegistrationComplete: user.isRegistrationComplete
    }
  });
});

// @desc    Get vendor profile
// @route   GET /api/vendor/profile
// @access  Private (Vendor only)
const getVendorProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update vendor profile
// @route   PUT /api/vendor/profile
// @access  Private (Vendor only)
const updateVendorProfile = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = req.body;

  // Remove sensitive fields
  delete fieldsToUpdate.password;
  delete fieldsToUpdate.email;
  delete fieldsToUpdate.userType;
  delete fieldsToUpdate.isEmailVerified;
  delete fieldsToUpdate.isPhoneVerified;

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Get vendor dashboard stats
// @route   GET /api/vendor/stats
// @access  Private (Vendor only)
const getVendorStats = asyncHandler(async (req, res, next) => {
  const vendorId = req.user.id;
  
  // Get vendor's organization ID
  const vendor = await User.findById(vendorId);
  if (!vendor || !vendor.organizationId) {
    return next(new ErrorResponse('Vendor organization not found', 400));
  }

  try {
    // Get total open requirements (not filtered by organization)
    const openRequirementsCount = await Requirement.countDocuments({ 
      status: 'open' 
    });

    // Get total active resources for vendor's organization
    const activeResourcesCount = await Resource.countDocuments({ 
      organizationId: vendor.organizationId,
      status: 'active'
    });

    // Get total open applications for vendor's organization
    const openApplicationsCount = await Application.countDocuments({ 
      organizationId: vendor.organizationId,
      status: { $in: ['applied', 'pending', 'shortlisted', 'interview'] }
    });

    res.status(200).json({
      success: true,
      data: {
        openRequirements: openRequirementsCount,
        activeResources: activeResourcesCount,
        openApplications: openApplicationsCount
      },
      message: 'Vendor stats retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    return next(new ErrorResponse('Error fetching stats', 500));
  }
});

module.exports = {
  saveStep,
  getRegistrationStatus,
  uploadDocuments,
  getVendorProfile,
  updateVendorProfile,
  getVendorStats
};