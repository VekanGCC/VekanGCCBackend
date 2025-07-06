const Requirement = require('../models/Requirement');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const ApiResponse = require('../models/ApiResponse');
const Resource = require('../models/Resource');

// @desc    Get all requirements
// @route   GET /api/requirements
// @access  Private
const getRequirements = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    search,
    status,
    priority,
    category,
    skills,
    skillLogic,
    minBudget,
    maxBudget,
    minDuration,
    maxDuration
  } = req.query;

  // Build query
  let query = {};

  // If user is a client, only show their organization's requirements
  if (req.user.userType === 'client') {
    if (req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    } else {
      // If client doesn't have organizationId, only show their own requirements
      query.createdBy = req.user.id;
    }
  }

  if (search) {
    console.log('🔧 Backend: Searching for term:', search);
    
    // First, try to find skills by name that match the search term
    const AdminSkill = require('../models/AdminSkill');
    const matchingSkills = await AdminSkill.find({
      name: { $regex: search, $options: 'i' }
    }).select('_id name');
    
    console.log('🔧 Backend: Found matching skills:', matchingSkills);
    
    const skillIds = matchingSkills.map(skill => skill._id);
    
    // Build search query to include title, description, and skills
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
    
    // If we found matching skills, also search in skills field
    if (skillIds.length > 0) {
      query.$or.push({ skills: { $in: skillIds } });
      console.log('🔧 Backend: Added skills search with IDs:', skillIds);
    }
    
    console.log('🔧 Backend: Final search query:', JSON.stringify(query, null, 2));
  }

  if (status) {
    query.status = status;
  }

  if (priority) {
    query.priority = priority;
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
      const logic = skillLogic || 'OR';
      
      if (logic === 'AND') {
        // For AND logic, use $all to ensure ALL skills are present
        query.skills = { $all: validSkillIds };
      } else {
        // For OR logic (default), use $in to match ANY of the skills
        query.skills = { $in: validSkillIds };
      }
    }
  }

  // Search by budget range
  if (minBudget || maxBudget) {
    query['budget.charge'] = {};
    if (minBudget) {
      query['budget.charge'].$gte = parseInt(minBudget);
    }
    if (maxBudget) {
      query['budget.charge'].$lte = parseInt(maxBudget);
    }
  }

  // Search by duration range
  if (minDuration || maxDuration) {
    query.duration = {};
    if (minDuration) {
      query.duration.$gte = parseInt(minDuration);
    }
    if (maxDuration) {
      query.duration.$lte = parseInt(maxDuration);
    }
  }

  // Execute query with pagination - OPTIMIZED
  const requirements = await Requirement.find(query)
    .populate('category', 'name description') // Only select needed fields
    .populate('skills', 'name description')   // Only select needed fields
    .populate('createdBy', 'firstName lastName email companyName contactPerson') // Populate creator info
    .populate('organizationId', 'name organizationType') // Populate organization info
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean(); // Use lean() for better performance when you don't need Mongoose documents

  // Add client information to each requirement
  const requirementsWithClientInfo = requirements.map(requirement => {
    const requirementWithClientInfo = { ...requirement };
    
    // Add client name and contact person
    if (requirement.organizationId) {
      requirementWithClientInfo.clientName = requirement.organizationId.name;
      requirementWithClientInfo.clientType = requirement.organizationId.organizationType;
    }
    
    if (requirement.createdBy) {
      requirementWithClientInfo.contactPerson = `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`;
      requirementWithClientInfo.contactEmail = requirement.createdBy.email;
      requirementWithClientInfo.contactCompany = requirement.createdBy.companyName;
    }
    
    return requirementWithClientInfo;
  });

  const total = await Requirement.countDocuments(query);

  res.status(200).json(
    ApiResponse.success(
      requirementsWithClientInfo,
      'Requirements retrieved successfully',
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    )
  );
});

// @desc    Get single requirement
// @route   GET /api/requirements/:id
// @access  Private
const getRequirement = asyncHandler(async (req, res, next) => {
  const requirement = await Requirement.findById(req.params.id)
    .populate('category')
    .populate('skills')
    .populate('createdBy', 'firstName lastName email companyName contactPerson')
    .populate('organizationId', 'name organizationType');

  if (!requirement) {
    return next(new ErrorResponse('Requirement not found', 404));
  }

  // Add client information to the response
  const requirementWithClientInfo = requirement.toObject();
  
  // Add client name and contact person
  if (requirement.organizationId) {
    requirementWithClientInfo.clientName = requirement.organizationId.name;
    requirementWithClientInfo.clientType = requirement.organizationId.organizationType;
  }
  
  if (requirement.createdBy) {
    requirementWithClientInfo.contactPerson = `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`;
    requirementWithClientInfo.contactEmail = requirement.createdBy.email;
    requirementWithClientInfo.contactCompany = requirement.createdBy.companyName;
  }

  res.status(200).json(
    ApiResponse.success(requirementWithClientInfo, 'Requirement retrieved successfully')
  );
});

