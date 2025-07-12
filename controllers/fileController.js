const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');
const { isAdmin } = require('../utils/adminRoleHelper');
const File = require('../models/File');
const User = require('../models/User');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Helper function to calculate file hash
const calculateFileHash = async (filePath) => {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch (error) {
    console.error('Error calculating file hash:', error);
    return null;
  }
};

// @desc    Upload file
// @route   POST /api/files/upload
// @access  Private
const uploadFile = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse('No file uploaded', 400));
  }

  const { entityType, entityId, category, description, isPublic, tags } = req.body;

  // Validate required fields
  if (!entityType || !entityId) {
    return next(new ErrorResponse('Entity type and entity ID are required', 400));
  }

  // Enforce correct MIME types based on file extension
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let correctedMimeType = req.file.mimetype;
  
  // Override MIME type for common file types
  if (fileExtension === '.pdf') {
    correctedMimeType = 'application/pdf';
  } else if (fileExtension === '.doc') {
    correctedMimeType = 'application/msword';
  } else if (fileExtension === '.docx') {
    correctedMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (fileExtension === '.png') {
    correctedMimeType = 'image/png';
  } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
    correctedMimeType = 'image/jpeg';
  }

  // Create file record
  const fileData = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path.replace(/\\/g, '/'),
    mimetype: correctedMimeType,
    size: req.file.size,
    extension: fileExtension,
    uploadedBy: req.user.id,
    entityType,
    entityId,
    category: category || 'other',
    description: description || '',
    isPublic: isPublic === 'true',
    tags: tags ? tags.split(',').map(tag => tag.trim()) : []
  };

  const file = await File.create(fileData);

  // Populate uploader info
  await file.populate('uploadedBy', 'firstName lastName email');

  res.status(201).json(
    ApiResponse.success(file, 'File uploaded successfully')
  );
});

