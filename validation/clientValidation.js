const { body } = require('express-validator');

const validateClientStep2 = [
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot be more than 50 characters'),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot be more than 50 characters'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
];

const validateClientStep3 = [
  body('address.street')
    .notEmpty()
    .withMessage('Street address is required'),
  body('address.city')
    .notEmpty()
    .withMessage('City is required'),
  body('address.state')
    .notEmpty()
    .withMessage('State is required'),
  body('address.zipCode')
    .notEmpty()
    .withMessage('Zip code is required')
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Please provide a valid zip code'),
  body('address.country')
    .notEmpty()
    .withMessage('Country is required')
];

const validateClientStep4 = [
  body('preferences.categories')
    .isArray({ min: 1 })
    .withMessage('At least one category preference is required'),
  body('preferences.budget.min')
    .optional()
    .isNumeric()
    .withMessage('Minimum budget must be a number'),
  body('preferences.budget.max')
    .optional()
    .isNumeric()
    .withMessage('Maximum budget must be a number'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  body('preferences.notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be a boolean')
];

module.exports = {
  validateClientStep2,
  validateClientStep3,
  validateClientStep4
};