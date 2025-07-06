const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const fs = require('fs');
const path = require('path');

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Admin only)
const getSystemSettings = asyncHandler(async (req, res, next) => {
  // In a real implementation, these would be stored in a database
  // For this example, we'll return some default settings
  const settings = {
    general: {
      siteName: 'Service Marketplace',
      siteDescription: 'Find and book services from trusted professionals',
      contactEmail: 'support@servicemarketplace.com',
      supportPhone: '+1-800-123-4567'
    },
    fees: {
      platformFeePercentage: 10,
      transactionFeeFixed: 0.30,
      minimumPayout: 50
    },
    approvals: {
      requireVendorApproval: true,
      requireServiceApproval: true,
      autoApproveClients: true
    },
    email: {
      sendWelcomeEmail: true,
      sendOrderConfirmations: true,
      sendReviewNotifications: true
    },
    security: {
      passwordExpiryDays: 90,
      maxLoginAttempts: 5,
      requireEmailVerification: true,
      requirePhoneVerification: false
    }
  };

  res.status(200).json({
    success: true,
    data: settings
  });
});

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
const updateSystemSettings = asyncHandler(async (req, res, next) => {
  // In a real implementation, these would be stored in a database
  // For this example, we'll just return the updated settings
  
  const updatedSettings = req.body;
  
  // Validate settings (basic validation)
  if (updatedSettings.fees) {
    if (updatedSettings.fees.platformFeePercentage < 0 || updatedSettings.fees.platformFeePercentage > 100) {
      return next(new ErrorResponse('Platform fee percentage must be between 0 and 100', 400));
    }
  }

  res.status(200).json({
    success: true,
    data: updatedSettings,
    message: 'Settings updated successfully'
  });
});

// @desc    Get email templates
// @route   GET /api/admin/settings/email-templates
// @access  Private (Admin only)
const getEmailTemplates = asyncHandler(async (req, res, next) => {
  // In a real implementation, these would be stored in a database
  // For this example, we'll return some default templates
  const templates = [
    {
      id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to Service Marketplace',
      body: 'Hello {{name}},\n\nWelcome to Service Marketplace! We\'re excited to have you join our community.\n\nBest regards,\nThe Service Marketplace Team'
    },
    {
      id: 'order_confirmation',
      name: 'Order Confirmation',
      subject: 'Your Order Confirmation',
      body: 'Hello {{name}},\n\nYour order #{{orderNumber}} has been confirmed.\n\nOrder Details:\nService: {{serviceName}}\nDate: {{date}}\nAmount: {{amount}}\n\nThank you for your business!\n\nBest regards,\nThe Service Marketplace Team'
    },
    {
      id: 'password_reset',
      name: 'Password Reset',
      subject: 'Password Reset Request',
      body: 'Hello {{name}},\n\nYou recently requested to reset your password. Please click the link below to reset it:\n\n{{resetLink}}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThe Service Marketplace Team'
    }
  ];

  res.status(200).json({
    success: true,
    data: templates
  });
});

// @desc    Update email template
// @route   PUT /api/admin/settings/email-templates/:id
// @access  Private (Admin only)
const updateEmailTemplate = asyncHandler(async (req, res, next) => {
  const { subject, body } = req.body;
  const templateId = req.params.id;
  
  // In a real implementation, this would update the template in the database
  // For this example, we'll just return the updated template
  
  if (!subject || !body) {
    return next(new ErrorResponse('Subject and body are required', 400));
  }

  const updatedTemplate = {
    id: templateId,
    name: templateId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    subject,
    body
  };

  res.status(200).json({
    success: true,
    data: updatedTemplate,
    message: 'Email template updated successfully'
  });
});

// @desc    Get system logs
// @route   GET /api/admin/settings/logs
// @access  Private (Admin only)
const getSystemLogs = asyncHandler(async (req, res, next) => {
  const { type = 'system', page = 1, limit = 50 } = req.query;
  
  // In a real implementation, logs would be stored in a database or read from log files
  // For this example, we'll return mock logs
  
  const mockLogs = [];
  const logTypes = {
    system: 'System',
    auth: 'Authentication',
    error: 'Error',
    transaction: 'Transaction'
  };
  
  // Generate mock logs
  for (let i = 0; i < limit; i++) {
    const date = new Date();
    date.setMinutes(date.getMinutes() - i * 10);
    
    mockLogs.push({
      id: `log-${Date.now()}-${i}`,
      timestamp: date.toISOString(),
      type: logTypes[type] || 'System',
      level: ['INFO', 'WARN', 'ERROR'][Math.floor(Math.random() * 3)],
      message: `Sample ${logTypes[type] || 'System'} log entry #${i + 1}`,
      details: {
        ip: '192.168.1.' + Math.floor(Math.random() * 255),
        user: Math.random() > 0.5 ? 'admin@example.com' : null,
        action: ['login', 'logout', 'create', 'update', 'delete'][Math.floor(Math.random() * 5)]
      }
    });
  }

  res.status(200).json({
    success: true,
    data: mockLogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: 1000, // Mock total
      pages: Math.ceil(1000 / limit)
    }
  });
});

module.exports = {
  getSystemSettings,
  updateSystemSettings,
  getEmailTemplates,
  updateEmailTemplate,
  getSystemLogs
};