const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/fileController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(protect);

// Upload file
router.post('/upload', upload.single('file'), uploadFile);

// Create test file (for debugging)
router.get('/test-file', createTestFile);

// Get files by entity
router.get('/entity/:entityType/:entityId', getFilesByEntity);

// Get user's files
router.get('/my-files', getMyFiles);

// Get file by ID
router.get('/:id', getFile);

// Download file
router.get('/:id/download', downloadFile);

// Simple download (based on working code)
router.get('/:id/simple-download', simpleDownload);

// Direct file serve test (for debugging)
router.get('/:id/direct', directFileServe);

// Test download (for debugging)
router.get('/:id/test-download', testDownload);

// Test file integrity (for debugging)
router.get('/:id/integrity', testFileIntegrity);

// Update file
router.put('/:id', updateFile);

// Delete file
router.delete('/:id', deleteFile);

// Admin routes
router.patch('/:id/approval', updateFileApproval);
router.get('/pending-approvals', getPendingApprovals);
router.post('/bulk-approval', bulkUpdateApproval);

module.exports = router; 