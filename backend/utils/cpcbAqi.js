// India CPCB AQI sub-index breakpoints: [concLow, concHigh, aqiLow, aqiHigh]
// ponytail: PM2.5/PM10 only — they dominate Indian AQI; add NO2/SO2/O3/CO bands if a
// station ever reports gas-driven AQI higher than the PM sub-index
const BREAKPOINTS = {
  pm25: [
    [0, 30, 0, 50],
    [30, 60, 50, 100],
    [60, 90, 100, 200],
    [90, 120, 200, 300],
    [120, 250, 300, 400],
    [250, 500, 400, 500]
  ],
  pm10: [
    [0, 50, 0, 50],
    [50, 100, 50, 100],
    [100, 250, 100, 200],
    [250, 350, 200, 300],
    [350, 430, 300, 400],
    [430, 600, 400, 500]
  ]
};

function subIndex(pollutant, value) {
  if (value == null || isNaN(value) || value < 0) return null;
  const bands = BREAKPOINTS[pollutant];
  const last = bands[bands.length - 1];
  if (value >= last[1]) return 500;

  for (const [cLo, cHi, aLo, aHi] of bands) {
    if (value <= cHi) {
      return Math.round(aLo + ((value - cLo) / (cHi - cLo)) * (aHi - aLo));
    }
  }
  return null;
}

/**
 * CPCB-style AQI (0-500) from PM concentrations in µg/m³.
 * Overall AQI = worst pollutant sub-index. Returns null if no usable input.
 */
function computeCpcbAqi(pm25, pm10) {
  const subs = [subIndex('pm25', pm25), subIndex('pm10', pm10)].filter((v) => v != null);
  return subs.length ? Math.max(...subs) : null;
}

module.exports = { computeCpcbAqi };

// Self-check: node utils/cpcbAqi.js
if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(computeCpcbAqi(30, null), 50); // band edge
  assert.strictEqual(computeCpcbAqi(45, null), 75); // midpoint of 30-60 -> 50-100
  assert.strictEqual(computeCpcbAqi(null, 75), 75); // pm10 midpoint 50-100
  assert.strictEqual(computeCpcbAqi(45, 300), 250); // worst pollutant wins (pm10 250-350 -> 200-300)
  assert.strictEqual(computeCpcbAqi(600, 0), 500); // capped
  assert.strictEqual(computeCpcbAqi(null, null), null);
  assert.strictEqual(computeCpcbAqi(-5, undefined), null);
  console.log('cpcbAqi self-check passed');
}
