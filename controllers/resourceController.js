const Resource = require('../models/Resource');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');

// @desc    Get all resources
// @route   GET /api/resources
// @access  Private
const getResources = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    search,
    status,
    category,
    skills,
    minExperience,
    maxExperience,
    minRate,
    maxRate,
    approvedVendorsOnly,
    requirementId
  } = req.query;

  // Build query
  let query = {};

  if (search) {
    // First, try to find skills by name that match the search term
    const AdminSkill = require('../models/AdminSkill');
    const matchingSkills = await AdminSkill.find({
      name: { $regex: search, $options: 'i' }
    }).select('_id name');
    
    const skillIds = matchingSkills.map(skill => skill._id);
    
    // Build search query to include name, description, and skills
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
    
    // If we found matching skills, also search in skills field
    if (skillIds.length > 0) {
      query.$or.push({ skills: { $in: skillIds } });
    }
  }

  if (status) {
    query.status = status;
  }

  if (category) {
    query.category = category;
  }

  if (skills) {
    // Handle skills as array or single skill
    const skillsArray = Array.isArray(skills) ? skills : [skills];
    // Filter out any empty values and ensure we have valid ObjectIds
    const validSkillIds = skillsArray.filter(skillId => skillId && skillId.trim() !== '');
    if (validSkillIds.length > 0) {
      const skillLogic = req.query.skillLogic || 'OR';
      
      if (skillLogic === 'AND') {
        // For AND logic, use $all to ensure ALL skills are present
        query.skills = { $all: validSkillIds };
      } else {
        // For OR logic (default), use $in to match ANY of the skills
        query.skills = { $in: validSkillIds };
      }
    }
  }

  // Search by experience range
  if (minExperience || maxExperience) {
    query['experience.years'] = {};
    if (minExperience) {
      query['experience.years'].$gte = parseInt(minExperience);
    }
    if (maxExperience) {
      query['experience.years'].$lte = parseInt(maxExperience);
    }
  }

  // Search by rate range
  if (minRate || maxRate) {
    query['rate.hourly'] = {};
    if (minRate) {
      query['rate.hourly'].$gte = parseInt(minRate);
    }
    if (maxRate) {
      query['rate.hourly'].$lte = parseInt(maxRate);
    }
  }

  // Filter by requirement matching
  if (requirementId) {
    // Get the requirement to extract matching criteria
    const Requirement = require('../models/Requirement');
    const requirement = await Requirement.findById(requirementId)
      .populate('skills', 'name')
      .populate('category', 'name');

    if (requirement) {
      // 1. Skills matching
      const requirementSkills = requirement.skills.map(skill => skill._id);
      const minSkillsToMatch = Math.min(requirementSkills.length, 3); // Max 3 skills to match
      
      if (requirementSkills.length > 0) {
        query.skills = { $in: requirementSkills };
      }

      // 2. Budget matching (resource cost should be less than requirement budget)
      if (requirement.budget && requirement.budget.charge) {
        query['rate.hourly'] = { ...query['rate.hourly'], $lte: requirement.budget.charge };
      }

      // 3. Availability matching (resource should be available before requirement start date)
      if (requirement.startDate) {
        query['availability.start_date'] = { $lte: requirement.startDate };
      }

      // 4. Experience years matching (resource should have equal or more years than requirement)
      if (requirement.experience && requirement.experience.minYears) {
        query['experience.years'] = { $gte: requirement.experience.minYears };
      }

      // 5. Resource should be active
      query.status = 'active';

      // 6. Resource should be available
      query['availability.status'] = { $in: ['available', 'partially_available'] };
    } else {
      query._id = { $in: [] }; // Return no results if requirement not found
    }
  }

  // Filter by approved vendors only
  if (approvedVendorsOnly === 'true') {
    // Get the VendorSkill and AdminSkill models
    const VendorSkill = require('../models/VendorSkill');
    const AdminSkill = require('../models/AdminSkill');
    
    if (skills && skills.length > 0) {
      // Handle skills as array or single skill
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      const validSkillIds = skillsArray.filter(skillId => skillId && skillId.trim() !== '');
      
      if (validSkillIds.length > 0) {
        const skillLogic = req.query.skillLogic || 'OR';
        
        // Get approved vendor skills that match the selected skill IDs
        let approvedVendorSkillsQuery = {
          status: 'approved',
          skill: { $in: validSkillIds }
        };
        
        const approvedVendorSkills = await VendorSkill.find(approvedVendorSkillsQuery);
        
        if (approvedVendorSkills.length > 0) {
          // Group by vendor and check logic
          const vendorSkillMap = {};
          approvedVendorSkills.forEach(vs => {
            if (!vendorSkillMap[vs.vendor]) {
              vendorSkillMap[vs.vendor] = [];
            }
            vendorSkillMap[vs.vendor].push(vs.skill);
          });
          
          let approvedVendors = [];
          
          if (skillLogic === 'AND') {
            // For AND logic, vendor must have ALL selected skills approved
            approvedVendors = Object.keys(vendorSkillMap).filter(vendorId => {
              const vendorSkills = vendorSkillMap[vendorId];
              return validSkillIds.every(skillId => vendorSkills.includes(skillId));
            });
          } else {
            // For OR logic, vendor must have ANY of the selected skills approved
            approvedVendors = Object.keys(vendorSkillMap);
          }
          
          if (approvedVendors.length > 0) {
            query.createdBy = { $in: approvedVendors };
          } else {
            // No vendors have the required approved skills
            query.createdBy = { $in: [] };
          }
        } else {
          // No approved vendor skills found for the selected skills
          query.createdBy = { $in: [] };
        }
      } else {
        // No valid skill IDs, return empty result
        query.createdBy = { $in: [] };
      }
    } else {
      // No skills selected, get all vendors with any approved skills
      const approvedVendors = await VendorSkill.distinct('vendor', { status: 'approved' });
      
      if (approvedVendors.length > 0) {
        query.createdBy = { $in: approvedVendors };
      } else {
        query.createdBy = { $in: [] };
      }
    }
  }

  // Only return resources for the logged-in vendor
  if (req.user && req.user.userType === 'vendor') {
    // If approvedVendorsOnly is true, we need to check if this vendor is approved
    if (approvedVendorsOnly === 'true') {
      const VendorSkill = require('../models/VendorSkill');
      const AdminSkill = require('../models/AdminSkill');
      
      if (skills && skills.length > 0) {
        // Handle skills as array or single skill
        const skillsArray = Array.isArray(skills) ? skills : [skills];
        const validSkillIds = skillsArray.filter(skillId => skillId && skillId.trim() !== '');
        
        if (validSkillIds.length > 0) {
          const skillLogic = req.query.skillLogic || 'OR';
          
          // Check if this vendor has approved skills matching the selected skills
          const vendorApprovedSkills = await VendorSkill.find({ 
            organizationId: req.user.organizationId, 
            status: 'approved',
            skill: { $in: validSkillIds }
          });
          
          if (skillLogic === 'AND') {
            // For AND logic, vendor must have ALL selected skills approved
            const vendorSkillIds = vendorApprovedSkills.map(vs => vs.skill);
            const hasAllSkills = validSkillIds.every(skillId => vendorSkillIds.includes(skillId));
            
            if (!hasAllSkills) {
              // Vendor doesn't have all required approved skills
              query.organizationId = { $in: [] };
            } else {
              // Vendor has all required approved skills - filter by organization
              query.organizationId = req.user.organizationId;
            }
          } else {
            // For OR logic, vendor must have ANY of the selected skills approved
            if (vendorApprovedSkills.length === 0) {
              // Vendor has no approved skills matching the selection
              query.organizationId = { $in: [] };
            } else {
              // Vendor has at least one approved skill matching the selection - filter by organization
              query.organizationId = req.user.organizationId;
            }
          }
        } else {
          // No valid skill IDs
          query.organizationId = { $in: [] };
        }
      } else {
        // No skills selected, check if vendor has any approved skills
        const vendorApprovedSkills = await VendorSkill.find({ 
          organizationId: req.user.organizationId, 
          status: 'approved' 
        });
        
        if (vendorApprovedSkills.length === 0) {
          // Vendor has no approved skills
          query.organizationId = { $in: [] };
        } else {
          // Vendor has approved skills - filter by organization
          query.organizationId = req.user.organizationId;
        }
      }
    } else {
      // Normal vendor filtering - filter by organization
      query.organizationId = req.user.organizationId;
    }
  }

  // Execute query with pagination
  const resources = await Resource.find(query)
    .populate('category', 'name description')
    .populate('skills', 'name description')
    .populate('createdBy', 'firstName lastName email')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Resource.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      resources,
      'Resources retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    )
  );
});

