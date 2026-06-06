require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./config/logger');
const routes = require('./routes');
const { initializeScheduledJobs } = require('./jobs');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// Error handling
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: err.status || 500
  });
});

const PORT = process.env.BACKEND_PORT || 5000;

// Start server
app.listen(PORT, () => {
  logger.info(`VayuGuard backend running on port ${PORT}`);
  
  // Initialize scheduled jobs
  initializeScheduledJobs();
  logger.info('Scheduled jobs initialized');
});

module.exports = app;
