import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUser } from '../models/user.model';
import { IUserAddress } from '../models/user-address.model';
import { IUserBankDetails } from '../models/user-bank-details.model';
import { IUserStatutoryCompliance } from '../models/user-statutory-compliance.model';
import { VendorRegistrationDto } from '../dto/vendor-registration.dto';

@Injectable()
export class VendorRegistrationService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<IUser>,
    @InjectModel('UserAddress') private readonly userAddressModel: Model<IUserAddress>,
    @InjectModel('UserBankDetails') private readonly userBankDetailsModel: Model<IUserBankDetails>,
    @InjectModel('UserStatutoryCompliance') private readonly userStatutoryComplianceModel: Model<IUserStatutoryCompliance>,
  ) {}

  async registerVendor(registrationData: VendorRegistrationDto) {
    // Create user
    const user = new this.userModel({
      email: registrationData.email,
      firstName: registrationData.firstName,
      lastName: registrationData.lastName,
      role: 'vendor',
      userType: 'vendor',
      isActive: true,
      isEmailVerified: false,
      isApproved: false,
      approvalStatus: 'pending',
      companyName: registrationData.companyName,
      contactPerson: registrationData.contactPerson,
      mobileNumber: registrationData.mobileNumber,
      gstNumber: registrationData.gstNumber,
      serviceType: registrationData.serviceType,
      numberOfResources: registrationData.numberOfResources,
      numberOfRequirements: registrationData.numberOfRequirements,
      paymentTerms: registrationData.paymentTerms,
      businessInfo: registrationData.businessInfo
    });
    await user.save();

    // Create address
    const address = new this.userAddressModel({
      userId: user._id,
      addressLine1: registrationData.address.addressLine1,
      addressLine2: registrationData.address.addressLine2,
      city: registrationData.address.city,
      state: registrationData.address.state,
      country: registrationData.address.country,
      pinCode: registrationData.address.pinCode,
      isDefault: true
    });
    await address.save();

    // Create bank details
    const bankDetails = new this.userBankDetailsModel({
      userId: user._id,
      bankAccountNumber: registrationData.bankDetails.bankAccountNumber,
      accountType: registrationData.bankDetails.accountType,
      ifscCode: registrationData.bankDetails.ifscCode,
      bankName: registrationData.bankDetails.bankName,
      branchName: registrationData.bankDetails.branchName,
      bankCity: registrationData.bankDetails.bankCity,
      isVerified: false
    });
    await bankDetails.save();

    // Create statutory compliance
    const statutoryCompliance = new this.userStatutoryComplianceModel({
      userId: user._id,
      panNumber: registrationData.statutoryCompliance.panNumber,
      registeredUnderESI: registrationData.statutoryCompliance.registeredUnderESI,
      esiRegistrationNumber: registrationData.statutoryCompliance.esiRegistrationNumber,
      registeredUnderPF: registrationData.statutoryCompliance.registeredUnderPF,
      pfRegistrationNumber: registrationData.statutoryCompliance.pfRegistrationNumber,
      registeredUnderMSMED: registrationData.statutoryCompliance.registeredUnderMSMED,
      compliesWithStatutoryRequirements: registrationData.statutoryCompliance.compliesWithStatutoryRequirements,
      hasCloseRelativesInCompany: registrationData.statutoryCompliance.hasCloseRelativesInCompany,
      hasAdequateSafetyStandards: registrationData.statutoryCompliance.hasAdequateSafetyStandards,
      hasOngoingLitigation: registrationData.statutoryCompliance.hasOngoingLitigation
    });
    await statutoryCompliance.save();

    return {
      user,
      address,
      bankDetails,
      statutoryCompliance
    };
  }
} 