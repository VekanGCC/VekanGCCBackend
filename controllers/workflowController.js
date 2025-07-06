const WorkflowConfiguration = require('../models/WorkflowConfiguration');
const WorkflowInstance = require('../models/WorkflowInstance');
const Application = require('../models/Application');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');
const { canAccessWorkflowManagement } = require('../utils/adminRoleHelper');

// @desc    Get all workflow configurations
// @route   GET /api/workflows
// @access  Private (Super Admin only)
const getWorkflowConfigurations = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    isActive,
    applicationTypes
  } = req.query;

  // Build query
  let query = {};

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (applicationTypes) {
    query.applicationTypes = { $in: applicationTypes.split(',') };
  }

  // Execute query with pagination
  const workflows = await WorkflowConfiguration.find(query)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await WorkflowConfiguration.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      workflows,
      'Workflow configurations retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    )
  );
});

// @desc    Get single workflow configuration
// @route   GET /api/workflows/:id
// @access  Private (Super Admin only)
const getWorkflowConfiguration = asyncHandler(async (req, res, next) => {
  const workflow = await WorkflowConfiguration.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  if (!workflow) {
    return next(new ErrorResponse('Workflow configuration not found', 404));
  }

  res.status(200).json(
    ApiResponse.success(workflow, 'Workflow configuration retrieved successfully')
  );
});

// @desc    Create workflow configuration
// @route   POST /api/workflows
// @access  Private (Admin Owner only)
const createWorkflowConfiguration = asyncHandler(async (req, res, next) => {
  // Check if user can access workflow management
  if (!canAccessWorkflowManagement(req.user)) {
    return next(new ErrorResponse('Only admin owners can create workflow configurations', 403));
  }

  const { name, description, applicationTypes, steps, settings, isDefault } = req.body;

  // If setting as default, unset other defaults
  if (isDefault) {
    await WorkflowConfiguration.updateMany(
      { applicationTypes: { $in: applicationTypes } },
      { isDefault: false }
    );
  }

  const workflow = await WorkflowConfiguration.create({
    name,
    description,
    applicationTypes,
    steps,
    settings,
    isDefault,
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  await workflow.populate('createdBy', 'firstName lastName email');

  res.status(201).json(
    ApiResponse.success(workflow, 'Workflow configuration created successfully')
  );
});

// @desc    Update workflow configuration
// @route   PUT /api/workflows/:id
// @access  Private (Admin Owner only)
const updateWorkflowConfiguration = asyncHandler(async (req, res, next) => {
  // Check if user can access workflow management
  if (!canAccessWorkflowManagement(req.user)) {
    return next(new ErrorResponse('Only admin owners can update workflow configurations', 403));
  }

  let workflow = await WorkflowConfiguration.findById(req.params.id);

  if (!workflow) {
    return next(new ErrorResponse('Workflow configuration not found', 404));
  }

  const { name, description, applicationTypes, steps, settings, isDefault } = req.body;

  // If setting as default, unset other defaults
  if (isDefault) {
    await WorkflowConfiguration.updateMany(
      { 
        _id: { $ne: req.params.id },
        applicationTypes: { $in: applicationTypes } 
      },
      { isDefault: false }
    );
  }

  workflow = await WorkflowConfiguration.findByIdAndUpdate(
    req.params.id,
    {
      name,
      description,
      applicationTypes,
      steps,
      settings,
      isDefault,
      updatedBy: req.user.id
    },
    {
      new: true,
      runValidators: true
    }
  ).populate('createdBy', 'firstName lastName email')
   .populate('updatedBy', 'firstName lastName email');

  res.status(200).json(
    ApiResponse.success(workflow, 'Workflow configuration updated successfully')
  );
});

// @desc    Delete workflow configuration
// @route   DELETE /api/workflows/:id
// @access  Private (Admin Owner only)
const deleteWorkflowConfiguration = asyncHandler(async (req, res, next) => {
  // Check if user can access workflow management
  if (!canAccessWorkflowManagement(req.user)) {
    return next(new ErrorResponse('Only admin owners can delete workflow configurations', 403));
  }

  const workflow = await WorkflowConfiguration.findById(req.params.id);

  if (!workflow) {
    return next(new ErrorResponse('Workflow configuration not found', 404));
  }

  // Check if workflow is being used by any applications
  const activeInstances = await WorkflowInstance.countDocuments({
    workflowConfigurationId: req.params.id,
    status: { $in: ['active', 'in_progress'] }
  });

  if (activeInstances > 0) {
    return next(new ErrorResponse('Cannot delete workflow configuration that has active instances', 400));
  }

  await WorkflowConfiguration.findByIdAndDelete(req.params.id);

  res.status(200).json(
    ApiResponse.success(null, 'Workflow configuration deleted successfully')
  );
});

// @desc    Get workflow instances
// @route   GET /api/workflows/instances
// @access  Private (Admin only)
const getWorkflowInstances = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    status,
    applicationId,
    assignedTo
  } = req.query;

  // Build query
  let query = {};

  if (status) {
    query.status = status;
  }

  if (applicationId) {
    query.applicationId = applicationId;
  }

  if (assignedTo) {
    query['steps.assignedTo'] = assignedTo;
  }

  // Execute query with pagination
  const instances = await WorkflowInstance.find(query)
    .populate('applicationId', 'status notes')
    .populate('workflowConfigurationId', 'name description')
    .populate('steps.assignedTo', 'firstName lastName email')
    .populate('steps.performedBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await WorkflowInstance.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      instances,
      'Workflow instances retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    )
  );
});

