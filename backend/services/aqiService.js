const db = require('../config/database');
const redis = require('../config/redis');
const logger = require('../config/logger');

class AQIService {
  /**
   * Get current AQI for all locations
   */
  async getCurrentAQI() {
    try {
      const cacheKey = 'aqi:current:all';
      
      // Check cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT 
          l.id, l.city, l.latitude, l.longitude, l.state,
          m.aqi, m.pm25, m.pm10, m.no2, m.o3,
          m.measured_at,
          w.temperature, w.humidity, w.wind_speed
        FROM locations l
        LEFT JOIN (
          SELECT DISTINCT ON (location_id) * FROM measurements 
          ORDER BY location_id, measured_at DESC
        ) m ON l.id = m.location_id
        LEFT JOIN (
          SELECT DISTINCT ON (location_id) * FROM weather 
          ORDER BY location_id, measured_at DESC
        ) w ON l.id = w.location_id
        ORDER BY l.city ASC
      `;

      const result = await db.query(query);
      const data = result.rows;

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(data));

      return data;
    } catch (err) {
      logger.error('Error in getCurrentAQI:', err);
      throw err;
    }
  }

  /**
   * Search cities by name
   */
  async searchCities(query) {
    try {
      const sql = `
        SELECT id, city, state, latitude, longitude
        FROM locations
        WHERE LOWER(city) LIKE LOWER($1)
        ORDER BY city ASC
        LIMIT 20
      `;

      const result = await db.query(sql, [`${query}%`]);
      return result.rows;
    } catch (err) {
      logger.error('Error in searchCities:', err);
      throw err;
    }
  }

  /**
   * Get AQI data for a specific city with historical data
   */
  async getAQIByCityId(cityId, days = 7) {
    try {
      const cacheKey = `aqi:city:${cityId}:${days}d`;
      
      // Check cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get current location info
      const locationQuery = `
        SELECT id, city, state, latitude, longitude
        FROM locations
        WHERE id = $1
      `;
      const locResult = await db.query(locationQuery, [cityId]);
      
      if (locResult.rows.length === 0) {
        return null;
      }

      const location = locResult.rows[0];

      // Get historical measurements
      const measurementsQuery = `
        SELECT 
          measured_at, aqi, pm25, pm10, no2, o3, so2, co
        FROM measurements
        WHERE location_id = $1 
          AND measured_at >= NOW() - INTERVAL '${days} days'
        ORDER BY measured_at DESC
      `;

      const measResult = await db.query(measurementsQuery, [cityId]);

      // Get weather data
      const weatherQuery = `
        SELECT 
          measured_at, temperature, humidity, wind_speed, pressure, precipitation
        FROM weather
        WHERE location_id = $1 
          AND measured_at >= NOW() - INTERVAL '${days} days'
        ORDER BY measured_at DESC
        LIMIT 1
      `;

      const weatherResult = await db.query(weatherQuery, [cityId]);

      const data = {
        location,
        measurements: measResult.rows,
        currentWeather: weatherResult.rows[0] || null,
        dataPoints: measResult.rows.length
      };

      // Cache for 10 minutes
      await redis.setex(cacheKey, 600, JSON.stringify(data));

      return data;
    } catch (err) {
      logger.error('Error in getAQIByCityId:', err);
      throw err;
    }
  }

  /**
   * Get trends for a city (aggregated daily data)
   */
  async getTrends(cityId, days = 30) {
    try {
      const cacheKey = `trends:city:${cityId}:${days}d`;
      
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT 
          date, 
          avg_aqi, max_aqi, min_aqi,
          avg_pm25, avg_pm10,
          avg_temperature, avg_humidity
        FROM daily_aggregate
        WHERE location_id = $1 
          AND date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `;

      const result = await db.query(query, [cityId]);
      
      await redis.setex(cacheKey, 1800, JSON.stringify(result.rows));

      return result.rows;
    } catch (err) {
      logger.error('Error in getTrends:', err);
      throw err;
    }
  }

  /**
   * Get hotspots - cities with worst AQI
   */
  async getHotspots(limit = 10) {
    try {
      const cacheKey = `hotspots:worst:${limit}`;
      
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT 
          l.id, l.city, l.state, l.latitude, l.longitude,
          m.aqi, m.pm25, m.pm10,
          m.measured_at
        FROM locations l
        LEFT JOIN (
          SELECT DISTINCT ON (location_id) * FROM measurements 
          WHERE aqi IS NOT NULL
          ORDER BY location_id, measured_at DESC
        ) m ON l.id = m.location_id
        WHERE m.aqi IS NOT NULL
        ORDER BY m.aqi DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      
      await redis.setex(cacheKey, 600, JSON.stringify(result.rows));

      return result.rows;
    } catch (err) {
      logger.error('Error in getHotspots:', err);
      throw err;
    }
  }
}

module.exports = new AQIService();
