const User = require('../models/User');
const UserAddress = require('../models/UserAddress');
const UserBankDetails = require('../models/UserBankDetails');
const UserStatutoryCompliance = require('../models/UserStatutoryCompliance');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');
const { createNotification } = require('./notificationController');
const { canManageUsers } = require('../utils/adminRoleHelper');

// @desc    Get all users (with filtering)
// @route   GET /api/admin/users/all
// @access  Private (Admin only)
const getAllUsers = asyncHandler(async (req, res, next) => {
  const { 
    userType, 
    isActive, 
    isEmailVerified,
    registrationComplete,
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    search
  } = req.query;

  // Build query
  let query = {};

  if (userType) {
    query.userType = userType;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (isEmailVerified !== undefined) {
    query.isEmailVerified = isEmailVerified === 'true';
  }

  if (registrationComplete !== undefined) {
    query.isRegistrationComplete = registrationComplete === 'true';
  }

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query with pagination
  const users = await User.find(query)
    .select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get user by ID
// @route   GET /api/admin/users/all/:id
// @access  Private (Admin only)
const getUserById = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user
// @route   PUT /api/admin/users/all/:id
// @access  Private (Admin only)
const updateUser = asyncHandler(async (req, res, next) => {
  // Prevent updating sensitive fields
  const fieldsToUpdate = { ...req.body };
  delete fieldsToUpdate.password;
  delete fieldsToUpdate.role; // Role can only be updated by admin owners
  delete fieldsToUpdate.email; // Email changes should go through a verification process

  // Check if trying to update admin permissions without proper authorization
  if (fieldsToUpdate.permissions && !canManageUsers(req.user)) {
    return next(new ErrorResponse('Not authorized to update admin permissions', 403));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    {
      new: true,
      runValidators: true
    }
  ).select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Activate/Deactivate user
// @route   PUT /api/admin/users/all/:id/toggle-status
// @access  Private (Admin only)
const toggleUserStatus = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Toggle active status
  user.isActive = !user.isActive;
  await user.save();

  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      isActive: user.isActive
    },
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
  });
});

// @desc    Approve/Reject user
// @route   PUT /api/admin/users/all/:id/approve
// @access  Private (Admin only)
const approveUser = asyncHandler(async (req, res, next) => {
  const { approve = true, notes } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  user.approvalStatus = approve ? 'approved' : 'rejected';
  if (!approve && notes) {
    user.rejectionReason = notes;
  } else if (approve) {
    user.rejectionReason = undefined;
  }
  await user.save();

  // Create notification for the user
  await createNotification({
    recipient: user._id,
    type: 'account_update',
    title: approve ? 'Account Approved' : 'Account Rejected',
    message: approve 
      ? `Your ${user.userType} account has been approved. You can now ${user.userType === 'vendor' ? 'create services and receive orders' : 'book services'}.`
      : `Your ${user.userType} account approval was rejected. ${notes ? `Reason: ${notes}` : 'Please contact support for more information.'}`,
    relatedUser: req.user.id
  });

  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      approvalStatus: user.approvalStatus,
      rejectionReason: user.rejectionReason
    },
    message: `User ${approve ? 'approved' : 'rejected'} successfully`
  });
});

// @desc    Reset user password
// @route   PUT /api/admin/users/all/:id/reset-password
// @access  Private (Admin only)
const resetUserPassword = asyncHandler(async (req, res, next) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return next(new ErrorResponse('Password must be at least 6 characters', 400));
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Create notification for the user
  await createNotification({
    recipient: user._id,
    type: 'account_update',
    title: 'Password Reset',
    message: 'Your password has been reset by an administrator. Please log in with your new password.',
    relatedUser: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully'
  });
});

// @desc    Get user profile with all related data
// @route   GET /api/admin/users/:id/profile
// @access  Private (Admin only)
const getUserProfile = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;

  // Get user data
  const user = await User.findById(userId)
    .select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get user addresses
  const addresses = await UserAddress.find({ userId });

  // Get user bank details (only for vendors)
  const bankDetails = user.userType === 'vendor' ? await UserBankDetails.find({ userId }) : [];

  // Get user compliance data
  const compliance = await UserStatutoryCompliance.findOne({ userId });

  // Prepare response data
  const profileData = {
    user,
    addresses,
    bankDetails,
    compliance
  };

  res.status(200).json({
    success: true,
    data: profileData
  });
});

