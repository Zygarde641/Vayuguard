import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getAQIStatus } from './AQICard';

const AQI_COLORS = {
  green: '#4caf50',
  lime: '#8bc34a',
  yellow: '#fdd835',
  orange: '#ff9800',
  red: '#f44336',
  purple: '#7c1d12',
  gray: '#999'
};

export default function ForecastCard({ cityId }) {
  const [tomorrow, setTomorrow] = useState(null);

  useEffect(() => {
    if (!cityId) return;
    setTomorrow(null);

    api.getCityAirPollution(cityId)
      .then((data) => {
        const target = new Date();
        target.setDate(target.getDate() + 1);

        const values = (data.forecast || [])
          .filter((entry) => {
            const d = new Date(entry.dt * 1000);
            return (
              d.getDate() === target.getDate() &&
              d.getMonth() === target.getMonth() &&
              entry.main?.aqi_cpcb != null
            );
          })
          .map((entry) => entry.main.aqi_cpcb);

        if (values.length > 0) {
          setTomorrow({
            avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            peak: Math.max(...values)
          });
        }
      })
      .catch((err) => console.error('Error fetching forecast:', err));
  }, [cityId]);

  if (!tomorrow) return null;

  const { status, color } = getAQIStatus(tomorrow.avg);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-3">
      <h3 className="text-lg font-bold text-gray-800">🔮 Tomorrow's AQI</h3>

      <div className="flex items-center gap-3">
        <div
          className="text-4xl font-bold text-white px-6 py-4 rounded-lg w-fit"
          style={{ backgroundColor: AQI_COLORS[color] }}
        >
          {tomorrow.avg}
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-800">{status}</p>
          <p className="text-xs text-gray-500">expected peak: {tomorrow.peak}</p>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Based on hourly forecast (OpenWeatherMap), converted to India CPCB scale
      </p>
    </div>
  );
}
