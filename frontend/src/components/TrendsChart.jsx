import React from 'react';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getAqiBand } from '../utils/aqi';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const avg = payload.find((p) => p.dataKey === 'avg_aqi')?.value;
  const band = getAqiBand(avg);
  return (
    <div className="panel px-3 py-2" style={{ borderRadius: 12 }}>
      <p className="text-[11px] text-[var(--mist-dim)]">
        {new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
      <p className="stat text-sm font-bold" style={{ color: band.color }}>
        {avg?.toFixed(0)} <span className="font-normal text-[var(--mist-dim)]">avg · {band.label}</span>
      </p>
    </div>
  );
}

export default function TrendsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <article className="panel rise p-6">
        <p className="eyebrow">30-day trend</p>
        <p className="mt-4 text-sm text-[var(--mist-faint)]">
          Not enough history yet. The trend fills in as hourly readings collect.
        </p>
      </article>
    );
  }

  const values = data.map((d) => d.avg_aqi || 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const peak = Math.max(...data.map((d) => d.max_aqi || 0));

  return (
    <article className="panel rise p-6">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">30-day trend</p>
        <span className="text-[10px] text-[var(--mist-faint)]">daily average AQI</span>
      </div>

      <div className="mt-4 -ml-2">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--sky)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--sky)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,170,205,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--mist-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,170,205,0.12)' }}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: 'var(--mist-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148,170,205,0.25)' }} />
            <Area
              type="monotone" dataKey="avg_aqi"
              stroke="var(--sky)" strokeWidth={2}
              fill="url(#aqiFill)" dot={false} activeDot={{ r: 4, fill: 'var(--sky)' }}
            />
            <Line
              type="monotone" dataKey="max_aqi"
              stroke="rgba(239,68,68,0.55)" strokeWidth={1} strokeDasharray="4 4" dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="chip px-3 py-2.5">
          <p className="text-[11px] text-[var(--mist-dim)]">Period average</p>
          <p className="stat mt-0.5 text-lg font-bold" style={{ color: getAqiBand(mean).color }}>
            {mean.toFixed(0)}
          </p>
        </div>
        <div className="chip px-3 py-2.5">
          <p className="text-[11px] text-[var(--mist-dim)]">Worst day</p>
          <p className="stat mt-0.5 text-lg font-bold" style={{ color: getAqiBand(peak).color }}>
            {peak.toFixed(0)}
          </p>
        </div>
      </div>
    </article>
  );
}
