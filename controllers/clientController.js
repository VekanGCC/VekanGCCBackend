const User = require('../models/User');
const UserAddress = require('../models/UserAddress');
const UserStatutoryCompliance = require('../models/UserStatutoryCompliance');
const Requirement = require('../models/Requirement');
const OTP = require('../models/OTP');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');
const {
  validateClientStep2,
  validateClientStep3,
  validateClientStep4
} = require('../validation/clientValidation');
const ApiResponse = require('../models/ApiResponse');



// @desc    Get client registration status
// @route   GET /api/client/registration-status
// @access  Private (Client only)
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

// @desc    Update client registration step
// @route   PUT /api/client/registration/step/:step
// @access  Private (Client only)
const updateRegistrationStep = asyncHandler(async (req, res, next) => {
  const { step } = req.params;
  const stepNumber = parseInt(step);

  if (stepNumber < 2 || stepNumber > 5) {
    return next(new ErrorResponse('Invalid step number', 400));
  }

  const user = await User.findById(req.user.id);

  // Validate based on step
  let validations = [];
  switch (stepNumber) {
    case 2:
      validations = validateClientStep2;
      break;
    case 3:
      validations = validateClientStep3;
      break;
    case 4:
      validations = validateClientStep4;
      break;
  }

  if (validations.length > 0) {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return next(new ErrorResponse('Validation failed', 400, errors.array()));
    }
  }

  // Update user data based on step
  switch (stepNumber) {
    case 2:
      // Personal Information
      const { firstName, lastName, phone, dateOfBirth } = req.body;
      user.firstName = firstName;
      user.lastName = lastName;
      user.phone = phone;
      if (dateOfBirth) user.dateOfBirth = dateOfBirth;
      break;

    case 3:
      // Address Information
      const { address } = req.body;
      user.address = address;
      break;

    case 4:
      // Preferences
      const { preferences } = req.body;
      user.preferences = preferences;
      break;

    case 5:
      // Documents - handled separately in uploadDocuments
      break;
  }

  // Update registration step
  if (user.registrationStep < stepNumber) {
    user.registrationStep = stepNumber;
  }

  // Check if registration is complete
  if (stepNumber === 5 && user.documents?.identificationDocument) {
    user.isRegistrationComplete = true;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: `Step ${stepNumber} completed successfully`,
    data: {
      registrationStep: user.registrationStep,
      isRegistrationComplete: user.isRegistrationComplete
    }
  });
});

// @desc    Upload client documents
// @route   POST /api/client/upload-documents
// @access  Private (Client only)
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

  // Update user documents
  user.documents = { ...user.documents, ...documents };

  // Check if required documents are uploaded
  if (user.documents.identificationDocument) {
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

// @desc    Complete client registration
// @route   POST /api/client/registration/complete
// @access  Private (Client only)
const completeRegistration = asyncHandler(async (req, res, next) => {
  const { user, address, statutoryCompliance } = req.body;

  // Validate input
  if (!user || !address || !statutoryCompliance) {
    return next(new ErrorResponse('Missing required registration data', 400));
  }

  // Create or update user
  const userData = await User.findByIdAndUpdate(
    req.user.id,
    {
      ...user,
      isRegistrationComplete: true,
      registrationStep: 5
    },
    { new: true, runValidators: true }
  );

  // Create or update address
  const addressData = await UserAddress.findOneAndUpdate(
    { userId: req.user.id },
    { ...address, userId: req.user.id },
    { new: true, upsert: true }
  );

  // Create or update statutory compliance
  const statutoryComplianceData = await UserStatutoryCompliance.findOneAndUpdate(
    { userId: req.user.id },
    { ...statutoryCompliance, userId: req.user.id },
    { new: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    message: 'Registration completed successfully',
    data: {
      user: userData,
      address: addressData,
      statutoryCompliance: statutoryComplianceData
    }
  });
});

// @desc    Get client profile
// @route   GET /api/client/profile
// @access  Private (Client only)
const getClientProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      companyName: user.companyName,
      contactPerson: user.contactPerson,
      phone: user.phone,
      gstNumber: user.gstNumber,
      serviceType: user.serviceType,
      numberOfRequirements: user.numberOfRequirements,
      paymentTerms: user.paymentTerms,
      businessInfo: user.businessInfo,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      approvalStatus: user.approvalStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  });
});

