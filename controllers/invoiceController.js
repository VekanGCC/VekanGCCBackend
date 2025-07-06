const Invoice = require('../models/Invoice');
const PO = require('../models/PO');
const User = require('../models/User');
const Organization = require('../models/Organization');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');

// @desc    Create new Invoice
// @route   POST /api/invoice
// @access  Private (Vendor only)
const createInvoice = asyncHandler(async (req, res, next) => {
  const { poId, vendorId, invoiceDate, invoiceAmount, workSummary } = req.body;

  // Validate user permissions
  const user = await User.findById(req.user.id);
  if (user.userType !== 'vendor') {
    return next(new ErrorResponse('Only vendors can create invoices', 403));
  }

  // Check if user has permission to create invoices
  if (!['vendor_owner', 'vendor_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to create invoices', 403));
  }

  // Validate PO exists and is active
  const po = await PO.findById(poId);
  if (!po) {
    return next(new ErrorResponse('PO not found', 404));
  }

  if (po.status !== 'active') {
    return next(new ErrorResponse('Invoice can only be created for active POs', 400));
  }

  // Check if vendor owns this PO
  if (po.vendorOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied - PO does not belong to your organization', 403));
  }

  // Validate invoice amount doesn't exceed PO remaining amount
  const totalInvoiced = po.paymentTracking.totalInvoiced;
  const poAmount = po.totalAmount.amount;
  const newInvoiceAmount = invoiceAmount.amount;

  if (totalInvoiced + newInvoiceAmount > poAmount) {
    return next(new ErrorResponse('Invoice amount exceeds PO remaining amount', 400));
  }

  // Create invoice
  const invoice = await Invoice.create({
    poId,
    vendorId: req.user.id,
    clientId: po.clientId,
    invoiceDate,
    invoiceAmount,
    workSummary,
    clientOrganizationId: po.clientOrganizationId,
    vendorOrganizationId: user.organizationId,
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  // Update PO payment tracking
  po.paymentTracking.totalInvoiced += newInvoiceAmount;
  po.paymentTracking.remainingAmount = poAmount - po.paymentTracking.totalInvoiced;
  await po.save();

  // Populate details
  await invoice.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'poId', select: 'poNumber totalAmount paymentTerms' }
  ]);

  res.status(201).json(
    ApiResponse.success(invoice, 'Invoice created successfully')
  );
});

// @desc    Get all invoices for current user
// @route   GET /api/invoice
// @access  Private
const getInvoices = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const { page = 1, limit = 10, paymentStatus, vendorId, clientId, poId } = req.query;

  let query = {};

  // Filter based on user type and role
  if (user.userType === 'client') {
    if (['client_owner', 'client_account'].includes(user.organizationRole)) {
      query.clientOrganizationId = user.organizationId;
    } else {
      return next(new ErrorResponse('Insufficient permissions to view invoices', 403));
    }
  } else if (user.userType === 'vendor') {
    if (['vendor_owner', 'vendor_account'].includes(user.organizationRole)) {
      query.vendorOrganizationId = user.organizationId;
    } else {
      return next(new ErrorResponse('Insufficient permissions to view invoices', 403));
    }
  }

  // Apply filters
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (vendorId) query.vendorId = vendorId;
  if (clientId) query.clientId = clientId;
  if (poId) query.poId = poId;

  const skip = (page - 1) * limit;
  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .populate([
        { path: 'vendorId', select: 'firstName lastName companyName email' },
        { path: 'clientId', select: 'firstName lastName companyName email' },
        { path: 'poId', select: 'poNumber totalAmount paymentTerms' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'updatedBy', select: 'firstName lastName email' },
        { path: 'approvalDetails.approvedBy', select: 'firstName lastName email' },
        { path: 'approvalDetails.rejectedBy', select: 'firstName lastName email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(query)
  ]);
  res.status(200).json(
    ApiResponse.success({
      docs: invoices,
      totalDocs: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }, 'Invoices retrieved successfully')
  );
});

// @desc    Get single invoice
// @route   GET /api/invoice/:id
// @access  Private
const getInvoice = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  const invoice = await Invoice.findById(req.params.id).populate([
    { path: 'vendorId', select: 'firstName lastName companyName email phone' },
    { path: 'clientId', select: 'firstName lastName companyName email phone' },
    { path: 'poId', select: 'poNumber totalAmount paymentTerms startDate endDate' },
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'updatedBy', select: 'firstName lastName email' },
    { path: 'approvalDetails.approvedBy', select: 'firstName lastName email' },
    { path: 'approvalDetails.rejectedBy', select: 'firstName lastName email' },
    { path: 'creditNote.createdBy', select: 'firstName lastName email' }
  ]);

  if (!invoice) {
    return next(new ErrorResponse('Invoice not found', 404));
  }

  // Check access permissions
  if (user.userType === 'client') {
    if (invoice.clientOrganizationId.toString() !== user.organizationId.toString()) {
      return next(new ErrorResponse('Access denied', 403));
    }
  } else if (user.userType === 'vendor') {
    if (invoice.vendorOrganizationId.toString() !== user.organizationId.toString()) {
      return next(new ErrorResponse('Access denied', 403));
    }
  }

  res.status(200).json(
    ApiResponse.success(invoice, 'Invoice retrieved successfully')
  );
});

// @desc    Update invoice
// @route   PUT /api/invoice/:id
// @access  Private (Vendor only)
const updateInvoice = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'vendor') {
    return next(new ErrorResponse('Only vendors can update invoices', 403));
  }

  let invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new ErrorResponse('Invoice not found', 404));
  }

  // Check ownership and permissions
  if (invoice.vendorOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  // Only allow updates in pending status
  if (invoice.paymentStatus !== 'pending') {
    return next(new ErrorResponse('Invoice cannot be updated in current status', 400));
  }

  // Update invoice
  invoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user.id },
    { new: true, runValidators: true }
  ).populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'poId', select: 'poNumber totalAmount paymentTerms' }
  ]);

  res.status(200).json(
    ApiResponse.success(invoice, 'Invoice updated successfully')
  );
});