// @desc    Create new requirement
// @route   POST /api/requirements
// @access  Private
const createRequirement = asyncHandler(async (req, res, next) => {
  // Add user to req.body from JWT token
  req.body.createdBy = req.user.id;

  // Add organizationId from user's organization
  if (req.user.organizationId) {
    req.body.organizationId = req.user.organizationId;
  } else {
    return next(new ErrorResponse('User must belong to an organization to create requirements', 400));
  }

  console.log('🔧 Backend: Creating requirement with body:', JSON.stringify(req.body, null, 2));
  console.log('🔧 Backend: Budget field:', req.body.budget);
  console.log('🔧 Backend: Budget charge value:', req.body.budget?.charge);

  const requirement = await Requirement.create(req.body);

  console.log('🔧 Backend: Created requirement:', JSON.stringify(requirement, null, 2));
  console.log('🔧 Backend: Saved budget field:', requirement.budget);

  res.status(201).json(
    ApiResponse.success(requirement, 'Requirement created successfully')
  );
});

// @desc    Update requirement
// @route   PUT /api/requirements/:id
// @access  Private
const updateRequirement = asyncHandler(async (req, res, next) => {
  let requirement = await Requirement.findById(req.params.id);

  if (!requirement) {
    return next(new ErrorResponse('Requirement not found', 404));
  }

  // Make sure user is requirement owner or admin
  if (requirement.createdBy.toString() !== req.user.id && req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(
      new ErrorResponse('Not authorized to update this requirement', 403)
    );
  }

  requirement = await Requirement.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
  .populate('category')
  .populate('skills')
  .populate('createdBy', 'firstName lastName email companyName contactPerson')
  .populate('organizationId', 'name organizationType');

  // Add client information to the response
  const requirementWithClientInfo = requirement.toObject();
  
  // Add client name and contact person
  if (requirement.organizationId) {
    requirementWithClientInfo.clientName = requirement.organizationId.name;
    requirementWithClientInfo.clientType = requirement.organizationId.organizationType;
  }
  
  if (requirement.createdBy) {
    requirementWithClientInfo.contactPerson = `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`;
    requirementWithClientInfo.contactEmail = requirement.createdBy.email;
    requirementWithClientInfo.contactCompany = requirement.createdBy.companyName;
  }

  res.status(200).json(
    ApiResponse.success(requirementWithClientInfo, 'Requirement updated successfully')
  );
});

// @desc    Update requirement status
// @route   PUT /api/requirements/:id/status
// @access  Private
const updateRequirementStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new ErrorResponse('Status is required', 400));
  }

  let requirement = await Requirement.findById(req.params.id);

  if (!requirement) {
    return next(new ErrorResponse('Requirement not found', 404));
  }

  // Make sure user is requirement owner or admin
  if (requirement.createdBy.toString() !== req.user.id && req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(
      new ErrorResponse('Not authorized to update this requirement', 403)
    );
  }

  requirement = await Requirement.findByIdAndUpdate(
    req.params.id, 
    { status }, 
    {
      new: true,
      runValidators: true
    }
  )
  .populate('category')
  .populate('skills')
  .populate('createdBy', 'firstName lastName email companyName contactPerson')
  .populate('organizationId', 'name organizationType');

  // Add client information to the response
  const requirementWithClientInfo = requirement.toObject();
  
  // Add client name and contact person
  if (requirement.organizationId) {
    requirementWithClientInfo.clientName = requirement.organizationId.name;
    requirementWithClientInfo.clientType = requirement.organizationId.organizationType;
  }
  
  if (requirement.createdBy) {
    requirementWithClientInfo.contactPerson = `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`;
    requirementWithClientInfo.contactEmail = requirement.createdBy.email;
    requirementWithClientInfo.contactCompany = requirement.createdBy.companyName;
  }

  res.status(200).json(
    ApiResponse.success(requirementWithClientInfo, 'Requirement status updated successfully')
  );
});