// @desc    Get single resource
// @route   GET /api/resources/:id
// @access  Private
const getResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id)
    .populate('category', 'name description')
    .populate('skills', 'name description')
    .populate('createdBy', 'firstName lastName email');

  if (!resource) {
    return next(new ErrorResponse('Resource not found', 404));
  }

  res.status(200).json(
    ApiResponse.success(resource, 'Resource retrieved successfully')
  );
});

// @desc    Create new resource
// @route   POST /api/resources
// @access  Private
const createResource = asyncHandler(async (req, res, next) => {
  // Add user to req.body from JWT token
  req.body.createdBy = req.user.id;

  // Add organizationId for vendor resources
  if (req.user.userType === 'vendor' && req.user.organizationId) {
    req.body.organizationId = req.user.organizationId;
  }

  // Ensure skills is an array and convert string IDs to ObjectIds
  if (req.body.skills) {
    if (!Array.isArray(req.body.skills)) {
      req.body.skills = [req.body.skills];
    }
    // Filter out any empty or invalid skill IDs
    req.body.skills = req.body.skills.filter(skillId => skillId && skillId.trim() !== '');
  }

  // Remove the old skill field if it exists
  if (req.body.skill) {
    delete req.body.skill;
  }

  const resource = await Resource.create(req.body);

  res.status(201).json(
    ApiResponse.success(resource, 'Resource created successfully')
  );
});

