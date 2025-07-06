import mongoose, { Schema, Document } from 'mongoose';

export interface IUserAddress extends Document {
  userId: mongoose.Types.ObjectId;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const UserAddressSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  pinCode: { type: String, required: true },
  isDefault: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const UserAddress = mongoose.model<IUserAddress>('UserAddress', UserAddressSchema); 