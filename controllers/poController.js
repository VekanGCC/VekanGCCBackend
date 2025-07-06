const PO = require('../models/PO');
const SOW = require('../models/SOW');
const User = require('../models/User');
const Organization = require('../models/Organization');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');

// @desc    Create new PO
// @route   POST /api/po
// @access  Private (Client only)
const createPO = asyncHandler(async (req, res, next) => {
  const { sowId, vendorId, startDate, endDate, totalAmount, paymentTerms, customPaymentTerms } = req.body;

  // Validate user permissions
  const user = await User.findById(req.user.id);
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can create POs', 403));
  }

  // Check if user has permission to create POs
  if (!['client_owner', 'client_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to create POs', 403));
  }

  // Validate SOW exists and is accepted by vendor
  const sow = await SOW.findById(sowId);
  if (!sow) {
    return next(new ErrorResponse('SOW not found', 404));
  }

  if (sow.status !== 'vendor_accepted') {
    return next(new ErrorResponse('PO can only be created for accepted SOWs', 400));
  }

  // Check if a PO already exists for this SOW
  const existingPO = await PO.findOne({ sowId: sowId });
  if (existingPO) {
    console.log('🔧 PO creation blocked: SOW already has a PO', { sowId, existingPOId: existingPO._id });
    return next(new ErrorResponse('A Purchase Order has already been created for this SOW. SOW amount is already utilized.', 400));
  }

  console.log('🔧 SOW validation passed: No existing PO found for SOW', sowId);

  // Validate vendor exists and is approved
  const vendor = await User.findById(vendorId);
  if (!vendor || vendor.userType !== 'vendor' || vendor.approvalStatus !== 'approved') {
    return next(new ErrorResponse('Invalid vendor or vendor not approved', 400));
  }

  // Create PO
  const poData = {
    sowId,
    clientId: req.user.id,
    vendorId,
    startDate,
    endDate,
    totalAmount,
    paymentTerms,
    customPaymentTerms,
    clientOrganizationId: user.organizationId,
    vendorOrganizationId: vendor.organizationId,
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  // Generate PO number
  const year = new Date().getFullYear();
  const count = await PO.countDocuments({ 
    createdAt: { 
      $gte: new Date(year, 0, 1), 
      $lt: new Date(year + 1, 0, 1) 
    } 
  });
  poData.poNumber = `PO-${year}-${(count + 1).toString().padStart(4, '0')}`;

  console.log('🔧 Creating PO with data:', poData);

  try {
    const po = await PO.create(poData);

    // Populate vendor, client, and SOW details
    await po.populate([
      { path: 'vendorId', select: 'firstName lastName companyName email' },
      { path: 'clientId', select: 'firstName lastName companyName email' },
      { path: 'sowId', select: 'title description estimatedCost' }
    ]);

    res.status(201).json(
      ApiResponse.success(po, 'PO created successfully')
    );
  } catch (error) {
    console.error('🔧 Error creating PO:', error);
    return next(new ErrorResponse(`Failed to create PO: ${error.message}`, 500));
  }
});

