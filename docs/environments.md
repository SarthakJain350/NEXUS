# NEXUS — Environments & Reproducibility

Three runtimes, never mixed. This is the exact documented setup (P2 #14).

| Env | Python | Where | Deps file | Purpose |
|---|---|---|---|---|
| **CV env** (root) | 3.9+, demo machine uses anaconda `C:\Users\Sarthak\anaconda3\python.exe` (see `test.bat`) | repo root | `requirements.txt` | YOLO, ByteTrack, Fast-Plate-OCR, OpenCV, torch — everything that touches models/GPU |
| **Backend env** | 3.11 | `backend/.venv` | `backend/requirements.txt` | FastAPI + SQLAlchemy + Alembic + pytest. **No CV deps** — torch/onnxruntime pins in the root file conflict (Plan §0). The video-upload endpoint spawns the CV env as a subprocess via `CV_PYTHON` |
| **Node** | Node 18+ | `frontend/node_modules` | `frontend/package.json` | React/Vite dashboard |

## Boot order (full demo)

```
1. docker compose up -d          (in backend/ — Postgres 16 container)
2. alembic upgrade head           (backend/.venv)
3. uvicorn app.main:app --reload  (backend/.venv)
4. npm run dev                    (frontend/)
5. python seed_data.py            (backend/.venv, idempotent)
6. python scripts/run_video_live_ingest.py ...   (CV env, for live ingest)
```

## Environment variables

| Var | Where | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | yes | copy from `backend/.env.example`; Postgres 16 via docker compose |
| `CV_PYTHON` | backend `.env` | no | path to the CV-env python for the video-upload subprocess; defaults to `python` |
| `OPENROUTER_API_KEY` | root `.env` | no | enables the GPT-4o-mini OCR fallback in `app.py`; absent = Fast-Plate-OCR only |
| `VITE_MAP_TILES_URL` | `frontend/.env` | no | Tactical GIS tile URL template; default = keyless CARTO Dark Matter; `{apikey}` placeholder supported |
| `VITE_MAP_API_KEY` | `frontend/.env` | no | map tile key, used only when the URL contains `{apikey}`; empty for CARTO/OSM. Compiled into the browser bundle — browser key with domain restrictions |
| `VITE_MAP_TILES_ATTRIBUTION` / `VITE_MAP_MAX_ZOOM` | `frontend/.env` | no | attribution HTML override / max zoom (default 19) |

`.env` files are gitignored; `.env.example` is committed.

## Fresh-clone checklist

```bash
git lfs install && git clone https://github.com/SarthakJain350/NEXUS.git
# 1. CV env
pip install -r requirements.txt
# 2. Backend
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt && copy .env.example .env
# 3. Frontend
cd ../frontend && npm install
# 4. Model weights (LFS)
git lfs pull
# 5. Verify the stack
test.bat                     # CV models load+infer (uses anaconda python)
cd backend && pytest -q      # needs Postgres container up; never run while uvicorn is live
cd ../frontend && npm run build
```

## Known reproducibility gaps (honest)

- No conda `env.yml` / lockfile for the CV env — the demo machine's
  anaconda env is the source of truth; `requirements.txt` is the
  reconstruction recipe (unpinned floors).
- Backend/frontend use unpinned floors too (backend is pytest-tested per
  install; frontend is build-checked).
- GPU optional: everything runs on CPU (slow — ~2 FPS live ingest, clips
  capped at ~1 min / 200 frames); CUDA is auto-detected by ultralytics.