// @desc    Update user profile (Admin only)
// @route   PUT /api/admin/users/:id/profile
// @access  Private (Admin only)
const updateUserProfile = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const updateData = req.body;

  // Prevent updating sensitive fields
  delete updateData.password;
  delete updateData.email; // Email changes should go through verification
  delete updateData.userType; // User type changes should be restricted

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user,
    message: 'User profile updated successfully'
  });
});

// @desc    Update user address (Admin only)
// @route   PUT /api/admin/users/:id/addresses/:addressId
// @access  Private (Admin only)
const updateUserAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;
  const updateData = req.body;

  const address = await UserAddress.findOneAndUpdate(
    { _id: addressId, userId: req.params.id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!address) {
    return next(new ErrorResponse('Address not found', 404));
  }

  res.status(200).json({
    success: true,
    data: address,
    message: 'Address updated successfully'
  });
});

// @desc    Add user address (Admin only)
// @route   POST /api/admin/users/:id/addresses
// @access  Private (Admin only)
const addUserAddress = asyncHandler(async (req, res, next) => {
  const addressData = {
    ...req.body,
    userId: req.params.id
  };

  const address = await UserAddress.create(addressData);

  res.status(201).json({
    success: true,
    data: address,
    message: 'Address added successfully'
  });
});

// @desc    Delete user address (Admin only)
// @route   DELETE /api/admin/users/:id/addresses/:addressId
// @access  Private (Admin only)
const deleteUserAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;

  const address = await UserAddress.findOneAndDelete({
    _id: addressId,
    userId: req.params.id
  });

  if (!address) {
    return next(new ErrorResponse('Address not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully'
  });
});

// @desc    Update user bank details (Admin only)
// @route   PUT /api/admin/users/:id/bank-details/:bankDetailsId
// @access  Private (Admin only)
const updateUserBankDetails = asyncHandler(async (req, res, next) => {
  const { bankDetailsId } = req.params;
  const updateData = req.body;

  const bankDetails = await UserBankDetails.findOneAndUpdate(
    { _id: bankDetailsId, userId: req.params.id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!bankDetails) {
    return next(new ErrorResponse('Bank details not found', 404));
  }

  res.status(200).json({
    success: true,
    data: bankDetails,
    message: 'Bank details updated successfully'
  });
});

// @desc    Add user bank details (Admin only)
// @route   POST /api/admin/users/:id/bank-details
// @access  Private (Admin only)
const addUserBankDetails = asyncHandler(async (req, res, next) => {
  const bankDetailsData = {
    ...req.body,
    userId: req.params.id
  };

  const bankDetails = await UserBankDetails.create(bankDetailsData);

  res.status(201).json({
    success: true,
    data: bankDetails,
    message: 'Bank details added successfully'
  });
});

// @desc    Delete user bank details (Admin only)
// @route   DELETE /api/admin/users/:id/bank-details/:bankDetailsId
// @access  Private (Admin only)
const deleteUserBankDetails = asyncHandler(async (req, res, next) => {
  const { bankDetailsId } = req.params;

  const bankDetails = await UserBankDetails.findOneAndDelete({
    _id: bankDetailsId,
    userId: req.params.id
  });

  if (!bankDetails) {
    return next(new ErrorResponse('Bank details not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Bank details deleted successfully'
  });
});

// @desc    Update user compliance (Admin only)
// @route   PUT /api/admin/users/:id/compliance
// @access  Private (Admin only)
const updateUserCompliance = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const updateData = req.body;

  const compliance = await UserStatutoryCompliance.findOneAndUpdate(
    { userId },
    updateData,
    { new: true, runValidators: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    data: compliance,
    message: 'Compliance information updated successfully'
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  approveUser,
  resetUserPassword,
  getUserProfile,
  updateUserProfile,
  updateUserAddress,
  addUserAddress,
  deleteUserAddress,
  updateUserBankDetails,
  addUserBankDetails,
  deleteUserBankDetails,
  updateUserCompliance
};