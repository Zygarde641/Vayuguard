# VayuGuard - Hyperlocal Air Quality Forecasting Platform

A production-ready platform for real-time air quality monitoring, forecasting, and personalized health advisories across Indian cities using MERN stack + ML.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- PostgreSQL 15 (optional, handled by Docker)

### Setup

1. **Clone repository**
```bash
cd Vayuguard
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Start with Docker**
```bash
docker-compose up
```

The application will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- ML Service: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

## 📊 Project Structure

```
vayuguard/
├── frontend/              # React + Leaflet map UI
├── backend/               # Express.js API server
├── ml-service/           # FastAPI ML prediction service
├── data-pipeline/        # Python data processing & model training
├── docker/               # Dockerfiles for all services
├── .github/workflows/    # CI/CD pipeline
├── docker-compose.yml    # Full stack orchestration
└── README.md
```

## 🔄 Architecture

```
External Data Sources (OpenAQ, Open-Meteo)
         ↓
Data Ingestion Pipeline (Node.js scheduled jobs)
         ↓
PostgreSQL Database
    ↙        ↘
Backend API    Data Pipeline (Python)
  ↓             ↓
Frontend UI    ML Models (XGBoost)
  ↓             ↓
User Interface ML Service (FastAPI)
```

## 🎯 Features

### Phase 1: MVP (Current)
- ✅ Real-time AQI data from OpenAQ + Open-Meteo
- ✅ Interactive map with location selector
- ✅ 7-day historical trends
- ✅ Pollutant breakdown (PM2.5, PM10, NO₂, O₃)
- ✅ Mobile-responsive design
- ✅ Health advisories based on AQI

### Phase 2: Advanced (Planned)
- 📈 24-72 hour AQI forecasts (XGBoost)
- 🏥 Personalized health risk scoring
- 🔔 Alert subscriptions by location
- 📊 Analytics dashboards
- 👤 User profiles and favorites

### Phase 3: Production (Roadmap)
- 🔐 Enterprise authentication
- 🌍 Multi-country support
- 📱 Mobile app
- 🤖 Advanced ML pipelines

## 📥 Dataset Sources for Model Training

### 1. **Real-Time Air Quality Data** (Free)

- [Overview](#overview)
- [The Problem](#the-problem)
- [What VayuGuard Delivers](#what-vayuguard-delivers)
- [System Architecture](#system-architecture)
- [Engineering Tracks](#engineering-tracks)
- [Tech Stack](#tech-stack)
- [45-Day Roadmap](#45-day-roadmap)
- [Operating Rhythm](#operating-rhythm)
- [Definition of Done](#definition-of-done)
- [Early Decisions to Lock](#early-decisions-to-lock)

---

## Overview

VayuGuard is a production-grade web platform that ingests real-time and historical air-quality data, forecasts AQI 24–72 hours ahead at a hyperlocal level, and delivers personalised health advisories based on each user's profile (asthma, children, elderly, outdoor workers).

| | |
|---|---|
| **Duration** | 45 working days · 9 one-week sprints |
| **Tracks** | AI/ML · Data · DevOps · MERN |
| **Outcome** | Live, monitored production URL |
| **Data Sources** | OpenAQ · CPCB · Open-Meteo (all public APIs) |

---

## The Problem

Air-quality data today is mostly station-level, backward-looking, and impersonal — it tells you the AQI *was* bad yesterday at a monitoring station eight kilometres away.

VayuGuard closes the gap by answering two questions people actually care about:

- **Forward-looking** — *How bad will it be near me tomorrow afternoon?*
- **Personal** — *I have asthma / a toddler / I work outdoors — what should I do?*

---

## What VayuGuard Delivers

| # | Feature | Description |
|---|---------|-------------|
| 01 | **Ingest** | Real-time and historical air-quality data (OpenAQ / CPCB) plus weather (Open-Meteo) across selected cities and zones |
| 02 | **Forecast** | Predicts AQI 24–72 hours ahead at a hyperlocal level using a progression of ML models |
| 03 | **Advise** | Generates personalised health advisories from each user's profile |
| 04 | **Visualise** | Interactive map, forecast charts, historical trends, analytics dashboards, and threshold-based alerts |
| 05 | **Analyse** | Admin and analytics layer surfacing pollution patterns, hotspots and weather–pollution correlations |

---

## System Architecture

```
External Data Sources
OpenAQ · CPCB · Open-Meteo
         │
         ▼
