const mongoose = require('mongoose');
const Resource = require('./models/Resource');
const Requirement = require('./models/Requirement');
const AdminSkill = require('./models/AdminSkill');

// MongoDB connection string
const MONGODB_URI = 'mongodb://127.0.0.1:27017/venkan212';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function testMatching() {
  try {
       
    // Check if there are any skills
    const skills = await AdminSkill.find({});
    
    // Check if there are any resources
    const resources = await Resource.find({}).populate('skills', 'name');
    
    
    // Check if there are any requirements
    const requirements = await Requirement.find({}).populate('skills', 'name');
    
    
    // Test matching logic if we have data
    if (resources.length > 0 && requirements.length > 0) {
      const resource = resources[0];
    
      
      // Build matching criteria
      const matchingCriteria = {
        status: 'open'
      };
      
      if (resource.skills && resource.skills.length > 0) {
        matchingCriteria.skills = { $exists: true, $ne: [] };
      }
      
      if (resource.experience && resource.experience.years) {
        matchingCriteria['experience.minYears'] = { $lte: resource.experience.years };
      }
      
      if (resource.rate && resource.rate.hourly) {
        matchingCriteria['budget.charge'] = { $gte: resource.rate.hourly };
      }
      
      
      
      const matchingRequirements = await Requirement.find(matchingCriteria)
        .populate('skills', 'name')
        .lean();
      
      
      
      // Test skill matching
      const filteredRequirements = matchingRequirements.filter(requirement => {
        const requirementSkillIds = requirement.skills.map(skill => skill._id.toString());
        const resourceSkillIds = resource.skills.map(skill => skill._id.toString());
        
       
        // Resource must have ALL skills required by the requirement
        const hasAllRequiredSkills = requirementSkillIds.every(skillId =>
          resourceSkillIds.includes(skillId)
        );
        
        
        
        if (!hasAllRequiredSkills) {
          
          return false;
        }
        
        
        return true;
      });
      
      console.log('🔧 After skill filtering:', filteredRequirements.length, 'requirements');
    }
    
  } catch (error) {
    console.error('Error testing matching:', error);
  } finally {
    mongoose.disconnect();
  }
}

testMatching(); 