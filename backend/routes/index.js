const express = require('express');
const aqi = require('./aqi');
const health = require('./health');
const airPollution = require('./airPollution');

const router = express.Router();

// AQI routes
router.use('/aqi', aqi);

// Health routes
router.use('/health', health);

// OpenWeather Air Pollution routes
router.use('/air-pollution', airPollution);

module.exports = router;
