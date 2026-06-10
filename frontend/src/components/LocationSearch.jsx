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
        <input
          type="text"
          placeholder="🔍 Search for a city..."
          value={query}
          onChange={handleSearch}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/30 transition duration-300 backdrop-blur-md shadow-inner text-sm"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition duration-200 text-sm font-semibold"
          >
            Clear
          </button>
        )}
      </div>

      {showResults && (
        <>
          {/* Backdrop click listener to close results */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowResults(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto backdrop-blur-xl divide-y divide-slate-800/50">
            {loading ? (
              <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-400"></div>
                Searching...
              </div>
            ) : results.length > 0 ? (
              results.map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectResult(city)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-800/50 text-slate-200 transition duration-200 flex flex-col gap-0.5"
                >
                  <div className="font-medium text-sm text-slate-200 hover:text-sky-400 transition duration-150">{city.city}</div>
                  {city.state && <div className="text-xs text-slate-400">{city.state}</div>}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 text-xs">No cities found</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
