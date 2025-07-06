import mongoose, { Schema, Document } from 'mongoose';

export interface IUserBankDetails extends Document {
  userId: mongoose.Types.ObjectId;
  bankAccountNumber: string;
  accountType: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  bankCity: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const UserBankDetailsSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bankAccountNumber: { type: String, required: true },
  accountType: { type: String, required: true },
  ifscCode: { type: String, required: true },
  bankName: { type: String, required: true },
  branchName: { type: String, required: true },
  bankCity: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const UserBankDetails = mongoose.model<IUserBankDetails>('UserBankDetails', UserBankDetailsSchema); 