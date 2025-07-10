/**
 * Application Status Mapping Utility
 * 
 * This utility defines which application statuses are considered "active" vs "inactive"
 * for the purpose of determining if a resource/requirement can be safely deactivated.
 */

// Application statuses that are considered ACTIVE (ongoing/active applications)
const ACTIVE_STATUSES = [
  'applied',      // Application submitted and under review
  'pending',      // Application is pending approval/review
  'shortlisted',  // Resource has been shortlisted
  'interview',    // Interview process is ongoing
  'accepted',     // Application has been accepted
  'offer_created', // Offer has been created
  'offer_accepted', // Offer has been accepted
  'onboarded'     // Resource has been onboarded
];

// Application statuses that are considered INACTIVE (completed/terminated applications)
const INACTIVE_STATUSES = [
  'rejected',     // Application was rejected
  'withdrawn',    // Application was withdrawn by applicant
  'did_not_join', // Resource accepted but didn't join
  'cancelled'     // Application was cancelled
];

/**
 * Check if an application status is considered active
 * @param {string} status - The application status to check
 * @returns {boolean} - True if the status is active, false otherwise
 */
const isActiveStatus = (status) => {
  return ACTIVE_STATUSES.includes(status);
};

/**
 * Check if an application status is considered inactive
 * @param {string} status - The application status to check
 * @returns {boolean} - True if the status is inactive, false otherwise
 */
const isInactiveStatus = (status) => {
  return INACTIVE_STATUSES.includes(status);
};

/**
 * Get all active statuses
 * @returns {string[]} - Array of active status strings
 */
const getActiveStatuses = () => {
  return [...ACTIVE_STATUSES];
};

/**
 * Get all inactive statuses
 * @returns {string[]} - Array of inactive status strings
 */
const getInactiveStatuses = () => {
  return [...INACTIVE_STATUSES];
};

/**
 * Get the status category (active/inactive) for a given status
 * @param {string} status - The application status to categorize
 * @returns {string} - 'active' or 'inactive'
 */
const getStatusCategory = (status) => {
  if (isActiveStatus(status)) {
    return 'active';
  } else if (isInactiveStatus(status)) {
    return 'inactive';
  } else {
    // Default to inactive for unknown statuses
    return 'inactive';
  }
};

/**
 * Get a MongoDB query object to filter for active applications
 * @returns {Object} - MongoDB query object for active applications
 */
const getActiveApplicationsQuery = () => {
  return { status: { $in: ACTIVE_STATUSES } };
};

/**
 * Get a MongoDB query object to filter for inactive applications
 * @returns {Object} - MongoDB query object for inactive applications
 */
const getInactiveApplicationsQuery = () => {
  return { status: { $in: INACTIVE_STATUSES } };
};

module.exports = {
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  isActiveStatus,
  isInactiveStatus,
  getActiveStatuses,
  getInactiveStatuses,
  getStatusCategory,
  getActiveApplicationsQuery,
  getInactiveApplicationsQuery
}; 