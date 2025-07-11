const Application = require('../models/Application');
const Requirement = require('../models/Requirement');
const Resource = require('../models/Resource');
const ApplicationHistory = require('../models/ApplicationHistory');
const WorkflowConfiguration = require('../models/WorkflowConfiguration');
const WorkflowInstance = require('../models/WorkflowInstance');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');
const { createNotification } = require('./notificationController');
const User = require('../models/User');
const { 
  getActiveApplicationsQuery, 
  getActiveStatuses, 
  getInactiveStatuses,
  getStatusCategory 
} = require('../utils/applicationStatusMapping');

// @desc    Get all applications
// @route   GET /api/applications
// @access  Private
const getApplications = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    status,
    requirementId,
    resourceId,
    vendorId,
    clientId
  } = req.query;

  // Build query
  let query = {};

  if (status) {
    // Handle both single status and comma-separated statuses for OR logic
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else if (typeof status === 'string' && status.includes(',')) {
      // Split comma-separated statuses
      const statusArray = status.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    } else {
      query.status = status;
    }
  }

  if (requirementId) {
    query.requirement = requirementId;
  }

  if (resourceId) {
    query.resource = resourceId;
  }

  // For vendor-specific applications
  if (vendorId) {
    // Get the vendor user to check if they have an organization
    const vendor = await User.findById(vendorId).lean();
    
    if (vendor && vendor.userType === 'vendor') {
      if (vendor.organizationId) {
        // Get resources that belong to the vendor's organization
        const vendorResources = await Resource.find({ 
          organizationId: vendor.organizationId 
        }).select('_id').lean();
        const vendorResourceIds = vendorResources.map(res => res._id);
        query.resource = { $in: vendorResourceIds };
      } else {
        // Fallback to resource-based filtering for vendors without organization
        const vendorResources = await Resource.find({ createdBy: vendorId }).select('_id').lean();
        const vendorResourceIds = vendorResources.map(res => res._id);
        query.resource = { $in: vendorResourceIds };
      }
    }
  }

  // For client-specific applications
  if (clientId) {
    // Find requirements created by this client
    const clientRequirements = await Requirement.find({ createdBy: clientId }).select('_id').lean();
    const requirementIds = clientRequirements.map(req => req._id);
    
    // Applications where client is the requirement owner
    query.requirement = { $in: requirementIds };
  }

  // Execute query with pagination - OPTIMIZED
  const applications = await Application.find(query)
    .populate('requirement', 'title status priority')
    .populate('resource', 'name status category')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await Application.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      applications,
      'Applications retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    )
  );
});

// @desc    Get vendor applications
// @route   GET /api/applications/vendor
// @access  Private (Vendor only)
const getVendorApplications = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    status
  } = req.query;

  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  // Build query - filter by vendor's resources (CORRECTED LOGIC)
  let query = {};

  if (req.user.userType === 'vendor') {
    // For vendors, we want to show ALL applications for their resources
    // regardless of the application's organizationId, since applications can come from different clients
    if (req.user.organizationId) {
      // Get resources that belong to the vendor's organization
      const vendorResources = await Resource.find({ 
        organizationId: req.user.organizationId 
      }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds };
    } else {
      // Fallback to resource-based filtering for vendors without organization
      const vendorResources = await Resource.find({ createdBy: vendorId }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds };
    }
  }

  if (status) {
    // Handle both single status and comma-separated statuses for OR logic
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else if (typeof status === 'string' && status.includes(',')) {
      // Split comma-separated statuses
      const statusArray = status.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    } else {
      query.status = status;
    }
  }

  // Execute query with pagination - OPTIMIZED
  const applications = await Application.find(query)
    .populate('requirement', 'title status priority createdBy')
    .populate('resource', 'name status category createdBy')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await Application.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      applications,
      'Vendor applications retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    )
  );
});

