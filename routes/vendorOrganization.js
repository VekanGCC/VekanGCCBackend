const express = require('express');
const router = express.Router();
const {
  addEmployee,
  getEmployees,
  verifyEmployeeOTP,
  resendOTP
} = require('../controllers/organizationController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Add employee (vendor owner only)
router.post('/add-employee', authorize('vendor'), addEmployee);

// Get organization employees (vendor users)
router.get('/employees', authorize('vendor'), getEmployees);

// Resend OTP (vendor owner only)
router.post('/resend-otp', authorize('vendor'), resendOTP);

// Verify OTP (public - no authorization required)
router.post('/verify-otp', verifyEmployeeOTP);

module.exports = router; 