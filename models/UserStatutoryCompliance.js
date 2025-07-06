const mongoose = require('mongoose');

const UserStatutoryComplianceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  panNumber: { type: String },
  registeredUnderESI: { type: Boolean },
  esiRegistrationNumber: { type: String },
  registeredUnderPF: { type: Boolean },
  pfRegistrationNumber: { type: String },
  registeredUnderMSMED: { type: Boolean },
  msmedRegistrationNumber: { type: String },
  compliesWithStatutoryRequirements: { type: Boolean },
  hasCloseRelativesInCompany: { type: Boolean },
  hasAdequateSafetyStandards: { type: Boolean },
  hasOngoingLitigation: { type: Boolean }
}, { timestamps: true });

module.exports = mongoose.model('UserStatutoryCompliance', UserStatutoryComplianceSchema); 