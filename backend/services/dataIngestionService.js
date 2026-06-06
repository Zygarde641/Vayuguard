const axios = require('axios');
const db = require('../config/database');
const logger = require('../config/logger');

class DataIngestionService {
  /**
   * Fetch data from OpenAQ API
   */
  async fetchFromOpenAQ() {
    try {
      const baseURL = process.env.OPENAQ_API_URL || 'https://api.openaq.org/v2';
      
      // Get latest data from all locations
      const response = await axios.get(`${baseURL}/latest`, {
        params: {
          country: 'IN',
          limit: 1000
        }
      });

      const results = response.data.results || [];
      logger.info(`Fetched ${results.length} measurements from OpenAQ`);

      return results;
    } catch (err) {
      logger.error('Error fetching from OpenAQ:', err.message);
      throw err;
    }
  }

  /**
   * Fetch weather data from Open-Meteo
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
   * Insert or update location in database
   */
  async upsertLocation(city, state, latitude, longitude) {
    try {
      const query = `
        INSERT INTO locations (city, state, latitude, longitude, country)
        VALUES ($1, $2, $3, $4, 'India')
        ON CONFLICT (city) DO UPDATE
        SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const result = await db.query(query, [city, state, latitude, longitude]);
      return result.rows[0].id;
    } catch (err) {
      logger.error('Error upserting location:', err);
      throw err;
    }
  }

  /**
   * Insert measurements from OpenAQ data
   */
  async insertMeasurements(locationId, measurements) {
    try {
      const query = `
        INSERT INTO measurements (location_id, aqi, pm25, pm10, no2, o3, so2, co, measured_at, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OpenAQ')
        ON CONFLICT DO NOTHING
      `;

      for (const measurement of measurements) {
        try {
          await db.query(query, [
            locationId,
            measurement.aqi || null,
            measurement.pm25 || null,
            measurement.pm10 || null,
            measurement.no2 || null,
            measurement.o3 || null,
            measurement.so2 || null,
            measurement.co || null,
            new Date(measurement.date.utc || new Date())
          ]);
        } catch (err) {
          logger.warn(`Failed to insert measurement for location ${locationId}:`, err.message);
        }
      }

      logger.info(`Inserted ${measurements.length} measurements for location ${locationId}`);
    } catch (err) {
      logger.error('Error inserting measurements:', err);
      throw err;
    }
  }

  /**
   * Insert weather data
   */
  async insertWeather(locationId, weatherData) {
    try {
      if (!weatherData || !weatherData.temperature_2m) {
        return;
      }

      const query = `
        INSERT INTO weather (location_id, temperature, humidity, wind_speed, pressure, measured_at, source)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'Open-Meteo')
      `;

      await db.query(query, [
        locationId,
        weatherData.temperature_2m || null,
        weatherData.relative_humidity_2m || null,
        weatherData.wind_speed_10m || null,
        weatherData.pressure_msl || null
      ]);

      logger.debug(`Inserted weather data for location ${locationId}`);
    } catch (err) {
      logger.error('Error inserting weather:', err);
    }
  }

  /**
   * Perform full ingestion pipeline
   */
  async performFullIngestion() {
    try {
      logger.info('Starting data ingestion...');
      
      const openAQData = await this.fetchFromOpenAQ();
      
      let processedCount = 0;

      for (const result of openAQData) {
        try {
          // Extract location info
          const { city, country, coordinates } = result.location || {};
          
          if (!city || !coordinates) {
            continue;
          }

          // Upsert location
          const locationId = await this.upsertLocation(
            city,
            country || 'India',
            coordinates.latitude,
            coordinates.longitude
          );

          // Insert measurements
          const { measurements = [] } = result;
          if (measurements.length > 0) {
            await this.insertMeasurements(locationId, measurements);
          }

          // Fetch and insert weather
          const weather = await this.fetchWeatherForLocation(
            coordinates.latitude,
            coordinates.longitude
          );
          if (weather) {
            await this.insertWeather(locationId, weather);
          }

          processedCount++;
        } catch (err) {
          logger.warn('Error processing result:', err.message);
          continue;
        }
      }

      logger.info(`Data ingestion completed. Processed ${processedCount} locations`);
      return { processedCount, totalReceived: openAQData.length };
    } catch (err) {
      logger.error('Error in performFullIngestion:', err);
      throw err;
    }
  }
}

module.exports = new DataIngestionService();
