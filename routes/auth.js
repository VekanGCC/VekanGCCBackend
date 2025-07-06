const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyPhone,
  resendVerification,
  getCurrentUser
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const verifyToken = require('../middleware/jwt.middleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-phone', verifyPhone);
router.post('/refresh-token', refreshToken);

// Protected routes
router.post('/logout', protect, logout);
router.post('/resend-verification', protect, resendVerification);
router.get('/me', protect, getCurrentUser);
router.get('/verify', verifyToken, getCurrentUser);

module.exports = router;