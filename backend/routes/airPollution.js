const express = require('express');
const router = express.Router();
const openWeatherService = require('../services/openWeatherService');
const db = require('../config/database');
const logger = require('../config/logger');

/**
 * Validate and parse latitude/longitude from query params.
 * Returns { lat, lon } or sends a 400 error response.
 */
function parseCoordinates(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({
      error: 'Invalid or missing coordinates. Provide lat and lon as query parameters.',
      example: '?lat=28.6139&lon=77.2090'
    });
    return null;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({
      error: 'Coordinates out of range. lat: [-90, 90], lon: [-180, 180]'
    });
    return null;
  }

  return { lat, lon };
}

/**
 * Look up a city's coordinates from the database by cityId.
 * Returns { lat, lon, city, state } or sends a 404 error response.
 */
async function getCityCoordinates(cityId, res) {
  const result = await db.query(
    'SELECT id, city, state, latitude, longitude FROM locations WHERE id = $1',
    [cityId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: `City with id ${cityId} not found` });
    return null;
  }

  const loc = result.rows[0];
  return {
    lat: parseFloat(loc.latitude),
    lon: parseFloat(loc.longitude),
    city: loc.city,
    state: loc.state,
    id: loc.id
  };
}

// -----------------------------------------------------------------------------
// GET /api/air-pollution/current?lat=...&lon=...
// Current air pollution for arbitrary coordinates
// -----------------------------------------------------------------------------
router.get('/current', async (req, res, next) => {
  try {
    const coords = parseCoordinates(req, res);
    if (!coords) return;

    const data = await openWeatherService.getCachedCurrentPollution(coords.lat, coords.lon);
    res.json(data);
  } catch (err) {
    logger.error('Error fetching current air pollution:', err);
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/air-pollution/forecast?lat=...&lon=...
// 4-day hourly air pollution forecast for arbitrary coordinates
// -----------------------------------------------------------------------------
router.get('/forecast', async (req, res, next) => {
  try {
    const coords = parseCoordinates(req, res);
    if (!coords) return;

    const data = await openWeatherService.getCachedForecastPollution(coords.lat, coords.lon);
    res.json(data);
  } catch (err) {
    logger.error('Error fetching air pollution forecast:', err);
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/air-pollution/history?lat=...&lon=...&start=...&end=...
// Historical air pollution data between two Unix timestamps
// -----------------------------------------------------------------------------
router.get('/history', async (req, res, next) => {
  try {
    const coords = parseCoordinates(req, res);
    if (!coords) return;

    const start = parseInt(req.query.start);
    const end = parseInt(req.query.end);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({
        error: 'Missing or invalid start/end parameters. Provide Unix timestamps (UTC).',
        example: '?lat=28.6139&lon=77.2090&start=1606488670&end=1606747870'
      });
    }

    if (start >= end) {
      return res.status(400).json({
        error: 'start must be less than end'
      });
    }

    // Limit range to 30 days to prevent excessive API usage
    const maxRange = 30 * 24 * 60 * 60; // 30 days in seconds
    if ((end - start) > maxRange) {
      return res.status(400).json({
        error: 'Time range exceeds maximum of 30 days. Please narrow your query.'
      });
    }

    const data = await openWeatherService.getCachedHistoricalPollution(
      coords.lat, coords.lon, start, end
    );
    res.json(data);
  } catch (err) {
    logger.error('Error fetching historical air pollution:', err);
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/air-pollution/city/:cityId
// Current air pollution + forecast for a stored DB city
// -----------------------------------------------------------------------------
router.get('/city/:cityId', async (req, res, next) => {
  try {
    const cityId = parseInt(req.params.cityId);
    if (isNaN(cityId)) {
      return res.status(400).json({ error: 'Invalid cityId. Must be a number.' });
    }

    const cityInfo = await getCityCoordinates(cityId, res);
    if (!cityInfo) return;

    // Fetch current and forecast in parallel
    const [current, forecast] = await Promise.all([
      openWeatherService.getCachedCurrentPollution(cityInfo.lat, cityInfo.lon),
      openWeatherService.getCachedForecastPollution(cityInfo.lat, cityInfo.lon)
    ]);

    res.json({
      city: {
        id: cityInfo.id,
        name: cityInfo.city,
        state: cityInfo.state,
        latitude: cityInfo.lat,
        longitude: cityInfo.lon
      },
      current: current?.list?.[0] || null,
      forecast: forecast?.list || []
    });
  } catch (err) {
    logger.error('Error fetching air pollution for city:', err);
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/air-pollution/aqi-scale
// Returns the OpenWeather AQI scale reference (static data)
// -----------------------------------------------------------------------------
router.get('/aqi-scale', (req, res) => {
  res.json({
    description: 'OpenWeatherMap Air Quality Index scale',
    levels: [
      {
        index: 1, label: 'Good',
        thresholds: { so2: '[0, 20)', no2: '[0, 40)', pm10: '[0, 20)', pm2_5: '[0, 10)', o3: '[0, 60)', co: '[0, 4400)' }
      },
      {
        index: 2, label: 'Fair',
        thresholds: { so2: '[20, 80)', no2: '[40, 70)', pm10: '[20, 50)', pm2_5: '[10, 25)', o3: '[60, 100)', co: '[4400, 9400)' }
      },
      {
        index: 3, label: 'Moderate',
        thresholds: { so2: '[80, 250)', no2: '[70, 150)', pm10: '[50, 100)', pm2_5: '[25, 50)', o3: '[100, 140)', co: '[9400, 12400)' }
      },
      {
        index: 4, label: 'Poor',
        thresholds: { so2: '[250, 350)', no2: '[150, 200)', pm10: '[100, 200)', pm2_5: '[50, 75)', o3: '[140, 180)', co: '[12400, 15400)' }
      },
      {
        index: 5, label: 'Very Poor',
        thresholds: { so2: '≥350', no2: '≥200', pm10: '≥200', pm2_5: '≥75', o3: '≥180', co: '≥15400' }
      }
    ],
    non_aqi_parameters: {
      nh3: { min: 0.1, max: 200, unit: 'μg/m³' },
      no: { min: 0.1, max: 100, unit: 'μg/m³' }
    },
    unit: 'μg/m³'
  });
});

module.exports = router;
