const mongoose = require('mongoose');
const User = require('./models/User');
const Resource = require('./models/Resource');
const Requirement = require('./models/Requirement');
const Application = require('./models/Application');
const AdminSkill = require('./models/AdminSkill');

// Test database connection
async function testConnection() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/venkan212', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Database connected successfully');
    
    // Test basic queries
    const userCount = await User.countDocuments();
    console.log('👥 Total users:', userCount);
    
    const resourceCount = await Resource.countDocuments();
    console.log('💼 Total resources:', resourceCount);
    
    const requirementCount = await Requirement.countDocuments();
    console.log('📋 Total requirements:', requirementCount);
    
    const applicationCount = await Application.countDocuments();
    console.log('📝 Total applications:', applicationCount);
    
    const skillCount = await AdminSkill.countDocuments();
    console.log('🏆 Total skills:', skillCount);
    
    // Test user registration report query
    const userRegistrationData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalUsers: { $sum: 1 },
          vendors: {
            $sum: { $cond: [{ $eq: ['$userType', 'vendor'] }, 1, 0] }
          },
          clients: {
            $sum: { $cond: [{ $eq: ['$userType', 'client'] }, 1, 0] }
          },
          date: { $first: '$createdAt' }
        }
      },
      {
        $project: {
          _id: 0,
          date: { 
            $dateToString: { 
              format: '%Y-%m-%d', 
              date: '$date' 
            } 
          },
          totalUsers: 1,
          vendors: 1,
          clients: 1
        }
      },
      { $sort: { date: 1 } }
    ]);
    
    console.log('📊 User registration data:', JSON.stringify(userRegistrationData, null, 2));
    
    await mongoose.disconnect();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConnection(); 