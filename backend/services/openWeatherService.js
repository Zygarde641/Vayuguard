const axios = require('axios');
const db = require('../config/database');
const redis = require('../config/redis');
const logger = require('../config/logger');
const { computeCpcbAqi } = require('../utils/cpcbAqi');

/**
 * OpenWeatherMap Air Pollution API scale thresholds.
 * Each pollutant has breakpoints for AQI levels 1-5.
 * Values are upper bounds (exclusive) for levels 1-4; level 5 is >= the last threshold.
 */
const AQI_BREAKPOINTS = {
  so2:   [20, 80, 250, 350],
  no2:   [40, 70, 150, 200],
  pm10:  [20, 50, 100, 200],
  pm2_5: [10, 25, 50, 75],
  o3:    [60, 100, 140, 180],
  co:    [4400, 9400, 12400, 15400]
};

class OpenWeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.baseURL = process.env.OPENWEATHER_API_URL || 'https://api.openweathermap.org/data/2.5';
  }

  /**
   * Validate that API key is configured
   */
  _ensureApiKey() {
    if (!this.apiKey) {
      throw new Error('OPENWEATHER_API_KEY is not set in environment variables');
    }
  }

  // ---------------------------------------------------------------------------
  // API Client Methods
  // ---------------------------------------------------------------------------

  /**
   * Get current air pollution data for given coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} API response with coord, list (single entry)
   */
  async getCurrentAirPollution(lat, lon) {
    this._ensureApiKey();

    try {
      const response = await axios.get(`${this.baseURL}/air_pollution`, {
        params: { lat, lon, appid: this.apiKey }
      });

      logger.debug(`Fetched current air pollution for ${lat},${lon}`);
      return response.data;
    } catch (err) {
      logger.error(`Error fetching current air pollution for ${lat},${lon}:`, err.message);
      throw err;
    }
  }

  /**
   * Get 4-day hourly air pollution forecast for given coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} API response with coord, list (multiple hourly entries)
   */
  async getForecastAirPollution(lat, lon) {
    this._ensureApiKey();

    try {
      const response = await axios.get(`${this.baseURL}/air_pollution/forecast`, {
        params: { lat, lon, appid: this.apiKey }
      });

      logger.debug(`Fetched air pollution forecast for ${lat},${lon}: ${response.data.list?.length || 0} entries`);
      return response.data;
    } catch (err) {
      logger.error(`Error fetching air pollution forecast for ${lat},${lon}:`, err.message);
      throw err;
    }
  }

  /**
   * Get historical air pollution data for given coordinates and time range
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} start - Start Unix timestamp (UTC)
   * @param {number} end - End Unix timestamp (UTC)
   * @returns {Object} API response with coord, list (historical entries)
   */
  async getHistoricalAirPollution(lat, lon, start, end) {
    this._ensureApiKey();

    try {
      const response = await axios.get(`${this.baseURL}/air_pollution/history`, {
        params: { lat, lon, start, end, appid: this.apiKey }
      });

      logger.debug(`Fetched historical air pollution for ${lat},${lon}: ${response.data.list?.length || 0} entries`);
      return response.data;
    } catch (err) {
      logger.error(`Error fetching historical air pollution for ${lat},${lon}:`, err.message);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // AQI Calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculate individual AQI (1-5) for a single pollutant value
   * @param {string} pollutant - Pollutant key (so2, no2, pm10, pm2_5, o3, co)
   * @param {number} value - Concentration in μg/m³
   * @returns {number} AQI level 1-5
   */
  _getPollutantAQI(pollutant, value) {
    const breakpoints = AQI_BREAKPOINTS[pollutant];
    if (!breakpoints || value == null || value < 0) {
      return null;
    }

    for (let i = 0; i < breakpoints.length; i++) {
      if (value < breakpoints[i]) {
        return i + 1; // AQI levels are 1-indexed
      }
    }

    return 5; // Very Poor — exceeds all thresholds
  }

  /**
   * Calculate overall AQI from component concentrations.
   * The overall AQI is the maximum (worst) of all individual pollutant AQIs.
   * @param {Object} components - Object with co, no, no2, o3, so2, pm2_5, pm10, nh3
   * @returns {Object} { aqi, breakdown } where breakdown shows per-pollutant AQI
   */
  calculateAQIFromComponents(components) {
    if (!components) return { aqi: null, breakdown: {} };

    const breakdown = {};
    let maxAQI = 1;

    for (const [pollutant, thresholds] of Object.entries(AQI_BREAKPOINTS)) {
      const value = components[pollutant];
      if (value != null) {
        const pollutantAQI = this._getPollutantAQI(pollutant, value);
        breakdown[pollutant] = { value, aqi: pollutantAQI };
        if (pollutantAQI && pollutantAQI > maxAQI) {
          maxAQI = pollutantAQI;
        }
      }
    }

    return { aqi: maxAQI, breakdown };
  }

  /**
   * Get the human-readable label for an AQI value
   * @param {number} aqi - AQI value 1-5
   * @returns {string} Label
   */
  static getAQILabel(aqi) {
    const labels = {
      1: 'Good',
      2: 'Fair',
      3: 'Moderate',
      4: 'Poor',
      5: 'Very Poor'
    };
    return labels[aqi] || 'Unknown';
  }

  // ---------------------------------------------------------------------------
  // Data Mapping
  // ---------------------------------------------------------------------------

  /**
   * Map OpenWeather API list entry to our measurement DB columns
   * @param {Object} entry - Single list entry from API response
   * @returns {Object} Mapped data matching measurements table columns
   */
  mapToMeasurement(entry) {
    const { components, dt } = entry;
    return {
      // measurements.aqi holds India CPCB-scale AQI (0-500), not OpenWeather's 1-5 index
      aqi: computeCpcbAqi(components?.pm2_5, components?.pm10),
      pm25: components?.pm2_5 ?? null,
      pm10: components?.pm10 ?? null,
      no2: components?.no2 ?? null,
      o3: components?.o3 ?? null,
      so2: components?.so2 ?? null,
      co: components?.co ?? null,
      no: components?.no ?? null,
      nh3: components?.nh3 ?? null,
      measured_at: dt ? new Date(dt * 1000) : new Date()
    };
  }

  // ---------------------------------------------------------------------------
  // Database Ingestion
  // ---------------------------------------------------------------------------

  /**
   * Insert a single measurement from OpenWeather data into the measurements table
   * @param {number} locationId - DB location ID
   * @param {Object} measurement - Mapped measurement data
   */
  async insertMeasurement(locationId, measurement) {
    try {
      const query = `
        INSERT INTO measurements (
          location_id, aqi, pm25, pm10, no2, o3, so2, co, no, nh3, measured_at, source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OpenWeatherMap')
        ON CONFLICT DO NOTHING
      `;

      await db.query(query, [
        locationId,
        measurement.aqi,
        measurement.pm25,
        measurement.pm10,
        measurement.no2,
        measurement.o3,
        measurement.so2,
        measurement.co,
        measurement.no,
        measurement.nh3,
        measurement.measured_at
      ]);
    } catch (err) {
      logger.warn(`Failed to insert OpenWeather measurement for location ${locationId}:`, err.message);
    }
  }

  /**
   * Upsert forecast entries into air_pollution_forecast table
   * @param {number} locationId - DB location ID
   * @param {Array} forecastList - Array of API list entries
   */
  async upsertForecasts(locationId, forecastList) {
    try {
      const query = `
        INSERT INTO air_pollution_forecast (
          location_id, forecast_dt, aqi, co, no, no2, o3, so2, pm2_5, pm10, nh3
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (location_id, forecast_dt) DO UPDATE SET
          aqi = EXCLUDED.aqi,
          co = EXCLUDED.co,
          no = EXCLUDED.no,
          no2 = EXCLUDED.no2,
          o3 = EXCLUDED.o3,
          so2 = EXCLUDED.so2,
          pm2_5 = EXCLUDED.pm2_5,
          pm10 = EXCLUDED.pm10,
          nh3 = EXCLUDED.nh3,
          fetched_at = CURRENT_TIMESTAMP
      `;

      let insertedCount = 0;

      for (const entry of forecastList) {
        try {
          const { components, main, dt } = entry;
          await db.query(query, [
            locationId,
            new Date(dt * 1000),
            main?.aqi || null,
            components?.co || null,
            components?.no || null,
            components?.no2 || null,
            components?.o3 || null,
            components?.so2 || null,
            components?.pm2_5 || null,
            components?.pm10 || null,
            components?.nh3 || null
          ]);
          insertedCount++;
        } catch (err) {
          logger.warn(`Failed to upsert forecast entry for location ${locationId}:`, err.message);
        }
      }

      logger.debug(`Upserted ${insertedCount} forecast entries for location ${locationId}`);
    } catch (err) {
      logger.error('Error in upsertForecasts:', err);
      throw err;
    }
  }

  /**
   * Run ingestion for a single location: fetch current + forecast, store in DB
   * @param {Object} location - Location object with id, latitude, longitude, city
   */
  async ingestForLocation(location) {
    const { id, latitude, longitude, city } = location;

    try {
      // Fetch current air pollution
      const currentData = await this.getCurrentAirPollution(latitude, longitude);
      if (currentData?.list?.length > 0) {
        const measurement = this.mapToMeasurement(currentData.list[0]);
        await this.insertMeasurement(id, measurement);
        logger.debug(`Ingested current air pollution for ${city}`);
      }

      // Fetch forecast air pollution
      const forecastData = await this.getForecastAirPollution(latitude, longitude);
      if (forecastData?.list?.length > 0) {
        await this.upsertForecasts(id, forecastData.list);
        logger.debug(`Ingested ${forecastData.list.length} forecast entries for ${city}`);
      }
    } catch (err) {
      logger.warn(`OpenWeather ingestion failed for ${city} (${id}):`, err.message);
    }
  }

  /**
   * Run ingestion for ALL locations stored in the database.
   * Called by the scheduled hourly job.
   * @returns {Object} { processedCount, totalLocations }
   */
  async ingestForAllLocations() {
    try {
      logger.info('Starting OpenWeather air pollution ingestion for all locations...');

      const result = await db.query('SELECT id, city, latitude, longitude FROM locations ORDER BY id');
      const locations = result.rows;

      if (locations.length === 0) {
        logger.warn('No locations found in database for OpenWeather ingestion');
        return { processedCount: 0, totalLocations: 0 };
      }

      let processedCount = 0;

      for (const location of locations) {
        try {
          await this.ingestForLocation(location);
          processedCount++;

          // Rate limiting: OpenWeather free tier allows 60 calls/min
          // Each location = 2 calls (current + forecast), so wait 2.1s between locations
          if (locations.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 2100));
          }
        } catch (err) {
          logger.warn(`Skipping location ${location.city}:`, err.message);
        }
      }

      logger.info(`OpenWeather ingestion completed. Processed ${processedCount}/${locations.length} locations`);
      return { processedCount, totalLocations: locations.length };
    } catch (err) {
      logger.error('Error in ingestForAllLocations:', err);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Cached API Responses (for route handlers)
  // ---------------------------------------------------------------------------

  /**
   * Get current air pollution with Redis caching (5 min TTL)
   */
  async getCachedCurrentPollution(lat, lon) {
    const cacheKey = `owm:current:${lat}:${lon}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.getCurrentAirPollution(lat, lon);

    // Enrich with AQI labels and breakdown
    if (data?.list?.length > 0) {
      for (const entry of data.list) {
        const { aqi, breakdown } = this.calculateAQIFromComponents(entry.components);
        entry.main.aqi_label = OpenWeatherService.getAQILabel(entry.main.aqi);
        entry.main.aqi_calculated = aqi;
        entry.main.aqi_cpcb = computeCpcbAqi(entry.components?.pm2_5, entry.components?.pm10);
        entry.aqi_breakdown = breakdown;
      }
    }

    await redis.setex(cacheKey, 300, JSON.stringify(data));
    return data;
  }

  /**
   * Get forecast air pollution with Redis caching (30 min TTL)
   */
  async getCachedForecastPollution(lat, lon) {
    const cacheKey = `owm:forecast:${lat}:${lon}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.getForecastAirPollution(lat, lon);

    // Enrich with AQI labels and India CPCB-scale AQI
    if (data?.list?.length > 0) {
      for (const entry of data.list) {
        entry.main.aqi_label = OpenWeatherService.getAQILabel(entry.main.aqi);
        entry.main.aqi_cpcb = computeCpcbAqi(entry.components?.pm2_5, entry.components?.pm10);
      }
    }

    await redis.setex(cacheKey, 1800, JSON.stringify(data));
    return data;
  }

  /**
   * Get historical air pollution with Redis caching (1 hour TTL)
   */
  async getCachedHistoricalPollution(lat, lon, start, end) {
    const cacheKey = `owm:history:${lat}:${lon}:${start}:${end}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.getHistoricalAirPollution(lat, lon, start, end);

    // Enrich with AQI labels
    if (data?.list?.length > 0) {
      for (const entry of data.list) {
        entry.main.aqi_label = OpenWeatherService.getAQILabel(entry.main.aqi);
      }
    }

    await redis.setex(cacheKey, 3600, JSON.stringify(data));
    return data;
  }
}

module.exports = new OpenWeatherService();
