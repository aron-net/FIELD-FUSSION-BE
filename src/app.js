const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const farmRecordRoutes = require('./routes/farmRecordRoutes');
const healthRoutes = require('./routes/healthRoutes');
const weatherRoutes = require('./routes/weatherRoutes');

const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: '1mb',
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: '1mb',
  }),
);

// ==========================================
// SYSTEM
// ==========================================

app.use('/api/health', healthRoutes);

// ==========================================
// AUTHENTICATION
// ==========================================

app.use('/api/auth', authRoutes);

// ==========================================
// USERS
// ==========================================

app.use('/api/users', userRoutes);

// ==========================================
// FARM RECORDS
// ==========================================

app.use('/api/farm-records', farmRecordRoutes);

// ==========================================
// WEATHER
// ==========================================

app.use(
  '/api/weather',
  weatherRoutes,
);


// ==========================================
// ERROR HANDLING
// ==========================================

app.use(notFound);
app.use(errorHandler);

module.exports = app;