// @desc    Get client applications
// @route   GET /api/applications/client
// @access  Private (Client only)
const getClientApplications = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    status,
    requirementId
  } = req.query;

  // Get client ID from JWT token
  const clientId = req.user.id;

  // Build query - filter by client's requirements (CORRECTED LOGIC)
  let query = {};

  // For clients, we want to show ALL applications for their requirements
  // regardless of the application's organizationId, since applications can come from different vendors
  if (req.user.userType === 'client') {
    if (req.user.organizationId) {
      // Get requirements that belong to the client's organization
      const clientRequirements = await Requirement.find({ 
        organizationId: req.user.organizationId 
      }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds };
    } else {
      // Fallback to requirement-based filtering for clients without organization
      const clientRequirements = await Requirement.find({ createdBy: clientId }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds };
    }
  }

  if (status) {
    // Handle both single status and comma-separated statuses for OR logic
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else if (typeof status === 'string' && status.includes(',')) {
      // Split comma-separated statuses
      const statusArray = status.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    } else {
      query.status = status;
    }
  }

  // Filter by specific requirement if provided
  if (requirementId) {
    query.requirement = requirementId;
  }

  // Execute query with pagination - OPTIMIZED
  const applications = await Application.find(query)
    .populate('requirement', 'title status priority')
    .populate('resource', 'name status category')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await Application.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      applications,
      'Client applications retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    )
  );
});

// @desc    Get single application
// @route   GET /api/applications/:id
// @access  Private
const getApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id)
    .populate('requirement', 'title description status priority category')
    .populate('resource', 'name description status category')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  res.status(200).json(
    ApiResponse.success(application, 'Application retrieved successfully')
  );
});

// @desc    Get application history
// @route   GET /api/applications/:id/history
// @access  Private
const getApplicationHistory = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id)
    .populate('requirement', 'title status priority')
    .populate('resource', 'name status category')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  const history = await ApplicationHistory.find({ application: req.params.id })
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

  // Add application details to the response
  const responseData = {
    application: {
      _id: application._id,
      status: application.status,
      requirement: application.requirement,
      resource: application.resource,
      createdBy: application.createdBy,
      createdAt: application.createdAt
    },
    history: history
  };

  res.status(200).json(
    ApiResponse.success(responseData, 'Application history retrieved successfully')
  );
});

// @desc    Create new application
// @route   POST /api/applications
// @access  Private
const createApplication = asyncHandler(async (req, res, next) => {
  const { requirement: requirementId, resource: resourceId, notes, proposedRate, availability } = req.body;

  // Validate requirement exists
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) {
    return next(new ErrorResponse('Requirement not found', 404));
  }

  // Validate resource exists
  const resource = await Resource.findById(resourceId);
  if (!resource) {
    return next(new ErrorResponse('Resource not found', 404));
  }

  // Check if application already exists
  const existingApplication = await Application.findOne({
    requirement: requirementId,
    resource: resourceId
  });

  if (existingApplication) {
    return next(new ErrorResponse('Application already exists for this resource and requirement', 400));
  }

  // Create application with user ID from token
  const applicationData = {
    requirement: requirementId,
    resource: resourceId,
    notes,
    proposedRate,
    availability,
    createdBy: req.user.id,
    updatedBy: req.user.id,
    status: 'applied'
  };

  // Add organizationId for both vendor and client applications
  if (req.user.organizationId) {
    applicationData.organizationId = req.user.organizationId;
    console.log('🔧 ApplicationController: Adding organizationId to application:', req.user.organizationId);
  } else {
    return next(new ErrorResponse('User must belong to an organization to create applications', 400));
  }

  const application = await Application.create(applicationData);

  // Populate related fields for response
  const populatedApplication = await Application.findById(application._id)
    .populate('requirement', 'title status priority')
    .populate('resource', 'name status category')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  // Create initial history entry
  const historyData = {
    application: application._id,
    status: 'applied',
    notes: notes || 'Application submitted',
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  // Add organizationId for application history
  if (req.user.organizationId) {
    historyData.organizationId = req.user.organizationId;
    console.log('🔧 ApplicationController: Adding organizationId to application history:', req.user.organizationId);
  }

  await ApplicationHistory.create(historyData);

  // Create notification for requirement owner
  if (requirement.createdBy.toString() !== req.user.id) {
    await createNotification({
      recipient: requirement.createdBy,
      type: 'new_application',
      title: 'New Application Received',
      message: `A new application has been submitted for your requirement: ${requirement.title}`,
      relatedRequirement: requirementId,
      actionUrl: `/requirements/${requirementId}/applications`
    });
  }

  // Start workflow if configured
  try {
    await startWorkflowForApplication(application._id, req.user.userType);
  } catch (workflowError) {
    console.error('Error starting workflow for application:', workflowError);
    // Don't fail the application creation if workflow fails
  }

  res.status(201).json(
    ApiResponse.success(populatedApplication, 'Application created successfully')
  );
});

