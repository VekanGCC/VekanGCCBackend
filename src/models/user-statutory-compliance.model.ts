import mongoose, { Schema, Document } from 'mongoose';

export interface IUserStatutoryCompliance extends Document {
  userId: mongoose.Types.ObjectId;
  panNumber: string;
  registeredUnderESI: boolean;
  esiRegistrationNumber?: string;
  registeredUnderPF: boolean;
  pfRegistrationNumber?: string;
  registeredUnderMSMED: boolean;
  compliesWithStatutoryRequirements: boolean;
  hasCloseRelativesInCompany: boolean;
  hasAdequateSafetyStandards: boolean;
  hasOngoingLitigation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const UserStatutoryComplianceSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  panNumber: { type: String, required: true },
  registeredUnderESI: { type: Boolean, default: false },
  esiRegistrationNumber: { type: String },
  registeredUnderPF: { type: Boolean, default: false },
  pfRegistrationNumber: { type: String },
  registeredUnderMSMED: { type: Boolean, default: false },
  compliesWithStatutoryRequirements: { type: Boolean, default: false },
  hasCloseRelativesInCompany: { type: Boolean, default: false },
  hasAdequateSafetyStandards: { type: Boolean, default: false },
  hasOngoingLitigation: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const UserStatutoryCompliance = mongoose.model<IUserStatutoryCompliance>('UserStatutoryCompliance', UserStatutoryComplianceSchema); 