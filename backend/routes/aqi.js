const express = require('express');
const router = express.Router();
const aqiService = require('../services/aqiService');
const logger = require('../config/logger');

// Get current AQI for all locations
router.get('/', async (req, res, next) => {
  try {
    const data = await aqiService.getCurrentAQI();
    res.json(data);
  } catch (err) {
    logger.error('Error fetching AQI:', err);
    next(err);
  }
});

// Search cities by name
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    const cities = await aqiService.searchCities(q);
    res.json(cities);
  } catch (err) {
    logger.error('Error searching cities:', err);
    next(err);
  }
});

// Get AQI for specific city
router.get('/:cityId', async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const { days = 7 } = req.query;
    const data = await aqiService.getAQIByCityId(cityId, parseInt(days));
    if (!data) {
      return res.status(404).json({ error: 'City not found' });
    }
    res.json(data);
  } catch (err) {
    logger.error('Error fetching AQI for city:', err);
    next(err);
  }
});

// Get trends for a city
router.get('/:cityId/trends', async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const { days = 30 } = req.query;
    const trends = await aqiService.getTrends(cityId, parseInt(days));
    res.json(trends);
  } catch (err) {
    logger.error('Error fetching trends:', err);
    next(err);
  }
});

// Get hotspots (worst AQI cities)
router.get('/hotspots/worst', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const hotspots = await aqiService.getHotspots(parseInt(limit));
    res.json(hotspots);
  } catch (err) {
    logger.error('Error fetching hotspots:', err);
    next(err);
  }
});

module.exports = router;
