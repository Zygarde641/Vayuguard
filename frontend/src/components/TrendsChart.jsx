import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrendsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-white text-center">No trend data available</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">📈 30-Day Trend</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          />
          <YAxis tick={{ fontSize: 12 }} label={{ value: 'AQI', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
            formatter={(value) => value?.toFixed(1)}
          />
          <Line
            type="monotone"
            dataKey="avg_aqi"
            stroke="#667eea"
            dot={false}
            strokeWidth={2}
            name="Avg AQI"
          />
          <Line
            type="monotone"
            dataKey="max_aqi"
            stroke="#f44336"
            dot={false}
            strokeWidth={1}
            strokeDasharray="5 5"
            name="Max AQI"
          />
          <Line
            type="monotone"
            dataKey="min_aqi"
            stroke="#4caf50"
            dot={false}
            strokeWidth={1}
            strokeDasharray="5 5"
            name="Min AQI"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
        <div className="text-center p-2 bg-gray-50 rounded">
          <p className="text-gray-600 text-xs">Avg AQI</p>
          <p className="font-bold text-blue-600">
            {(data.reduce((sum, d) => sum + (d.avg_aqi || 0), 0) / data.length).toFixed(1)}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <p className="text-gray-600 text-xs">Max AQI</p>
          <p className="font-bold text-red-600">
            {Math.max(...data.map(d => d.max_aqi || 0)).toFixed(0)}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <p className="text-gray-600 text-xs">Min AQI</p>
          <p className="font-bold text-green-600">
            {Math.min(...data.map(d => d.min_aqi || 999)).toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