// @desc    Delete requirement
// @route   DELETE /api/requirements/:id
// @access  Private
const deleteRequirement = asyncHandler(async (req, res, next) => {
  const requirement = await Requirement.findById(req.params.id);

  if (!requirement) {
    return next(new ErrorResponse('Requirement not found', 404));
  }

  // Make sure user is requirement owner or admin
  if (requirement.createdBy.toString() !== req.user.id && req.user.organizationRole !== 'admin_owner' && req.user.organizationRole !== 'admin_employee') {
    return next(
      new ErrorResponse('Not authorized to delete this requirement', 403)
    );
  }

  await requirement.deleteOne();

  res.status(200).json(
    ApiResponse.success(null, 'Requirement deleted successfully')
  );
});

// @desc    Get matching resources count for a requirement
// @route   GET /api/requirements/:id/matching-resources
// @access  Private
const getMatchingResourcesCount = asyncHandler(async (req, res, next) => {
  const requirement = await Requirement.findById(req.params.id)
    .populate('skills', 'name')
    .populate('category', 'name');

  if (!requirement) {
    return next(new ErrorResponse('Requirement not found', 404));
  }

  // Build matching criteria
  const matchingCriteria = {};

  // 1. Skills matching
  const requirementSkills = requirement.skills.map(skill => skill._id);
  const minSkillsToMatch = Math.min(requirementSkills.length, 3); // Max 3 skills to match
  
  if (requirementSkills.length > 0) {
    matchingCriteria.skills = { $in: requirementSkills };
  }

  // 2. Budget matching (resource cost should be less than requirement budget)
  if (requirement.budget && requirement.budget.charge) {
    matchingCriteria['rate.hourly'] = { $lte: requirement.budget.charge };
  }

  // 3. Availability matching (resource should be available before requirement start date)
  if (requirement.startDate) {
    matchingCriteria['availability.start_date'] = { $lte: requirement.startDate };
  }

  // 4. Resource should be active
  matchingCriteria.status = 'active';

  // 5. Resource should be available
  matchingCriteria['availability.status'] = { $in: ['available', 'partially_available'] };

  // Get matching resources
  const matchingResources = await Resource.find(matchingCriteria)
    .populate('skills', 'name')
    .populate('category', 'name')
    .lean();

  // Filter by exact skills matching
  const filteredResources = matchingResources.filter(resource => {
    const resourceSkillIds = resource.skills.map(skill => skill._id.toString());
    const requirementSkillIds = requirementSkills.map(skill => skill.toString());
    
    // Count how many requirement skills are present in resource
    const matchingSkills = requirementSkillIds.filter(skillId => 
      resourceSkillIds.includes(skillId)
    );
    
    // Check if we have the minimum required skills
    if (matchingSkills.length < minSkillsToMatch) {
      return false;
    }

    // Check experience years matching - resource should have equal or more years than requirement
    const requirementMinYears = requirement.experience?.minYears || 0;
    const resourceYears = resource.experience?.years || 0;
    
    if (resourceYears < requirementMinYears) {
      return false;
    }

    return true;
  });

  // Additional filtering for budget and availability
  const finalMatchingResources = filteredResources.filter(resource => {
    // Budget check
    if (requirement.budget && requirement.budget.charge && resource.rate && resource.rate.hourly) {
      if (resource.rate.hourly > requirement.budget.charge) {
        return false;
      }
    }

    // Availability check
    if (requirement.startDate && resource.availability && resource.availability.start_date) {
      if (new Date(resource.availability.start_date) > new Date(requirement.startDate)) {
        return false;
      }
    }

    return true;
  });

  res.status(200).json(
    ApiResponse.success({
      count: finalMatchingResources.length,
      requirement: {
        _id: requirement._id,
        title: requirement.title,
        skills: requirement.skills,
        budget: requirement.budget,
        startDate: requirement.startDate,
        experience: requirement.experience
      },
      matchingCriteria: {
        minSkillsToMatch,
        maxBudget: requirement.budget?.charge,
        requiredStartDate: requirement.startDate,
        minExperienceYears: requirement.experience?.minYears
      }
    }, 'Matching resources count retrieved successfully')
  );
});

