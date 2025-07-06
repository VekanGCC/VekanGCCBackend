const express = require('express');
const router = express.Router();
const {
  getRequirements,
  getRequirement,
  createRequirement,
  updateRequirement,
  updateRequirementStatus,
  deleteRequirement,
  getMatchingResourcesCount,
  getMatchingResourcesCountsBatch
} = require('../controllers/requirementController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Requirement routes
router.route('/')
  .get(getRequirements)
  .post(createRequirement);

router.route('/:id')
  .get(getRequirement)
  .put(updateRequirement)
  .delete(deleteRequirement);

router.route('/:id/status')
  .put(updateRequirementStatus);

router.route('/:id/matching-resources')
  .get(getMatchingResourcesCount);

router.route('/matching-resources/batch')
  .post(getMatchingResourcesCountsBatch);

module.exports = router;