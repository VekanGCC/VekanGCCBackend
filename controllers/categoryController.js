const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private (Admin only)
const getCategories = asyncHandler(async (req, res, next) => {
  const { 
    isActive,
    page = 1, 
    limit = 50, 
    sortBy = 'name', 
    sortOrder = 'asc',
    search
  } = req.query;

  // Build query
  let query = {};

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  // Execute query with pagination
  const categories = await Category.find(query)
    .populate('createdBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Category.countDocuments(query);

  res.status(200).json({
    success: true,
    data: categories,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single category
// @route   GET /api/admin/categories/:id
// @access  Private (Admin only)
const getCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email');

  if (!category) {
    return next(new ErrorResponse('Category not found', 404));
  }

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Private (Admin only)
const createCategory = asyncHandler(async (req, res, next) => {
  // Add admin user to req.body
  req.body.createdBy = req.user.id;

  // Check if category already exists
  const existingCategory = await Category.findOne({ name: req.body.name });
  if (existingCategory) {
    return next(new ErrorResponse('Category with this name already exists', 400));
  }

  const category = await Category.create(req.body);

  res.status(201).json({
    success: true,
    data: category
  });
});

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private (Admin only)
const updateCategory = asyncHandler(async (req, res, next) => {
  let category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorResponse('Category not found', 404));
  }

  // Check if name is being updated and if it already exists
  if (req.body.name && req.body.name !== category.name) {
    const existingCategory = await Category.findOne({ name: req.body.name });
    if (existingCategory) {
      return next(new ErrorResponse('Category with this name already exists', 400));
    }
  }

  category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private (Admin only)
const deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorResponse('Category not found', 404));
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get active categories (for dropdowns)
// @route   GET /api/categories/active
// @access  Public
const getActiveCategories = asyncHandler(async (req, res, next) => {
  const categories = await Category.find({ isActive: true })
    .select('name description')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    data: categories
  });
});

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getActiveCategories
}; 