// @desc    Get all POs for current user
// @route   GET /api/po
// @access  Private
const getPOs = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const { page = 1, limit = 10, status, vendorId, clientId, sowId } = req.query;

  console.log('🔧 PO Controller: getPOs called');
  console.log('🔧 PO Controller: User:', { id: user._id, userType: user.userType, organizationRole: user.organizationRole, organizationId: user.organizationId });
  console.log('🔧 PO Controller: Query params:', req.query);

  let query = {};

  // Filter based on user type and role
  if (user.userType === 'client') {
    if (['client_owner', 'client_account'].includes(user.organizationRole)) {
      query.clientOrganizationId = user.organizationId;
      console.log('🔧 PO Controller: Client query - clientOrganizationId:', user.organizationId);
    } else {
      return next(new ErrorResponse('Insufficient permissions to view POs', 403));
    }
  } else if (user.userType === 'vendor') {
    if (['vendor_owner', 'vendor_account'].includes(user.organizationRole)) {
      query.vendorOrganizationId = user.organizationId;
      console.log('🔧 PO Controller: Vendor query - vendorOrganizationId:', user.organizationId);
    } else {
      return next(new ErrorResponse('Insufficient permissions to view POs', 403));
    }
  }

  // Apply filters
  if (status) query.status = status;
  if (vendorId) query.vendorId = vendorId;
  if (clientId) query.clientId = clientId;
  if (sowId) query.sowId = sowId;

  console.log('🔧 PO Controller: Final query:', JSON.stringify(query, null, 2));

  const skip = (page - 1) * limit;
  const [pos, total] = await Promise.all([
    PO.find(query)
      .populate([
        { path: 'vendorId', select: 'firstName lastName companyName email' },
        { path: 'clientId', select: 'firstName lastName companyName email' },
        { path: 'sowId', select: 'title description estimatedCost' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'updatedBy', select: 'firstName lastName email' },
        { path: 'financeApproval.userId', select: 'firstName lastName email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PO.countDocuments(query)
  ]);

  console.log('🔧 PO Controller: Found POs:', pos.length, 'Total:', total);

  res.status(200).json(
    ApiResponse.success({
      docs: pos,
      totalDocs: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }, 'POs retrieved successfully')
  );
});

// @desc    Get single PO
// @route   GET /api/po/:id
// @access  Private
const getPO = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  const po = await PO.findById(req.params.id).populate([
    { path: 'vendorId', select: 'firstName lastName companyName email phone' },
    { path: 'clientId', select: 'firstName lastName companyName email phone' },
    { path: 'sowId', select: 'title description estimatedCost startDate endDate' },
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'updatedBy', select: 'firstName lastName email' },
    { path: 'financeApproval.userId', select: 'firstName lastName email' }
  ]);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check access permissions
  if (user.userType === 'client') {
    if (po.clientOrganizationId.toString() !== user.organizationId.toString()) {
      return next(new ErrorResponse('Access denied', 403));
    }
  } else if (user.userType === 'vendor') {
    if (po.vendorOrganizationId.toString() !== user.organizationId.toString()) {
      return next(new ErrorResponse('Access denied', 403));
    }
  }

  res.status(200).json(
    ApiResponse.success(po, 'PO retrieved successfully')
  );
});

// @desc    Update PO
// @route   PUT /api/po/:id
// @access  Private (Client only)
const updatePO = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can update POs', 403));
  }

  let po = await PO.findById(req.params.id);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check ownership and permissions
  if (po.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  // Only allow updates in draft status
  if (po.status !== 'draft') {
    return next(new ErrorResponse('PO cannot be updated in current status', 400));
  }

  // Update PO
  po = await PO.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user.id },
    { new: true, runValidators: true }
  ).populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'sowId', select: 'title description estimatedCost' }
  ]);

  res.status(200).json(
    ApiResponse.success(po, 'PO updated successfully')
  );
});

// @desc    Submit PO for finance approval
// @route   POST /api/po/:id/submit
// @access  Private (Client only)
const submitPO = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can submit POs', 403));
  }

  let po = await PO.findById(req.params.id);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check ownership and permissions
  if (po.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (po.status !== 'draft') {
    return next(new ErrorResponse('PO can only be submitted from draft status', 400));
  }

  // Update status
  po.status = 'submitted';
  po.updatedBy = req.user.id;

  await po.save();

  await po.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'sowId', select: 'title description estimatedCost' }
  ]);

  res.status(200).json(
    ApiResponse.success(po, 'PO submitted successfully')
  );
});

