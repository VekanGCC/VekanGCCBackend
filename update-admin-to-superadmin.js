const mongoose = require('mongoose');
const { User } = require('./models/user.model');

const mongoURI = 'mongodb://127.0.0.1:27017/venkan212';

async function updateAdminToSuperAdmin() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find and update the admin user
    const adminUser = await User.findOneAndUpdate(
      { email: 'admin@venkan.com' },
      { role: 'superadmin' },
      { new: true }
    );

    if (adminUser) {
      console.log('✅ Admin user updated successfully!');
      console.log('Email:', adminUser.email);
      console.log('Role:', adminUser.role);
      console.log('UserType:', adminUser.userType);
      console.log('\n🎉 You can now access Workflow Management in the admin panel!');
    } else {
      console.log('❌ Admin user not found');
    }

  } catch (error) {
    console.error('Error updating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateAdminToSuperAdmin(); 