// @desc    Update client profile
// @route   PUT /api/client/profile
// @access  Private (Client only)
const updateClientProfile = asyncHandler(async (req, res, next) => {
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

// @desc    Send OTP to client email
// @route   POST /api/client/send-otp
// @access  Public
const sendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorResponse('Please provide an email address', 400));
  }

  // Find user by email
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return next(new ErrorResponse('No user found with this email', 404));
  }

  // Generate and store OTP in user table (for organization owners)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  // Send OTP via email (currently just logging)
  console.log(`OTP for ${email}: ${otp}`);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    otp: otp // Include OTP in response for development
  });
});

// @desc    Verify OTP
// @route   POST /api/client/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new ErrorResponse('Please provide email and OTP', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Find valid OTP
  const otpRecord = await OTP.findOne({
    userId: user._id,
    email: user.email,
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

  // Mark email as verified
  user.isEmailVerified = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully'
  });
});

const saveStep = asyncHandler(async (req, res, next) => {
  const { step, data } = req.body;

  let user;
  if (step === 1) {
    // Step 1: Create new user with basic info
    const { email, password, companyName, contactPerson, gstNumber, serviceType, numberOfResources, firstName, lastName, phone } = data;
    
    // Check if user already exists
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      return next(new ErrorResponse('Email already registered', 400));
    }

    // Create new user first (without organization)
    user = await User.create({
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
      userType: 'client',
      registrationStep: 1
    });

    // Extract domain from email for organization
    const domain = email.split('@')[1];

    // Create organization for client (now we have the user ID)
    const Organization = require('../models/Organization');
    const organization = await Organization.create({
      name: companyName || `${firstName} ${lastName}'s Organization`,
      ownerId: user._id, // Now we can provide the user ID
      organizationType: 'client',
      domain: domain
    });

    // Update user with organization details
    user.organizationId = organization._id;
    user.organizationRole = 'client_owner';
    await user.save();

    // Generate and store OTP in user table (for organization owners)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP via email (currently just logging)
    console.log(`OTP for ${email}: ${otp}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully. OTP sent to email.',
      data: {
        email: user.email,
        registrationStep: user.registrationStep
      },
      otp: otp // Include OTP in response for development
    });
  } else if (step === 2) {
    // Step 2: Verify OTP
    const { email, otp } = data;
    
    // Find user by email (case-insensitive) and select otp fields
    user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiry');
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Verify OTP
    if (!user.otp || user.otp !== otp) {
      return next(new ErrorResponse('No OTP found. Please request a new OTP.', 400));
    }

    if (user.otpExpiry < Date.now()) {
      return next(new ErrorResponse('OTP expired', 400));
    }

    // Mark email as verified
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

    // Update user data based on step
    switch (step) {
      case 3:
        // Address and Payment Terms
        await UserAddress.findOneAndUpdate(
          { userId: user._id },
          { ...data.address, userId: user._id },
          { upsert: true, new: true }
        );
        
        // Save payment terms directly to User model
        if (data.paymentTerms) {
          user.paymentTerms = data.paymentTerms;
        }
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
        // Documents
        user.documents = data.documents;
        user.isRegistrationComplete = true;
        // Also update UserStatutoryCompliance with any additional fields from step 5
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

// @desc    Get client requirements
// @route   GET /api/clients/requirements
// @access  Private (Client only)
const getClientRequirements = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    search,
    status,
    priority,
    category
  } = req.query;

  // Build query
  let query = {};

  // Get requirements from the client's organization
  if (req.user.organizationId) {
    query.organizationId = req.user.organizationId;
  } else {
    // Fallback to only get requirements created by this client if no organization
    query.createdBy = req.user.id;
  }

  if (search) {
    // First, try to find skills by name that match the search term
    const AdminSkill = require('../models/AdminSkill');
    const matchingSkills = await AdminSkill.find({
      name: { $regex: search, $options: 'i' }
    }).select('_id name');
    
    const skillIds = matchingSkills.map(skill => skill._id);
    
    // Build search query to include title, description, and skills
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
    
    // If we found matching skills, also search in skills field
    if (skillIds.length > 0) {
      query.$or.push({ skills: { $in: skillIds } });
    }
  }

  if (status) {
    query.status = status;
  }

  if (priority) {
    query.priority = priority;
  }

  if (category) {
    query.category = category;
  }

  // Execute query with pagination
  const requirements = await Requirement.find(query)
    .populate('category', 'name description')
    .populate('skills', 'name description')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Requirement.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      requirements,
      'Client requirements retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    )
  );
});

exports.saveStep = saveStep;
exports.getRegistrationStatus = getRegistrationStatus;
exports.updateRegistrationStep = updateRegistrationStep;
exports.uploadDocuments = uploadDocuments;
exports.completeRegistration = completeRegistration;
exports.getClientProfile = getClientProfile;
exports.updateClientProfile = updateClientProfile;
exports.sendOTP = sendOTP;
exports.verifyOTP = verifyOTP;
exports.getClientRequirements = getClientRequirements;

// @desc    Get organization users for client
// @route   GET /api/client/organization/users
// @access  Private (Client only)
const getOrganizationUsers = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (!user.organizationId) {
    return next(new ErrorResponse('User not associated with any organization', 400));
  }

  // Only organization owners can view users
  if (user.organizationRole !== 'client_owner') {
    return next(new ErrorResponse('Access denied. Only organization owners can view users.', 403));
  }

  const users = await User.find({ 
    organizationId: user.organizationId,
    userType: 'client'
  }).select('-password -otp -otpExpiry');

  res.status(200).json(
    ApiResponse.success(
      users,
      'Organization users retrieved successfully'
    )
  );
});

// @desc    Add user to client organization
// @route   POST /api/client/organization/users
// @access  Private (Client only)
const addOrganizationUser = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, phone } = req.body;

  const currentUser = await User.findById(req.user.id);
  
  if (!currentUser.organizationId) {
    return next(new ErrorResponse('User not associated with any organization', 400));
  }

  // Only organization owners can add users
  if (currentUser.organizationRole !== 'client_owner') {
    return next(new ErrorResponse('Access denied. Only organization owners can add users.', 403));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ErrorResponse('User with this email already exists', 400));
  }

  // Validate email domain (must match organization domain)
  const emailDomain = email.split('@')[1];
  const organization = await require('../models/Organization').findById(currentUser.organizationId);
  
  if (organization.domain && emailDomain !== organization.domain) {
    return next(new ErrorResponse(`Email domain must match organization domain: ${organization.domain}`, 400));
  }

  // Create new user
  const newUser = await User.create({
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
    phone,
    userType: 'client',
    organizationId: currentUser.organizationId,
    organizationRole: 'client_employee',
    companyName: organization.name, // Use organization name
    contactPerson: `${firstName} ${lastName}`,
    gstNumber: 'N/A', // Employee doesn't need GST
    serviceType: 'Employee',
    isEmailVerified: false,
    approvalStatus: 'approved'
  });

  // Generate OTP for email verification
  const OTP = require('../models/OTP');
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  await OTP.create({
    userId: newUser._id,
    email: newUser.email,
    otp,
    type: 'email_verification',
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  // Send OTP via email (currently just logging)
  console.log(`OTP for ${email}: ${otp}`);

  res.status(201).json(
    ApiResponse.success(
      { 
        user: {
          id: newUser._id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          status: newUser.isActive ? 'active' : 'inactive'
        },
        email 
      },
      'User added successfully. OTP sent to email for verification.'
    )
  );
});

// @desc    Update user status in client organization
// @route   PUT /api/client/organization/users/:userId/status
// @access  Private (Client only)
const updateUserStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { status } = req.body;

  const currentUser = await User.findById(req.user.id);
  
  if (!currentUser.organizationId) {
    return next(new ErrorResponse('User not associated with any organization', 400));
  }

  // Only organization owners can update user status
  if (currentUser.organizationRole !== 'client_owner') {
    return next(new ErrorResponse('Access denied. Only organization owners can update user status.', 403));
  }

  // Find the user to update
  const userToUpdate = await User.findById(userId);
  if (!userToUpdate) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Ensure user belongs to the same organization
  if (userToUpdate.organizationId.toString() !== currentUser.organizationId.toString()) {
    return next(new ErrorResponse('Access denied. User does not belong to your organization.', 403));
  }

  // Prevent updating organization owner status
  if (userToUpdate.organizationRole === 'client_owner') {
    return next(new ErrorResponse('Cannot update organization owner status', 400));
  }

  // Update user status
  userToUpdate.isActive = status === 'active';
  await userToUpdate.save();

  res.status(200).json(
    ApiResponse.success(
      userToUpdate,
      'User status updated successfully'
    )
  );
});

exports.getOrganizationUsers = getOrganizationUsers;
exports.addOrganizationUser = addOrganizationUser;
exports.updateUserStatus = updateUserStatus;