// @desc    Get matching resources counts for multiple requirements (BATCH)
// @route   POST /api/requirements/matching-resources/batch
// @access  Private
const getMatchingResourcesCountsBatch = asyncHandler(async (req, res, next) => {
  const { requirementIds } = req.body;

  if (!requirementIds || !Array.isArray(requirementIds) || requirementIds.length === 0) {
    return next(new ErrorResponse('Requirement IDs array is required', 400));
  }

  // Limit batch size to prevent abuse
  if (requirementIds.length > 100) {
    return next(new ErrorResponse('Batch size cannot exceed 100 requirements', 400));
  }

  // Get all requirements in one query
  const requirements = await Requirement.find({ 
    _id: { $in: requirementIds },
    ...(req.user.userType === 'client' ? { organizationId: req.user.organizationId } : {})
  })
    .populate('skills', 'name')
    .populate('category', 'name')
    .lean();

  const results = {};

  // Process each requirement
  for (const requirement of requirements) {
    // Build matching criteria
    const matchingCriteria = {};

    // 1. Skills matching
    const requirementSkills = requirement.skills.map(skill => skill._id);
    const minSkillsToMatch = Math.min(requirementSkills.length, 3);
    
    if (requirementSkills.length > 0) {
      matchingCriteria.skills = { $in: requirementSkills };
    }

    // 2. Budget matching
    if (requirement.budget && requirement.budget.charge) {
      matchingCriteria['rate.hourly'] = { $lte: requirement.budget.charge };
    }

    // 3. Availability matching
    if (requirement.startDate) {
      matchingCriteria['availability.start_date'] = { $lte: requirement.startDate };
    }

    // 4. Resource should be active and available
    matchingCriteria.status = 'active';
    matchingCriteria['availability.status'] = { $in: ['available', 'partially_available'] };

    // Get matching resources count
    const matchingResources = await Resource.find(matchingCriteria)
      .populate('skills', 'name')
      .lean();

    // Filter by exact skills matching and experience
    const filteredCount = matchingResources.filter(resource => {
      const resourceSkillIds = resource.skills.map(skill => skill._id.toString());
      const requirementSkillIds = requirementSkills.map(skill => skill.toString());
      
      const matchingSkills = requirementSkillIds.filter(skillId => 
        resourceSkillIds.includes(skillId)
      );
      
      if (matchingSkills.length < minSkillsToMatch) {
        return false;
      }

      // Check experience years
      const requirementMinYears = requirement.experience?.minYears || 0;
      const resourceYears = resource.experience?.years || 0;
      
      if (resourceYears < requirementMinYears) {
        return false;
      }

      return true;
    }).length;

    results[requirement._id.toString()] = filteredCount;
  }

  res.status(200).json(
    ApiResponse.success(results, 'Matching resources counts retrieved successfully')
  );
});