// @desc    Get workflow instance by ID
// @route   GET /api/workflows/instances/:id
// @access  Private (Admin only)
const getWorkflowInstance = asyncHandler(async (req, res, next) => {
  const instance = await WorkflowInstance.findById(req.params.id)
    .populate('applicationId', 'status notes requirement resource')
    .populate('workflowConfigurationId', 'name description steps')
    .populate('steps.assignedTo', 'firstName lastName email')
    .populate('steps.performedBy', 'firstName lastName email')
    .populate('escalatedTo', 'firstName lastName email');

  if (!instance) {
    return next(new ErrorResponse('Workflow instance not found', 404));
  }

  res.status(200).json(
    ApiResponse.success(instance, 'Workflow instance retrieved successfully')
  );
});

// @desc    Process workflow step
// @route   POST /api/workflows/instances/:id/process-step
// @access  Private (Admin only)
const processWorkflowStep = asyncHandler(async (req, res, next) => {
  const { stepOrder, action, comments, metadata } = req.body;

  const instance = await WorkflowInstance.findById(req.params.id)
    .populate('workflowConfigurationId')
    .populate('applicationId');

  if (!instance) {
    return next(new ErrorResponse('Workflow instance not found', 404));
  }

  // Find the current step
  const currentStep = instance.steps.find(step => step.order === parseInt(stepOrder));
  
  if (!currentStep) {
    return next(new ErrorResponse('Workflow step not found', 404));
  }

  // Check if user has permission for this step
  if (!hasPermissionForStep(req.user, currentStep)) {
    return next(new ErrorResponse('Insufficient permissions for this workflow step', 403));
  }

  // Update step status
  currentStep.status = 'completed';
  currentStep.completedAt = new Date();
  currentStep.performedBy = req.user.id;
  currentStep.actionTaken = action;
  currentStep.comments = comments;
  currentStep.metadata = { ...currentStep.metadata, ...metadata };

  // Update instance
  instance.currentStep = parseInt(stepOrder) + 1;
  
  // Check if workflow is completed
  if (instance.currentStep > instance.steps.length) {
    instance.status = 'completed';
    instance.completedAt = new Date();
  }

  await instance.save();

  // Update application status if workflow is completed
  if (instance.status === 'completed') {
    await Application.findByIdAndUpdate(instance.applicationId._id, {
      workflowStatus: 'completed',
      currentWorkflowStep: instance.currentStep
    });
  }

  res.status(200).json(
    ApiResponse.success(instance, 'Workflow step processed successfully')
  );
});

// Helper function to check permissions
const hasPermissionForStep = (user, step) => {
  // Use organizationRole if available, otherwise fall back to role/userType
  const userRole = user.organizationRole || user.role || user.userType;
  
  switch (step.role) {
    case 'super_admin':
      return userRole === 'admin_owner' || userRole === 'superadmin';
    case 'admin':
      return ['admin_owner', 'admin_employee', 'superadmin', 'admin'].includes(userRole);
    case 'hr_admin':
      return ['admin_owner', 'admin_employee', 'superadmin', 'admin', 'hr_admin'].includes(userRole);
    case 'client':
      return ['client_owner', 'client_employee', 'client'].includes(userRole);
    case 'vendor':
      return ['vendor_owner', 'vendor_employee', 'vendor'].includes(userRole);
    default:
      return false;
  }
};

module.exports = {
  getWorkflowConfigurations,
  getWorkflowConfiguration,
  createWorkflowConfiguration,
  updateWorkflowConfiguration,
  deleteWorkflowConfiguration,
  getWorkflowInstances,
  getWorkflowInstance,
  processWorkflowStep
}; 