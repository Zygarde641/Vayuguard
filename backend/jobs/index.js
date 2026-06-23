const cron = require('node-cron');
const dataIngestionService = require('../services/dataIngestionService');
const openWeatherService = require('../services/openWeatherService');
const logger = require('../config/logger');

/**
 * Initialize scheduled jobs
 */
function initializeScheduledJobs() {
  // Run OpenAQ data ingestion every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running scheduled OpenAQ data ingestion (6 hourly)');
    try {
      await dataIngestionService.performFullIngestion();
    } catch (err) {
      logger.error('Scheduled OpenAQ ingestion failed:', err);
    }
  });

  // Run OpenWeather air pollution ingestion every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled OpenWeather air pollution ingestion (hourly)');
    try {
      await openWeatherService.ingestForAllLocations();
    } catch (err) {
      logger.error('Scheduled OpenWeather ingestion failed:', err);
    }
  });

  // Run OpenAQ data ingestion immediately on startup (after 5 second delay)
  setTimeout(async () => {
    logger.info('Running initial OpenAQ data ingestion on startup');
    try {
      await dataIngestionService.performFullIngestion();
    } catch (err) {
      logger.error('Initial OpenAQ ingestion failed:', err);
    }
  }, 5000);

  // Run OpenWeather ingestion on startup (after 15 second delay, let OpenAQ go first)
  if (process.env.OPENWEATHER_API_KEY) {
    setTimeout(async () => {
      logger.info('Running initial OpenWeather air pollution ingestion on startup');
      try {
        await openWeatherService.ingestForAllLocations();
      } catch (err) {
        logger.error('Initial OpenWeather ingestion failed:', err);
      }
    }, 15000);
  } else {
    logger.warn('OPENWEATHER_API_KEY not set — skipping OpenWeather ingestion');
  }

  logger.info('Scheduled jobs initialized');
}

module.exports = { initializeScheduledJobs };
