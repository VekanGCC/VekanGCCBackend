const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/profileController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Basic profile routes
router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/change-password', changePassword);
router.delete('/', deleteAccount);

// Address management routes
router.post('/addresses', addAddress);
router.put('/addresses/:id', updateAddress);
router.delete('/addresses/:id', deleteAddress);

// Bank details management routes (vendor only)
router.post('/bank-details', addBankDetails);
router.put('/bank-details/:id', updateBankDetails);
router.delete('/bank-details/:id', deleteBankDetails);

// Compliance management routes
router.put('/compliance', updateCompliance);

module.exports = router;