# NEXUS Frontend — GIS Command Center (R4)

React 18 + Vite 6 + Leaflet dashboard for NEXUS (SIH 2026, PS SIH26127).
This is the **primary SIH demo UI** (decision D10) — it talks to the R3
FastAPI backend live and degrades to a clearly-labeled simulation mode when
the backend is offline.

- **Dev server:** http://localhost:3000 (Vite proxies `/api` → `:8000`)
- **Production build:** `npm run build` → `dist/`
- **Unit tests:** `npm test` (Vitest — pure service modules: analytics
  bridge, tile config, journey-focus derivation)
- **Lint:** `npm run lint` (ESLint flat config — recommended + react-hooks
  rules only; warnings are advisory)
- **No TypeScript, no component tests** (remaining MVP gap; see Root TODO §10)

## Quick start

```bash
npm install
npm run dev        # requires the backend on :8000 for live data
```

The header shows **ONLINE** when the backend is reachable and **SIMULATED**
when it is not (mock data fallback — see `services/api.js`).

## Stack

| Layer | Choice | Notes |
|---|---|---|
| UI | React 18 | function components, hooks, inline styles (no CSS framework) |
| Build | Vite 6 | dev proxy `/api` → `http://localhost:8000` (`vite.config.js`) |
| Map | Leaflet 1.9 + react-leaflet 4 | camera markers, journey polylines, focus/flyTo |
| Icons | lucide-react | |
| API | native `fetch` | `services/api.js` — one client, mock fallback, 3.5 s timeouts |

## Data flow

```
App.jsx  — polls backend every 12 s (health, cameras, vehicles, observations)
  ├─ services/api.js          — REST client; page_size=200 (backend clamp);
  │                             live mode NEVER substitutes mock journeys
  ├─ services/analyticsBridge.js — client-side analytics + alert rules (D4:
  │                             mirrors analytics/traffic_analyzer.py logic)
  ├─ services/aiService.js    — rule-based AI copilot replies (no LLM; canned)
  └─ 12 workspaces via props (no global state manager)
```

Key decisions baked into the code:

- **Polling, not websockets** — 12 s interval; new ingest observations appear
  on the next tick.
- **page_size 200** everywhere — the backend clamp ceiling; KPIs, client
  analytics and alerts see the full dataset (PR #11 fix).
- **No mock substitution in live mode** — a failed journey fetch returns
  `[]`, never a mock route with colliding ids (PR #11 fix).
- **Leaflet `invalidateSize({animate:false, pan:false})`** via
  `ContainerSizeObserver` (ResizeObserver) — fixes the zero-width-container
  flyTo bug (PR #11 fix).

## Map tiles (Tactical GIS)

The base map uses **CARTO Dark Matter** tiles by default — free for
non-commercial use, **no API key required**. If your network or deployment
receives key-required/rate-limited responses from the tile CDN, switch
providers via environment variables (copy `.env.example` to `.env`, which is
gitignored — names only, never real keys):

| Variable | Purpose |
|---|---|
| `VITE_MAP_TILES_URL` | Tile URL template; may contain an `{apikey}` placeholder for keyed providers (MapTiler, Thunderforest, …) |
| `VITE_MAP_API_KEY` | The key — only used when the URL contains `{apikey}`; empty = keyless |
| `VITE_MAP_TILES_ATTRIBUTION` | Attribution HTML override |
| `VITE_MAP_MAX_ZOOM` | Max tile zoom (default 19) |

Keyless fallback that always works: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.

> Note: `VITE_*` values are compiled into the browser bundle at build time
> (inherent to client-side map keys) — use a browser-allowed key with domain
> restrictions from your provider. Read in `src/services/mapConfig.js`.

## Workspaces

| Tab | Component | Data source |
|---|---|---|
| Overview | `overview/OverviewWorkspace` | live (KPIs, fleet status, feed) |
| GIS Map | `map/TacticalMap` + `CameraDetailDrawer` | live (markers, journeys) |
| Cameras | `cameras/CameraGrid` + `CameraEditModal` | live (GET/PATCH cameras) |
| Live Feed | `observations/LiveFeedTable` + `IngestSimulator` | live (observations, ingest POST) |
| ANPR | `anpr/AnprWorkspace` + `anpr/VideoUploadModal` | live (plate reads, video upload → pipeline) |
| Tracking | `tracking/VehicleSearch` + `JourneyTimeline` + `CrossCameraJourney` | live (vehicles, journeys) |
| Re-ID | `reid/ReidWorkspace` | live — real plate-linked cross-camera sightings (D3) |
| Analytics | `analytics/TrafficAnalytics` | client-computed from live data (D4) |
| Alerts | `alerts/AlertsWorkspace` | client-computed rules; ack/resolve persisted to localStorage (browser-only, D4) |
| Reports | `reports/ReportsWorkspace` | derived from live data |
| Health | `system/SystemHealthWorkspace` | live health endpoint |
| Settings | `system/SettingsWorkspace` | local UI prefs |

## Honest labels in the UI (do not remove before the viva)

- "CLIENT-DERIVED INTELLIGENCE" tags — analytics/alerts computed in the
  browser, not by a backend endpoint (D4).
- Re-ID studio notice — sightings are plate-linked associations (D3), the
  visual matcher `reid/vehicle_reid.py` is the Python reference baseline.
- AI copilot — rule-based, not an LLM.
- Alerts — decisions persist **in this browser only** (localStorage
  `nexus_alert_status_v1`), no backend alert store.

## Local video upload → ANPR

`anpr/VideoUploadModal` POSTs an mp4 to `POST /api/v1/videos/upload`; the
backend runs the R1+R2 pipeline (YOLO + ByteTrack + plate detection +
Fast-Plate-OCR) server-side and returns plate/det-conf/OCR-conf/real-world
IST timestamps. Idempotent replays are reported honestly. Limits: CPU caps
clips at ~1 min / 200 frames; the frontend times out after 5 min.

## Known limitations (MVP)

- No test suite, no ESLint config
- KPIs count fetched rows (max 200), not the response `total`
- Alert acknowledge/resolve is browser-local, not shared between viewers
- AI copilot is canned rules
