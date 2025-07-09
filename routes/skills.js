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

// Skills routes
router
  .route('/')
  .get(getSkills)
  .post(protect, authorize('admin'), createSkill);

router
  .route('/:id')
  .get(getSkill)
  .put(protect, authorize('admin'), updateSkill)
  .delete(protect, authorize('admin'), deleteSkill);

// Skill status toggle
router.patch('/:id/status', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const skill = await AdminSkill.findById(req.params.id);
  
  if (!skill) {
    return res.status(404).json(ApiResponse.error('Skill not found'));
  }
  
  skill.isActive = req.body.isActive;
  await skill.save();
  
  res.status(200).json(ApiResponse.success(skill, 'Skill status updated'));
}));

// Categories routes
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await AdminSkill.distinct('category');
  const categoryList = categories.map(cat => ({ _id: cat, name: cat }));
  
  res.status(200).json(ApiResponse.success(categoryList, 'Categories retrieved successfully'));
}));

router.post('/categories', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, description, isActive = true } = req.body;
  
  // For now, we'll store categories as strings in the skill model
  // In a real implementation, you'd have a separate Category model
  const category = { _id: name, name, description, isActive };
  
  res.status(201).json(ApiResponse.success(category, 'Category created successfully'));
}));

router.put('/categories/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  
  // Update all skills with this category
  await AdminSkill.updateMany(
    { category: req.params.id },
    { category: name }
  );
  
  const category = { _id: name, name, description, isActive };
  
  res.status(200).json(ApiResponse.success(category, 'Category updated successfully'));
}));

router.delete('/categories/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // Remove category from all skills
  await AdminSkill.updateMany(
    { category: req.params.id },
    { $unset: { category: 1 } }
  );
  
  res.status(200).json(ApiResponse.success({}, 'Category deleted successfully'));
}));

router.patch('/categories/:id/status', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // For now, we'll just return success since categories are stored as strings
  const category = { _id: req.params.id, name: req.params.id, isActive: req.body.isActive };
  
  res.status(200).json(ApiResponse.success(category, 'Category status updated'));
}));

module.exports = router; 