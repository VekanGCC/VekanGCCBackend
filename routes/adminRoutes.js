const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getPendingApprovals,
  approveEntity,
  rejectEntity
} = require('../controllers/adminController');
const adminRouter = require('./admin');
const adminUsersRouter = require('./adminUsers');
const adminReportsRouter = require('./adminReports');
const adminSettingsRouter = require('./adminSettings');

// Apply admin middleware to all admin routes
router.use(protect);

// Mount admin sub-routes
router.use('/', adminRouter);
router.use('/users', adminUsersRouter);
router.use('/reports', adminReportsRouter);
router.use('/settings', adminSettingsRouter);

// Get pending approvals
router.get('/approvals', protect, authorize('admin'), getPendingApprovals);

// Approve user
router.put('/users/:id/approve', protect, authorize('admin'), approveEntity);

// Reject user
router.put('/users/:id/reject', protect, authorize('admin'), rejectEntity);

module.exports = router;