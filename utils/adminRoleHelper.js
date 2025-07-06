/**
 * Helper functions for checking admin permissions using the new organizationRole system
 */

/**
 * Check if user has admin owner permissions (full access including workflow management)
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user has admin owner permissions
 */
const isAdminOwner = (user) => {
  return user.organizationRole === 'admin_owner';
};

/**
 * Check if user has admin employee permissions (all access except workflow management)
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user has admin employee permissions
 */
const isAdminEmployee = (user) => {
  return user.organizationRole === 'admin_employee';
};

/**
 * Check if user has admin account permissions (limited access)
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user has admin account permissions
 */
const isAdminAccount = (user) => {
  return user.organizationRole === 'admin_account';
};

/**
 * Check if user has any admin permissions
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user has any admin permissions
 */
const isAdmin = (user) => {
  return isAdminOwner(user) || isAdminEmployee(user) || isAdminAccount(user);
};

/**
 * Check if user has super admin permissions (admin owner)
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user has super admin permissions
 */
const isSuperAdmin = (user) => {
  return isAdminOwner(user);
};

/**
 * Check if user can access workflow management
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user can access workflow management
 */
const canAccessWorkflowManagement = (user) => {
  return isAdminOwner(user);
};

/**
 * Check if user can manage other users
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user can manage other users
 */
const canManageUsers = (user) => {
  return isAdminOwner(user) || isAdminEmployee(user);
};

/**
 * Check if user can manage system settings
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user can manage system settings
 */
const canManageSystemSettings = (user) => {
  return isAdminOwner(user);
};

module.exports = {
  isAdminOwner,
  isAdminEmployee,
  isAdminAccount,
  isAdmin,
  isSuperAdmin,
  canAccessWorkflowManagement,
  canManageUsers,
  canManageSystemSettings
}; 