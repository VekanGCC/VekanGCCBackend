const express = require('express');
const router = express.Router();
const {
  saveStep,
  getRegistrationStatus,
  uploadDocuments,
  getVendorProfile,
  updateVendorProfile
} = require('../controllers/vendorController');
const { getAllUsers } = require('../controllers/adminUserController');
const { protect } = require('../middleware/auth');
const { validateVendorStep3 } = require('../validation/vendorValidation');

// Test route (no auth required)
router.get('/test', (req, res) => {
  console.log('🔧 Vendor Route: Test route hit');
  res.json({ success: true, message: 'Vendor route is working' });
});

// Get all vendors (for dropdowns)
router.get('/', protect, async (req, res, next) => {
  console.log('🔧 Vendor Route: GET /vendors request received');
  console.log('🔧 Vendor Route: User:', req.user);
  console.log('🔧 Vendor Route: Query params:', req.query);
  
  try {
    // Use the getAllUsers function but filter for vendors only
    req.query.userType = 'vendor';
    req.query.isActive = 'true';
    req.query.isEmailVerified = 'true';
    req.query.registrationComplete = 'true';
    req.query.limit = '1000'; // Get all vendors
    
    console.log('🔧 Vendor Route: Modified query params:', req.query);
    
    await getAllUsers(req, res, next);
  } catch (error) {
    console.error('🔧 Vendor Route: Error in GET /vendors:', error);
    next(error);
  }
});

// Registration routes
router.post('/create', saveStep);
router.get('/registration/status', protect, getRegistrationStatus);

// Document upload
router.post('/documents', protect, uploadDocuments);

// Profile routes
router.get('/profile', protect, getVendorProfile);
router.put('/profile', protect, updateVendorProfile);

module.exports = router;