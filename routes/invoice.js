const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  approveInvoice,
  markAsPaid,
  createCreditNote,
  deleteInvoice
} = require('../controllers/invoiceController');

// All routes are protected
router.use(protect);

// Invoice CRUD operations
router.route('/')
  .post(authorize('vendor'), createInvoice)
  .get(getInvoices);

router.route('/:id')
  .get(getInvoice)
  .put(authorize('vendor'), updateInvoice)
  .delete(authorize('vendor'), deleteInvoice);

// Invoice workflow operations
router.post('/:id/approve', authorize('client'), approveInvoice);
router.post('/:id/mark-paid', authorize('client'), markAsPaid);
router.post('/:id/credit-note', authorize('client'), createCreditNote);

module.exports = router; 