// @desc    Update resource
// @route   PUT /api/resources/:id
// @access  Private
const updateResource = asyncHandler(async (req, res, next) => {
  let resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(new ErrorResponse('Resource not found', 404));
  }

  // Make sure user is resource owner or admin
  if (resource.createdBy.toString() !== req.user.id && req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(
      new ErrorResponse('Not authorized to update this resource', 403)
    );
  }

  resource = await Resource.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json(
    ApiResponse.success(resource, 'Resource updated successfully')
  );
});

// @desc    Delete resource
// @route   DELETE /api/resources/:id
// @access  Private
const deleteResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(new ErrorResponse('Resource not found', 404));
  }

  // Make sure user is resource owner or admin
  if (resource.createdBy.toString() !== req.user.id && req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(
      new ErrorResponse('Not authorized to delete this resource', 403)
    );
  }

  await resource.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'Resource deleted successfully')
  );
});

// @desc    Get matching requirements count for a resource
// @route   GET /api/resources/:id/matching-requirements
// @access  Private
const getMatchingRequirementsCount = asyncHandler(async (req, res, next) => {
  const resourceId = req.params.id;

  // Get the resource
  const resource = await Resource.findById(resourceId)
    .populate('skills', 'name')
    .populate('category', 'name');

  if (!resource) {
    return next(new ErrorResponse('Resource not found', 404));
  }

  // Get the Requirement model
  const Requirement = require('../models/Requirement');

  // Build matching criteria for requirements
  const matchingCriteria = {
    status: 'open' // Only open requirements
  };

  // 1. Skills matching - requirement should have at least some skills that resource has
  if (resource.skills && resource.skills.length > 0) {
    matchingCriteria.skills = { $exists: true, $ne: [] };
  }

  // 2. Experience matching - resource experience must be more than requirement minYears
  if (resource.experience && resource.experience.years) {
    matchingCriteria['experience.minYears'] = { $lte: resource.experience.years };
  }

  // 3. Budget matching - resource charge must be equal to or lesser than requirement budget
  if (resource.rate && resource.rate.hourly) {
    matchingCriteria['budget.charge'] = { $gte: resource.rate.hourly };
  }

  // 4. Availability matching - resource available date must be before requirement start date
  if (resource.availability && resource.availability.start_date) {
    matchingCriteria.startDate = { $gte: resource.availability.start_date };
  }

  // Get all possible requirements
  const totalMatchingRequirements = await Requirement.find(matchingCriteria)
    .populate('skills', 'name')
    .lean();

  // Filter by strict skill match: resource must have all skills required by the requirement
  const filteredRequirements = totalMatchingRequirements.filter(requirement => {
    const requirementSkillIds = requirement.skills.map(skill => skill._id.toString());
    const resourceSkillIds = resource.skills.map(skill => skill._id.toString());
    const hasAllRequiredSkills = requirementSkillIds.every(skillId =>
      resourceSkillIds.includes(skillId)
    );
    return hasAllRequiredSkills;
  });

  const matchingCount = filteredRequirements.length;

  res.status(200).json(
    ApiResponse.success({
      count: matchingCount,
      requirements: []
    }, 'Matching requirements count retrieved successfully')
  );
});

