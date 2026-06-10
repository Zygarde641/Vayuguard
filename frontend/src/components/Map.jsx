import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Custom marker icon using CSS classes from index.css
const createMarkerIcon = (aqi) => {
  let glowClass = 'aqi-glow-unknown';
  
  if (aqi !== null && aqi !== undefined) {
    if (aqi < 50) glowClass = 'aqi-glow-good';
    else if (aqi < 100) glowClass = 'aqi-glow-satisfactory';
    else if (aqi < 150) glowClass = 'aqi-glow-light-polluted';
    else if (aqi < 200) glowClass = 'aqi-glow-moderate-polluted';
    else if (aqi < 300) glowClass = 'aqi-glow-heavy-polluted';
    else glowClass = 'aqi-glow-severe-polluted';
  }

  return L.divIcon({
    html: `<div class="aqi-pulse-marker ${glowClass}">${aqi !== null && aqi !== undefined ? aqi : '?'}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: 'custom-marker'
  });
};

function MapController({ selectedCity }) {
  const map = useMap();

  useEffect(() => {
    if (selectedCity && selectedCity.latitude && selectedCity.longitude) {
      // Pan and zoom to selected city with a smooth animation
      map.setView([selectedCity.latitude, selectedCity.longitude], 8, {
        animate: true,
        duration: 1.2
      });
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

  const defaultCenter = [22.9734, 78.6569]; // Center of India for proper overall view

  // Choose the locations list: fallback to hotspots if locations list is empty
  const activeLocations = locations.length > 0 ? locations : hotspots;

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={5}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
        className="w-full h-full"
      >
        {/* CartoDB Dark Matter tiles for modern premium dark mode */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <MapController selectedCity={selectedCity} />

        {/* Display markers for all locations or hotspots */}
        {activeLocations.map((location) => (
          <Marker
            key={location.id}
            position={[location.latitude, location.longitude]}
            icon={createMarkerIcon(location.aqi)}
            eventHandlers={{
              click: () => onSelectCity(location)
            }}
          >
            <Popup closeButton={false}>
              <div className="text-center p-1 font-sans">
                <h3 className="font-bold text-sm text-slate-100">{location.city}</h3>
                {location.state && <p className="text-xs text-slate-400">{location.state}</p>}
                {location.aqi !== null && location.aqi !== undefined && (
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <span className="text-xs text-slate-400">AQI:</span>
                    <span className="text-sm font-extrabold text-sky-400">{location.aqi}</span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
