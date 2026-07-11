const axios = require('axios');
const db = require('../config/database');
const logger = require('../config/logger');

class DataIngestionService {
  /**
   * Fetch current weather from Open-Meteo (free, no API key)
   */
  async fetchWeatherForLocation(latitude, longitude) {
    try {
      const baseURL = process.env.OPENMETEO_API_URL || 'https://api.open-meteo.com/v1';

      const response = await axios.get(`${baseURL}/forecast`, {
        params: {
          latitude,
          longitude,
          current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,pressure_msl',
          timezone: 'Asia/Kolkata'
        }
      });

      return response.data.current || {};
    } catch (err) {
      logger.error(`Error fetching weather for ${latitude},${longitude}:`, err.message);
      return null;
    }
  }

  /**
   * Insert weather data
   */
  async insertWeather(locationId, weatherData) {
    try {
      if (!weatherData || weatherData.temperature_2m == null) {
        return;
      }

      const query = `
        INSERT INTO weather (location_id, temperature, humidity, wind_speed, pressure, measured_at, source)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'Open-Meteo')
      `;

      await db.query(query, [
        locationId,
        weatherData.temperature_2m ?? null,
        weatherData.relative_humidity_2m ?? null,
        weatherData.wind_speed_10m ?? null,
        weatherData.pressure_msl ?? null
      ]);

      logger.debug(`Inserted weather data for location ${locationId}`);
    } catch (err) {
      logger.error('Error inserting weather:', err);
    }
  }

  /**
   * Ingest current weather for every location in the database.
   * Pollutant data comes from openWeatherService; locations are seeded via schema.sql.
   */
  async ingestWeatherForAllLocations() {
    try {
      logger.info('Starting Open-Meteo weather ingestion...');

      const result = await db.query('SELECT id, city, latitude, longitude FROM locations ORDER BY id');
      const locations = result.rows;

      if (locations.length === 0) {
        logger.warn('No locations found in database for weather ingestion');
        return { processedCount: 0, totalLocations: 0 };
      }

      let processedCount = 0;

      for (const location of locations) {
        const weather = await this.fetchWeatherForLocation(location.latitude, location.longitude);
        if (weather) {
          await this.insertWeather(location.id, weather);
          processedCount++;
        }
      }

      logger.info(`Weather ingestion completed. Processed ${processedCount}/${locations.length} locations`);
      return { processedCount, totalLocations: locations.length };
    } catch (err) {
      logger.error('Error in ingestWeatherForAllLocations:', err);
      throw err;
    }
  }
}

module.exports = new DataIngestionService();
