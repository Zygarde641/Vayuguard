-- Migration: fix measurements data quality
-- 1. Earlier OpenWeather ingestion stored the 1-5 OpenWeather index in the 0-500 AQI
--    column; clear those so fresh ingestion (CPCB scale) replaces them
UPDATE measurements SET aqi = NULL WHERE source = 'OpenWeatherMap' AND aqi BETWEEN 1 AND 5;

-- 2. Remove duplicates accumulated while ON CONFLICT had no unique constraint to hit
DELETE FROM measurements a
USING measurements b
WHERE a.id > b.id
  AND a.location_id = b.location_id
  AND a.measured_at = b.measured_at
  AND a.source = b.source;

-- 3. Enforce uniqueness so ON CONFLICT DO NOTHING actually dedupes
CREATE UNIQUE INDEX IF NOT EXISTS uq_measurements_location_time_source
  ON measurements(location_id, measured_at, source);
