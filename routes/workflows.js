const express = require('express');
const router = express.Router();
const {
  getWorkflowConfigurations,
  getWorkflowConfiguration,
  createWorkflowConfiguration,
  updateWorkflowConfiguration,
  deleteWorkflowConfiguration,
  getWorkflowInstances,
  getWorkflowInstance,
  processWorkflowStep
} = require('../controllers/workflowController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Workflow configuration routes (Admin Owner only)
router.route('/')
  .get(authorize('admin_owner'), getWorkflowConfigurations)
  .post(authorize('admin_owner'), createWorkflowConfiguration);

// Workflow instance routes (Admin Owner and Admin Employee) - MUST come before /:id routes
router.route('/instances')
  .get(authorize('admin_owner', 'admin_employee'), getWorkflowInstances);

router.route('/instances/:id')
  .get(authorize('admin_owner', 'admin_employee'), getWorkflowInstance);

router.route('/instances/:id/process-step')
  .post(authorize('admin_owner', 'admin_employee'), processWorkflowStep);

// Workflow configuration by ID routes (Admin Owner only) - MUST come after /instances routes
router.route('/:id')
  .get(authorize('admin_owner'), getWorkflowConfiguration)
  .put(authorize('admin_owner'), updateWorkflowConfiguration)
  .delete(authorize('admin_owner'), deleteWorkflowConfiguration);

module.exports = router; 