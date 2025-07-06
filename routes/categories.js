const express = require('express');
const router = express.Router();
const { getActiveCategories } = require('../controllers/categoryController');

// Public route for getting active categories
router.get('/active', getActiveCategories);

module.exports = router; 