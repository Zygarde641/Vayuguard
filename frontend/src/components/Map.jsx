import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Custom marker icon
const createMarkerIcon = (aqi) => {
  let color = '#4caf50'; // Good

  if (aqi >= 50 && aqi < 100) color = '#8bc34a'; // Satisfactory
  else if (aqi >= 100 && aqi < 150) color = '#fdd835'; // Lightly Polluted
  else if (aqi >= 150 && aqi < 200) color = '#ff9800'; // Moderately Polluted
  else if (aqi >= 200 && aqi < 300) color = '#f44336'; // Heavily Polluted
  else if (aqi >= 300) color = '#7c1d12'; // Severely Polluted

  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${aqi || '?'}</div>`,
    iconSize: [30, 30],
    className: 'custom-marker'
  });
};

function MapController({ selectedCity }) {
  const map = useMap();

  useEffect(() => {
    if (selectedCity && selectedCity.latitude && selectedCity.longitude) {
      map.setView([selectedCity.latitude, selectedCity.longitude], 10);
    }
  }, [selectedCity, map]);

  return null;
}

export default function Map({ locations, selectedCity, onSelectCity }) {
  const [hotspots, setHotspots] = useState([]);

  useEffect(() => {
    fetchHotspots();
  }, []);

  const fetchHotspots = async () => {
    try {
      const data = await api.getHotspots(20);
      setHotspots(data);
    } catch (err) {
      console.error('Error fetching hotspots:', err);
    }
  };

  const defaultCenter = [20.5937, 78.9629]; // India center

  return (
    <MapContainer
      center={defaultCenter}
      zoom={4}
      style={{ height: '500px', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <MapController selectedCity={selectedCity} />

      {/* Display markers for all locations or hotspots */}
      {(locations.length > 0 ? locations : hotspots).map((location) => (
        <Marker
          key={location.id}
          position={[location.latitude, location.longitude]}
          icon={createMarkerIcon(location.aqi)}
          eventHandlers={{
            click: () => onSelectCity(location)
          }}
        >
          <Popup>
            <div className="text-center p-2">
              <h3 className="font-bold text-lg">{location.city}</h3>
              {location.state && <p className="text-sm text-gray-600">{location.state}</p>}
              {location.aqi && (
                <>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{location.aqi}</p>
                  <p className="text-xs text-gray-500">AQI</p>
                  {location.pm25 && <p className="text-sm">PM2.5: {location.pm25.toFixed(1)}</p>}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
