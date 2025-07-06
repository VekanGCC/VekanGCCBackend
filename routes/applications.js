const express = require('express');
const router = express.Router();
const {
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
  getVendorApplicationsByResource
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Application routes
router.route('/')
  .get(getApplications)
  .post(createApplication);

// User-specific application routes
router.get('/vendor', authorize('vendor'), getVendorApplications);
router.get('/vendor/resource/:resourceId', authorize('vendor'), getVendorApplicationsByResource);
router.get('/client', authorize('client'), getClientApplications);

// Application counts route
router.get('/counts/requirements', getApplicationCountsForRequirements);
router.get('/counts/resources', getApplicationCountsForResources);

router.route('/:id')
  .get(getApplication)
  .put(updateApplication)
  .delete(deleteApplication);

router.get('/:id/history', getApplicationHistory);
router.put('/:id/status', updateApplicationStatus);

module.exports = router;