// @desc    Finance approval for PO
// @route   POST /api/po/:id/finance-approval
// @access  Private (Client admin only)
const financeApproval = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client' || user.organizationRole !== 'client_owner') {
    return next(new ErrorResponse('Only client admins can approve POs', 403));
  }

  const { status, comments } = req.body;

  let po = await PO.findById(req.params.id);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check ownership
  if (po.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (po.status !== 'submitted') {
    return next(new ErrorResponse('PO can only be approved from submitted status', 400));
  }

  // Update finance approval details
  po.financeApproval = {
    userId: req.user.id,
    status,
    date: new Date(),
    comments
  };

  // Update status based on approval
  if (status === 'approved') {
    po.status = 'finance_approved';
  } else {
    po.status = 'draft'; // Reject back to draft
  }

  po.updatedBy = req.user.id;

  await po.save();

  await po.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'sowId', select: 'title description estimatedCost' },
    { path: 'financeApproval.userId', select: 'firstName lastName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(po, `PO ${status} by finance`)
  );
});

// @desc    Send PO to vendor
// @route   POST /api/po/:id/send-to-vendor
// @access  Private (Client only)
const sendToVendor = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can send POs to vendors', 403));
  }

  let po = await PO.findById(req.params.id);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check ownership and permissions
  if (po.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (po.status !== 'finance_approved') {
    return next(new ErrorResponse('PO can only be sent to vendor after finance approval', 400));
  }

  // Update status
  po.status = 'sent_to_vendor';
  po.updatedBy = req.user.id;

  await po.save();

  await po.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'sowId', select: 'title description estimatedCost' }
  ]);

  res.status(200).json(
    ApiResponse.success(po, 'PO sent to vendor successfully')
  );
});

// @desc    Vendor response to PO
// @route   POST /api/po/:id/vendor-response
// @access  Private (Vendor only)
const vendorResponse = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'vendor') {
    return next(new ErrorResponse('Only vendors can respond to POs', 403));
  }

  if (!['vendor_owner', 'vendor_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to respond to POs', 403));
  }

  const { status, comments } = req.body;

  let po = await PO.findById(req.params.id);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check ownership
  if (po.vendorOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (po.status !== 'sent_to_vendor') {
    return next(new ErrorResponse('PO is not in sent_to_vendor status', 400));
  }

  // Update PO with vendor response
  po.status = status === 'accepted' ? 'vendor_accepted' : 'vendor_rejected';
  po.vendorResponse = {
    status,
    responseDate: new Date(),
    comments
  };
  po.updatedBy = req.user.id;

  await po.save();

  await po.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'sowId', select: 'title description estimatedCost' }
  ]);

  res.status(200).json(
    ApiResponse.success(po, `PO ${status} by vendor`)
  );
});

// @desc    Activate PO
// @route   POST /api/po/:id/activate
// @access  Private (Client only)
const activatePO = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can activate POs', 403));
  }

  let po = await PO.findById(req.params.id);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check ownership and permissions
  if (po.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (po.status !== 'vendor_accepted') {
    return next(new ErrorResponse('PO can only be activated after vendor acceptance', 400));
  }

  // Update status
  po.status = 'active';
  po.updatedBy = req.user.id;

  await po.save();

  await po.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'sowId', select: 'title description estimatedCost' }
  ]);

  res.status(200).json(
    ApiResponse.success(po, 'PO activated successfully')
  );
});

// @desc    Delete PO
// @route   DELETE /api/po/:id
// @access  Private (Client only)
const deletePO = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can delete POs', 403));
  }

  const po = await PO.findById(req.params.id);

  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  // Check ownership and permissions
  if (po.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  // Only allow deletion in draft status
  if (po.status !== 'draft') {
    return next(new ErrorResponse('PO cannot be deleted in current status', 400));
  }

  await po.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'PO deleted successfully')
  );
});

module.exports = {
  createPO,
  getPOs,
  getPO,
  updatePO,
  submitPO,
  financeApproval,
  sendToVendor,
  vendorResponse,
  activatePO,
  deletePO
}; 