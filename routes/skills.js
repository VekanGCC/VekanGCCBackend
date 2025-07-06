const express = require('express');
const {
  getSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill
} = require('../controllers/skillController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const AdminSkill = require('../models/AdminSkill');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../models/ApiResponse');

// Get all active skills (accessible by vendors)
router.get('/active', protect, asyncHandler(async (req, res) => {
  const skills = await AdminSkill.find({ isActive: true })
    .select('name')
    .sort('name');

  res.status(200).json(
    ApiResponse.success(skills, 'Skills retrieved successfully')
  );
}));

router
  .route('/')
  .get(getSkills)
  .post(protect, authorize('admin'), createSkill);

router
  .route('/:id')
  .get(getSkill)
  .put(protect, authorize('admin'), updateSkill)
  .delete(protect, authorize('admin'), deleteSkill);

module.exports = router; 