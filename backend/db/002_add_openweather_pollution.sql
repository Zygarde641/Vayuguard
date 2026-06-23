-- Migration: Add OpenWeatherMap Air Pollution support
-- Adds missing pollutant columns (NO, NH3) to measurements
-- Creates air_pollution_forecast table for 4-day hourly forecasts

-- Add missing pollutant columns to measurements
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS no DECIMAL(10, 2);
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS nh3 DECIMAL(10, 2);

-- OpenWeather air pollution forecast storage
-- Separate from the ML-based 'forecasts' table — this stores raw API forecast data
CREATE TABLE IF NOT EXISTS air_pollution_forecast (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_dt TIMESTAMP NOT NULL,          -- the forecasted point in time
  aqi INTEGER,                             -- 1-5 OpenWeather scale
  co DECIMAL(10, 3),
  no DECIMAL(10, 3),
  no2 DECIMAL(10, 3),
  o3 DECIMAL(10, 3),
  so2 DECIMAL(10, 3),
  pm2_5 DECIMAL(10, 3),
  pm10 DECIMAL(10, 3),
  nh3 DECIMAL(10, 3),
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50) DEFAULT 'OpenWeatherMap',
  UNIQUE(location_id, forecast_dt)
);

-- Index for efficient querying by location and forecast time
CREATE INDEX IF NOT EXISTS idx_ap_forecast_location_dt 
  ON air_pollution_forecast(location_id, forecast_dt);
