const SOW = require('../models/SOW');
const User = require('../models/User');
const Organization = require('../models/Organization');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');

// Helper function to map user organization roles to SOW approval roles
const mapUserRoleToSOWRole = (userOrganizationRole) => {
  const roleMapping = {
    'client_owner': 'client_admin',
    'client_employee': 'client_account',
    'client_account': 'client_account',
    'vendor_owner': 'vendor_admin',
    'vendor_employee': 'vendor_account',
    'vendor_account': 'vendor_account'
  };
  
  return roleMapping[userOrganizationRole] || 'client_account';
};

// @desc    Create new SOW
// @route   POST /api/sow
// @access  Private (Client only)
const createSOW = asyncHandler(async (req, res, next) => {
  const { title, description, requirementId, vendorId, startDate, endDate, estimatedCost } = req.body;

  // Validate user permissions
  const user = await User.findById(req.user.id);
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can create SOWs', 403));
  }

  // Check if user has permission to create SOWs
  if (!['client_owner', 'client_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to create SOWs', 403));
  }

  // Validate vendor exists and is approved
  const vendor = await User.findById(vendorId);
  if (!vendor || vendor.userType !== 'vendor' || vendor.approvalStatus !== 'approved') {
    return next(new ErrorResponse('Invalid vendor or vendor not approved', 400));
  }

  // Create SOW
  const sow = await SOW.create({
    title,
    description,
    requirementId,
    clientId: req.user.id,
    vendorId,
    startDate,
    endDate,
    estimatedCost,
    clientOrganizationId: user.organizationId,
    vendorOrganizationId: vendor.organizationId,
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  // Populate vendor and client details
  await sow.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' }
  ]);

  res.status(201).json(
    ApiResponse.success(sow, 'SOW created successfully')
  );
});

// @desc    Get all SOWs for current user
// @route   GET /api/sow
// @access  Private
const getSOWs = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const { page = 1, limit = 10, status, vendorId, clientId } = req.query;

  let query = {};

  // Filter based on user type and role
  if (user.userType === 'client') {
    if (['client_owner', 'client_account'].includes(user.organizationRole)) {
      query.clientOrganizationId = user.organizationId;
    } else {
      return next(new ErrorResponse('Insufficient permissions to view SOWs', 403));
    }
  } else if (user.userType === 'vendor') {
    if (['vendor_owner', 'vendor_account'].includes(user.organizationRole)) {
      query.vendorOrganizationId = user.organizationId;
    } else {
      return next(new ErrorResponse('Insufficient permissions to view SOWs', 403));
    }
  }

  // Apply filters
  if (status) query.status = status;
  if (vendorId) query.vendorId = vendorId;
  if (clientId) query.clientId = clientId;

  const skip = (page - 1) * limit;
  const [sows, total] = await Promise.all([
    SOW.find(query)
      .populate([
        { path: 'vendorId', select: 'firstName lastName companyName email' },
        { path: 'clientId', select: 'firstName lastName companyName email' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'updatedBy', select: 'firstName lastName email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SOW.countDocuments(query)
  ]);
  res.status(200).json(
    ApiResponse.success({
      docs: sows,
      totalDocs: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }, 'SOWs retrieved successfully')
  );
});

// @desc    Get single SOW
// @route   GET /api/sow/:id
// @access  Private
const getSOW = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  const sow = await SOW.findById(req.params.id).populate([
    { path: 'vendorId', select: 'firstName lastName companyName email phone' },
    { path: 'clientId', select: 'firstName lastName companyName email phone' },
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'updatedBy', select: 'firstName lastName email' },
    { path: 'approvals.userId', select: 'firstName lastName email organizationRole' }
  ]);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check access permissions
  if (user.userType === 'client') {
    if (sow.clientOrganizationId.toString() !== user.organizationId.toString()) {
      return next(new ErrorResponse('Access denied', 403));
    }
  } else if (user.userType === 'vendor') {
    if (sow.vendorOrganizationId.toString() !== user.organizationId.toString()) {
      return next(new ErrorResponse('Access denied', 403));
    }
  }

  res.status(200).json(
    ApiResponse.success(sow, 'SOW retrieved successfully')
  );
});

// @desc    Update SOW
// @route   PUT /api/sow/:id
// @access  Private (Client only)
const updateSOW = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can update SOWs', 403));
  }

  let sow = await SOW.findById(req.params.id);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check ownership and permissions
  if (sow.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  // Only allow updates in draft status
  if (sow.status !== 'draft') {
    return next(new ErrorResponse('SOW cannot be updated in current status', 400));
  }

  // Update SOW
  sow = await SOW.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user.id },
    { new: true, runValidators: true }
  ).populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(sow, 'SOW updated successfully')
  );
});

