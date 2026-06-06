const express = require('express');
const aqi = require('./aqi');
const health = require('./health');

const router = express.Router();

// AQI routes
router.use('/aqi', aqi);

// Health routes
router.use('/health', health);

module.exports = router;
