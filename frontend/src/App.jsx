import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import LocationSearch from './components/LocationSearch';
import AQICard from './components/AQICard';
import ForecastCard from './components/ForecastCard';
import TrendsChart from './components/TrendsChart';
import api from './services/api';
import { AQI_BANDS, getAqiBand } from './utils/aqi';

const DEFAULT_TINT = '#4cc7e6';

function BreathMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="3" fill="var(--sky)" />
      <path d="M16 9a7 7 0 0 1 7 7" stroke="var(--sky)" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
      <path d="M16 4a12 12 0 0 1 12 12" stroke="var(--sky)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function AqiLegend() {
  return (
    <div className="panel p-4">
      <p className="eyebrow mb-3">AQI scale · CPCB</p>
      <div className="space-y-1.5">
        {AQI_BANDS.map((b, i) => {
          const lo = i === 0 ? 0 : AQI_BANDS[i - 1].max + 1;
          const range = b.max === Infinity ? `${lo}+` : `${lo}–${b.max}`;
          return (
            <div key={b.label} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
              <span className="flex-1 text-xs text-[var(--mist-dim)]">{b.label}</span>
              <span className="stat text-[11px] text-[var(--mist-faint)]">{range}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);

  useEffect(() => { fetchAllLocations(); }, []);

  useEffect(() => {
    if (selectedCity) {
      fetchAQIData(selectedCity.id);
      fetchTrends(selectedCity.id);
    }
  }, [selectedCity]);

  const fetchAllLocations = async () => {
    try {
      setLocations(await api.getCurrentAQI());
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Could not load the map data. Check that the backend is running.');
    }
  };

  const fetchAQIData = async (cityId) => {
    setLoading(true);
    setError(null);
    try {
      setAqiData(await api.getAQIByCityId(cityId));
    } catch (err) {
      console.error('Error fetching AQI data:', err);
      setError('Could not load air data for this city. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async (cityId) => {
    try {
      setTrends(await api.getTrends(cityId, 30));
    } catch (err) {
      console.error('Error fetching trends:', err);
      setTrends(null);
    }
  };

  const latestAqi = aqiData?.measurements?.[0]?.aqi;
  const activeColor = selectedCity ? getAqiBand(latestAqi).color : DEFAULT_TINT;

  return (
    <div className="relative" style={{ '--aqi': activeColor }}>
      <div className="ambient" />

      <div className="relative z-10 flex min-h-screen flex-col lg:h-screen">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <BreathMark />
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight text-white">VayuGuard</h1>
              <p className="mt-1 text-[11px] text-[var(--mist-faint)]">India&rsquo;s air, hour by hour</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 backdrop-blur-md sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #34d399' }} />
            <span className="text-[11px] text-[var(--mist-dim)]">Live · updates hourly</span>
          </div>
        </header>

        {/* Main */}
        <main className="grid flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:min-h-0 lg:grid-cols-[1fr_minmax(360px,400px)] lg:gap-5 lg:px-6 lg:pb-6">
          {/* Map */}
          <section className="relative min-h-[380px] overflow-hidden rounded-3xl border border-[var(--line)] lg:h-full">
            <div className="absolute inset-x-4 top-4 z-[1000] max-w-md">
              <LocationSearch onSelectCity={setSelectedCity} />
            </div>
            <Map locations={locations} selectedCity={selectedCity} onSelectCity={setSelectedCity} />
          </section>

          {/* Rail */}
          <aside className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
            {error && (
              <div className="panel rise border-l-2 border-l-red-400 p-4 text-sm text-[var(--mist)]">
                {error}
              </div>
            )}

            {loading && (
              <div className="panel p-6">
                <div className="flex items-center gap-3 text-[var(--mist-dim)]">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--sky)]" />
                  <span className="text-sm">Reading the air…</span>
                </div>
              </div>
            )}

            {selectedCity && aqiData && !loading && (
              <>
                <AQICard data={aqiData} />
                <ForecastCard cityId={selectedCity.id} />
                {trends && <TrendsChart data={trends} />}
              </>
            )}

            {!selectedCity && !loading && (
              <>
                <div className="panel rise p-6">
                  <BreathMark />
                  <h2 className="mt-4 text-xl font-semibold text-white">Read the air near you</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mist-dim)]">
                    Tap a city on the map or search above to see its current air quality
                    and what tomorrow looks like.
                  </p>
                </div>
                <AqiLegend />
              </>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
