const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protect routes
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Check if user is approved (except for admins)
    if (req.user.userType !== 'admin' && req.user.approvalStatus !== 'approved') {
      return next(new ErrorResponse('Your account is pending approval', 403));
    }

    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    // Check both userType and organizationRole
    const hasUserType = roles.includes(req.user.userType);
    const hasOrganizationRole = req.user.organizationRole && roles.includes(req.user.organizationRole);
    
    if (!hasUserType && !hasOrganizationRole) {
      return next(
        new ErrorResponse(
          `User role ${req.user.userType}/${req.user.organizationRole} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

module.exports = { protect, authorize };