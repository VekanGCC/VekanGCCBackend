const mongoose = require('mongoose');
const { User } = require('./models/user.model');

const mongoURI = 'mongodb://127.0.0.1:27017/venkan212';

async function migrateAdminToOrganizationRole() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find all admin users
    const adminUsers = await User.find({ userType: 'admin' });
    console.log(`Found ${adminUsers.length} admin users to migrate`);

    for (const user of adminUsers) {
      console.log(`\n📋 Migrating user: ${user.email}`);
      console.log(`  Current role: ${user.role}`);
      console.log(`  Current organizationRole: ${user.organizationRole}`);

      // Map old role to new organizationRole
      let newOrganizationRole = null;
      
      if (user.role === 'superadmin') {
        newOrganizationRole = 'admin_owner';
      } else if (user.role === 'admin') {
        newOrganizationRole = 'admin_employee';
      } else {
        // If no role or unknown role, default to admin_employee
        newOrganizationRole = 'admin_employee';
      }

      // Update the user
      if (user.organizationRole !== newOrganizationRole) {
        user.organizationRole = newOrganizationRole;
        await user.save();
        console.log(`  ✅ Updated organizationRole to: ${newOrganizationRole}`);
      } else {
        console.log(`  ℹ️  organizationRole already set to: ${newOrganizationRole}`);
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 Summary of new organization roles:');
    console.log('  admin_owner: Full access including workflow management');
    console.log('  admin_employee: All access except workflow management');
    console.log('  admin_account: Limited access (for future use)');

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateAdminToOrganizationRole(); 