// @desc    Get matching requirements counts for multiple resources (BATCH)
// @route   POST /api/resources/matching-requirements/batch
// @access  Private
const getMatchingRequirementsCountsBatch = asyncHandler(async (req, res, next) => {
  const { resourceIds } = req.body;

  if (!resourceIds || !Array.isArray(resourceIds)) {
    return next(new ErrorResponse('Resource IDs array is required', 400));
  }

  // Get the Requirement model
  const Requirement = require('../models/Requirement');

  const results = [];

  for (const resourceId of resourceIds) {
    try {
      // Get the resource
      const resource = await Resource.findById(resourceId)
        .populate('skills', '_id'); // 🔴 Use only _id for skill comparison

      if (!resource) {
        results.push({
          resourceId,
          count: 0,
          error: 'Resource not found'
        });
        continue;
      }

      // Build base matching criteria
      const matchingCriteria = {
        status: 'open' // Only open requirements
      };

      if (resource.experience && resource.experience.years) {
        matchingCriteria['experience.minYears'] = { $lte: resource.experience.years };
      }

      if (resource.rate && resource.rate.hourly) {
        matchingCriteria['budget.charge'] = { $gte: resource.rate.hourly };
      }

      if (resource.availability && resource.availability.start_date) {
        matchingCriteria.startDate = { $gte: resource.availability.start_date };
      }

      // 🔴 Fetch all requirements matching non-skill criteria
      const possibleRequirements = await Requirement.find(matchingCriteria)
        .populate('skills', '_id') // 🔴 Populate only _id to avoid loading names
        .lean();

      // 🔴 Convert resource skills to string format for comparison
      const resourceSkillIds = resource.skills.map(skill => skill._id.toString());

      // 🔴 Filter requirements: resource must have ALL skills required by the requirement
      const matchingRequirements = possibleRequirements.filter(requirement => {
        const requirementSkillIds = requirement.skills.map(skill => skill._id.toString());
        return requirementSkillIds.every(skillId => resourceSkillIds.includes(skillId));
      });

      // 🔴 Count the matches
      const matchingCount = matchingRequirements.length;

      results.push({
        resourceId,
        count: matchingCount
      });

    } catch (error) {
      console.error('🔧 ResourceController: Error processing resource:', resourceId, error);
      results.push({
        resourceId,
        count: 0,
        error: error.message
      });
    }
  }

  res.status(200).json(
    ApiResponse.success(results, 'Matching requirements counts retrieved successfully')
  );
});