// @desc    Get files by entity
// @route   GET /api/files/entity/:entityType/:entityId
// @access  Private
const getFilesByEntity = asyncHandler(async (req, res, next) => {
  const { entityType, entityId } = req.params;
  const { category, approvalStatus, page = 1, limit = 10 } = req.query;

  // Build query
  let query = { entityType, entityId };

  // Add filters
  if (category) {
    query.category = category;
  }

  if (approvalStatus) {
    query.approvalStatus = approvalStatus;
  }

  // Enhanced permission check for cross-access
  if (!isAdmin(req.user)) {
    // Build permission query
    let permissionQuery = { $or: [] };

    // File owner can always see their files
    permissionQuery.$or.push({ uploadedBy: req.user.id });

    // Public files are visible to everyone
    permissionQuery.$or.push({ isPublic: true });

    // Cross-access permissions based on user role and entity type
    if (req.user.userType === 'client') {
      // Clients can see:
      // 1. All resource attachments (from any vendor)
      // 2. Their own requirement attachments
      if (entityType === 'resource') {
        permissionQuery.$or.push({ entityType: 'resource' }); // All resource files
      } else if (entityType === 'requirement') {
        // Check if the requirement belongs to this client
        const Requirement = require('../models/Requirement');
        const requirement = await Requirement.findById(entityId);
        if (requirement && requirement.clientId.toString() === req.user.id) {
          permissionQuery.$or.push({ entityType: 'requirement', entityId: entityId }); // Client's own requirement files
        }
      }
    } else if (req.user.userType === 'vendor') {
      // Vendors can see:
      // 1. All requirement attachments (from any client)
      // 2. Their own resource attachments
      if (entityType === 'requirement') {
        permissionQuery.$or.push({ entityType: 'requirement' }); // All requirement files
      } else if (entityType === 'resource') {
        // Check if the resource belongs to this vendor
        const Resource = require('../models/Resource');
        const resource = await Resource.findById(entityId);
        if (resource && resource.createdBy.toString() === req.user.id) {
          permissionQuery.$or.push({ entityType: 'resource', entityId: entityId }); // Vendor's own resource files
        }
      }
    }

    // Combine the main query with permission query
    query = { $and: [query, permissionQuery] };
  }

  const files = await File.find(query)
    .populate('uploadedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await File.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(files, 'Files retrieved successfully', {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  );
});

// @desc    Get file by ID
// @route   GET /api/files/:id
// @access  Private
const getFile = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id)
    .populate('uploadedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email');

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  // Enhanced permission check for cross-access (same as downloadFile)
  let hasPermission = false;

  // Admin can access everything
  if (isAdmin(req.user)) {
    hasPermission = true;
  }
  // File owner can always access their files
  else if (file.uploadedBy._id.toString() === req.user.id) {
    hasPermission = true;
  }
  // Public files are accessible to everyone
  else if (file.isPublic) {
    hasPermission = true;
  }
  // Cross-access permissions based on user role and entity type
  else {
    if (req.user.userType === 'client') {
      // Clients can access:
      // 1. All resource attachments (from any vendor)
      // 2. Their own requirement attachments
      if (file.entityType === 'resource') {
        hasPermission = true; // Clients can access all resource attachments
      } else if (file.entityType === 'requirement') {
        // Check if the requirement belongs to this client
        const Requirement = require('../models/Requirement');
        const requirement = await Requirement.findById(file.entityId);
        if (requirement && requirement.clientId.toString() === req.user.id) {
          hasPermission = true; // Client can access their own requirement attachments
        }
      }
    } else if (req.user.userType === 'vendor') {
      // Vendors can access:
      // 1. All requirement attachments (from any client)
      // 2. Their own resource attachments
      if (file.entityType === 'requirement') {
        hasPermission = true; // Vendors can access all requirement attachments
      } else if (file.entityType === 'resource') {
        // Check if the resource belongs to this vendor
        const Resource = require('../models/Resource');
        const resource = await Resource.findById(file.entityId);
        if (resource && resource.createdBy.toString() === req.user.id) {
          hasPermission = true; // Vendor can access their own resource attachments
        }
      }
    }
  }

  if (!hasPermission) {
    return next(new ErrorResponse('Not authorized to access this file', 403));
  }

  res.status(200).json(
    ApiResponse.success(file, 'File retrieved successfully')
  );
});