// @desc    Submit SOW for internal approval
// @route   POST /api/sow/:id/submit
// @access  Private (Client only)
const submitSOW = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can submit SOWs', 403));
  }

  let sow = await SOW.findById(req.params.id);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check ownership and permissions
  if (sow.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (sow.status !== 'draft') {
    return next(new ErrorResponse('SOW can only be submitted from draft status', 400));
  }

  // Update status and add approval record
  sow.status = 'submitted';
  sow.approvals.push({
    userId: req.user.id,
    status: 'approved',
    role: mapUserRoleToSOWRole(user.organizationRole),
    comments: 'Submitted for internal approval'
  });
  sow.updatedBy = req.user.id;

  await sow.save();

  await sow.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(sow, 'SOW submitted successfully')
  );
});

// @desc    Submit SOW for PM approval
// @route   POST /api/sow/:id/submit-for-pm-approval
// @access  Private (Client only)
const submitForPMApproval = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can submit SOWs for PM approval', 403));
  }

  let sow = await SOW.findById(req.params.id);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check ownership and permissions
  if (sow.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (sow.status !== 'draft') {
    return next(new ErrorResponse('SOW can only be submitted for PM approval from draft status', 400));
  }

  // Map user organization role to SOW approval role
  const sowApprovalRole = mapUserRoleToSOWRole(user.organizationRole);

  // Update status and add approval record
  sow.status = 'pm_approval_pending';
  sow.approvals.push({
    userId: req.user.id,
    status: 'approved',
    role: sowApprovalRole,
    comments: req.body.comments || 'Submitted for PM approval'
  });
  sow.updatedBy = req.user.id;

  await sow.save();

  await sow.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(sow, 'SOW submitted for PM approval successfully')
  );
});

// @desc    Approve SOW internally
// @route   POST /api/sow/:id/approve
// @access  Private (Client admin only)
const approveSOW = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client' || user.organizationRole !== 'client_owner') {
    return next(new ErrorResponse('Only client admins can approve SOWs', 403));
  }

  let sow = await SOW.findById(req.params.id);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check ownership
  if (sow.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (sow.status !== 'submitted' && sow.status !== 'pm_approval_pending') {
    return next(new ErrorResponse('SOW can only be approved from submitted or pm_approval_pending status', 400));
  }

  // Update status based on current status
  if (sow.status === 'pm_approval_pending') {
    sow.status = 'internal_approved';
  } else {
    sow.status = 'internal_approved';
  }

  sow.approvals.push({
    userId: req.user.id,
    status: 'approved',
    role: mapUserRoleToSOWRole(user.organizationRole),
    comments: req.body.comments || 'Internally approved'
  });
  sow.updatedBy = req.user.id;

  await sow.save();

  await sow.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(sow, 'SOW approved internally')
  );
});

// @desc    Send SOW to vendor
// @route   POST /api/sow/:id/send-to-vendor
// @access  Private (Client only)
const sendToVendor = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can send SOWs to vendors', 403));
  }

  let sow = await SOW.findById(req.params.id);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check ownership and permissions
  if (sow.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (sow.status !== 'internal_approved') {
    return next(new ErrorResponse('SOW can only be sent to vendor after internal approval', 400));
  }

  // Update status
  sow.status = 'sent_to_vendor';
  sow.updatedBy = req.user.id;

  await sow.save();

  await sow.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(sow, 'SOW sent to vendor successfully')
  );
});

// @desc    Vendor response to SOW
// @route   POST /api/sow/:id/vendor-response
// @access  Private (Vendor only)
const vendorResponse = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'vendor') {
    return next(new ErrorResponse('Only vendors can respond to SOWs', 403));
  }

  if (!['vendor_owner', 'vendor_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to respond to SOWs', 403));
  }

  const { status, comments, proposedChanges } = req.body;

  let sow = await SOW.findById(req.params.id);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check ownership
  if (sow.vendorOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (sow.status !== 'sent_to_vendor') {
    return next(new ErrorResponse('SOW is not in sent_to_vendor status', 400));
  }

  // Update SOW with vendor response
  sow.status = status === 'accepted' ? 'vendor_accepted' : 'vendor_rejected';
  sow.vendorResponse = {
    status,
    responseDate: new Date(),
    comments,
    proposedChanges
  };
  sow.approvals.push({
    userId: req.user.id,
    status: status === 'accepted' ? 'approved' : 'rejected',
    role: mapUserRoleToSOWRole(user.organizationRole),
    comments
  });
  sow.updatedBy = req.user.id;

  await sow.save();

  await sow.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(sow, `SOW ${status} by vendor`)
  );
});

// @desc    Delete SOW
// @route   DELETE /api/sow/:id
// @access  Private (Client only)
const deleteSOW = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can delete SOWs', 403));
  }

  const sow = await SOW.findById(req.params.id);

  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  // Check ownership and permissions
  if (sow.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  // Only allow deletion in draft status
  if (sow.status !== 'draft') {
    return next(new ErrorResponse('SOW cannot be deleted in current status', 400));
  }

  await sow.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'SOW deleted successfully')
  );
});

module.exports = {
  createSOW,
  getSOWs,
  getSOW,
  updateSOW,
  submitSOW,
  submitForPMApproval,
  approveSOW,
  sendToVendor,
  vendorResponse,
  deleteSOW
}; 