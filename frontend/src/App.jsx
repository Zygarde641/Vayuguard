import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import LocationSearch from './components/LocationSearch';
import AQICard from './components/AQICard';
import TrendsChart from './components/TrendsChart';
import api from './services/api';

export default function App() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);

  // Fetch all locations on mount
  useEffect(() => {
    fetchAllLocations();
  }, []);

  // Fetch AQI data when city is selected
  useEffect(() => {
    if (selectedCity) {
      fetchAQIData(selectedCity.id);
      fetchTrends(selectedCity.id);
    }
  }, [selectedCity]);

  const fetchAllLocations = async () => {
    try {
      const data = await api.getCurrentAQI();
      setLocations(data);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to load locations');
    }
  };

  const fetchAQIData = async (cityId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAQIByCityId(cityId);
      setAqiData(data);
    } catch (err) {
      console.error('Error fetching AQI data:', err);
      setError('Failed to load AQI data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async (cityId) => {
    try {
      const data = await api.getTrends(cityId, 30);
      setTrends(data);
    } catch (err) {
      console.error('Error fetching trends:', err);
    }
  };

  const handleLocationSelect = (city) => {
    setSelectedCity(city);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-teal-700 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            VayuGuard
          </h1>
          <p className="text-blue-100">
            Hyperlocal air-quality forecasting & health advisory
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Map & Search */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search Bar */}
            <LocationSearch onSelectCity={handleLocationSelect} />

            {/* Map */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <Map
                locations={locations}
                selectedCity={selectedCity}
                onSelectCity={handleLocationSelect}
              />
            </div>
          </div>

          {/* Right Column: AQI Details */}
          <div className="space-y-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 mt-2">Loading...</p>
              </div>
            )}

            {selectedCity && aqiData && !loading && (
              <>
                <AQICard data={aqiData} />
                {trends && <TrendsChart data={trends} />}
              </>
            )}

            {!selectedCity && !loading && (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <p className="text-gray-600">
                  👈 Select a city from the map or search to view AQI details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