// @desc    Get matching requirements details for a resource
// @route   GET /api/resources/:id/matching-requirements/details
// @access  Private
const getMatchingRequirementsDetails = asyncHandler(async (req, res, next) => {
  const resourceId = req.params.id;
  
  // Get pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get the resource
  const resource = await Resource.findById(resourceId)
    .populate('skills', '_id name') // 🔴 Use _id for skill comparison, name for display
    .populate('category', 'name');

  if (!resource) {
    return next(new ErrorResponse('Resource not found', 404));
  }

  // Verify the resource belongs to the vendor
  // Check if user created the resource OR if it belongs to their organization
  const isOwner = resource.createdBy.toString() === req.user.id;
  const isOrganizationMember = resource.organizationId && 
                              req.user.organizationId && 
                              resource.organizationId.toString() === req.user.organizationId.toString();

  if (!isOwner && !isOrganizationMember) {
    return next(new ErrorResponse('Access denied - You can only view matching requirements for your own resources or resources in your organization', 403));
  }

  // Get the Requirement model
  const Requirement = require('../models/Requirement');

  // 🔴 Use the SAME matching criteria as getMatchingRequirementsCountsBatch
  const matchingCriteria = {
    status: 'open' // Only open requirements
  };

  if (resource.experience && resource.experience.years) {
    matchingCriteria['experience.minYears'] = { $lte: resource.experience.years };
  }

  if (resource.rate && resource.rate.hourly) {
    matchingCriteria['budget.charge'] = { $gte: resource.rate.hourly };
  }

  if (resource.availability && resource.availability.start_date) {
    matchingCriteria.startDate = { $gte: resource.availability.start_date };
  }

  // 🔴 Fetch all requirements matching non-skill criteria (same as batch)
  const possibleRequirements = await Requirement.find(matchingCriteria)
    .populate('skills', '_id name') // 🔴 Populate _id for comparison, name for display
    .populate('category', 'name')
    .populate('createdBy', 'firstName lastName email') // 🔴 Use createdBy instead of client
    .populate('organizationId', 'name')
    .lean();

  // 🔴 Convert resource skills to string format for comparison (same as batch)
  const resourceSkillIds = resource.skills.map(skill => skill._id.toString());

  // 🔴 Filter requirements: resource must have ALL skills required by the requirement (same as batch)
  const matchingRequirements = possibleRequirements.filter(requirement => {
    const requirementSkillIds = requirement.skills.map(skill => skill._id.toString());
    return requirementSkillIds.every(skillId => resourceSkillIds.includes(skillId));
  });

  // Calculate match percentage for each requirement
  const requirementsWithMatchPercentage = matchingRequirements.map(requirement => {
    const requirementSkillIds = requirement.skills.map(skill => skill._id.toString());
    const resourceSkillIds = resource.skills.map(skill => skill._id.toString());
    
    const matchingSkills = resourceSkillIds.filter(skillId => 
      requirementSkillIds.includes(skillId)
    );
    
    // Calculate match percentage based on how well the resource's skills match the requirement's needs
    const resourceSkillMatchPercentage = matchingSkills.length / resourceSkillIds.length;
    const requirementSkillMatchPercentage = matchingSkills.length / requirementSkillIds.length;
    
    // Use the higher percentage to show the best match
    const matchPercentage = Math.round(Math.max(resourceSkillMatchPercentage, requirementSkillMatchPercentage) * 100);
    
    return {
      ...requirement,
      // Add client information from client and organizationId
      client: {
        firstName: requirement.createdBy?.firstName || '',
        lastName: requirement.createdBy?.lastName || '',
        email: requirement.createdBy?.email || '',
        organizationName: requirement.organizationId?.name || 'N/A'
      },
      matchPercentage,
      matchingSkills: matchingSkills.length,
      totalRequiredSkills: requirementSkillIds.length // Show requirement's total skills
    };
  });

  // Sort by match percentage (highest first)
  requirementsWithMatchPercentage.sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Apply pagination
  const totalCount = requirementsWithMatchPercentage.length;
  const paginatedRequirements = requirementsWithMatchPercentage.slice(skip, skip + limit);
  const totalPages = Math.ceil(totalCount / limit);

  res.status(200).json(
    ApiResponse.success({
      resource: {
        _id: resource._id,
        name: resource.name,
        description: resource.description,
        skills: resource.skills,
        experience: resource.experience,
        rate: resource.rate,
        category: resource.category
      },
      matchingRequirements: paginatedRequirements,
      totalCount,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      matchingCriteria: {
        minSkillsToMatch: resource.skills?.length || 0,
        maxBudget: resource.rate?.hourly,
        requiredStartDate: resource.availability?.start_date,
        minExperienceYears: resource.experience?.years
      }
    }, 'Matching requirements details retrieved successfully')
  );
});

module.exports = {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  getMatchingRequirementsCount,
  getMatchingRequirementsCountsBatch,
  getMatchingRequirementsDetails
};