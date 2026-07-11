const cron = require('node-cron');
const dataIngestionService = require('../services/dataIngestionService');
const openWeatherService = require('../services/openWeatherService');
const logger = require('../config/logger');

/**
 * Initialize scheduled jobs
 */
function initializeScheduledJobs() {
  // OpenWeather air pollution ingestion every hour at :00
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled OpenWeather air pollution ingestion (hourly)');
    try {
      await openWeatherService.ingestForAllLocations();
    } catch (err) {
      logger.error('Scheduled OpenWeather ingestion failed:', err);
    }
  });

  // Open-Meteo weather ingestion every hour at :15
  cron.schedule('15 * * * *', async () => {
    logger.info('Running scheduled Open-Meteo weather ingestion (hourly)');
    try {
      await dataIngestionService.ingestWeatherForAllLocations();
    } catch (err) {
      logger.error('Scheduled weather ingestion failed:', err);
    }
  });

  // Run both once on startup so a fresh instance has data quickly
  if (process.env.OPENWEATHER_API_KEY) {
    setTimeout(async () => {
      logger.info('Running initial OpenWeather air pollution ingestion on startup');
      try {
        await openWeatherService.ingestForAllLocations();
      } catch (err) {
        logger.error('Initial OpenWeather ingestion failed:', err);
      }
    }, 5000);
  } else {
    logger.warn('OPENWEATHER_API_KEY not set — skipping OpenWeather ingestion');
  }

  setTimeout(async () => {
    logger.info('Running initial Open-Meteo weather ingestion on startup');
    try {
      await dataIngestionService.ingestWeatherForAllLocations();
    } catch (err) {
      logger.error('Initial weather ingestion failed:', err);
    }
  }, 15000);
}

module.exports = { initializeScheduledJobs };