// Helper function to start workflow for application
const startWorkflowForApplication = async (applicationId, userType) => {
  // Determine application type based on user type
  const applicationType = userType === 'client' ? 'client_applied' : 'vendor_applied';
  
  // Find default workflow for this application type
  const defaultWorkflow = await WorkflowConfiguration.findOne({
    applicationTypes: { $in: [applicationType, 'both'] },
    isActive: true,
    isDefault: true
  });

  if (!defaultWorkflow) {
    console.log(`No default workflow found for application type: ${applicationType}`);
    return;
  }

  // Create workflow instance
  const workflowInstance = await WorkflowInstance.create({
    applicationId: applicationId,
    workflowConfigurationId: defaultWorkflow._id,
    currentStep: 1,
    status: 'active',
    steps: defaultWorkflow.steps.map(step => ({
      stepId: step._id || `step_${step.order}`,
      stepName: step.name,
      order: step.order,
      role: step.role,
      action: step.action,
      status: 'pending',
      required: step.required,
      autoAdvance: step.autoAdvance
    }))
  });

  // Update application with workflow info
  await Application.findByIdAndUpdate(applicationId, {
    workflowInstanceId: workflowInstance._id,
    workflowStatus: 'in_progress',
    currentWorkflowStep: 1
  });

  console.log(`Workflow started for application ${applicationId}: ${defaultWorkflow.name}`);
};

