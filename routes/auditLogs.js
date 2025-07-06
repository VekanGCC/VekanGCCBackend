const express = require('express');
const router = express.Router();
const {
  createAuditLog,
  getAuditLogs,
  getEntityAuditTrail,
  getAuditTrailSummary,
  getOrganizationAuditLogs,
  getUserAuditLogs,
  exportAuditLogs,
  getAuditStatistics,
  getAuditLog
} = require('../controllers/auditLogController');
const { protect } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(protect);

// Create audit log entry
router.post('/', createAuditLog);

// Get all audit logs with filters
router.get('/', getAuditLogs);

// Get audit trail for specific entity
router.get('/entity/:entityType/:entityId', getEntityAuditTrail);

// Get audit trail summary for entity
router.get('/entity/:entityType/:entityId/summary', getAuditTrailSummary);

// Get audit logs by organization
router.get('/organization', getOrganizationAuditLogs);

// Get audit logs by user
router.get('/user', getUserAuditLogs);

// Export audit logs
router.get('/export', exportAuditLogs);

// Get audit log statistics
router.get('/statistics', getAuditStatistics);

// Get single audit log
router.get('/:id', getAuditLog);

module.exports = router; 