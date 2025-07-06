const VendorSkill = require('../models/VendorSkill');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all vendor skills
// @route   GET /api/vendor/niche-skills
// @access  Private
exports.getVendorSkills = asyncHandler(async (req, res, next) => {
  let query;

  // If user is vendor, show skills based on organization
  if (req.user.userType === 'vendor') {
    if (req.user.organizationId) {
      // Filter by organization for vendor organization members
      query = VendorSkill.find({ organizationId: req.user.organizationId });
      console.log('🔧 VendorSkillController: Filtering vendor skills by organization ID:', req.user.organizationId);
    } else {
      // Fallback to user-based filtering for vendors without organization
      query = VendorSkill.find({ vendor: req.user.id });
    }
  } else {
    // For admin, show all skills
    query = VendorSkill.find();
  }

  // Add filters
  if (req.query.status) {
    query = query.find({ status: req.query.status });
  }

  if (req.query.category) {
    query = query.find({ category: req.query.category });
  }

  // Populate vendor details
  query = query.populate({
    path: 'vendor',
    select: 'firstName lastName email companyName'
  }).populate({
    path: 'skill',
    select: 'name description isActive'
  });

  const skills = await query.sort('-createdAt');

  res.status(200).json({
    success: true,
    count: skills.length,
    data: skills
  });
});

// @desc    Get single vendor skill
// @route   GET /api/vendor/niche-skills/:id
// @access  Private
exports.getVendorSkill = asyncHandler(async (req, res, next) => {
  const skill = await VendorSkill.findById(req.params.id)
    .populate({
      path: 'vendor',
      select: 'firstName lastName email companyName'
    }).populate({
      path: 'skill',
      select: 'name description isActive'
    });

  if (!skill) {
    return next(new ErrorResponse(`Skill not found with id of ${req.params.id}`, 404));
  }

  // Check if user is authorized to view this skill
  if (req.user.userType === 'vendor') {
    if (req.user.organizationId) {
      // Check if skill belongs to the same organization
      if (skill.organizationId && skill.organizationId.toString() !== req.user.organizationId.toString()) {
        return next(new ErrorResponse('Not authorized to access this skill', 403));
      }
    } else {
      // Fallback to vendor-based authorization for vendors without organization
      if (skill.vendor._id.toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorized to access this skill', 403));
      }
    }
  }

  res.status(200).json({
    success: true,
    data: skill
  });
});

// @desc    Create vendor skill
// @route   POST /api/vendor/niche-skills
// @access  Private/Vendor
exports.createVendorSkill = asyncHandler(async (req, res, next) => {
  // Add vendor to req.body
  req.body.vendor = req.user.id;

  // Add organizationId for vendor skills
  if (req.user.userType === 'vendor' && req.user.organizationId) {
    req.body.organizationId = req.user.organizationId;
    console.log('🔧 VendorSkillController: Adding organizationId to vendor skill:', req.user.organizationId);
  }

  const skill = await VendorSkill.create(req.body);

  // Populate the skill field for the response
  const populatedSkill = await VendorSkill.findById(skill._id)
    .populate({
      path: 'skill',
      select: 'name description isActive'
    });

  res.status(201).json({
    success: true,
    data: populatedSkill
  });
});

// @desc    Update vendor skill status
// @route   PATCH /api/vendor/niche-skills/:id/status
// @access  Private/Admin
exports.updateVendorSkillStatus = asyncHandler(async (req, res, next) => {
  const { status, reviewNotes } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return next(new ErrorResponse('Please provide a valid status (approved/rejected)', 400));
  }

  const skill = await VendorSkill.findById(req.params.id);

  if (!skill) {
    return next(new ErrorResponse(`Skill not found with id of ${req.params.id}`, 404));
  }

  // Update skill status
  skill.status = status;
  skill.reviewNotes = reviewNotes;
  skill.reviewedBy = req.user.id;
  skill.reviewedAt = Date.now();

  await skill.save();

  // Populate the skill field for the response
  const populatedSkill = await VendorSkill.findById(skill._id)
    .populate({
      path: 'skill',
      select: 'name description isActive'
    });

  res.status(200).json({
    success: true,
    data: populatedSkill
  });
});

// @desc    Delete vendor skill
// @route   DELETE /api/vendor/niche-skills/:id
// @access  Private/Vendor
exports.deleteVendorSkill = asyncHandler(async (req, res, next) => {
  const skill = await VendorSkill.findById(req.params.id);

  if (!skill) {
    return next(new ErrorResponse(`Skill not found with id of ${req.params.id}`, 404));
  }

  // Check if user is authorized to delete this skill
  if (req.user.userType === 'vendor') {
    if (req.user.organizationId) {
      // Check if skill belongs to the same organization
      if (skill.organizationId && skill.organizationId.toString() !== req.user.organizationId.toString()) {
        return next(new ErrorResponse('Not authorized to delete this skill', 403));
      }
    } else {
      // Fallback to vendor-based authorization for vendors without organization
      if (skill.vendor.toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorized to delete this skill', 403));
      }
    }
  }

  // Soft delete by setting isActive to false
  skill.isActive = false;
  await skill.save();

  res.status(200).json({
    success: true,
    data: {}
  });
}); 