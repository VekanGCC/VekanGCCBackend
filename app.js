const express = require('express');
const app = express();
const adminRoutes = require('./routes/admin');
const vendorRoutes = require('./routes/vendor');
const clientRoutes = require('./routes/client');
const skillsRoutes = require('./routes/skills');
const sowRoutes = require('./routes/sow');
const poRoutes = require('./routes/po');
const invoiceRoutes = require('./routes/invoice');
const auditLogRoutes = require('./routes/auditLogs');
const workflowRoutes = require('./routes/workflows');

// Mount routers
app.use('/api/admin', adminRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/sow', sowRoutes);
app.use('/api/po', poRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/workflows', workflowRoutes);

// ... existing code ... 