const cron = require('node-cron');
const dataIngestionService = require('../services/dataIngestionService');
const logger = require('../config/logger');

/**
 * Initialize scheduled jobs
 */
function initializeScheduledJobs() {
  // Run data ingestion every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running scheduled data ingestion (6 hourly)');
    try {
      await dataIngestionService.performFullIngestion();
    } catch (err) {
      logger.error('Scheduled ingestion failed:', err);
    }
  });

  // Run data ingestion immediately on startup (after 5 second delay)
  setTimeout(async () => {
    logger.info('Running initial data ingestion on startup');
    try {
      await dataIngestionService.performFullIngestion();
    } catch (err) {
      logger.error('Initial ingestion failed:', err);
    }
  }, 5000);

  logger.info('Scheduled jobs initialized');
}

module.exports = { initializeScheduledJobs };
