const express = require('express');
const router = express.Router();
const {
  browseServices,
  getServiceDetails,
  getServiceReviews,
  toggleSaveService,
  getServiceCategories,
  getFeaturedServices,
  searchServices
} = require('../controllers/clientServiceController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and client-only
router.use(protect);
router.use(authorize('client'));

// Service browsing routes
router.get('/', browseServices);
router.get('/categories', getServiceCategories);
router.get('/featured', getFeaturedServices);
router.get('/search', searchServices);

// Individual service routes
router.get('/:id', getServiceDetails);
router.get('/:id/reviews', getServiceReviews);
router.put('/:id/save', toggleSaveService);

module.exports = router;