Ingestion & Cleaning Pipeline  ──────────────────────────────────────┐
(Data Analyst)                                                        │
         │                                                            │
         ▼                                                            │
Analytical Store + Dashboards    Feature Engineering + Models         │
Postgres · KPIs · Insights   ──► AI/ML · forecast + risk             │
                                          │                           │
                                          ▼                           │
                                 ML Service — FastAPI                 │
                                 /forecast · /health-risk             │
                                          │                           │
                                          ▼                           │
                                 Application Backend                  │
                                 Node.js · Express · MongoDB          │
                                          │                           │
                                          ▼                           │
                                 Web Application — React              │
                                 Map · Forecast · Alerts · Admin      │
                                          │                           │
                                          ▼                           │
                                      End Users                       │
                                                                      │
└──────────────────── DevOps Platform ────────────────────────────────┘
       Docker · CI/CD · Cloud Hosting · Scheduled Jobs
            Monitoring · Security · Secrets Management
```

> **Key principle:** Lock the two shared contracts early — the **data schema** (Analyst + ML + MERN) and the **ML API spec** (ML + MERN + DevOps) — and the four tracks rarely block one another.

---

## Engineering Tracks

### AI/ML Developer — *Owns Prediction*

Responsible for the full ML lifecycle: feature engineering (lag features, weather joins, time features), a baseline → classical → deep model progression for AQI forecasting, a health-risk scoring model, rigorous evaluation (MAE / RMSE, backtesting), a versioned FastAPI serving layer, and an automated retraining pipeline.

**Model used:** XGBoost

**Key deliverables:** `/forecast` and `/health-risk` FastAPI endpoints, model card, retraining pipeline.

---

### Data Analyst — *Owns Data & Insight*

Responsible for the ingestion and cleaning pipeline, data-quality checks, exploratory analysis, the analytical store and schema, KPI / metric definitions ("unhealthy-air days", exposure scores), health-impact and hotspot analysis, and the dashboards powering the platform's insights surfaces and admin view.

**Key deliverables:** Ingestion scripts for all target cities, KPI dashboards, data-quality dashboard, advisory rule definitions.

---

### DevOps Engineer — *Owns Reliability*

Responsible for repo, branching and environments; Dockerising every service; CI/CD pipelines; infrastructure provisioning; hosting the databases and services; scheduling ingestion and retraining; secrets management; monitoring, logging and alerting; security hardening; load testing; backups; and the production launch.

**Key deliverables:** Dockerised services, CI/CD (GitHub Actions), cloud hosting, Prometheus + Grafana monitoring, runbooks.

---

### MERN Stack Developer — *Owns Experience*

Responsible for the full web app: authentication; user health-profile management; the interactive map and forecast views; the alerts / subscription system; the analytics and insights UI; an admin panel; and the integration glue that calls the ML and analytics APIs — all responsive and production-grade.

**Key deliverables:** React frontend, Node/Express/MongoDB backend, all API integrations, admin panel, E2E tests.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **AI / ML** | Python · scikit-learn · XGBoost · PyTorch / TensorFlow · FastAPI |
| **Data** | SQL · PostgreSQL · Pandas · dbt / BI · Dashboards |
| **DevOps** | Docker · GitHub Actions · Cloud (Render / Railway / Fly / AWS) · Nginx · Prometheus / Grafana |
| **MERN** | React · Node.js · Express · MongoDB |

---

## 45-Day Roadmap

The project runs across **five delivery phases** and **nine one-week sprints**. Every Friday is demo day.

```
Weeks 1–2          Weeks 3–5        Week 6         Weeks 7–8          Week 9
Foundation &       Core Build       Integration    Testing &          Launch &
Discovery                                          Hardening          Handover
```

### Phase 1 — Foundation & Discovery (Weeks 1–2)

| Week | Focus |
|------|-------|
| **Week 1** · Days 1–5 | Problem framing, shared contracts (data schema + ML API spec), repo setup, wireframes, app shell deployed to staging |
| **Week 2** · Days 6–10 | Feature pipeline, baseline model, ingestion script, CI setup, auth + map + forecast page UI |

**Submission gate (end of Week 1):** signed-off data schema, ML API contract, architecture diagram, working repo with CI placeholder, app shell on staging.

---

### Phase 2 — Core Build (Weeks 3–5)

| Week | Focus |
|------|-------|
| **Week 3** · Days 11–15 | XGBoost model, FastAPI `/forecast` live, ingestion scaled to all cities, monitoring set up, app consuming real forecasts |
| **Week 4** · Days 16–20 | Model tuning, `/health-risk` endpoint, Grafana dashboards, personalised advisory UI, automated deploys |
| **Week 5** · Days 21–25 | Retraining pipeline, drift checks, Nginx gateway, feature-complete app on staging |

---

### Phase 3 — Full Integration (Week 6)

| Days | Focus |
|------|-------|
| **Days 26–30** | All services behind one staging URL, no mocks remaining, load testing, tracing, accessibility pass, full documentation written |

---

### Phase 4 — Testing & Hardening (Weeks 7–8)

| Week | Focus |
|------|-------|
| **Week 7** · Days 31–35 | Edge-case tests, chaos testing, E2E tests, model monitoring, cross-browser testing |
| **Week 8** · Days 36–40 | Security review (TLS, headers, XSS, rate limits), UAT, performance tuning, release candidates tagged |

---

### Phase 5 — Launch & Handover (Week 9)

| Days | Focus |
|------|-------|
| **Days 41–45** | Production deploy of all services, live monitoring verified, final documentation and READMEs, demo rehearsal, final presentation |

**Submission gate (Day 45):** every item on the production-readiness checklist below must be true.

---

## Operating Rhythm

Every candidate submits **every day**. The rhythm is what turns 45 days of effort into a production system rather than a pile of notebooks.

1. Work pushed to your branch with a clear commit message; a PR opened when a feature is complete.
2. A three-line end-of-day log in the shared tracker — **Done / Blocked / Next**.
3. Any artefact attached — notebook, screenshot, dashboard link or deployed URL.
4. **Every Friday is demo day:** each track shows a working increment, followed by a 30-minute integration check.

> **The one rule that keeps it production-ready:** nothing is "done" until it is committed, reviewed, and running in at least the staging environment. Local-only work does not count.

---

## Definition of Done

This is the bar candidates are graded against on Day 45. If any single item is missing, the project is not production-ready.

- [ ] A live, public production URL serving real users
- [ ] Every service containerised and deployed through CI/CD
- [ ] Real, scheduled data ingestion and automated model retraining
- [ ] Monitoring, logging and alerting active across all services
- [ ] Secrets managed centrally — no keys committed to code
- [ ] Authentication and baseline security hardening complete
- [ ] Automated tests passing in the pipeline
- [ ] Rollback procedure and on-call runbook documented
- [ ] A complete README / handover document per role

---

## Early Decisions to Lock

Lock these in Week 1 to avoid scope and schedule risk later.

### Target Cities & Zones

Start with **two or three cities**, not twenty. Narrow scope keeps the data pipeline, models and dashboards tractable inside 45 days — breadth can come after launch.

### Cloud Host

| Option | Trade-off |
|--------|-----------|
| **Render / Railway / Fly** | Simplicity and speed; recommended for most teams |
| **AWS** | Genuine DevOps depth, but adds schedule risk; choose deliberately |

---

*Altrodav · Industry Immersion Program — Capstone Project Brief*