// @desc    Approve/Reject invoice
// @route   POST /api/invoice/:id/approval
// @access  Private (Client only)
const approveInvoice = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can approve invoices', 403));
  }

  if (!['client_owner', 'client_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to approve invoices', 403));
  }

  const { status, rejectionReason } = req.body;

  let invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new ErrorResponse('Invoice not found', 404));
  }

  // Check ownership
  if (invoice.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (invoice.paymentStatus !== 'pending') {
    return next(new ErrorResponse('Invoice is not in pending status', 400));
  }

  // Update approval details
  if (status === 'approved') {
    invoice.paymentStatus = 'approved';
    invoice.approvalDetails.approvedBy = req.user.id;
    invoice.approvalDetails.approvedAt = new Date();
  } else {
    invoice.paymentStatus = 'rejected';
    invoice.approvalDetails.rejectedBy = req.user.id;
    invoice.approvalDetails.rejectedAt = new Date();
    invoice.approvalDetails.rejectionReason = rejectionReason;
  }

  invoice.updatedBy = req.user.id;

  await invoice.save();

  await invoice.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'poId', select: 'poNumber totalAmount paymentTerms' },
    { path: 'approvalDetails.approvedBy', select: 'firstName lastName email' },
    { path: 'approvalDetails.rejectedBy', select: 'firstName lastName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(invoice, `Invoice ${status}`)
  );
});

// @desc    Mark invoice as paid
// @route   POST /api/invoice/:id/mark-paid
// @access  Private (Client only)
const markAsPaid = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can mark invoices as paid', 403));
  }

  if (!['client_owner', 'client_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to mark invoices as paid', 403));
  }

  const { paidAmount, paidDate, paymentMethod, transactionId, notes } = req.body;

  let invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new ErrorResponse('Invoice not found', 404));
  }

  // Check ownership
  if (invoice.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (invoice.paymentStatus !== 'approved') {
    return next(new ErrorResponse('Invoice must be approved before marking as paid', 400));
  }

  // Update payment details
  invoice.paymentStatus = 'paid';
  invoice.paymentDetails = {
    paidAmount: paidAmount || invoice.invoiceAmount.amount,
    paidDate: paidDate || new Date(),
    paymentMethod,
    transactionId,
    notes
  };

  // Update PO payment tracking
  const po = await PO.findById(invoice.poId);
  if (po) {
    po.paymentTracking.totalPaid += (paidAmount || invoice.invoiceAmount.amount);
    po.paymentTracking.lastPaymentDate = new Date();
    await po.save();
  }

  invoice.updatedBy = req.user.id;

  await invoice.save();

  await invoice.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'poId', select: 'poNumber totalAmount paymentTerms' }
  ]);

  res.status(200).json(
    ApiResponse.success(invoice, 'Invoice marked as paid')
  );
});

// @desc    Create credit note
// @route   POST /api/invoice/:id/credit-note
// @access  Private (Client only)
const createCreditNote = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'client') {
    return next(new ErrorResponse('Only clients can create credit notes', 403));
  }

  if (!['client_owner', 'client_account'].includes(user.organizationRole)) {
    return next(new ErrorResponse('Insufficient permissions to create credit notes', 403));
  }

  const { amount, reason } = req.body;

  let invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new ErrorResponse('Invoice not found', 404));
  }

  // Check ownership
  if (invoice.clientOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  if (amount > invoice.invoiceAmount.amount) {
    return next(new ErrorResponse('Credit note amount cannot exceed invoice amount', 400));
  }

  // Create credit note
  invoice.creditNote = {
    amount,
    reason,
    createdAt: new Date(),
    createdBy: req.user.id
  };

  invoice.updatedBy = req.user.id;

  await invoice.save();

  await invoice.populate([
    { path: 'vendorId', select: 'firstName lastName companyName email' },
    { path: 'clientId', select: 'firstName lastName companyName email' },
    { path: 'poId', select: 'poNumber totalAmount paymentTerms' },
    { path: 'creditNote.createdBy', select: 'firstName lastName email' }
  ]);

  res.status(200).json(
    ApiResponse.success(invoice, 'Credit note created successfully')
  );
});

// @desc    Delete invoice
// @route   DELETE /api/invoice/:id
// @access  Private (Vendor only)
const deleteInvoice = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user.userType !== 'vendor') {
    return next(new ErrorResponse('Only vendors can delete invoices', 403));
  }

  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new ErrorResponse('Invoice not found', 404));
  }

  // Check ownership and permissions
  if (invoice.vendorOrganizationId.toString() !== user.organizationId.toString()) {
    return next(new ErrorResponse('Access denied', 403));
  }

  // Only allow deletion in pending status
  if (invoice.paymentStatus !== 'pending') {
    return next(new ErrorResponse('Invoice cannot be deleted in current status', 400));
  }

  // Update PO payment tracking
  const po = await PO.findById(invoice.poId);
  if (po) {
    po.paymentTracking.totalInvoiced -= invoice.invoiceAmount.amount;
    po.paymentTracking.remainingAmount = po.totalAmount.amount - po.paymentTracking.totalInvoiced;
    await po.save();
  }

  await invoice.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'Invoice deleted successfully')
  );
});

module.exports = {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  approveInvoice,
  markAsPaid,
  createCreditNote,
  deleteInvoice
}; 