// @desc    Update application status
// @route   PUT /api/applications/:id/status
// @access  Private
const updateApplicationStatus = asyncHandler(async (req, res, next) => {
  console.log('🔧 ApplicationController: updateApplicationStatus called with:', {
    applicationId: req.params.id,
    body: req.body,
    user: { id: req.user.id, userType: req.user.userType, organizationRole: req.user.organizationRole }
  });
  const { 
    status, 
    notes, 
    decisionReason, 
    notifyCandidate, 
    notifyClient, 
    followUpRequired, 
    followUpDate, 
    followUpNotes 
  } = req.body;

  if (!status) {
    return next(new ErrorResponse('Status is required', 400));
  }

  // Validate that the status is a valid application status
  const validStatuses = [...getActiveStatuses(), ...getInactiveStatuses()];
  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`, 400));
  }

  let application = await Application.findById(req.params.id).select('+organizationId');

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  // Check authorization based on user role and current status
  const requirement = await Requirement.findById(application.requirement);
  const resource = await Resource.findById(application.resource);
  
  if (!requirement) {
    return next(new ErrorResponse('Associated requirement not found', 404));
  }

  if (!resource) {
    return next(new ErrorResponse('Associated resource not found', 404));
  }

  const isRequirementOwner = requirement.createdBy.toString() === req.user.id;
  const isResourceOwner = resource.createdBy.toString() === req.user.id;
  const isAdmin = req.user.userType === 'admin' || req.user.organizationRole?.includes('admin');
  const isClient = req.user.userType === 'client' || req.user.organizationRole?.includes('client');
  const isVendor = req.user.userType === 'vendor' || req.user.organizationRole?.includes('vendor');

  // Check if user has permission to update status based on current status and role
  let hasPermission = false;
  const currentStatus = application.status;

  // Admin can update any status
  if (isAdmin) {
    hasPermission = true;
  }
  // Client can update status in their process flow
  else if (isClient && isRequirementOwner) {
    // When status is 'applied', client can only reject (admin must shortlist first)
    if (currentStatus === 'applied') {
      hasPermission = status === 'rejected';
    } else if (currentStatus === 'offer_created') {
      // When offer is created, client can only remove offer (withdraw)
      hasPermission = status === 'withdrawn';
    } else {
      // For other statuses, client can update to these statuses
      const clientAllowedStatuses = ['shortlisted', 'interview', 'accepted', 'offer_created', 'rejected'];
      hasPermission = clientAllowedStatuses.includes(status);
    }
  }
  // Vendor can only revoke (withdraw) at any point
  else if (isVendor && (isResourceOwner || application.createdBy.toString() === req.user.id)) {
    hasPermission = status === 'withdrawn';
  }

  if (!hasPermission) {
    return next(
      new ErrorResponse('Not authorized to update this application status. Check your role and the current application status.', 403)
    );
  }

  // Save previous status for history
  const previousStatus = application.status;

  // Special logic for admin approval - automatically set to shortlisted
  let finalStatus = status;
  if (isAdmin && status === 'accepted' && currentStatus === 'applied') {
    finalStatus = 'shortlisted';
  }

  // Update application
  const updateData = { status: finalStatus };
  if (notes) {
    updateData.notes = notes;
  }
  updateData.updatedBy = req.user.id;
  updateData.updatedAt = Date.now();

  application = await Application.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  )
    .select('+organizationId')
    .populate('requirement', 'title status priority')
    .populate('resource', 'name status category')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  // Create enhanced history entry with all decision data
  const historyData = {
    application: application._id,
    previousStatus,
    status,
    notes: notes || `Status changed from ${previousStatus} to ${status}`,
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  // Add enhanced decision data if provided
  if (decisionReason) {
    historyData.decisionReason = {
      category: decisionReason.category,
      details: decisionReason.details,
      rating: decisionReason.rating,
      criteria: decisionReason.criteria || [],
      notes: decisionReason.notes
    };
  }

  // Add notification preferences
  if (notifyCandidate !== undefined) {
    historyData.notifyCandidate = notifyCandidate;
  }

  if (notifyClient !== undefined) {
    historyData.notifyClient = notifyClient;
  }

  // Add follow-up data
  if (followUpRequired !== undefined) {
    historyData.followUpRequired = followUpRequired;
  }

  if (followUpDate) {
    historyData.followUpDate = new Date(followUpDate);
  }

  if (followUpNotes) {
    historyData.followUpNotes = followUpNotes;
  }

  // Add organizationId for application history - use application's organizationId
  historyData.organizationId = application.organizationId;
  console.log('🔧 ApplicationController: Adding organizationId to application history:', application.organizationId);
  console.log('🔧 ApplicationController: History data to be created:', JSON.stringify(historyData, null, 2));

  try {
    const historyEntry = await ApplicationHistory.create(historyData);
    console.log('✅ ApplicationController: History entry created successfully:', historyEntry._id);
  } catch (error) {
    console.error('❌ ApplicationController: Error creating history entry:', error);
    // Don't fail the status update if history creation fails
  }

  // Create notification for application creator
  await createNotification({
    recipient: application.createdBy,
    type: 'application_status_change',
    title: 'Application Status Updated',
    message: `Your application for ${requirement.title} has been ${finalStatus}`,
    relatedRequirement: requirement._id,
    actionUrl: `/applications/${application._id}`
  });

  // Send notifications if requested
  if (notifyCandidate && application.createdBy.toString() !== req.user.id) {
    await createNotification({
      recipient: application.createdBy,
      type: 'application_status_change',
      title: 'Application Status Update',
      message: `Your application for ${requirement.title} has been ${finalStatus}${decisionReason?.notes ? `: ${decisionReason.notes}` : ''}`,
      relatedRequirement: requirement._id,
      actionUrl: `/applications/${application._id}`
    });
  }

  if (notifyClient && requirement.createdBy.toString() !== req.user.id) {
    await createNotification({
      recipient: requirement.createdBy,
      type: 'application_status_change',
      title: 'Application Status Update',
      message: `Application for ${requirement.title} has been ${finalStatus} by ${req.user.firstName} ${req.user.lastName}`,
      relatedRequirement: requirement._id,
      actionUrl: `/applications/${application._id}`
    });
  }

  // Process workflow step if application has workflow
  if (application.workflowInstanceId) {
    try {
      await processWorkflowStepForApplication(application._id, req.user, finalStatus, notes);
    } catch (workflowError) {
      console.error('Error processing workflow step:', workflowError);
      // Don't fail the status update if workflow processing fails
    }
  }

  // Get status category for response
  const statusCategory = getStatusCategory(finalStatus);

  res.status(200).json(
    ApiResponse.success({
      application,
      statusCategory,
      previousStatus,
      newStatus: finalStatus
    }, 'Application status updated successfully')
  );
});

// Helper function to process workflow step for application
const processWorkflowStepForApplication = async (applicationId, user, action, comments) => {
  const application = await Application.findById(applicationId).populate('workflowInstanceId');
  
  if (!application.workflowInstanceId) {
    return;
  }

  const workflowInstance = application.workflowInstanceId;
  const currentStep = workflowInstance.steps.find(step => step.order === workflowInstance.currentStep);
  
  if (!currentStep) {
    console.log(`No current step found for workflow instance ${workflowInstance._id}`);
    return;
  }

  // Check if user has permission for this step
  if (!hasPermissionForWorkflowStep(user, currentStep)) {
    console.log(`User ${user.id} does not have permission for step ${currentStep.stepName}`);
    return;
  }

  // Update step status
  currentStep.status = 'completed';
  currentStep.completedAt = new Date();
  currentStep.performedBy = user.id;
  currentStep.actionTaken = action;
  currentStep.comments = comments;

  // Update workflow instance
  workflowInstance.currentStep = workflowInstance.currentStep + 1;
  
  // Check if workflow is completed
  if (workflowInstance.currentStep > workflowInstance.steps.length) {
    workflowInstance.status = 'completed';
    workflowInstance.completedAt = new Date();
    
    // Update application workflow status
    await Application.findByIdAndUpdate(applicationId, {
      workflowStatus: 'completed',
      currentWorkflowStep: workflowInstance.currentStep
    });
  }

  await workflowInstance.save();
  console.log(`Workflow step completed for application ${applicationId}: ${currentStep.stepName}`);
};

// Helper function to check permissions for workflow step
const hasPermissionForWorkflowStep = (user, step) => {
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

// @desc    Update application details
// @route   PUT /api/applications/:id
// @access  Private
const updateApplication = asyncHandler(async (req, res, next) => {
  const { notes, proposedRate, availability } = req.body;

  let application = await Application.findById(req.params.id);

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  // Check authorization - only application creator can update details
  if (application.createdBy.toString() !== req.user.id && req.user.userType !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to update this application', 403)
    );
  }

  // Update application
  const updateData = {};
  if (notes !== undefined) updateData.notes = notes;
  if (proposedRate) updateData.proposedRate = proposedRate;
  if (availability) updateData.availability = availability;
  updateData.updatedBy = req.user.id;
  updateData.updatedAt = Date.now();

  application = await Application.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  )
    .populate('requirement', 'title status priority')
    .populate('resource', 'name status category')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  // Create history entry
  const historyData = {
    application: application._id,
    status: application.status,
    notes: 'Application details updated',
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  // Add organizationId for application history
  if (req.user.organizationId) {
    historyData.organizationId = req.user.organizationId;
    console.log('🔧 ApplicationController: Adding organizationId to application history:', req.user.organizationId);
  }

  await ApplicationHistory.create(historyData);

  res.status(200).json(
    ApiResponse.success(application, 'Application updated successfully')
  );
});

// @desc    Delete application
// @route   DELETE /api/applications/:id
// @access  Private
const deleteApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id);

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  // Check authorization - only application creator can delete
  if (application.createdBy.toString() !== req.user.id && req.user.userType !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to delete this application', 403)
    );
  }

  // Create final history entry before deletion
  const historyData = {
    application: application._id,
    previousStatus: application.status,
    status: 'deleted',
    notes: 'Application was deleted',
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  // Add organizationId for application history
  if (req.user.organizationId) {
    historyData.organizationId = req.user.organizationId;
    console.log('🔧 ApplicationController: Adding organizationId to application history:', req.user.organizationId);
  }

  await ApplicationHistory.create(historyData);

  await application.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'Application deleted successfully')
  );
});

// @desc    Get application counts for requirements
// @route   GET /api/applications/counts/requirements
// @access  Private
const getApplicationCountsForRequirements = asyncHandler(async (req, res, next) => {
  const { requirementIds } = req.query;
  
  if (!requirementIds) {
    return next(new ErrorResponse('Requirement IDs are required', 400));
  }

  // Parse requirement IDs (can be comma-separated string or array)
  let requirementIdArray;
  if (typeof requirementIds === 'string') {
    requirementIdArray = requirementIds.split(',');
  } else if (Array.isArray(requirementIds)) {
    requirementIdArray = requirementIds;
  } else {
    return next(new ErrorResponse('Invalid requirement IDs format', 400));
  }

  // Build query based on user type
  let query = { requirement: { $in: requirementIdArray } };

  // For clients, we want to count ALL applications for their requirements
  // regardless of organizationId, since applications can come from different vendors
  if (req.user.userType === 'client') {
    // For clients, we only need to ensure the requirements belong to them
    // The applications can be from any vendor/organization
    if (req.user.organizationId) {
      // Get requirements that belong to the client's organization
      const clientRequirements = await Requirement.find({ 
        organizationId: req.user.organizationId,
        _id: { $in: requirementIdArray }
      }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds };
    } else {
      // Fallback to requirement-based filtering for clients without organization
      const clientRequirements = await Requirement.find({ createdBy: req.user.id }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds.filter(id => requirementIdArray.includes(id.toString())) };
    }
  }

  // For vendors, filter by their resources
  if (req.user.userType === 'vendor') {
    // For vendors, we want to count ALL applications for their resources
    // regardless of the application's organizationId, since applications can come from different clients
    if (req.user.organizationId) {
      // Get resources that belong to the vendor's organization
      const vendorResources = await Resource.find({ 
        organizationId: req.user.organizationId
      }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds };
    } else {
      // Fallback to resource-based filtering for vendors without organization
      const vendorResources = await Resource.find({ createdBy: req.user.id }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds };
    }
  }

  // Aggregate to get counts for each requirement - OPTIMIZED
  const counts = await Application.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$requirement',
        count: { $sum: 1 }
      }
    }
  ]).allowDiskUse(true); // Allow disk use for large datasets

  // Convert to object with requirement ID as key
  const countsMap = {};
  counts.forEach(item => {
    countsMap[item._id.toString()] = item.count;
  });

  // Ensure all requested requirement IDs are included (with 0 count if no applications)
  requirementIdArray.forEach(reqId => {
    if (!countsMap[reqId]) {
      countsMap[reqId] = 0;
    }
  });

  res.status(200).json(
    ApiResponse.success(countsMap, 'Application counts retrieved successfully')
  );
});

// @desc    Get application counts for resources
// @route   GET /api/applications/counts/resources
// @access  Private
const getApplicationCountsForResources = asyncHandler(async (req, res, next) => {
  const { resourceIds } = req.query;
  
  if (!resourceIds) {
    return next(new ErrorResponse('Resource IDs are required', 400));
  }

  // Parse resource IDs (can be comma-separated string or array)
  let resourceIdArray;
  if (typeof resourceIds === 'string') {
    resourceIdArray = resourceIds.split(',');
  } else if (Array.isArray(resourceIds)) {
    resourceIdArray = resourceIds;
  } else {
    return next(new ErrorResponse('Invalid resource IDs format', 400));
  }

  // Build query based on user type
  let query = { resource: { $in: resourceIdArray } };

  // For vendors, we want to count applications for their resources
  if (req.user.userType === 'vendor') {
    // For vendors, we want to count ALL applications for their resources
    // regardless of the application's organizationId, since applications can come from different clients
    if (req.user.organizationId) {
      // Get resources that belong to the vendor's organization
      const vendorResources = await Resource.find({ 
        organizationId: req.user.organizationId,
        _id: { $in: resourceIdArray }
      }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds };
    } else {
      // Fallback to resource-based filtering for vendors without organization
      const vendorResources = await Resource.find({ createdBy: req.user.id }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds.filter(id => resourceIdArray.includes(id.toString())) };
    }
  }

  // For clients, filter by their requirements
  if (req.user.userType === 'client') {
    if (req.user.organizationId) {
      // Get requirements that belong to the client's organization
      const clientRequirements = await Requirement.find({ 
        organizationId: req.user.organizationId
      }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds };
    } else {
      // Fallback to requirement-based filtering for clients without organization
      const clientRequirements = await Requirement.find({ createdBy: req.user.id }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds };
    }
  }

  // Aggregate to get counts for each resource - OPTIMIZED
  const counts = await Application.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$resource',
        count: { $sum: 1 }
      }
    }
  ]).allowDiskUse(true); // Allow disk use for large datasets

  // Convert to object with resource ID as key
  const countsMap = {};
  counts.forEach(item => {
    countsMap[item._id.toString()] = item.count;
  });

  // Ensure all requested resource IDs are included (with 0 count if no applications)
  resourceIdArray.forEach(resId => {
    if (!countsMap[resId]) {
      countsMap[resId] = 0;
    }
  });

  res.status(200).json(
    ApiResponse.success(countsMap, 'Application counts for resources retrieved successfully')
  );
});

// @desc    Get active applications count for a resource
// @route   GET /api/applications/active/resource/:resourceId
// @access  Private
const getActiveApplicationsCountForResource = asyncHandler(async (req, res, next) => {
  const { resourceId } = req.params;

  // Build query for active applications only
  let query = { 
    resource: resourceId,
    ...getActiveApplicationsQuery() // Use the status mapping utility
  };

  // For vendors, ensure they can only check their own resources
  if (req.user.userType === 'vendor') {
    if (req.user.organizationId) {
      // Check if resource belongs to vendor's organization
      const resource = await Resource.findOne({ 
        _id: resourceId,
        organizationId: req.user.organizationId 
      });
      if (!resource) {
        return next(new ErrorResponse('Resource not found or access denied', 404));
      }
    } else {
      // Fallback to user-based ownership
      const resource = await Resource.findOne({ 
        _id: resourceId,
        createdBy: req.user.id 
      });
      if (!resource) {
        return next(new ErrorResponse('Resource not found or access denied', 404));
      }
    }
  }

  // For clients, ensure they can only check applications for their requirements
  if (req.user.userType === 'client') {
    if (req.user.organizationId) {
      // Get requirements that belong to the client's organization
      const clientRequirements = await Requirement.find({ 
        organizationId: req.user.organizationId
      }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds };
    } else {
      // Fallback to requirement-based filtering for clients without organization
      const clientRequirements = await Requirement.find({ createdBy: req.user.id }).select('_id').lean();
      const clientRequirementIds = clientRequirements.map(req => req._id);
      query.requirement = { $in: clientRequirementIds };
    }
  }

  const count = await Application.countDocuments(query);

  res.status(200).json(
    ApiResponse.success({ count }, 'Active applications count retrieved successfully')
  );
});

// @desc    Get active applications count for a requirement
// @route   GET /api/applications/active/requirement/:requirementId
// @access  Private
const getActiveApplicationsCountForRequirement = asyncHandler(async (req, res, next) => {
  const { requirementId } = req.params;

  // Build query for active applications only
  let query = { 
    requirement: requirementId,
    ...getActiveApplicationsQuery() // Use the status mapping utility
  };

  // For clients, ensure they can only check their own requirements
  if (req.user.userType === 'client') {
    if (req.user.organizationId) {
      // Check if requirement belongs to client's organization
      const requirement = await Requirement.findOne({ 
        _id: requirementId,
        organizationId: req.user.organizationId 
      });
      if (!requirement) {
        return next(new ErrorResponse('Requirement not found or access denied', 404));
      }
    } else {
      // Fallback to user-based ownership
      const requirement = await Requirement.findOne({ 
        _id: requirementId,
        createdBy: req.user.id 
      });
      if (!requirement) {
        return next(new ErrorResponse('Requirement not found or access denied', 404));
      }
    }
  }

  // For vendors, ensure they can only check applications for their resources
  if (req.user.userType === 'vendor') {
    if (req.user.organizationId) {
      // Get resources that belong to the vendor's organization
      const vendorResources = await Resource.find({ 
        organizationId: req.user.organizationId
      }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds };
    } else {
      // Fallback to resource-based filtering for vendors without organization
      const vendorResources = await Resource.find({ createdBy: req.user.id }).select('_id').lean();
      const vendorResourceIds = vendorResources.map(res => res._id);
      query.resource = { $in: vendorResourceIds };
    }
  }

  const count = await Application.countDocuments(query);

  res.status(200).json(
    ApiResponse.success({ count }, 'Active applications count retrieved successfully')
  );
});

// @desc    Get application status mapping information
// @route   GET /api/applications/status-mapping
// @access  Private
const getApplicationStatusMapping = asyncHandler(async (req, res, next) => {
  const statusMapping = {
    active: getActiveStatuses(),
    inactive: getInactiveStatuses(),
    all: [...getActiveStatuses(), ...getInactiveStatuses()]
  };

  res.status(200).json(
    ApiResponse.success(statusMapping, 'Application status mapping retrieved successfully')
  );
});

// @desc    Get vendor applications filtered by resource ID
// @route   GET /api/applications/vendor/resource/:resourceId
// @access  Private (Vendor only)
const getVendorApplicationsByResource = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    status
  } = req.query;

  const { resourceId } = req.params;

  // Get vendor ID from JWT token
  const vendorId = req.user.id;

  // Validate that the resource belongs to the vendor
  let resource;
  if (req.user.organizationId) {
    // Check if resource belongs to vendor's organization
    resource = await Resource.findOne({ 
      _id: resourceId,
      organizationId: req.user.organizationId 
    });
  } else {
    // Fallback to user-based ownership
    resource = await Resource.findOne({ 
      _id: resourceId,
      createdBy: vendorId 
    });
  }

  if (!resource) {
    return next(new ErrorResponse('Resource not found or access denied', 404));
  }

  // Build query - filter by specific resource
  let query = { resource: resourceId };

  if (status) {
    // Handle both single status and array of statuses for OR logic
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else {
      query.status = status;
    }
  }

  // Execute query with pagination
  const applications = await Application.find(query)
    .populate('requirement', 'title status priority createdBy')
    .populate('resource', 'name status category createdBy')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await Application.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      applications,
      'Vendor applications for resource retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    )
  );
});

module.exports = {
  getApplications,
  getVendorApplications,
  getClientApplications,
  getApplication,
  getApplicationHistory,
  createApplication,
  updateApplicationStatus,
  updateApplication,
  deleteApplication,
  getApplicationCountsForRequirements,
  getApplicationCountsForResources,
  getVendorApplicationsByResource,
  getActiveApplicationsCountForResource,
  getActiveApplicationsCountForRequirement,
  getApplicationStatusMapping
};