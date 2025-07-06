const { body } = require('express-validator');

const validateVendorStep2 = [
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
    .withMessage('Please provide a valid phone number')
];

const validateVendorStep3 = [
  body('address.addressLine1')
    .notEmpty()
    .withMessage('Address line 1 is required'),
  body('address.city')
    .notEmpty()
    .withMessage('City is required'),
  body('address.state')
    .notEmpty()
    .withMessage('State is required'),
  body('address.pinCode')
    .notEmpty()
    .withMessage('Pin code is required')
    .matches(/^\d{6}$/)
    .withMessage('Please provide a valid 6-digit pin code'),
  body('address.country')
    .notEmpty()
    .withMessage('Country is required'),
  
  body('bankDetails.bankAccountNumber')
    .notEmpty()
    .withMessage('Bank account number is required')
    .matches(/^\d{9,18}$/)
    .withMessage('Bank account number must be 9-18 digits'),
  body('bankDetails.accountType')
    .notEmpty()
    .withMessage('Account type is required')
    .isIn(['savings', 'current', 'business'])
    .withMessage('Account type must be savings, current, or business'),
  body('bankDetails.ifscCode')
    .notEmpty()
    .withMessage('IFSC code is required')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Please provide a valid IFSC code'),
  body('bankDetails.bankName')
    .notEmpty()
    .withMessage('Bank name is required'),
  body('bankDetails.branchName')
    .notEmpty()
    .withMessage('Branch name is required'),
  body('bankDetails.bankCity')
    .notEmpty()
    .withMessage('Bank city is required')
];

const validateVendorStep4 = [
  body('businessInfo.companyName')
    .notEmpty()
    .withMessage('Company name is required'),
  body('businessInfo.businessType')
    .notEmpty()
    .withMessage('Business type is required'),
  body('businessInfo.businessLicense')
    .notEmpty()
    .withMessage('Business license is required'),
  body('businessInfo.taxId')
    .notEmpty()
    .withMessage('Tax ID is required'),
  body('businessInfo.website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL')
];

module.exports = {
  validateVendorStep2,
  validateVendorStep3,
  validateVendorStep4
};