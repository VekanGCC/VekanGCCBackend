const express = require('express');
const router = express.Router();
const {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  getMatchingRequirementsCount,
  getMatchingRequirementsCountsBatch,
  getMatchingRequirementsDetails
} = require('../controllers/resourceController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Resource routes
router.route('/')
  .get(getResources)
  .post(createResource);

router.route('/:id')
  .get(getResource)
  .put(updateResource)
  .delete(deleteResource);

// Matching requirements routes
router.route('/:id/matching-requirements')
  .get(getMatchingRequirementsCount);

router.route('/:id/matching-requirements/details')
  .get(getMatchingRequirementsDetails);

router.route('/matching-requirements/batch')
  .post(getMatchingRequirementsCountsBatch);

module.exports = router;