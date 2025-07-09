const AdminSkill = require('../models/AdminSkill');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all skills
// @route   GET /api/skills
// @access  Public
exports.getSkills = asyncHandler(async (req, res, next) => {
  const skills = await AdminSkill.find()
    .select('-__v')
    .sort('name');

  res.status(200).json({
    success: true,
    count: skills.length,
    data: skills
  });
});

// @desc    Get single skill
// @route   GET /api/skills/:id
// @access  Public
exports.getSkill = asyncHandler(async (req, res, next) => {
  const skill = await AdminSkill.findById(req.params.id).select('-__v');

  if (!skill) {
    return next(new ErrorResponse(`Skill not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: skill
  });
});

// @desc    Create new skill
// @route   POST /api/skills
// @access  Private/Admin
exports.createSkill = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;

  const skill = await AdminSkill.create(req.body);

  res.status(201).json({
    success: true,
    data: skill
  });
});

// @desc    Update skill
// @route   PUT /api/skills/:id
// @access  Private/Admin
exports.updateSkill = asyncHandler(async (req, res, next) => {
  let skill = await AdminSkill.findById(req.params.id);

  if (!skill) {
    return next(new ErrorResponse(`Skill not found with id of ${req.params.id}`, 404));
  }

  skill = await AdminSkill.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: skill
  });
});

// @desc    Delete skill
// @route   DELETE /api/skills/:id
// @access  Private/Admin
exports.deleteSkill = asyncHandler(async (req, res, next) => {
  const skill = await AdminSkill.findById(req.params.id);

  if (!skill) {
    return next(new ErrorResponse(`Skill not found with id of ${req.params.id}`, 404));
  }

  // Soft delete by setting isActive to false
  skill.isActive = false;
  await skill.save();

  res.status(200).json({
    success: true,
    data: {}
  });
}); 