const User = require('../models/User');
const UserAddress = require('../models/UserAddress');
const UserBankDetails = require('../models/UserBankDetails');
const UserStatutoryCompliance = require('../models/UserStatutoryCompliance');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const bcrypt = require('bcryptjs');

// @desc    Get current user profile with all related data
// @route   GET /api/profile
// @access  Private
const getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  // Fetch related data
  const [addresses, bankDetails, compliance] = await Promise.all([
    UserAddress.find({ userId: req.user.id }),
    UserBankDetails.find({ userId: req.user.id }),
    UserStatutoryCompliance.findOne({ userId: req.user.id })
  ]);

  res.status(200).json({
    success: true,
    data: {
      user,
      addresses,
      bankDetails,
      compliance
    }
  });
});

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = req.body;

  // Prevent updating sensitive fields
  delete fieldsToUpdate.password;
  delete fieldsToUpdate.role;
  delete fieldsToUpdate.email;
  delete fieldsToUpdate.approvalStatus;

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Change password
// @route   PUT /api/profile/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('Please provide current password and new password', 400));
  }

  // Get user with password field
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.matchPassword(currentPassword))) {
    return next(new ErrorResponse('Current password is incorrect', 400));
  }

  // Validate new password
  if (newPassword.length < 6) {
    return next(new ErrorResponse('New password must be at least 6 characters', 400));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
});

// @desc    Delete user account
// @route   DELETE /api/profile
// @access  Private
const deleteAccount = asyncHandler(async (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return next(new ErrorResponse('Please provide your password to confirm account deletion', 400));
  }

  // Get user with password field
  const user = await User.findById(req.user.id).select('+password');

  // Check password
  if (!(await user.matchPassword(password))) {
    return next(new ErrorResponse('Password is incorrect', 400));
  }

  // Soft delete - deactivate account instead of permanent deletion
  user.isActive = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully'
  });
});

// @desc    Add address
// @route   POST /api/profile/addresses
// @access  Private
const addAddress = asyncHandler(async (req, res, next) => {
  req.body.userId = req.user.id;
  
  // If this is set as default, unset other addresses as default
  if (req.body.isDefault) {
    await UserAddress.updateMany(
      { userId: req.user.id },
      { isDefault: false }
    );
  }

  const address = await UserAddress.create(req.body);

  res.status(201).json({
    success: true,
    data: address
  });
});

// @desc    Update address
// @route   PUT /api/profile/addresses/:id
// @access  Private
const updateAddress = asyncHandler(async (req, res, next) => {
  let address = await UserAddress.findById(req.params.id);

  if (!address) {
    return next(new ErrorResponse('Address not found', 404));
  }

  // Make sure user owns the address
  if (address.userId.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to update this address', 401));
  }

  // If this is set as default, unset other addresses as default
  if (req.body.isDefault) {
    await UserAddress.updateMany(
      { userId: req.user.id, _id: { $ne: req.params.id } },
      { isDefault: false }
    );
  }

  address = await UserAddress.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: address
  });
});

// @desc    Delete address
// @route   DELETE /api/profile/addresses/:id
// @access  Private
const deleteAddress = asyncHandler(async (req, res, next) => {
  const address = await UserAddress.findById(req.params.id);

  if (!address) {
    return next(new ErrorResponse('Address not found', 404));
  }

  // Make sure user owns the address
  if (address.userId.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to delete this address', 401));
  }

  await address.remove();

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully'
  });
});

// @desc    Add bank details
// @route   POST /api/profile/bank-details
// @access  Private
const addBankDetails = asyncHandler(async (req, res, next) => {
  // Check if user is vendor
  const user = await User.findById(req.user.id);
  if (user.userType !== 'vendor') {
    return next(new ErrorResponse('Bank details are only available for vendors', 403));
  }

  req.body.userId = req.user.id;
  const bankDetails = await UserBankDetails.create(req.body);

  res.status(201).json({
    success: true,
    data: bankDetails
  });
});

// @desc    Update bank details
// @route   PUT /api/profile/bank-details/:id
// @access  Private
const updateBankDetails = asyncHandler(async (req, res, next) => {
  let bankDetails = await UserBankDetails.findById(req.params.id);

  if (!bankDetails) {
    return next(new ErrorResponse('Bank details not found', 404));
  }

  // Make sure user owns the bank details
  if (bankDetails.userId.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to update these bank details', 401));
  }

  bankDetails = await UserBankDetails.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: bankDetails
  });
});

// @desc    Delete bank details
// @route   DELETE /api/profile/bank-details/:id
// @access  Private
const deleteBankDetails = asyncHandler(async (req, res, next) => {
  const bankDetails = await UserBankDetails.findById(req.params.id);

  if (!bankDetails) {
    return next(new ErrorResponse('Bank details not found', 404));
  }

  // Make sure user owns the bank details
  if (bankDetails.userId.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to delete these bank details', 401));
  }

  await bankDetails.remove();

  res.status(200).json({
    success: true,
    message: 'Bank details deleted successfully'
  });
});

// @desc    Update compliance
// @route   PUT /api/profile/compliance
// @access  Private
const updateCompliance = asyncHandler(async (req, res, next) => {
  let compliance = await UserStatutoryCompliance.findOne({ userId: req.user.id });

  if (compliance) {
    // Update existing compliance
    compliance = await UserStatutoryCompliance.findByIdAndUpdate(compliance._id, req.body, {
      new: true,
      runValidators: true
    });
  } else {
    // Create new compliance record
    req.body.userId = req.user.id;
    compliance = await UserStatutoryCompliance.create(req.body);
  }

  res.status(200).json({
    success: true,
    data: compliance
  });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  addAddress,
  updateAddress,
  deleteAddress,
  addBankDetails,
  updateBankDetails,
  deleteBankDetails,
  updateCompliance
};