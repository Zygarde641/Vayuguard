import React from 'react';

export const getAQIStatus = (aqi) => {
  if (!aqi) return { status: 'Unknown', color: 'gray' };
  if (aqi < 50) return { status: 'Good', color: 'green' };
  if (aqi < 100) return { status: 'Satisfactory', color: 'lime' };
  if (aqi < 150) return { status: 'Lightly Polluted', color: 'yellow' };
  if (aqi < 200) return { status: 'Moderately Polluted', color: 'orange' };
  if (aqi < 300) return { status: 'Heavily Polluted', color: 'red' };
  return { status: 'Severely Polluted', color: 'purple' };
};

const getHealthAdvice = (aqi) => {
  if (!aqi) return 'Data unavailable';
  if (aqi < 50) return '✅ Ideal for all outdoor activities';
  if (aqi < 100) return '⚠️ May be acceptable for most activities';
  if (aqi < 150) return '⚠️ Sensitive groups should limit outdoor activities';
  if (aqi < 200) return '❌ Limit outdoor activities, use mask';
  if (aqi < 300) return '🚫 Avoid outdoor activities, use N95 mask';
  return '🚫🚫 Emergency! Stay indoors';
};

export default function AQICard({ data }) {
  if (!data || !data.location) {
    return <div className="text-white">No data available</div>;
  }

  const { location, measurements, currentWeather } = data;
  const latestMeasurement = measurements?.[0];
  const { status, color } = getAQIStatus(latestMeasurement?.aqi);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
      {/* Location Header */}
      <div className="border-b pb-3">
        <h2 className="text-2xl font-bold text-gray-800">{location.city}</h2>
        {location.state && <p className="text-sm text-gray-500">{location.state}, India</p>}
      </div>

      {/* AQI Badge */}
      {latestMeasurement && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Air Quality Index</p>
            <div className="flex items-center gap-3">
              <div
                className={`text-4xl font-bold text-white px-6 py-4 rounded-lg bg-${color}-500 w-fit`}
                style={{
                  backgroundColor: {
                    green: '#4caf50',
                    lime: '#8bc34a',
                    yellow: '#fdd835',
                    orange: '#ff9800',
                    red: '#f44336',
                    purple: '#7c1d12',
                    gray: '#999'
                  }[color]
                }}
              >
                {latestMeasurement.aqi}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">{status}</p>
                <p className="text-xs text-gray-500">
                  {new Date(latestMeasurement.measured_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Health Advice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900 mb-1">💡 Health Advisory</p>
        <p className="text-sm text-blue-800">{getHealthAdvice(latestMeasurement?.aqi)}</p>
      </div>

      {/* Pollutants Breakdown */}
      {latestMeasurement && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">PM2.5</p>
            <p className="text-lg font-bold text-gray-800">
              {latestMeasurement.pm25?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">µg/m³</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">PM10</p>
            <p className="text-lg font-bold text-gray-800">
              {latestMeasurement.pm10?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">µg/m³</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">NO₂</p>
            <p className="text-lg font-bold text-gray-800">
              {latestMeasurement.no2?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">µg/m³</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">O₃</p>
            <p className="text-lg font-bold text-gray-800">
              {latestMeasurement.o3?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">µg/m³</p>
          </div>
        </div>
      )}

      {/* Weather Info */}
      {currentWeather && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-gray-600 font-semibold mb-2">🌤️ Current Weather</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Temp:</span>
              <span className="font-semibold ml-1">{currentWeather.temperature?.toFixed(1)}°C</span>
            </div>
            <div>
              <span className="text-gray-600">Humidity:</span>
              <span className="font-semibold ml-1">{currentWeather.humidity}%</span>
            </div>
            <div>
              <span className="text-gray-600">Wind:</span>
              <span className="font-semibold ml-1">{currentWeather.wind_speed?.toFixed(1)} m/s</span>
            </div>
            <div>
              <span className="text-gray-600">Pressure:</span>
              <span className="font-semibold ml-1">{currentWeather.pressure?.toFixed(0)} hPa</span>
            </div>
          </div>
        </div>
      )}

      {/* Data Points Info */}
      {data.dataPoints && (
        <p className="text-xs text-gray-500 text-center">
          📊 Based on {data.dataPoints} measurements
        </p>
      )}
    </div>
  );
}