// @desc    Get matching resources details for a requirement
// @route   GET /api/client/matching-resources/:requirementId
// @access  Private
const getMatchingResourcesDetails = asyncHandler(async (req, res, next) => {
  const requirementId = req.params.requirementId;
  
  // Get pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  console.log('🔧 RequirementController: Getting matching resources details for requirement:', requirementId, 'page:', page, 'limit:', limit);
  console.log('🔧 RequirementController: User info:', {
    userType: req.user.userType,
    userId: req.user.id,
    organizationId: req.user.organizationId
  });

  // Get the requirement
  const requirement = await Requirement.findById(requirementId)
    .populate('skills', 'name')
    .populate('category', 'name');

  if (!requirement) {
    return next(new ErrorResponse('Requirement not found', 404));
  }

  console.log('🔧 RequirementController: Found requirement:', {
    _id: requirement._id,
    title: requirement.title,
    createdBy: requirement.createdBy,
    organizationId: requirement.organizationId
  });

  // Verify the requirement belongs to the client
  // Check if user created the requirement OR if it belongs to their organization
  const isOwner = requirement.createdBy.toString() === req.user.id;
  const isOrganizationMember = requirement.organizationId && 
                              req.user.organizationId && 
                              requirement.organizationId.toString() === req.user.organizationId.toString();
  
  console.log('🔧 RequirementController: Authorization check:', {
    isOwner,
    isOrganizationMember,
    requirementCreatedBy: requirement.createdBy.toString(),
    currentUserId: req.user.id,
    requirementOrgId: requirement.organizationId?.toString(),
    userOrgId: req.user.organizationId?.toString()
  });

  if (!isOwner && !isOrganizationMember) {
    return next(new ErrorResponse('Access denied - You can only view matching resources for your own requirements or requirements in your organization', 403));
  }

  // Build matching criteria
  const matchingCriteria = {};

  // 1. Skills matching
  const requirementSkills = requirement.skills.map(skill => skill._id);
  const minSkillsToMatch = Math.min(requirementSkills.length, 3); // Max 3 skills to match
  
  if (requirementSkills.length > 0) {
    matchingCriteria.skills = { $in: requirementSkills };
  }

  // 2. Budget matching (resource cost should be less than requirement budget)
  if (requirement.budget && requirement.budget.charge) {
    matchingCriteria['rate.hourly'] = { $lte: requirement.budget.charge };
  }

  // 3. Availability matching (resource should be available before requirement start date)
  if (requirement.startDate) {
    matchingCriteria['availability.start_date'] = { $lte: requirement.startDate };
  }

  // 4. Resource should be active
  matchingCriteria.status = 'active';

  // 5. Resource should be available
  matchingCriteria['availability.status'] = { $in: ['available', 'partially_available'] };

  // Get total count first
  const totalMatchingResources = await Resource.find(matchingCriteria)
    .populate('skills', 'name')
    .populate('category', 'name')
    .populate('createdBy', 'firstName lastName email')
    .populate('organizationId', 'name')
    .lean();

  // Filter by exact skills matching
  const filteredResources = totalMatchingResources.filter(resource => {
    const resourceSkillIds = resource.skills.map(skill => skill._id.toString());
    const requirementSkillIds = requirementSkills.map(skill => skill.toString());
    
    // Count how many requirement skills are present in resource
    const matchingSkills = requirementSkillIds.filter(skillId => 
      resourceSkillIds.includes(skillId)
    );
    
    // Check if we have the minimum required skills
    if (matchingSkills.length < minSkillsToMatch) {
      return false;
    }

    // Check experience years matching - resource should have equal or more years than requirement
    const requirementMinYears = requirement.experience?.minYears || 0;
    const resourceYears = resource.experience?.years || 0;
    
    if (resourceYears < requirementMinYears) {
      return false;
    }

    return true;
  });

  // Additional filtering for budget and availability
  const finalMatchingResources = filteredResources.filter(resource => {
    // Budget check
    if (requirement.budget && requirement.budget.charge && resource.rate && resource.rate.hourly) {
      if (resource.rate.hourly > requirement.budget.charge) {
        return false;
      }
    }

    // Availability check
    if (requirement.startDate && resource.availability && resource.availability.start_date) {
      if (new Date(resource.availability.start_date) > new Date(requirement.startDate)) {
        return false;
      }
    }

    return true;
  });

  // Calculate match percentage for each resource
  const resourcesWithMatchPercentage = finalMatchingResources.map(resource => {
    const resourceSkillIds = resource.skills.map(skill => skill._id.toString());
    const requirementSkillIds = requirementSkills.map(skill => skill.toString());
    
    const matchingSkills = requirementSkillIds.filter(skillId => 
      resourceSkillIds.includes(skillId)
    );
    
    const matchPercentage = Math.round((matchingSkills.length / requirementSkills.length) * 100);
    
    return {
      ...resource,
      // Add vendor information from createdBy and organizationId
      vendor: {
        firstName: resource.createdBy?.firstName || '',
        lastName: resource.createdBy?.lastName || '',
        email: resource.createdBy?.email || '',
        organizationName: resource.organizationId?.name || 'N/A'
      },
      matchPercentage,
      matchingSkills: matchingSkills.length,
      totalRequiredSkills: requirementSkills.length
    };
  });

  // Sort by match percentage (highest first)
  resourcesWithMatchPercentage.sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Apply pagination
  const totalCount = resourcesWithMatchPercentage.length;
  const paginatedResources = resourcesWithMatchPercentage.slice(skip, skip + limit);
  const totalPages = Math.ceil(totalCount / limit);

  console.log('🔧 RequirementController: Pagination info:', {
    totalCount,
    page,
    limit,
    skip,
    totalPages,
    returnedCount: paginatedResources.length
  });

  res.status(200).json(
    ApiResponse.success({
      requirement: {
        _id: requirement._id,
        title: requirement.title,
        description: requirement.description,
        skills: requirement.skills,
        budget: requirement.budget,
        startDate: requirement.startDate,
        experience: requirement.experience,
        category: requirement.category
      },
      matchingResources: paginatedResources,
      totalCount,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      matchingCriteria: {
        minSkillsToMatch,
        maxBudget: requirement.budget?.charge,
        requiredStartDate: requirement.startDate,
        minExperienceYears: requirement.experience?.minYears
      }
    }, 'Matching resources details retrieved successfully')
  );
});

module.exports = {
  getRequirements,
  getRequirement,
  createRequirement,
  updateRequirement,
  updateRequirementStatus,
  deleteRequirement,
  getMatchingResourcesCount,
  getMatchingResourcesCountsBatch,
  getMatchingResourcesDetails
};