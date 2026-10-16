const express = require('express');

const cors = require('cors');

const authRoutes = require('./routes/authRoutes');

const userRoutes = require('./routes/userRoutes');

const farmRecordRoutes = require('./routes/farmRecordRoutes');

const farmRoutes = require('./routes/farmRoutes');

const healthRoutes = require('./routes/healthRoutes');

const weatherRoutes = require('./routes/weatherRoutes');

const notFound = require('./middleware/notFound');

const errorHandler = require('./middleware/errorHandler');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
);

app.disable('x-powered-by');

app.use(
  cors({
    origin: (origin, callback) => {
      callback(
        null,
        !origin || !isProduction || allowedOrigins.has(origin),
      );
    },
    credentials: true,
  }),
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

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
// FARMS
// ==========================================

app.use('/api/farms', farmRoutes);

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
