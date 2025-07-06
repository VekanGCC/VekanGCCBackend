const mongoose = require('mongoose');
const User = require('./models/User');

const mongoURI = 'mongodb://127.0.0.1:27017/venkan212';

async function setAdminOwner() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find the admin user (assuming it's the one with admin@venkan.com email)
    const adminUser = await User.findOne({ email: 'admin@venkan.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log('📋 Current admin user data:');
    console.log('  ID:', adminUser._id);
    console.log('  Email:', adminUser.email);
    console.log('  UserType:', adminUser.userType);
    console.log('  OrganizationRole:', adminUser.organizationRole);

    // Set organizationRole to admin_owner
    if (adminUser.organizationRole !== 'admin_owner') {
      console.log('\n🔄 Setting organizationRole to "admin_owner"...');
      
      adminUser.organizationRole = 'admin_owner';
      await adminUser.save();
      
      console.log('✅ OrganizationRole updated successfully!');
      console.log('  New OrganizationRole:', adminUser.organizationRole);
    } else {
      console.log('\n✅ OrganizationRole is already set to "admin_owner"');
    }

    console.log('\n🎉 Admin user now has workflow management access!');
    console.log('\n📊 Role structure:');
    console.log('  userType: admin');
    console.log('  organizationRole: admin_owner (full access including workflow management)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

setAdminOwner(); 