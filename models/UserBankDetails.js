const mongoose = require('mongoose');

const UserBankDetailsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bankAccountNumber: { type: String, required: true },
  accountType: { type: String, required: true },
  ifscCode: { type: String, required: true },
  bankName: { type: String, required: true },
  branchName: { type: String, required: true },
  bankCity: { type: String, required: true },
  paymentTerms: { 
    type: String, 
    enum: ['net_15', 'net_30', 'net_45', 'net_60', 'net_90'],
    default: 'net_30' 
  },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('UserBankDetails', UserBankDetailsSchema); 