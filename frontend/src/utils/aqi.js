// Single source of truth for the India CPCB AQI scale (0-500).
// Drives the AQI cards, map markers, and the ambient background tint.

export const AQI_BANDS = [
  { max: 50,       label: 'Good',         color: '#22c55e', advice: 'Air is clean. A great day to be outside.' },
  { max: 100,      label: 'Satisfactory', color: '#9bc53d', advice: 'Comfortable for most people. Sensitive folks can take it easy.' },
  { max: 200,      label: 'Moderate',     color: '#eab308', advice: 'Sensitive groups should limit long or intense time outdoors.' },
  { max: 300,      label: 'Poor',         color: '#f97316', advice: 'Ease up on outdoor activity. Wear a mask if you are sensitive.' },
  { max: 400,      label: 'Very Poor',    color: '#ef4444', advice: 'Avoid outdoor exertion. Wear an N95 when you head out.' },
  { max: Infinity, label: 'Severe',       color: '#b02a4a', advice: 'Stay indoors and run an air purifier if you have one.' }
];

const NO_DATA = { label: 'No data', color: '#64748b', advice: 'No recent reading for this city yet.' };

export function getAqiBand(aqi) {
  if (aqi == null || isNaN(aqi)) return NO_DATA;
  return AQI_BANDS.find((b) => aqi <= b.max) || NO_DATA;
}
