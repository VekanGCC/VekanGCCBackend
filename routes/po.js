const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
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
} = require('../controllers/poController');

// All routes are protected
router.use(protect);

// PO CRUD operations
router.route('/')
  .post(authorize('client'), createPO)
  .get(getPOs);

router.route('/:id')
  .get(getPO)
  .put(authorize('client'), updatePO)
  .delete(authorize('client'), deletePO);

// PO workflow operations
router.post('/:id/submit', authorize('client'), submitPO);
router.post('/:id/finance-approval', authorize('client'), financeApproval);
router.post('/:id/send-to-vendor', authorize('client'), sendToVendor);
router.post('/:id/vendor-response', authorize('vendor'), vendorResponse);
router.post('/:id/activate', authorize('client'), activatePO);

module.exports = router; 