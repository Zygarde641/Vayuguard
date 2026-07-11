import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getAqiBand } from '../utils/aqi';

export default function ForecastCard({ cityId }) {
  const [tomorrow, setTomorrow] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | empty

  useEffect(() => {
    if (!cityId) return;
    let active = true;
    setState('loading');
    setTomorrow(null);

    api.getCityAirPollution(cityId)
      .then((data) => {
        if (!active) return;
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
          setState('ready');
        } else {
          setState('empty');
        }
      })
      .catch(() => active && setState('empty'));

    return () => { active = false; };
  }, [cityId]);

  if (state === 'empty') return null;

  const band = tomorrow ? getAqiBand(tomorrow.avg) : null;
  const dayLabel = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-IN', { weekday: 'long' });
  })();

  return (
    <article className="panel rise p-6">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Tomorrow · {dayLabel}</p>
        <span className="text-[10px] text-[var(--mist-faint)]">forecast</span>
      </div>

      {state === 'loading' && (
        <div className="mt-5 flex items-center gap-3 text-[var(--mist-dim)]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--sky)]" />
          <span className="text-sm">Reading the forecast…</span>
        </div>
      )}

      {state === 'ready' && band && (
        <>
          <div className="mt-4 flex items-end gap-4">
            <span className="stat text-5xl font-bold leading-none" style={{ color: band.color }}>
              {tomorrow.avg}
            </span>
            <div className="pb-1">
              <p className="text-base font-semibold" style={{ color: band.color }}>{band.label}</p>
              <p className="text-xs text-[var(--mist-faint)]">
                peak <span className="stat text-white">{tomorrow.peak}</span>
              </p>
            </div>
          </div>

          {/* Severity meter */}
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.min(100, (tomorrow.avg / 500) * 100)}%`, background: band.color }}
            />
          </div>
          <p className="mt-3 text-xs text-[var(--mist-faint)]">Daily average, India CPCB scale</p>
        </>
      )}
    </article>
  );
}
