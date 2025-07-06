# Service Marketplace Backend API

A comprehensive Node.js backend application with Express and MongoDB for a service marketplace platform, supporting both vendors and clients with JWT authentication.

## Features

- **Multi-step Registration**: 5-step registration process for both vendors and clients
- **JWT Authentication**: Secure JWT-based authentication with refresh tokens
- **Email Verification**: Email verification system with resend functionality
- **Phone Verification**: SMS verification system
- **File Upload**: Document upload functionality with validation
- **Password Reset**: Secure password reset via email
- **Role-based Access**: Different access levels for vendors and clients
- **Input Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Centralized error handling with meaningful messages
- **Rate Limiting**: API rate limiting for security
- **Security Headers**: Helmet.js for security headers

## Client Features
- Dashboard with booking statistics and spending analytics
- Service browsing and booking
- Review management
- Saved services
- Booking history and tracking

## Vendor Features
- Dashboard with revenue and order analytics
- Service management
- Order processing
- Review management
- Payment tracking
- Analytics and reporting

## API Authentication

All API endpoints (except public routes like login/register) require JWT authentication:

1. When a user logs in, they receive a JWT token and refresh token
2. For subsequent API calls, include the JWT token in the Authorization header:
   ```
   Authorization: Bearer <your_jwt_token>
   ```
3. If the token expires, use the refresh token endpoint to get a new JWT token

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration:
   - MongoDB connection string
   - JWT secrets
   - Email SMTP settings
   - Other configuration values

5. Create uploads directory:
   ```bash
   mkdir uploads
   ```

6. Start the server:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/reset-password/:token` - Reset password
- `GET /api/auth/verify-email/:token` - Verify email
- `POST /api/auth/verify-phone` - Verify phone number
- `POST /api/auth/resend-verification` - Resend verification email
- `GET /api/auth/me` - Get current user

### Client Dashboard Routes
- `GET /api/client/dashboard/overview` - Get dashboard overview
- `GET /api/client/dashboard/recent-bookings` - Get recent bookings
- `GET /api/client/dashboard/upcoming-bookings` - Get upcoming bookings
- `GET /api/client/dashboard/booking-history` - Get booking history
- `GET /api/client/dashboard/spending-analytics` - Get spending analytics
- `GET /api/client/dashboard/saved-services` - Get saved services
- `GET /api/client/dashboard/my-reviews` - Get client reviews
- `GET /api/client/dashboard/pending-reviews` - Get services requiring reviews
- `GET /api/client/dashboard/recommendations` - Get recommended services
- `GET /api/client/dashboard/notifications` - Get client notifications

### Client Booking Routes
- `GET /api/client/bookings` - Get all client bookings
- `POST /api/client/bookings` - Create new booking
- `GET /api/client/bookings/:id` - Get single booking
- `PUT /api/client/bookings/:id` - Update booking
- `PUT /api/client/bookings/:id/cancel` - Cancel booking
- `GET /api/client/bookings/statistics` - Get booking statistics
- `GET /api/client/bookings/:id/history` - Get booking history

### Vendor Dashboard Routes
- `GET /api/vendor/dashboard/overview` - Get dashboard overview
- `GET /api/vendor/dashboard/recent-orders` - Get recent orders
- `GET /api/vendor/dashboard/revenue-analytics` - Get revenue analytics
- `GET /api/vendor/dashboard/service-performance` - Get service performance
- `GET /api/vendor/dashboard/customer-insights` - Get customer insights
- `GET /api/vendor/dashboard/order-status` - Get order status distribution
- `GET /api/vendor/dashboard/recent-reviews` - Get recent reviews
- `GET /api/vendor/dashboard/notifications` - Get notification summary

### Vendor Order Routes
- `GET /api/vendor/orders` - Get all vendor orders
- `GET /api/vendor/orders/:id` - Get single order
- `PUT /api/vendor/orders/:id/status` - Update order status
- `PUT /api/vendor/orders/:id/notes` - Add order notes
- `GET /api/vendor/orders/statistics` - Get order statistics
- `GET /api/vendor/orders/:id/history` - Get order history

### Vendor Service Routes
- `GET /api/vendor/services` - Get all vendor services
- `POST /api/vendor/services` - Create new service
- `GET /api/vendor/services/:id` - Get single service
- `PUT /api/vendor/services/:id` - Update service
- `DELETE /api/vendor/services/:id` - Delete service
- `PUT /api/vendor/services/:id/toggle-status` - Toggle service status
- `GET /api/vendor/services/:id/analytics` - Get service analytics

### Vendor Review Routes
- `GET /api/vendor/reviews` - Get vendor reviews
- `GET /api/vendor/reviews/:id` - Get single review
- `PUT /api/vendor/reviews/:id/respond` - Respond to review
- `PUT /api/vendor/reviews/:id/report` - Report a review
- `GET /api/vendor/reviews/statistics` - Get review statistics

### Vendor Analytics Routes
- `GET /api/vendor/analytics/overview` - Get analytics overview
- `GET /api/vendor/analytics/revenue` - Get revenue analytics
- `GET /api/vendor/analytics/customers` - Get customer analytics
- `GET /api/vendor/analytics/services` - Get service analytics

### Vendor Payment Routes
- `GET /api/vendor/payments/summary` - Get payment summary
- `GET /api/vendor/payments/history` - Get payment history
- `GET /api/vendor/payments/methods` - Get payment methods
- `POST /api/vendor/payments/methods` - Add payment method
- `PUT /api/vendor/payments/methods/:id` - Update payment method
- `DELETE /api/vendor/payments/methods/:id` - Delete payment method

### Resource Management Routes
- `GET /api/resources` - Get all resources
- `POST /api/resources` - Create new resource
- `GET /api/resources/:id` - Get single resource
- `PUT /api/resources/:id` - Update resource
- `DELETE /api/resources/:id` - Delete resource

### Requirement Management Routes
- `GET /api/requirements` - Get all requirements
- `POST /api/requirements` - Create new requirement
- `GET /api/requirements/:id` - Get single requirement
- `PUT /api/requirements/:id` - Update requirement
- `PUT /api/requirements/:id/status` - Update requirement status
- `DELETE /api/requirements/:id` - Delete requirement

### Application Management Routes
- `GET /api/applications` - Get all applications
- `GET /api/applications/vendor` - Get vendor applications
- `GET /api/applications/client` - Get client applications
- `POST /api/applications` - Create new application
- `GET /api/applications/:id` - Get single application
- `PUT /api/applications/:id` - Update application
- `PUT /api/applications/:id/status` - Update application status
- `DELETE /api/applications/:id` - Delete application
- `GET /api/applications/:id/history` - Get application history

### Notification Routes
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/count` - Get notification count
- `PUT /api/notifications/read-all` - Mark all notifications as read
- `PUT /api/notifications/:id/read` - Mark notification as read
- `DELETE /api/notifications/:id` - Delete notification

## Environment Variables

Required environment variables:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/auth_system
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRE=30d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_NAME=Service Marketplace
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=5242880
```

## Security Features

- JWT authentication with token expiration
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- Security headers with Helmet.js
- File upload validation
- Refresh token mechanism
- Role-based access control

## Error Handling

The application includes comprehensive error handling with:
- Custom error response class
- Validation error formatting
- Database error handling
- JWT error handling
- File upload error handling