// @desc    Download file
// @route   GET /api/files/:id/download
// @access  Private
const downloadFile = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  // Enhanced permission check for cross-access
  let hasPermission = false;

  // Admin can access everything
  if (isAdmin(req.user)) {
    hasPermission = true;
  }
  // File owner can always access their files
  else if (file.uploadedBy.toString() === req.user.id) {
    hasPermission = true;
  }
  // Public files are accessible to everyone
  else if (file.isPublic) {
    hasPermission = true;
  }
  // Cross-access permissions based on user role and entity type
  else {
    if (req.user.userType === 'client') {
      // Clients can download:
      // 1. All resource attachments (from any vendor)
      // 2. Their own requirement attachments
      if (file.entityType === 'resource') {
        hasPermission = true; // Clients can download all resource attachments
      } else if (file.entityType === 'requirement') {
        // Check if the requirement belongs to this client
        const Requirement = require('../models/Requirement');
        const requirement = await Requirement.findById(file.entityId);
        if (requirement && requirement.clientId.toString() === req.user.id) {
          hasPermission = true; // Client can download their own requirement attachments
        }
      }
    } else if (req.user.userType === 'vendor') {
      // Vendors can download:
      // 1. All requirement attachments (from any client)
      // 2. Their own resource attachments
      if (file.entityType === 'requirement') {
        hasPermission = true; // Vendors can download all requirement attachments
      } else if (file.entityType === 'resource') {
        // Check if the resource belongs to this vendor
        const Resource = require('../models/Resource');
        const resource = await Resource.findById(file.entityId);
        if (resource && resource.createdBy.toString() === req.user.id) {
          hasPermission = true; // Vendor can download their own resource attachments
        }
      }
    }
  }

  if (!hasPermission) {
    return next(new ErrorResponse('Not authorized to download this file', 403));
  }

  // Build file path using the stored filename from database
  const path = require('path');
  const fs = require('fs');
  
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../uploads', file.filename),
    path.join(process.cwd(), 'uploads', file.filename),
    path.join(process.cwd(), 'backend/uploads', file.filename),
    file.path // Use the stored path directly
  ];

  let filePath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      filePath = testPath;
      break;
    }
  }

  if (!filePath) {
    return res.status(404).json({ message: "File not found on server" });
  }

  try {
    // Get file stats to verify it's a real file
    const stats = fs.statSync(filePath);

    if (!stats.isFile()) {
      return res.status(400).json({ message: "Path is not a file" });
    }

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`);
    res.setHeader("Content-Type", file.mimetype || "application/octet-stream");
    res.setHeader("Content-Length", stats.size);

    // Create read stream and pipe to response
    const readStream = fs.createReadStream(filePath);
    
    readStream.on('error', (err) => {
      console.error('🔧 FileController: Read stream error:', err);
      if (!res.headersSent) {
        return next(new ErrorResponse('Error reading file', 500));
      }
    });

    readStream.on('end', () => {
      // Update download count
      try {
        file.downloadCount += 1;
        file.lastDownloadedAt = new Date();
        file.save().catch((err) => {
          console.error('🔧 FileController: Error updating download count:', err);
        });
      } catch (err) {
        console.error('🔧 FileController: Error updating download count:', err);
      }
    });

    // Pipe the file to response
    readStream.pipe(res);

  } catch (error) {
    console.error('🔧 FileController: Download error:', error);
    return next(new ErrorResponse('Internal server error', 500));
  }
});

// @desc    Update file
// @route   PUT /api/files/:id
// @access  Private
const updateFile = asyncHandler(async (req, res, next) => {
  let file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  // Check permissions - only uploader or admin can update
  if (file.uploadedBy.toString() !== req.user.id && req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(new ErrorResponse('Not authorized to update this file', 403));
  }

  // Fields that can be updated
  const allowedFields = ['description', 'category', 'isPublic', 'tags'];
  const updateData = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'tags' && typeof req.body[field] === 'string') {
        updateData[field] = req.body[field].split(',').map(tag => tag.trim());
      } else {
        updateData[field] = req.body[field];
      }
    }
  });

  file = await File.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  }).populate('uploadedBy', 'firstName lastName email');

  res.status(200).json(
    ApiResponse.success(file, 'File updated successfully')
  );
});

// @desc    Delete file
// @route   DELETE /api/files/:id
// @access  Private
const deleteFile = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  // Check permissions - only uploader or admin can delete
  if (file.uploadedBy.toString() !== req.user.id && req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(new ErrorResponse('Not authorized to delete this file', 403));
  }

  // Delete file from disk
  try {
    await fs.unlink(file.path);
  } catch (error) {
    console.error('Error deleting file from disk:', error);
    // Continue with database deletion even if file doesn't exist on disk
  }

  await file.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'File deleted successfully')
  );
});

// @desc    Approve/reject file (Admin only)
// @route   PATCH /api/files/:id/approval
// @access  Private (Admin only)
const updateFileApproval = asyncHandler(async (req, res, next) => {
  if (req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(new ErrorResponse('Not authorized to approve files', 403));
  }

  const { approvalStatus, approvalNotes } = req.body;

  if (!approvalStatus || !['approved', 'rejected'].includes(approvalStatus)) {
    return next(new ErrorResponse('Invalid approval status', 400));
  }

  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  file.approvalStatus = approvalStatus;
  file.approvalNotes = approvalNotes || '';
  file.approvedBy = req.user.id;
  file.approvedAt = new Date();

  await file.save();

  await file.populate('uploadedBy', 'firstName lastName email');
  await file.populate('approvedBy', 'firstName lastName email');

  res.status(200).json(
    ApiResponse.success(file, `File ${approvalStatus} successfully`)
  );
});

// @desc    Get user's files
// @route   GET /api/files/my-files
// @access  Private
const getMyFiles = asyncHandler(async (req, res, next) => {
  const { category, approvalStatus, page = 1, limit = 10 } = req.query;

  let query = { uploadedBy: req.user.id };

  if (category) {
    query.category = category;
  }

  if (approvalStatus) {
    query.approvalStatus = approvalStatus;
  }

  const files = await File.find(query)
    .populate('approvedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await File.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(files, 'Files retrieved successfully', {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  );
});

// @desc    Get pending approvals (Admin only)
// @route   GET /api/files/pending-approvals
// @access  Private (Admin only)
const getPendingApprovals = asyncHandler(async (req, res, next) => {
  if (req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(new ErrorResponse('Not authorized to view pending approvals', 403));
  }

  const { page = 1, limit = 10 } = req.query;

  const files = await File.find({ approvalStatus: 'pending' })
    .populate('uploadedBy', 'firstName lastName email companyName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await File.countDocuments({ approvalStatus: 'pending' });

  res.status(200).json(
    ApiResponse.success(files, 'Pending approvals retrieved successfully', {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  );
});

// @desc    Bulk approve/reject files (Admin only)
// @route   POST /api/files/bulk-approval
// @access  Private (Admin only)
const bulkUpdateApproval = asyncHandler(async (req, res, next) => {
  if (req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(new ErrorResponse('Not authorized to approve files', 403));
  }

  const { fileIds, approvalStatus, approvalNotes } = req.body;

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return next(new ErrorResponse('File IDs are required', 400));
  }

  if (!approvalStatus || !['approved', 'rejected'].includes(approvalStatus)) {
    return next(new ErrorResponse('Invalid approval status', 400));
  }

  const updateData = {
    approvalStatus,
    approvalNotes: approvalNotes || '',
    approvedBy: req.user.id,
    approvedAt: new Date()
  };

  const result = await File.updateMany(
    { _id: { $in: fileIds } },
    updateData
  );

  res.status(200).json(
    ApiResponse.success(
      { updatedCount: result.modifiedCount },
      `${result.modifiedCount} files ${approvalStatus} successfully`
    )
  );
});

// @desc    Test file integrity (for debugging)
// @route   GET /api/files/:id/integrity
// @access  Private
const testFileIntegrity = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  const absolutePath = path.resolve(file.path);
  
  try {
    const stats = await fs.stat(absolutePath);
    const fileHash = await calculateFileHash(absolutePath);
    
    const integrityInfo = {
      fileId: file._id,
      filename: file.filename,
      originalName: file.originalName,
      path: file.path,
      absolutePath: absolutePath,
      size: stats.size,
      expectedSize: file.size,
      sizeMatch: stats.size === file.size,
      hash: fileHash,
      mimetype: file.mimetype,
      extension: file.extension
    };

    res.status(200).json(
      ApiResponse.success(integrityInfo, 'File integrity check completed')
    );
  } catch (error) {
    return next(new ErrorResponse('Error checking file integrity', 500));
  }
});

// @desc    Simple test download (for debugging)
// @route   GET /api/files/:id/test-download
// @access  Private
const testDownload = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  const absolutePath = path.resolve(file.path);

  try {
    // Simple file read and send
    const fileBuffer = await fs.readFile(absolutePath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="test-${file.originalName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    res.send(fileBuffer);
  } catch (error) {
    return next(new ErrorResponse('Test download failed', 500));
  }
});

// @desc    Create and serve test file (for debugging)
// @route   GET /api/files/test-file
// @access  Private
const createTestFile = asyncHandler(async (req, res, next) => {
  try {
    // Create a simple test file
    const testContent = 'This is a test file for debugging download issues.\n\nIf you can download this file successfully, the download mechanism is working.\n\nTimestamp: ' + new Date().toISOString();
    const testBuffer = Buffer.from(testContent, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="test-file.txt"');
    res.setHeader('Content-Length', testBuffer.length);
    
    res.send(testBuffer);
  } catch (error) {
    return next(new ErrorResponse('Test file creation failed', 500));
  }
});

// @desc    Direct file serve test (for debugging)
// @route   GET /api/files/:id/direct
// @access  Private
const directFileServe = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  const absolutePath = path.resolve(file.path).replace(/\\/g, '/');

  try {
    // Use Express's built-in sendFile method
    res.sendFile(absolutePath, (err) => {
      if (err) {
        return next(new ErrorResponse('Direct serve failed', 500));
      }
    });
  } catch (error) {
    return next(new ErrorResponse('Direct serve failed', 500));
  }
});

// @desc    Simple file download (based on working code)
// @route   GET /api/files/:id/simple-download
// @access  Private
const simpleDownload = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse('File not found', 404));
  }

  // Enhanced permission check for cross-access (same as downloadFile)
  let hasPermission = false;

  // Admin can access everything
  if (isAdmin(req.user)) {
    hasPermission = true;
  }
  // File owner can always access their files
  else if (file.uploadedBy.toString() === req.user.id) {
    hasPermission = true;
  }
  // Public files are accessible to everyone
  else if (file.isPublic) {
    hasPermission = true;
  }
  // Cross-access permissions based on user role and entity type
  else {
    if (req.user.userType === 'client') {
      // Clients can download:
      // 1. All resource attachments (from any vendor)
      // 2. Their own requirement attachments
      if (file.entityType === 'resource') {
        hasPermission = true; // Clients can download all resource attachments
      } else if (file.entityType === 'requirement') {
        // Check if the requirement belongs to this client
        const Requirement = require('../models/Requirement');
        const requirement = await Requirement.findById(file.entityId);
        if (requirement && requirement.clientId.toString() === req.user.id) {
          hasPermission = true; // Client can download their own requirement attachments
        }
      }
    } else if (req.user.userType === 'vendor') {
      // Vendors can download:
      // 1. All requirement attachments (from any client)
      // 2. Their own resource attachments
      if (file.entityType === 'requirement') {
        hasPermission = true; // Vendors can download all requirement attachments
      } else if (file.entityType === 'resource') {
        // Check if the resource belongs to this vendor
        const Resource = require('../models/Resource');
        const resource = await Resource.findById(file.entityId);
        if (resource && resource.createdBy.toString() === req.user.id) {
          hasPermission = true; // Vendor can download their own resource attachments
        }
      }
    }
  }

  if (!hasPermission) {
    return next(new ErrorResponse('Not authorized to download this file', 403));
  }

  // Build file path
  const path = require('path');
  let filePath = path.join(__dirname, '../uploads', file.filename);

  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  try {
    // Set headers for file download (simple approach)
    res.setHeader("Content-Disposition", `attachment; filename=${file.originalName}`);
    res.setHeader("Content-Type", "application/octet-stream");

    // Send the file using the working approach
    res.sendFile(filePath, (err) => {
      if (err) {
        return next(new ErrorResponse('Error serving file', 500));
      }
      
      // Update download count
      try {
        file.downloadCount += 1;
        file.lastDownloadedAt = new Date();
        file.save().catch((err) => {
          console.error('🔧 FileController: Error updating download count:', err);
        });
      } catch (err) {
        console.error('🔧 FileController: Error updating download count:', err);
      }
    });

  } catch (error) {
    return next(new ErrorResponse('Internal server error', 500));
  }
});

module.exports = {
  uploadFile,
  getFilesByEntity,
  getFile,
  downloadFile,
  updateFile,
  deleteFile,
  updateFileApproval,
  getMyFiles,
  getPendingApprovals,
  bulkUpdateApproval,
  testFileIntegrity,
  testDownload,
  createTestFile,
  directFileServe,
  simpleDownload
}; 