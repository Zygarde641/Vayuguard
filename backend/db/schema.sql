-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) NOT NULL UNIQUE,
  country VARCHAR(50) DEFAULT 'India',
  state VARCHAR(100),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Air Quality Measurements
CREATE TABLE IF NOT EXISTS measurements (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  aqi INTEGER,
  pm25 DECIMAL(10, 2),
  pm10 DECIMAL(10, 2),
  no2 DECIMAL(10, 2),
  o3 DECIMAL(10, 2),
  so2 DECIMAL(10, 2),
  co DECIMAL(10, 2),
  measured_at TIMESTAMP NOT NULL,
  source VARCHAR(50) DEFAULT 'OpenAQ',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weather data
CREATE TABLE IF NOT EXISTS weather (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  temperature DECIMAL(5, 2),
  humidity DECIMAL(5, 2),
  wind_speed DECIMAL(5, 2),
  wind_direction INTEGER,
  pressure DECIMAL(7, 2),
  precipitation DECIMAL(5, 2),
  measured_at TIMESTAMP NOT NULL,
  source VARCHAR(50) DEFAULT 'Open-Meteo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historical Trends/Daily Aggregates
CREATE TABLE IF NOT EXISTS daily_aggregate (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  avg_aqi DECIMAL(5, 2),
  max_aqi INTEGER,
  min_aqi INTEGER,
  avg_pm25 DECIMAL(10, 2),
  avg_pm10 DECIMAL(10, 2),
  avg_temperature DECIMAL(5, 2),
  avg_humidity DECIMAL(5, 2),
  avg_wind_speed DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(location_id, date)
);

-- Forecasts (for ML predictions)
CREATE TABLE IF NOT EXISTS forecasts (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  horizon_hours INTEGER,
  predicted_aqi DECIMAL(5, 2),
  predicted_pm25 DECIMAL(10, 2),
  predicted_pm10 DECIMAL(10, 2),
  model_version VARCHAR(50),
  confidence_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_measurements_location_time ON measurements(location_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_measured_at ON measurements(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_location_time ON weather(location_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_aggregate_location_date ON daily_aggregate(location_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_location_date ON forecasts(location_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
