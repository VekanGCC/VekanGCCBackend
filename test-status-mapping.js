const { 
  isActiveStatus, 
  isInactiveStatus, 
  getStatusCategory, 
  getActiveStatuses, 
  getInactiveStatuses,
  getActiveApplicationsQuery 
} = require('./utils/applicationStatusMapping');

console.log('🧪 Testing Application Status Mapping Utility\n');

// Test active statuses
console.log('✅ Active Statuses:');
const activeStatuses = getActiveStatuses();
console.log(activeStatuses);

console.log('\n❌ Inactive Statuses:');
const inactiveStatuses = getInactiveStatuses();
console.log(inactiveStatuses);

// Test individual status checks
console.log('\n🔍 Testing Individual Status Checks:');
const testStatuses = [
  'applied',
  'pending', 
  'shortlisted',
  'interview',
  'accepted',
  'offer_created',
  'offer_accepted',
  'onboarded',
  'rejected',
  'withdrawn',
  'did_not_join',
  'cancelled',
  'unknown_status'
];

testStatuses.forEach(status => {
  const isActive = isActiveStatus(status);
  const isInactive = isInactiveStatus(status);
  const category = getStatusCategory(status);
  
  console.log(`${status}:`);
  console.log(`  - Active: ${isActive}`);
  console.log(`  - Inactive: ${isInactive}`);
  console.log(`  - Category: ${category}`);
  console.log('');
});

// Test MongoDB query
console.log('🔍 MongoDB Query for Active Applications:');
const activeQuery = getActiveApplicationsQuery();
console.log(JSON.stringify(activeQuery, null, 2));

console.log('\n✅ Status mapping utility test completed!'); 