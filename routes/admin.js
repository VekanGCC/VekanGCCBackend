const express = require('express');
const router = express.Router();
const {
  getPendingApprovals,
  getApproval,
  approveEntity,
  rejectEntity,
  getPlatformStats,
  getAdminSkills,
  getAdminSkill,
  createAdminSkill,
  updateAdminSkill,
  deleteAdminSkill,
  getAllTransactions,
  getTransaction,
  updateTransaction,
  getAdminUsers,
  createAdminUser,
  getVendorEmployees
} = require('../controllers/adminController');

const {
  getUserGrowthReport,
  getRevenueReport,
  getServicePerformanceReport,
  getVendorPerformanceReport,
  getClientActivityReport,
  getUserRegistrationReport,
  getResourcesReport,
  getRequirementsReport,
  getApplicationsReport,
  getSkillsReport,
  getFinancialReport,
  getMonthlyGrowthReport,
  createCustomReport,
  getReportTemplates,
  saveReportTemplate
} = require('../controllers/adminReportController');
const { protect } = require('../middleware/adminMiddleware');

// All routes are protected and admin-only
router.use(protect);

// Approval routes
router.get('/approvals', getPendingApprovals);
router.get('/approvals/:id', getApproval);
router.put('/approvals/:id/approve', approveEntity);
router.put('/approvals/:id/reject', rejectEntity);

// Platform statistics
router.get('/stats', getPlatformStats);

// Admin skills routes
router.route('/skills')
  .get(getAdminSkills)
  .post(createAdminSkill);

router.route('/skills/:id')
  .get(getAdminSkill)
  .put(updateAdminSkill)
  .delete(deleteAdminSkill);

// Transaction routes
router.get('/transactions', getAllTransactions);
router.route('/transactions/:id')
  .get(getTransaction)
  .put(updateTransaction);

// Admin user management
router.route('/users')
  .get(getAdminUsers)
  .post(createAdminUser);

// Vendor employee management (Admin access)
router.get('/vendor-employees', getVendorEmployees);

// Admin reporting routes
router.get('/reports/user-growth-reporting', getUserGrowthReport);
router.get('/reports/revenue-reporting', getRevenueReport);
router.get('/reports/service-performance-reporting', getServicePerformanceReport);
router.get('/reports/vendor-performance-reporting', getVendorPerformanceReport);
router.get('/reports/client-activity-reporting', getClientActivityReport);
router.get('/reports/user-registration-reporting', getUserRegistrationReport);
router.get('/reports/resources-reporting', getResourcesReport);
router.get('/reports/requirements-reporting', getRequirementsReport);
router.get('/reports/applications-reporting', getApplicationsReport);
router.get('/reports/skills-reporting', getSkillsReport);
router.get('/reports/financial-reporting', getFinancialReport);
router.get('/reports/monthly-growth-reporting', getMonthlyGrowthReport);

// Custom reporting routes
router.post('/reports/custom-reporting', createCustomReport);
router.get('/reports/templates-reporting', getReportTemplates);
router.post('/reports/save-template-reporting', saveReportTemplate);

module.exports = router;