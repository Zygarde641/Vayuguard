import React from 'react';
import { getAqiBand } from '../utils/aqi';

const POLLUTANTS = [
  { key: 'pm25', label: 'PM2.5' },
  { key: 'pm10', label: 'PM10' },
  { key: 'no2', label: 'NO₂' },
  { key: 'o3', label: 'O₃' }
];

const WEATHER = [
  { key: 'temperature', label: 'Temp', unit: '°C', digits: 1 },
  { key: 'humidity', label: 'Humidity', unit: '%', digits: 0 },
  { key: 'wind_speed', label: 'Wind', unit: 'm/s', digits: 1 },
  { key: 'pressure', label: 'Pressure', unit: 'hPa', digits: 0 }
];

const fmt = (v, digits = 1) =>
  v == null || isNaN(v) ? '—' : Number(v).toFixed(digits);

export default function AQICard({ data }) {
  if (!data || !data.location) return null;

  const { location, measurements, currentWeather } = data;
  const latest = measurements?.[0];
  const aqi = latest?.aqi;
  const band = getAqiBand(aqi);
  const measuredAt = latest?.measured_at
    ? new Date(latest.measured_at).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      })
    : null;

  return (
    <article className="panel rise p-6 space-y-6">
      {/* Location */}
      <div>
        <p className="eyebrow">Current air quality</p>
        <h2 className="mt-1 text-2xl font-semibold text-white leading-tight">
          {location.city}
        </h2>
        {location.state && (
          <p className="text-sm text-[var(--mist-faint)]">{location.state}, India</p>
        )}
      </div>

      {/* Hero reading */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ color: band.color }}>
          <span className="breathe absolute inset-0 rounded-full blur-2xl" style={{ background: 'currentColor' }} />
          <div className="relative flex flex-col items-center justify-center">
            <span className="stat text-6xl font-bold leading-none" style={{ color: band.color }}>
              {aqi ?? '—'}
            </span>
            <span className="mt-1 text-[10px] tracking-[0.25em] uppercase text-[var(--mist-faint)]">AQI</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xl font-semibold" style={{ color: band.color }}>{band.label}</p>
          {measuredAt && (
            <p className="mt-1 text-xs text-[var(--mist-faint)]">as of {measuredAt}</p>
          )}
        </div>
      </div>

      {/* Advisory */}
      <div
        className="rounded-2xl px-4 py-3 text-sm text-[var(--mist)]"
        style={{ background: `${band.color}14`, borderLeft: `3px solid ${band.color}` }}
      >
        {band.advice}
      </div>

      {/* Pollutants */}
      {latest && (
        <div>
          <p className="eyebrow mb-3">Pollutants · µg/m³</p>
          <div className="grid grid-cols-4 gap-2">
            {POLLUTANTS.map((p) => (
              <div key={p.key} className="chip px-2.5 py-3 text-center">
                <p className="text-[11px] text-[var(--mist-dim)]">{p.label}</p>
                <p className="stat mt-1 text-base font-bold text-white">{fmt(latest[p.key])}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather */}
      {currentWeather && (
        <div>
          <p className="eyebrow mb-3">Weather now</p>
          <div className="grid grid-cols-4 gap-2">
            {WEATHER.map((w) => (
              <div key={w.key} className="text-center">
                <p className="text-[11px] text-[var(--mist-dim)]">{w.label}</p>
                <p className="stat mt-0.5 text-sm font-bold text-white">
                  {fmt(currentWeather[w.key], w.digits)}
                  <span className="text-[10px] font-normal text-[var(--mist-faint)]"> {w.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
