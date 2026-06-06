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
    <div className="relative">
      <div className="bg-white rounded-lg shadow-lg p-4">
        <input
          type="text"
          placeholder="🔍 Search for a city..."
          value={query}
          onChange={handleSearch}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 transition"
        />

        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : results.length > 0 ? (
              results.map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectResult(city)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 transition"
                >
                  <div className="font-semibold text-gray-800">{city.city}</div>
                  {city.state && <div className="text-sm text-gray-500">{city.state}</div>}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">No cities found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
