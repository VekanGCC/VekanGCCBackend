const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');

// @desc    Create audit log entry
// @route   POST /api/audit-logs
// @access  Private
const createAuditLog = asyncHandler(async (req, res, next) => {
  const auditData = req.body;
  
  // Create audit log with user context
  const auditLog = await AuditLog.createWithUser(auditData, req.user, req);
  
  res.status(201).json(new ApiResponse(true, 'Audit log created successfully', auditLog));
});

// @desc    Get all audit logs with filters
// @route   GET /api/audit-logs
// @access  Private
const getAuditLogs = asyncHandler(async (req, res, next) => {
  const {
    entityType,
    entityId,
    actionType,
    performedBy,
    organizationId,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = 'performedAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;
  if (actionType) query.actionType = actionType;
  if (performedBy) query['performedBy.userId'] = performedBy;
  if (organizationId) query['performedBy.organizationId'] = organizationId;
  
  if (startDate || endDate) {
    query.performedAt = {};
    if (startDate) query.performedAt.$gte = new Date(startDate);
    if (endDate) query.performedAt.$lte = new Date(endDate);
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with pagination
  const skip = (page - 1) * limit;
  
  const [auditLogs, total] = await Promise.all([
    AuditLog.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('performedBy.userId', 'firstName lastName email')
      .populate('performedBy.organizationId', 'name'),
    AuditLog.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.json(new ApiResponse(true, 'Audit logs retrieved successfully', {
    docs: auditLogs,
    totalDocs: total,
    limit: parseInt(limit),
    totalPages,
    page: parseInt(page),
    pagingCounter: skip + 1,
    hasPrevPage,
    hasNextPage,
    prevPage: hasPrevPage ? page - 1 : null,
    nextPage: hasNextPage ? page + 1 : null
  }));
});

// @desc    Get audit trail for specific entity
// @route   GET /api/audit-logs/entity/:entityType/:entityId
// @access  Private
const getEntityAuditTrail = asyncHandler(async (req, res, next) => {
  const { entityType, entityId } = req.params;
  const { actionType, startDate, endDate, limit = 100 } = req.query;

  const options = {
    actionType,
    startDate,
    endDate,
    limit: parseInt(limit)
  };

  const auditLogs = await AuditLog.getEntityAuditTrail(entityType, entityId, options);

  res.json(new ApiResponse(true, 'Audit trail retrieved successfully', auditLogs));
});

// @desc    Get audit trail summary for entity
// @route   GET /api/audit-logs/entity/:entityType/:entityId/summary
// @access  Private
const getAuditTrailSummary = asyncHandler(async (req, res, next) => {
  const { entityType, entityId } = req.params;

  const summary = await AuditLog.getAuditSummary(entityType, entityId);
  
  if (!summary || summary.length === 0) {
    return next(new ErrorResponse('No audit trail found for this entity', 404));
  }

  // Get timeline data
  const timeline = await AuditLog.aggregate([
    { $match: { entityType, entityId } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$performedAt' }
        },
        actions: { $push: '$$ROOT' }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 30 }
  ]);

  const result = {
    ...summary[0],
    timeline: timeline.map(day => ({
      date: day._id,
      actions: day.actions
    }))
  };

  res.json(new ApiResponse(true, 'Audit trail summary retrieved successfully', result));
});

// @desc    Get audit logs by organization
// @route   GET /api/audit-logs/organization
// @access  Private
const getOrganizationAuditLogs = asyncHandler(async (req, res, next) => {
  const { organizationId } = req.query;
  
  if (!organizationId) {
    return next(new ErrorResponse('Organization ID is required', 400));
  }

  // Check if user has access to this organization
  if (req.user.organizationId.toString() !== organizationId && req.user.organizationRole !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this organization\'s audit logs', 403));
  }

  const query = { 'performedBy.organizationId': organizationId };
  
  // Add other filters from query params
  const { actionType, startDate, endDate, page = 1, limit = 20 } = req.query;
  
  if (actionType) query.actionType = actionType;
  if (startDate || endDate) {
    query.performedAt = {};
    if (startDate) query.performedAt.$gte = new Date(startDate);
    if (endDate) query.performedAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  
  const [auditLogs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ performedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('performedBy.userId', 'firstName lastName email'),
    AuditLog.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json(new ApiResponse(true, 'Organization audit logs retrieved successfully', {
    docs: auditLogs,
    totalDocs: total,
    limit: parseInt(limit),
    totalPages,
    page: parseInt(page),
    pagingCounter: skip + 1,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null
  }));
});

// @desc    Get audit logs by user
// @route   GET /api/audit-logs/user
// @access  Private
const getUserAuditLogs = asyncHandler(async (req, res, next) => {
  const { userId } = req.query;
  
  if (!userId) {
    return next(new ErrorResponse('User ID is required', 400));
  }

  // Check if user has access to this user's audit logs
  if (req.user._id.toString() !== userId && req.user.organizationRole !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this user\'s audit logs', 403));
  }

  const query = { 'performedBy.userId': userId };
  
  // Add other filters from query params
  const { actionType, startDate, endDate, page = 1, limit = 20 } = req.query;
  
  if (actionType) query.actionType = actionType;
  if (startDate || endDate) {
    query.performedAt = {};
    if (startDate) query.performedAt.$gte = new Date(startDate);
    if (endDate) query.performedAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  
  const [auditLogs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ performedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('performedBy.organizationId', 'name'),
    AuditLog.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json(new ApiResponse(true, 'User audit logs retrieved successfully', {
    docs: auditLogs,
    totalDocs: total,
    limit: parseInt(limit),
    totalPages,
    page: parseInt(page),
    pagingCounter: skip + 1,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null
  }));
});

// @desc    Export audit logs
// @route   GET /api/audit-logs/export
// @access  Private
const exportAuditLogs = asyncHandler(async (req, res, next) => {
  const { format = 'csv', ...queryParams } = req.query;

  // Build query (same as getAuditLogs)
  const query = {};
  
  if (queryParams.entityType) query.entityType = queryParams.entityType;
  if (queryParams.entityId) query.entityId = queryParams.entityId;
  if (queryParams.actionType) query.actionType = queryParams.actionType;
  if (queryParams.performedBy) query['performedBy.userId'] = queryParams.performedBy;
  if (queryParams.organizationId) query['performedBy.organizationId'] = queryParams.organizationId;
  
  if (queryParams.startDate || queryParams.endDate) {
    query.performedAt = {};
    if (queryParams.startDate) query.performedAt.$gte = new Date(queryParams.startDate);
    if (queryParams.endDate) query.performedAt.$lte = new Date(queryParams.endDate);
  }

  const auditLogs = await AuditLog.find(query)
    .sort({ performedAt: -1 })
    .populate('performedBy.userId', 'firstName lastName email')
    .populate('performedBy.organizationId', 'name');

  let data, contentType, filename;

  if (format === 'csv') {
    // Convert to CSV
    const csvHeaders = [
      'Date', 'Action', 'Action Type', 'Entity Type', 'Entity ID', 
      'Performed By', 'Organization', 'IP Address', 'Comments'
    ];
    
    const csvData = auditLogs.map(log => [
      log.performedAt.toISOString(),
      log.action,
      log.actionType,
      log.entityType,
      log.entityId,
      `${log.performedBy.firstName} ${log.performedBy.lastName}`,
      log.performedBy.organizationId?.name || 'N/A',
      log.ipAddress || 'N/A',
      log.comments || 'N/A'
    ]);

    data = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    contentType = 'text/csv';
    filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  } else if (format === 'json') {
    data = JSON.stringify(auditLogs, null, 2);
    contentType = 'application/json';
    filename = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
  } else {
    return next(new ErrorResponse('Unsupported export format', 400));
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(data);
});

// @desc    Get audit log statistics
// @route   GET /api/audit-logs/statistics
// @access  Private
const getAuditStatistics = asyncHandler(async (req, res, next) => {
  const { organizationId, startDate, endDate } = req.query;

  const matchStage = {};
  
  if (organizationId) {
    matchStage['performedBy.organizationId'] = organizationId;
  }
  
  if (startDate || endDate) {
    matchStage.performedAt = {};
    if (startDate) matchStage.performedAt.$gte = new Date(startDate);
    if (endDate) matchStage.performedAt.$lte = new Date(endDate);
  }

  const stats = await AuditLog.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        actionsByType: {
          $push: '$actionType'
        },
        actionsByEntityType: {
          $push: '$entityType'
        },
        uniqueUsers: {
          $addToSet: '$performedBy.userId'
        },
        uniqueOrganizations: {
          $addToSet: '$performedBy.organizationId'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalActions: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        uniqueOrganizations: { $size: '$uniqueOrganizations' },
        actionsByType: {
          $reduce: {
            input: '$actionsByType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                { $literal: { '$$this': { $add: [{ $indexOfArray: ['$actionsByType', '$$this'] }, 1] } } }
              ]
            }
          }
        },
        actionsByEntityType: {
          $reduce: {
            input: '$actionsByEntityType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                { $literal: { '$$this': { $add: [{ $indexOfArray: ['$actionsByEntityType', '$$this'] }, 1] } } }
              ]
            }
          }
        }
      }
    }
  ]);

  res.json(new ApiResponse(true, 'Audit statistics retrieved successfully', stats[0] || {}));
});

// @desc    Get single audit log
// @route   GET /api/audit-logs/:id
// @access  Private
const getAuditLog = asyncHandler(async (req, res, next) => {
  const auditLog = await AuditLog.findById(req.params.id)
    .populate('performedBy.userId', 'firstName lastName email')
    .populate('performedBy.organizationId', 'name');

  if (!auditLog) {
    return next(new ErrorResponse('Audit log not found', 404));
  }

  res.json(new ApiResponse(true, 'Audit log retrieved successfully', auditLog));
});

module.exports = {
  createAuditLog,
  getAuditLogs,
  getEntityAuditTrail,
  getAuditTrailSummary,
  getOrganizationAuditLogs,
  getUserAuditLogs,
  exportAuditLogs,
  getAuditStatistics,
  getAuditLog
}; 