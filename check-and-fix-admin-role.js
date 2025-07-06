const mongoose = require('mongoose');
const { User } = require('./models/user.model');

const mongoURI = 'mongodb://127.0.0.1:27017/venkan212';

async function checkAndFixAdminRole() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find the admin user
    const adminUser = await User.findOne({ email: 'admin@venkan.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log('📋 Current admin user data:');
    console.log('  ID:', adminUser._id);
    console.log('  Email:', adminUser.email);
    console.log('  UserType:', adminUser.userType);
    console.log('  Role:', adminUser.role);
    console.log('  ApprovalStatus:', adminUser.approvalStatus);
    console.log('  IsActive:', adminUser.isActive);

    // Check if role needs to be updated
    if (adminUser.role !== 'superadmin') {
      console.log('\n🔄 Updating role from "' + adminUser.role + '" to "superadmin"...');
      
      adminUser.role = 'superadmin';
      await adminUser.save();
      
      console.log('✅ Role updated successfully!');
      console.log('  New Role:', adminUser.role);
    } else {
      console.log('\n✅ Role is already set to "superadmin"');
    }

    // Test the login response data
    console.log('\n🧪 Testing login response data...');
    const testResponse = {
      success: true,
      message: 'Login successful',
      token: 'test-token',
      refreshToken: 'test-refresh-token',
      data: {
        id: adminUser._id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        userType: adminUser.userType,
        role: adminUser.role,
        approvalStatus: adminUser.approvalStatus
      }
    };
    
    console.log('📤 Login response data:');
    console.log(JSON.stringify(testResponse, null, 2));

    console.log('\n🎉 Admin user is ready for workflow management access!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkAndFixAdminRole(); 