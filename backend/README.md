# NEXUS R3 Backend

FastAPI + PostgreSQL backend for the NEXUS multi-camera ANPR system.
Receives vehicle observations from the R1/R2 pipelines, persists them,
and serves vehicles/cameras/journeys to the R4 dashboard, R5 analytics,
and R6 fusion.

**Status: Phases 0–9 complete + R1/R2 contract integration (2026-09-12).**
135+ tests green (schema, DB, services, API, fixtures, load, R1/R2
integration). Consumer docs: `docs/api_contract.md`,
`docs/database_schema.md`, `docs/integration.md` (repo root).

## R1/R2 integration (2026-09-12)

- The **frozen NEXUSVehicle contract posts as-is**: `vehicle_class`,
  `plate_text`, `raw_ocr_text` are accepted as aliases of `vehicle_type`,
  `plate_number`, `raw_plate_text`; `frame_id`, `vehicle_bbox`,
  `trajectory`, `plate_bbox`, `plate_confidence`, `ocr_confidence`,
  `detection_confidence`, `ocr_engine`, `vehicle_crop_reference` are stored
  (`vehicle_crop` binary is ignored — crops never enter PostgreSQL).
- **Confidences are strictly [0,1]** at the API boundary. R2's `r2_anpr`
  0–100 heuristic score must be converted with the adapter:
  ```python
  from app.integration import from_r1_r2, normalize_r2_confidence
  payload = from_r1_r2(r1_dict, r2_dict)   # camera_id+track_id association,
                                           # sentinel/junk filtering, rescaling
  payload["ingest_id"] = "cam01-t17-f12345"
  ```
- **Coordinates are optional**: payload → camera row → null (decision C7).
- Every plate-bearing ingest writes a **`plate_reads` trail row** (raw OCR
  text, separate OCR/detection confidences, plate bbox, engine tag), served
  by `GET /observations/{id}/plate-reads`.

Full mapping table and the R1/R2 reality check: `docs/integration.md`.

## Quick start

```bash
# 1. Backend virtual environment (never mix with the CV app's env)
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 2. PostgreSQL 16 via Docker (needs Docker Desktop running)
copy .env.example .env          # then edit if your ports/creds differ
docker compose up -d            # wait for "healthy"

# 3. Migrations
alembic upgrade head

# 4. API
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

First-time setup notes:

- `.env` needs a `DATABASE_URL` (see `.env.example`) — the app **fails fast
  and loud at startup** if it's missing or malformed.
- `ALLOWED_ORIGINS` (comma-separated) controls browser CORS; default allows
  `localhost:3000` (R4's Vite dev server) and `localhost:8501` (Streamlit).
- No auth for the MVP (D12).

## Migrations

```bash
alembic upgrade head      # apply everything (0001_initial + 0002_r1r2_contract_fields)
alembic downgrade -1      # roll back 0002 (drops the R1/R2 contract columns)
alembic upgrade head      # ...and back up
```

`0002` is additive only (new columns + nullable coordinates) — existing
migrations are never modified. Deployment always goes through Alembic; only
the test suite uses `metadata.create_all` against its throwaway `nexus_test`
database.

## Tests

```bash
pytest -q                          # full suite (~15s with load tests' fast defaults)
pytest tests\test_r1r2_integration.py -v   # the R1/R2 contract suite
pytest tests\test_api.py -v        # one module
```

The suite needs the Postgres container up (it creates/drops a `nexus_test`
database on the same server; your real `nexus` database is never touched).

Load/stress tests (`tests/test_load.py`) run a real uvicorn server on an
ephemeral port and use env tunables for scale:

```bash
NEXUS_LOAD_CONCURRENCY=200 NEXUS_LOAD_SOAK_SECONDS=180 pytest tests/test_load.py -v -s
```

Recorded numbers live in `docs/integration.md` (§14.3).

## Layout

```
backend/
├── app/
│   ├── main.py        # FastAPI app: CORS, routers, error handlers
│   ├── config.py      # pydantic-settings, fail-fast DATABASE_URL
│   ├── api/           # routers (thin) + uniform error envelope
│   ├── database/      # engine/session (explicit pool settings)
│   ├── integration/   # R1/R2 adapter: field mapping, confidence rescaling,
│   │                  #   sentinel/junk filtering, camera_id+track_id association
│   ├── models/        # SQLAlchemy ORM: cameras, vehicles, observations, plate_reads
│   ├── schemas/       # Pydantic contracts + all validation rules (+ frozen-contract aliases)
│   ├── services/      # business logic: ingest, batch, queries, camera update
│   └── repositories/  # data access (+ plate-read trail writes)
├── alembic/           # migrations (0001_initial, 0002_r1r2_contract_fields)
├── tests/             # schema / DB / service / API / fixture / load / R1R2 integration
└── fixtures/          # dummy_observations.json (Plan §12 edge cases)
```

Architecture rule: **route handlers stay thin — every business rule and
edge case lives in the service layer** (idempotency, camera auto-create,
provisional vehicles, monotonic last_seen_at, pagination clamps), and every
producer-specific quirk lives in `app/integration/` — never in routes.

Spec: `NEXUS_R3_Backend_Database_Claude_Code_Plan_v2.md` (repo root).
Progress: `TODO.md` (repo root, untracked).
