---
title: NEXUS ANPR
emoji: 🚗
colorFrom: blue
colorTo: green
sdk: streamlit
sdk_version: 1.32.0
app_file: app.py
pinned: false
license: mit
---

<div align="center">

# 🚗 NEXUS — City-Wide AI Engine for Multi-Camera ANPR

**Vehicle Detection · Trajectory Tracking · Automatic Number Plate Recognition · Urban Traffic Analytics**

Smart India Hackathon 2026 · Problem Statement **SIH26127**

[![Streamlit](https://img.shields.io/badge/Streamlit_Demo-FF4B4B?logo=streamlit&logoColor=white)](https://streamlit.io)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL_16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![YOLOv11](https://img.shields.io/badge/Ultralytics-YOLOv11-blue)](https://docs.ultralytics.com)
[![React](https://img.shields.io/badge/Frontend-React_+_Leaflet-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Hugging Face](https://img.shields.io/badge/🤗_HuggingFace-Space-yellow)](https://huggingface.co/spaces/Sarthak403/NEXUS)

</div>

> **⚠️ Project status: SIH MVP / prototype.** This is a hackathon prototype
> demonstrating the full architecture end-to-end on development-scale data —
> not a production traffic-surveillance system.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Module Ownership](#-module-ownership)
- [The ANPR Engine (Detection + OCR Core)](#-the-anpr-engine-detection--ocr-core)
- [Model Performance](#-model-performance)
- [Datasets](#-datasets)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [R1/R2 → R3 Data Contract](#-r1r2--r3-data-contract)
- [API & Database](#-api--database)
- [Testing](#-testing)
- [Demo Flow](#-demo-flow)
- [Deployment](#-deployment)
- [Current Status & Limitations](#-current-status--limitations)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

**NEXUS** is a city-wide AI engine that turns ordinary CCTV feeds into a
queryable traffic record: it detects and tracks vehicles across cameras
(R1), reads their number plates (R2), persists every observation with its
plate trail in PostgreSQL (R3), computes traffic analytics and raises alerts
(R5), and visualizes cameras, vehicles and journeys on a GIS dashboard (R4).
Cross-camera fusion into global vehicle identities (R6) is integrated at the
API-contract level; its implementation is intentionally out of scope here.

The detection/OCR core is a two-stage pipeline — vehicle detection (COCO
YOLOv11n), then plate detection inside each vehicle crop (custom fine-tuned
YOLOv11n, **99.49% mAP@50** with only 2.6M parameters) — followed by
Fast-Plate-OCR with an optional GPT-4o-mini fallback.

---

## 🏗️ Architecture

```
            CCTV feeds (Indian traffic video)
                        │
                        ▼
        ┌───────────────────────────────┐
        │  R1 — Vehicle Detection +     │  YOLO vehicle detect + ByteTrack
        │  Per-Camera Tracking          │  → persistent per-camera track_id
        └───────────────┬───────────────┘
                        │  vehicle crop + track
                        ▼
        ┌───────────────────────────────┐
        │  R2 — ANPR / OCR              │  plate detection + OCR
        │  (r2_anpr/ + engine core)     │  → plate text + confidence
        └───────────────┬───────────────┘
                        │  combined NEXUS observation (JSON)
                        ▼
        ┌───────────────────────────────┐
        │  R3 — Backend + PostgreSQL    │  FastAPI ingest (idempotent),
        │  (backend/)                   │  observations/vehicles/cameras,
        │                               │  plate_reads OCR trail
        └───────────────┬───────────────┘
                        │  REST API
          ┌─────────────┴─────────────┐
          ▼                           ▼
┌───────────────────┐       ┌───────────────────┐
│  R5 — Re-ID +     │       │  R4 — Frontend +  │
│  Analytics/Alerts │       │  GIS Dashboard    │
│  (reid/,analytics)│       │  (frontend/,React)│
└─────────┬─────────┘       └───────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│  R6 — Cross-Camera Fusion                        │
│  (integration contract only — PATCH             │
│   /observations/{id}/vehicle; implementation     │
│   not part of this repository's scope)           │
└─────────────────────────────────────────────────┘
```

The frozen inter-module vehicle-observation contract (camera_id, frame_id,
timestamp, track_id, vehicle_class, vehicle_bbox, trajectory, plate_bbox,
plate_text, plate_confidence, ...) lets all six modules work independently;
see [R1/R2 → R3 Data Contract](#-r1r2--r3-data-contract) and
`docs/integration.md`.

---

## 👥 Module Ownership

| Module | Owner | Code | Status |
|---|---|---|---|
| **R1** — vehicle detection + per-camera tracking | R1 (HARSHIT) | root pipeline (`app.py` detection stage) | ⚠️ detection works; ByteTrack tracking output not delivered yet |
| **R2** — ANPR + OCR | R2 (khushi) | `r2_anpr/` + engine core in `app.py` | ✅ plate detection + OCR (known bug: `anpr_pipeline.py` broken import) |
| **R3** — backend + PostgreSQL | R3 (Sarthak) | `backend/` | ✅ shipped: ingest, idempotency, journeys, plate_reads trail, R1/R2 contract integration |
| **R4** — frontend + GIS dashboard | R4 (Rushil) | `frontend/` (React + Vite + Leaflet) | ✅ dashboard live against the backend API |
| **R5** — Re-ID + analytics + alerts | R5 (Harshit) | `reid/`, `analytics/` | ✅ analytics, alerts, offline demo |
| **R6** — cross-camera fusion | R6 | — (API contract only) | ⛔ intentionally out of scope; provisional integration point in R3 |

---

## 🧠 The ANPR Engine (Detection + OCR Core)

```
Input Image / Video Frame
        │
        ▼
┌─────────────────────────┐
│   Vehicle Detector      │  YOLOv11n (COCO pre-trained)
│   conf ≥ 0.30           │  Classes: car, motorcycle, bus, truck
└──────────┬──────────────┘
           │  vehicle crops (ROIs)
           ▼
┌─────────────────────────┐
│   Plate Detector        │  Custom fine-tuned YOLOv11n
│   conf ≥ 0.40           │  (ONNX or PyTorch selectable)
└──────────┬──────────────┘
           │  plate bounding boxes
           ▼
┌─────────────────────────┐
│   Preprocessing         │  Crop + Padding (±15px)
│   + CLAHE (optional)    │  Bilateral filter denoising
│   + 4× Lanczos Upscale  │  Enhances small plate readability
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│   OCR Engine            │  Fast-Plate-OCR  (~5ms, default)
│                         │  GPT-4o-mini     (fallback via API)
└─────────────────────────┘
```

- **Why two-stage?** Fewer false positives (shop signs, road boards), focused
  ROIs improve plate accuracy, and ~60–80% less effective detection area.
- **Fallback:** if no vehicle is detected, the plate detector runs on the
  full frame (and at 90° rotation for submissions).
- `r2_anpr/` wraps the OCR stage (preprocess → pytesseract OCR → plate
  cleaning → heuristic confidence + readability status); its output feeds the
  R3 adapter (`backend/app/integration/r1r2.py`).

The interactive **Streamlit demo** (`app.py`) runs this engine on uploaded
images/videos with live metrics — deployed on
[Hugging Face Spaces](https://huggingface.co/spaces/Sarthak403/NEXUS).

---

## 📊 Model Performance

### Detection Metrics (Plate Detector — Epoch 20)

| Metric | Value |
|--------|-------|
| **mAP@50** | **99.49%** |
| **mAP@50-95** | **72.91%** |
| **Precision** | **99.90%** |
| **Recall** | **99.45%** |
| **F1 Score** | **99.67%** |

| Model | Params | mAP@50 | mAP@50-95 |
|-------|--------|--------|-----------|
| YOLOv8n COCO general | — | ~37% | ~18% |
| Typical LP detector (academic) | — | 92–96% | 55–65% |
| YOLOv8m fine-tuned LP | 25M | ~97% | ~68% |
| **NEXUS plate detector (ours)** | **2.6M** | **99.49%** | **72.91%** |

Model specs: YOLOv11n (anchor-free, single-class), ~2.6M params, 5.3 MB (PT) /
10.5 MB (ONNX), 480×480 input, ~8 ms (PT) / ~6 ms (ONNX) on RTX 4060.
Training details, augmentation pipeline and the full technical report:
[`explain.md`](explain.md), [`notebooks/train.ipynb`](notebooks/train.ipynb),
[`configs/nexus.yaml`](configs/nexus.yaml).

---

## 🗃️ Datasets

Two datasets with distinct roles (the team uses small development subsets —
the full driving dataset is ~210 GB and is **not** required to run anything
in this repo; nothing here depends on one developer's local paths):

1. **Indian Road Driving Dataset** (Delhi NCR; ~8,441 clips / 646k annotated
   frames / 6.9M detections; BDD100K-style; day/night/dusk/rain; car, truck,
   bus, motorcycle, autorickshaw; GPS-tagged frames) —
   R1 vehicle detection, tracking, trajectory/context, demo data.
   *Not* a source of plate-text labels.
2. **Indian Vehicle License Plate Dataset** (~1,500 images; state-wise and
   highway samples; XML annotations with plate boxes + text) —
   R2 plate detection and OCR training/testing.

---

## 📁 Project Structure

```
NEXUS/
├── app.py                      # 🎯 Streamlit ANPR demo (detection/OCR engine, HF Space)
├── create_submission.py        # 📦 Competition submission generator
├── visualize_predictions.py    # 📊 Prediction visualizer
│
├── r2_anpr/                    # 🔤 R2 — ANPR/OCR module (preprocess, OCR, plate cleaning, confidence)
├── reid/                       # 🔁 R5 — vehicle Re-ID (feature extraction, similarity)
├── analytics/                  # 📈 R5 — traffic analyzer, anomaly detector, alerts
│
├── backend/                    # 🛠️ R3 — FastAPI + PostgreSQL backend
│   ├── app/
│   │   ├── integration/        #   R1/R2 adapter (field mapping, confidence rescaling)
│   │   ├── api/  schemas/  services/  repositories/  models/  database/
│   ├── alembic/                #   migrations (0001_initial, 0002_r1r2_contract_fields)
│   ├── tests/                  #   160+ tests incl. load/stress + R1/R2 integration
│   └── fixtures/               #   edge-case fixtures
│
├── frontend/                   # 🗺️ R4 — React + Vite + Leaflet GIS command center
│   └── src/ (components, services/api.js)
│
├── models/                     # 🧠 Weights (Git LFS): best.pt/.onnx (plate), yolo11n.pt (vehicle)
├── configs/  notebooks/  scripts/  runs/
├── src/                        # 🧩 Training-time modules (object detection, LPR, segmentation)
├── tests/                      # CV-side tests
├── docs/                       # api_contract.md, database_schema.md, integration.md, R5 docs
├── requirements.txt            # CV/Streamlit deps (backend has its own)
└── LICENSE                     # MIT
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9+ (root CV app) and Python 3.11+ (backend)
- Docker Desktop (PostgreSQL 16 via `backend/docker-compose.yml`)
- Git LFS (model weights are LFS-tracked)
- Node 18+ (frontend only)

### 1. ANPR Streamlit demo (root environment)

```bash
git lfs install
git clone https://github.com/SarthakJain350/NEXUS.git && cd NEXUS
python -m venv venv && venv\Scripts\activate     # or conda
pip install -r requirements.txt
streamlit run app.py                             # http://localhost:8501
```

Optional `.env` with `OPENROUTER_API_KEY=...` enables the GPT-4o-mini OCR
fallback. The app works fully without it.

### 2. Backend (R3 — its own venv, never mixed with the CV env)

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env                           # DATABASE_URL etc.
docker compose up -d                             # Postgres 16, wait for "healthy"
alembic upgrade head
uvicorn app.main:app --reload                    # http://localhost:8000/docs
```

### 3. Frontend (R4)

```bash
cd frontend
npm install
npm run dev                                      # http://localhost:3000 (proxies /api → :8000)
```

Full backend details: [`backend/README.md`](backend/README.md).

---

## 🔗 R1/R2 → R3 Data Contract

The frozen NEXUS vehicle-observation contract:

```
camera_id · frame_id · timestamp · track_id · vehicle_class
vehicle_bbox [x1,y1,x2,y2] · vehicle_crop · trajectory
plate_bbox · plate_text · plate_confidence
```

R3 accepts this **as-is** over `POST /api/v1/observations`:
`vehicle_class`/`plate_text`/`raw_ocr_text` are input aliases;
`frame_id`, `vehicle_bbox`, `trajectory`, `plate_bbox`, the separate
confidences and `vehicle_crop_reference` are stored; `vehicle_crop` binary
is ignored (crops never enter PostgreSQL). Separate R1/R2 objects are
combined with the adapter:

```python
from app.integration import from_r1_r2
payload = from_r1_r2(r1_dict, r2_dict)   # associates on camera_id + track_id,
                                         # rescales R2's 0–100 heuristic confidence,
                                         # drops UNREADABLE/ERR sentinels
payload["ingest_id"] = "cam01-t17-f12345"
```

Field-by-field mapping, decisions and the R1/R2 status: `docs/integration.md`.

---

## 🛠️ API & Database

- **Base URL:** `http://localhost:8000/api/v1` · interactive docs at `/docs` · no auth (MVP), CORS-restricted
- **Ingest:** `POST /observations` (idempotent via `ingest_id` — replays return 200, never 409), `POST /observations/batch` (per-item results)
- **Reads:** observations (filters + pagination, page_size ≤ 200), cameras (auto-created as `unregistered`, monotonic `last_seen_at`), vehicles + timestamp-sorted journeys, `GET /observations/{id}/plate-reads` (raw OCR trail)
- **R6 integration point (provisional):** `PATCH /observations/{id}/vehicle` with `{global_vehicle_id}`
- **Database:** PostgreSQL 16, SQLAlchemy 2.x, Alembic (`0001_initial` + `0002_r1r2_contract_fields`, additive); naive timestamps assumed IST, stored UTC; plates normalized (uppercase, separators stripped, 4–12 alphanumeric, no rigid regex); JSONB for bboxes/trajectory

Full contract: `docs/api_contract.md` · schema rationale: `docs/database_schema.md`.

---

## ✅ Testing

```bash
# Backend (needs the Postgres container up; uses a throwaway nexus_test DB)
cd backend && pytest -q

# CV-side model/pipeline checks
python test.bat          # or: .\test.bat  (PowerShell)
```

The backend suite covers schema validation, DB constraints, service edge
cases (idempotency races, camera auto-create, monotonic last_seen_at),
every endpoint over HTTP, fixture round-trips, load/stress (200 concurrent
POSTs, duplicate-ingest_id race ×50, journey latency, fuzzing, soak) and the
R1/R2 contract integration (frozen-contract payloads, adapter, plate trail,
coordinate fallback, backward compatibility). Recorded numbers:
`docs/integration.md`.

---

## 🎬 Demo Flow

1. **Start the stack:** Postgres (`docker compose up -d` in `backend/`) →
   `alembic upgrade head` → `uvicorn app.main:app --reload` →
   `npm run dev` in `frontend/`.
2. **Register cameras:** `PATCH /api/v1/cameras/CAM_01` with name/GPS/status.
3. **Ingest observations:** run the detection/OCR engine (or the dashboard's
   ingest simulator) and POST the combined NEXUS payload via the adapter —
   or use `backend/fixtures/dummy_observations.json`.
4. **Watch the dashboard:** cameras appear with live status; search vehicles
   by plate; open a vehicle's journey on the GIS map.
5. **Analytics/alerts (R5):** `python scripts/run_r5_demo.py` for the
   offline Re-ID/analytics/alerts demo on synthetic crops.

---

## 🚀 Deployment

The Streamlit demo deploys to Hugging Face Spaces (front-matter in this file
is the Space config; `packages.txt` + `requirements.txt` are already set up;
set `OPENROUTER_API_KEY` as a Space secret for the OCR fallback):

```bash
git remote add hf https://huggingface.co/spaces/Sarthak403/NEXUS   # once
git push hf main
```

The backend targets any Docker host (Postgres 16 + uvicorn); the frontend
builds with `npm run build`. This is a prototype — no production deployment
is claimed.

---

## ⚠️ Current Status & Limitations

Honest state as of 2026-09-12 (SIH MVP/prototype):

- **R1 tracking is not delivered yet** — no ByteTrack/track_id producer is in
  the repo; the backend speaks the frozen contract and provides the adapter
  so R1 can drop in. The detection/OCR engine itself works (Streamlit demo,
  99.49% mAP@50 plate detector).
- **R6 cross-camera fusion is not implemented** — only the provisional API
  integration point exists (by design, out of scope).
- Known R2 bug: `r2_anpr/anpr_pipeline.py` imports `clean_plate` but the
  module defines `clean_plate_text` (flagged to R2's owner).
- Analytics run on development-scale data; no production-scale or
  multi-city claims.
- OCR quality depends on plate visibility; the heuristic R2 confidence score
  is rescaled to [0,1] by the adapter and kept separate from OCR/detection
  confidences in the `plate_reads` trail.

---

## 🗺️ Roadmap

| Feature | Status | Details |
|---------|--------|---------|
| Two-stage detection + dual OCR | ✅ Done | ONNX selectable, GPT-4o fallback |
| Video inference + night vision | ✅ Done | Configurable sample rate, CLAHE |
| PostgreSQL backend + observations API | ✅ Done | FastAPI, idempotent ingest, journeys, migrations |
| GIS dashboard | ✅ Done | React + Leaflet against the live API |
| Re-ID, analytics, alerts | ✅ Done | `reid/`, `analytics/`, offline demo |
| R1 ByteTrack tracking output → backend | 🔲 In progress | Contract + adapter ready; R1 delivery pending |
| Cross-camera fusion (R6) | 🔲 Out of scope | API contract preserved |
| Live webcam stream | 🔲 Planned | `cv2.VideoCapture(0)` |
| TensorRT FP16 / OpenVINO INT8 | 🔲 Planned | Edge acceleration |

---

## 🤝 Contributing

Team NEXUS works via feature branches → PRs to `main`. Module ownership
above is respected — coordinate before touching another module's code.
Backend dependencies stay in `backend/requirements.txt` (never the root
file); `.env` and secrets are never committed; large weights go through
Git LFS.

---

## 📄 License

[MIT](LICENSE) — Team NEXUS, Smart India Hackathon 2026.
