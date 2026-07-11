import React, { useState } from 'react';
import api from '../services/api';

export default function LocationSearch({ onSelectCity }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.searchCities(value);
      setResults(data);
      setShowResults(true);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (city) => {
    onSelectCity(city);
    setQuery(city.city);
    setShowResults(false);
  };

  return (
    <div className="relative w-full z-[1000]">
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mist-faint)]"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search a city…"
          value={query}
          onChange={handleSearch}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="w-full rounded-2xl border border-[var(--line-strong)] bg-[rgba(11,17,32,0.72)] py-3 pl-11 pr-16 text-sm text-white placeholder-[var(--mist-faint)] shadow-lg backdrop-blur-xl transition focus:border-[var(--sky)] focus:outline-none focus:ring-2 focus:ring-[rgba(76,199,230,0.25)]"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setShowResults(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-[var(--mist-dim)] transition hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {showResults && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)} />
          <div className="panel absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-xs text-[var(--mist-dim)]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--sky)]" />
                Searching…
              </div>
            ) : results.length > 0 ? (
              results.map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectResult(city)}
                  className="group flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
                >
                  <span className="text-sm font-medium text-[var(--mist)] transition group-hover:text-[var(--sky)]">{city.city}</span>
                  {city.state && <span className="text-xs text-[var(--mist-faint)]">{city.state}</span>}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-[var(--mist-dim)]">No cities found. Try another name.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
