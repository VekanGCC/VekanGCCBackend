const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

// Set default JWT secret if not in environment
if (!process.env.JWT_SECRET) {
  console.log('Setting default JWT secrets...');
  process.env.JWT_SECRET = 'default_jwt_secret_key_123';
  process.env.JWT_EXPIRE = '30d';
  process.env.JWT_REFRESH_SECRET = 'default_jwt_refresh_secret_key_456';
  process.env.JWT_REFRESH_EXPIRE = '7d';
  process.env.JWT_COOKIE_EXPIRE = 30;
}

console.log('JWT Configuration:', {
  hasSecret: !!process.env.JWT_SECRET,
  hasExpire: !!process.env.JWT_EXPIRE,
  hasRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
  hasRefreshExpire: !!process.env.JWT_REFRESH_EXPIRE,
  hasCookieExpire: !!process.env.JWT_COOKIE_EXPIRE
});

// Connect to database
connectDB();

const app = express();

// CORS configuration - must be before other middleware
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:3000',
    'https://red-field-0bebfae00.1.azurestaticapps.net'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
}));


// Security middleware - temporarily simplified for file download testing
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  // Disable content security policy for file downloads
  contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Only apply rate limiting to specific routes
app.use('/api/auth/login', limiter);
app.use('/api/auth/register', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendor', require('./routes/vendor'));
app.use('/api/client', require('./routes/client'));
app.use('/api/profile', require('./routes/profile'));

// Client dashboard routes
app.use('/api/client/dashboard', require('./routes/clientDashboard'));
app.use('/api/client/bookings', require('./routes/clientBookings'));
app.use('/api/client/services', require('./routes/clientServices'));
app.use('/api/client/reviews', require('./routes/clientReviews'));
app.use('/api/client/settings', require('./routes/clientSettings'));
app.use('/api/client/sow', require('./routes/sow'));

// Vendor dashboard routes
app.use('/api/vendor/dashboard', require('./routes/vendorDashboard'));
app.use('/api/vendor/orders', require('./routes/vendorOrders'));
app.use('/api/vendor/services', require('./routes/vendorServices'));
app.use('/api/vendor/reviews', require('./routes/vendorReviews'));
app.use('/api/vendor/analytics', require('./routes/vendorAnalytics'));
app.use('/api/vendor/payments', require('./routes/vendorPayments'));
app.use('/api/vendor/settings', require('./routes/vendorSettings'));
app.use('/api/vendor/organization', require('./routes/vendorOrganization'));
app.use('/api/vendor/sow', require('./routes/sow'));

// PO routes
app.use('/api/po', require('./routes/po'));
app.use('/api/client/po', require('./routes/po'));
app.use('/api/vendor/po', require('./routes/po'));

// Invoice routes
app.use('/api/invoice', require('./routes/invoice'));
app.use('/api/client/invoice', require('./routes/invoice'));
app.use('/api/vendor/invoice', require('./routes/invoice'));

// Audit log routes
app.use('/api/audit-logs', require('./routes/auditLogs'));

// Workflow routes
app.use('/api/workflows', require('./routes/workflows'));

// Resource management routes
app.use('/api/resources', require('./routes/resources'));
app.use('/api/requirements', require('./routes/requirements'));
app.use('/api/applications', require('./routes/applications'));

// Notifications
app.use('/api/notifications', require('./routes/notifications'));

// Admin routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/admin/categories', require('./routes/adminCategories'));

// Public category routes
app.use('/api/categories', require('./routes/categories'));

// File management routes
app.use('/api/files', require('./routes/files'));

// Additional routes
app.use('/api/users', require('./routes/users'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/vendor/niche-skills', require('./routes/vendorSkills'));
app.use('/api/vendors', require('./routes/vendor'));
app.use('/api/client-settings', require('./routes/clientSettings'));
app.use('/api/vendor-settings', require('./routes/vendorSettings'));

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Handle undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

module.exports = app;