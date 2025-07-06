const express = require('express');
const {
  getVendorSkills,
  getVendorSkill,
  createVendorSkill,
  updateVendorSkillStatus,
  deleteVendorSkill
} = require('../controllers/vendorSkillController');

const router = express.Router({ mergeParams: true });

const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, getVendorSkills)
  .post(protect, authorize('vendor'), createVendorSkill);

router
  .route('/:id')
  .get(protect, getVendorSkill)
  .delete(protect, authorize('vendor'), deleteVendorSkill);

router
  .route('/:id/status')
  .patch(protect, authorize('admin'), updateVendorSkillStatus);

module.exports = router; 