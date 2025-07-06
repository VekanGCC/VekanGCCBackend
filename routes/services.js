const express = require('express');
const router = express.Router();
const {
  getVendorServices,
  getService,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  getServiceAnalytics
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and vendor-only
router.use(protect);
router.use(authorize('vendor'));

// Service routes
router.route('/')
  .get(getVendorServices)
  .post(createService);

router.route('/:id')
  .get(getService)
  .put(updateService)
  .delete(deleteService);

router.put('/:id/toggle-status', toggleServiceStatus);
router.get('/:id/analytics', getServiceAnalytics);

module.exports = router;