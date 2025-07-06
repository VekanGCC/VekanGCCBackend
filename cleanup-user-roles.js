const mongoose = require('mongoose');
const User = require('./models/User');

const mongoURI = 'mongodb://127.0.0.1:27017/venkan212';

async function cleanupUserRoles() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to clean up`);

    for (const user of users) {
      console.log(`\n📋 Processing user: ${user.email}`);
      console.log(`  Current userType: ${user.userType}`);
      console.log(`  Current role: ${user.role}`);
      console.log(`  Current organizationRole: ${user.organizationRole}`);

      // Set organizationRole based on userType and current role
      let newOrganizationRole = null;
      
      if (user.userType === 'admin') {
        if (user.role === 'superadmin') {
          newOrganizationRole = 'admin_owner';
        } else if (user.role === 'admin') {
          newOrganizationRole = 'admin_employee';
        } else {
          // Default for admin users without role
          newOrganizationRole = 'admin_employee';
        }
      } else if (user.userType === 'vendor') {
        if (!user.organizationRole) {
          newOrganizationRole = 'vendor_owner';
        } else {
          newOrganizationRole = user.organizationRole;
        }
      } else if (user.userType === 'client') {
        if (!user.organizationRole) {
          newOrganizationRole = 'client_owner';
        } else {
          newOrganizationRole = user.organizationRole;
        }
      }

      // Update the user
      if (user.organizationRole !== newOrganizationRole) {
        user.organizationRole = newOrganizationRole;
        console.log(`  ✅ Updated organizationRole to: ${newOrganizationRole}`);
      } else {
        console.log(`  ℹ️  organizationRole already set to: ${newOrganizationRole}`);
      }

      // Remove the legacy role field
      if (user.role) {
        user.role = undefined;
        console.log(`  🗑️  Removed legacy role field`);
      }

      await user.save();
    }

    // Now remove the role field from the schema completely
    console.log('\n🔧 Removing role field from schema...');
    await User.updateMany({}, { $unset: { role: 1 } });
    console.log('✅ Role field removed from all documents');

    console.log('\n🎉 Role cleanup completed successfully!');
    console.log('\n📊 Final role structure:');
    console.log('  userType: admin | vendor | client');
    console.log('  organizationRole:');
    console.log('    admin_owner: Full access including workflow management');
    console.log('    admin_employee: Admin access but no workflow management');
    console.log('    admin_account: Limited admin access');
    console.log('    vendor_owner: Full vendor access');
    console.log('    vendor_employee: Vendor employee access');
    console.log('    vendor_account: Limited vendor access');
    console.log('    client_owner: Full client access');
    console.log('    client_employee: Client employee access');
    console.log('    client_account: Limited client access');

  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanupUserRoles(); 