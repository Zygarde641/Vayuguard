# VayuGuard

A simple air-quality website for Indian cities: shows the current AQI and **tomorrow's forecast**, with pollutant breakdown, a live map, and 30-day trends. No login, no accounts — just open it and pick a city.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite, TailwindCSS, Leaflet map, Recharts |
| Backend | Node.js + Express, node-cron scheduled ingestion |
| Data store | PostgreSQL 15, Redis (caching, optional) |
| Data source | [OpenWeatherMap Air Pollution API](https://openweathermap.org/api/air-pollution) (current + 4-day forecast) and [Open-Meteo](https://open-meteo.com/) (weather) |

AQI is computed on the **India CPCB scale (0–500)** from PM2.5/PM10, not OpenWeather's 1–5 index.

## Quick start

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env` and set `OPENWEATHER_API_KEY` (free key from https://home.openweathermap.org/api_keys). Everything else has working defaults.

### 2. Run with Docker

```bash
docker compose up
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:5000
- Postgres → localhost:5432, Redis → localhost:6379

On first boot the database is seeded with 10 major Indian cities and the backend starts pulling pollution + weather data automatically.

> Upgrading an existing database (created before the migrations were added)? Run once:
> ```bash
> cd backend && DB_HOST=localhost npm run migrate
> ```

### Run without Docker

```bash
# backend  (needs Postgres + optionally Redis running locally)
cd backend && npm install && DB_HOST=localhost npm run migrate && npm run dev

# frontend
cd frontend && npm install && npm run dev
```

## Project structure

```
Vayuguard/
├── frontend/          # React app — map, AQI card, tomorrow's forecast, trends
├── backend/
│   ├── routes/        # /api/aqi, /api/air-pollution, /health
│   ├── services/      # OpenWeather + Open-Meteo ingestion, AQI queries
│   ├── jobs/          # hourly cron ingestion
│   ├── db/            # schema.sql, migrations, migrate.js
│   └── utils/         # CPCB AQI calculation
├── docker/            # Dockerfiles
├── docker-compose.yml
└── README.md
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/aqi` | Current AQI for all cities |
| `GET /api/aqi/search?q=` | Search cities by name |
| `GET /api/aqi/:cityId?days=7` | City detail + recent measurements |
| `GET /api/aqi/:cityId/trends?days=30` | Daily AQI trend |
| `GET /api/aqi/hotspots/worst?limit=10` | Worst-AQI cities |
| `GET /api/air-pollution/city/:cityId` | Current + 4-day hourly forecast (drives "Tomorrow's AQI") |

## Data ingestion

`node-cron` jobs run hourly: OpenWeather air pollution at `:00`, Open-Meteo weather at `:15`, for every seeded city. Both also run once on startup. Rate-limited to stay within the OpenWeather free tier.
