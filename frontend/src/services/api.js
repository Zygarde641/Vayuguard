import axios from 'axios';

const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

const api = {
  // Get current AQI for all locations
  getCurrentAQI: () => client.get('/aqi').then(res => res.data),

  // Search cities by name
  searchCities: (query) => 
    client.get('/aqi/search', { params: { q: query } }).then(res => res.data),

  // Get AQI for specific city
  getAQIByCityId: (cityId, days = 7) => 
    client.get(`/aqi/${cityId}`, { params: { days } }).then(res => res.data),

  // Get trends for a city
  getTrends: (cityId, days = 30) => 
    client.get(`/aqi/${cityId}/trends`, { params: { days } }).then(res => res.data),

  // Get hotspots
  getHotspots: (limit = 10) =>
    client.get('/aqi/hotspots/worst', { params: { limit } }).then(res => res.data),

  // Get current + 4-day hourly air pollution forecast for a city
  getCityAirPollution: (cityId) =>
    client.get(`/air-pollution/city/${cityId}`).then(res => res.data)
};

export default api;
