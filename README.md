# PROJECT INDIA AI OS MAPS

**India-first geospatial intelligence and operations platform**

This repository is the initial developer starter recovered from the saved project brief. It creates a working local dashboard with an interactive India-centred map, selectable thematic layers, a scenario/event panel, API health status and an AI analyst placeholder.

> **Important:** the current build is a DEMONSTRATION SANDBOX. Map markers and scenario records are simulated examples, not real alerts, official observations, live traffic, or government intelligence. The AI analyst endpoint is a transparent rule-based placeholder, not a connected language model. No national live feeds are connected by default.

## 1. Product objective

Build a unified geospatial intelligence workspace that can ingest licensed/authorized public data, normalize it, display it on maps, analyze trends, and help authorized users prepare evidence-backed reports and response options.

## 2. Requirements

- Windows 11 / Windows 10, macOS or Linux
- Python 3.11+
- Node.js 20+
- npm 10+
- Internet access for map tiles and npm packages

## 3. Start on Windows

Open PowerShell in this folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
.\scripts\dev.ps1
```

The frontend opens at `http://localhost:5173` and the API runs at `http://127.0.0.1:8000`. API docs: `http://127.0.0.1:8000/docs`.

To run the complete dependency, backend-test and frontend-build pipeline:

```powershell
.\scripts\build-all.ps1
```

To build only the frontend for deployment:

```powershell
.\scripts\build.ps1
```

## 4. Start manually

### Backend

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

### Frontend (second terminal)

```powershell
cd frontend
npm install
npm run dev
```

## 5. Host the dashboard as a website (GitHub Pages)

The dashboard is a static single-page app. The production build bundles the synthetic fixtures from `data/demo_data.json`, so the hosted site runs without the Python API. The API remains available for local work and future connectors.

`.github/workflows/deploy.yml` runs the API tests, builds the frontend and publishes `frontend/dist` to GitHub Pages on every push to `main`.

1. Create a repository on GitHub and push this project to the `main` branch.
2. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push a commit (the workflow also has a manual *Run workflow* button).
4. The site is published at `https://<account>.github.io/<repository>/`.

The Vite build uses a relative asset base, so it works under any project sub-path. On the hosted site the status bar reports `BUNDLED DEMO DATASET` instead of a live API connection, and the AI analyst returns the same transparent rule-based placeholder text as the local API.

To point the static build at a deployed API instead, build with an API origin:

```powershell
cd frontend
$env:VITE_API_URL="https://your-api.example.com"; npm run build
```

## 6. What's implemented in this starter

- Dark command-centre dashboard shell
- India-centred interactive MapLibre map
- Toggleable thematic categories
- Demo GeoJSON event markers and selected-event details
- API-backed overview and event list
- API health and explicit demo/live status indicators
- Rule-based analyst placeholder that clearly states it is not live AI
- Static build with bundled fixtures for free hosting (GitHub Pages workflow included)
- Shared `data/demo_data.json` fixture file used by both the API and the UI
- FastAPI backend with typed request/response models
- Windows setup, dev and build scripts
- Product blueprint, delivery roadmap, connector plan and governance notes

## 7. What is not implemented yet

- No official IMD, NDMA/SACHET, CWC, ISRO/NRSC/Bhuvan, Survey of India, railway, road, utility or data.gov.in connector is active.
- No validated flood, cyclone, traffic, population, economic or infrastructure prediction model is included.
- No satellite or drone ingestion is active.
- No real-time national operations centre, government integration, or command authority is claimed.
- No person-level tracking, face recognition, watchlists or mass-surveillance capability is included.

See `docs/` before connecting production datasets.

## 8. Architecture direction

```text
Authorized public / partner data
            |
            v
Connector adapters + license/provenance checks
            |
            v
Ingestion queue -> validation -> geospatial normalization
            |
            v
PostgreSQL + PostGIS / object storage / cache
            |
            +--> analytics and forecasting jobs
            +--> AI analyst (retrieval + tools + evidence)
            |
            v
FastAPI service / OGC-compatible services
            |
            v
React + MapLibre + analytical panels
```

For the initial local build, the database and queue are intentionally omitted; the API serves a small local fixture. Add PostGIS, a queue and a source registry only after the MVP interface and data model are validated.

## 9. Product promises and evidence

The product should promise only capabilities demonstrated by the current release. Every displayed dataset should show its provider, license, geographic coverage, timestamp, update frequency, processing method and confidence/quality notes. A visual overlay must never imply that a model output is an official warning.

## 10. Project status

- **Recovered concept:** yes — saved master file dated 17 May 2026.
- **Starter dashboard code:** included in this repository.
- **Live official data integration:** not yet implemented.
- **Forecasting accuracy validation:** not yet performed.
- **Production readiness:** not yet achieved.
