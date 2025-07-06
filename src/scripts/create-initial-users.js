const mongoose = require('mongoose');
const { User } = require('../../models/user.model');

const mongoURI = 'mongodb://127.0.0.1:27017/venkan212';

async function createInitialUsers() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Create Admin User
    const adminUser = new User({
      email: 'admin@venkan.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      userType: 'admin',
      isActive: true,
      isEmailVerified: true,
      isApproved: true,
      approvalStatus: 'approved',
      companyName: 'Venkan Admin',
      contactPerson: 'Admin User',
      mobileNumber: '9999999999',
      gstNumber: 'ADMIN123456',
      serviceType: 'admin',
      currentStep: 5,
      registrationComplete: true
    });

    // Create Client User
    const clientUser = new User({
      email: 'client@venkan.com',
      firstName: 'Client',
      lastName: 'User',
      role: 'client',
      userType: 'client',
      isActive: true,
      isEmailVerified: true,
      isApproved: true,
      approvalStatus: 'approved',
      companyName: 'Client Company',
      contactPerson: 'Client User',
      mobileNumber: '8888888888',
      gstNumber: 'CLIENT123456',
      serviceType: 'IT Services',
      currentStep: 5,
      registrationComplete: true
    });

    // Create Vendor User
    const vendorUser = new User({
      email: 'vendor@venkan.com',
      firstName: 'Vendor',
      lastName: 'User',
      role: 'vendor',
      userType: 'vendor',
      isActive: true,
      isEmailVerified: true,
      isApproved: true,
      approvalStatus: 'approved',
      companyName: 'Vendor Company',
      contactPerson: 'Vendor User',
      mobileNumber: '7777777777',
      gstNumber: 'VENDOR123456',
      serviceType: 'IT Staffing',
      currentStep: 5,
      registrationComplete: true
    });

    // Save all users
    await Promise.all([
      adminUser.save(),
      clientUser.save(),
      vendorUser.save()
    ]);

    console.log('Initial users created successfully');
    console.log('Admin User:', adminUser.email);
    console.log('Client User:', clientUser.email);
    console.log('Vendor User:', vendorUser.email);

  } catch (error) {
    console.error('Error creating initial users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createInitialUsers(); 