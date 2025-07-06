const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  approveUser,
  resetUserPassword,
  getUserProfile,
  updateUserProfile,
  updateUserAddress,
  addUserAddress,
  deleteUserAddress,
  updateUserBankDetails,
  addUserBankDetails,
  deleteUserBankDetails,
  updateUserCompliance
} = require('../controllers/adminUserController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and admin-only
router.use(protect);
router.use(authorize('admin', 'superadmin'));

// User management routes
router.get('/all', getAllUsers);
router.get('/:id/profile', getUserProfile);
router.get('/all/:id', getUserById);
router.put('/all/:id', updateUser);
router.put('/all/:id/toggle-status', toggleUserStatus);
router.put('/all/:id/approve', approveUser);
router.put('/all/:id/reset-password', resetUserPassword);

// Admin profile update routes
router.put('/:id/profile', updateUserProfile);
router.put('/:id/addresses/:addressId', updateUserAddress);
router.post('/:id/addresses', addUserAddress);
router.delete('/:id/addresses/:addressId', deleteUserAddress);
router.put('/:id/bank-details/:bankDetailsId', updateUserBankDetails);
router.post('/:id/bank-details', addUserBankDetails);
router.delete('/:id/bank-details/:bankDetailsId', deleteUserBankDetails);
router.put('/:id/compliance', updateUserCompliance);

module.exports = router;