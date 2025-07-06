const express = require('express');
const router = express.Router();
const {
  completeRegistration,
  getClientProfile,
  updateClientProfile,
  saveStep,
  sendOTP,
  verifyOTP,
  getClientRequirements,
  getOrganizationUsers,
  addOrganizationUser,
  updateUserStatus
} = require('../controllers/clientController');
const { createApplication } = require('../controllers/applicationController');
const { getMatchingResourcesDetails } = require('../controllers/requirementController');
const {
  createPO,
  getPOs,
  getPO,
  updatePO,
  submitPO,
  financeApproval,
  sendToVendor,
  activatePO,
  deletePO
} = require('../controllers/poController');
const {
  createSOW,
  getSOWs,
  getSOW,
  updateSOW,
  submitSOW,
  approveSOW,
  sendToVendor: sendSOWToVendor,
  vendorResponse: sowVendorResponse,
  deleteSOW
} = require('../controllers/sowController');
const {
  getInvoices,
  getInvoice,
  approveInvoice,
  markAsPaid
} = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

// Public routes - no authentication required
router.post('/create', saveStep);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

// Protected routes
router.use(protect);

// Client-only routes
router.get('/profile', authorize('client'), getClientProfile);
router.put('/profile', authorize('client'), updateClientProfile);
router.get('/requirements', authorize('client'), getClientRequirements);
router.post('/applications', authorize('client'), createApplication);

// Client User Management routes
router.get('/organization/users', authorize('client'), getOrganizationUsers);
router.post('/organization/users', authorize('client'), addOrganizationUser);
router.put('/organization/users/:userId/status', authorize('client'), updateUserStatus);

// Matching resources route
router.get('/matching-resources/:requirementId', authorize('client'), getMatchingResourcesDetails);

// Registration routes
router.post('/complete-registration', authorize('client'), completeRegistration);

// SOW routes
router.route('/sow')
  .post(authorize('client'), createSOW)
  .get(authorize('client'), getSOWs);

router.route('/sow/:id')
  .get(authorize('client'), getSOW)
  .put(authorize('client'), updateSOW)
  .delete(authorize('client'), deleteSOW);

router.post('/sow/:id/submit', authorize('client'), submitSOW);
router.post('/sow/:id/approve', authorize('client'), approveSOW);
router.post('/sow/:id/send-to-vendor', authorize('client'), sendSOWToVendor);
router.post('/sow/:id/vendor-response', authorize('client'), sowVendorResponse);

// PO routes
router.route('/po')
  .post(authorize('client'), createPO)
  .get(authorize('client'), getPOs);

router.route('/po/:id')
  .get(authorize('client'), getPO)
  .put(authorize('client'), updatePO)
  .delete(authorize('client'), deletePO);

router.post('/po/:id/submit', authorize('client'), submitPO);
router.post('/po/:id/finance-approval', authorize('client'), financeApproval);
router.post('/po/:id/send-to-vendor', authorize('client'), sendToVendor);
router.post('/po/:id/activate', authorize('client'), activatePO);

// Invoice routes (client can view and approve invoices)
router.get('/invoice', authorize('client'), getInvoices);
router.get('/invoice/:id', authorize('client'), getInvoice);
router.post('/invoice/:id/approval', authorize('client'), approveInvoice);
router.post('/invoice/:id/mark-paid', authorize('client'), markAsPaid);

module.exports = router;