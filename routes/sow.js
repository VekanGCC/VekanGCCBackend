const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createSOW,
  getSOWs,
  getSOW,
  updateSOW,
  submitSOW,
  approveSOW,
  sendToVendor,
  vendorResponse,
  deleteSOW,
  submitForPMApproval
} = require('../controllers/sowController');

// All routes are protected
router.use(protect);

// SOW CRUD operations
router.route('/')
  .post(authorize('client'), createSOW)
  .get(getSOWs);

router.route('/:id')
  .get(getSOW)
  .put(authorize('client'), updateSOW)
  .delete(authorize('client'), deleteSOW);

// SOW workflow operations
router.post('/:id/submit', authorize('client'), submitSOW);
router.post('/:id/submit-for-pm-approval', authorize('client'), submitForPMApproval);
router.post('/:id/approve', authorize('client'), approveSOW);
router.post('/:id/send-to-vendor', authorize('client'), sendToVendor);
router.post('/:id/vendor-response', authorize('vendor'), vendorResponse);

module.exports = router; 