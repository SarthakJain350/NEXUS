# NEXUS R3 Backend

FastAPI + PostgreSQL backend for the NEXUS multi-camera ANPR system.
Receives vehicle observations from the R1/R2 pipelines, persists them,
and serves vehicles/cameras/journeys to the R4 dashboard, R5 analytics,
and R6 fusion.

**Status: Phases 0–6 complete.** 128+ tests green (schema, DB, services,
API, fixtures, load). Consumer docs: `docs/api_contract.md`,
`docs/database_schema.md`, `docs/integration.md` (repo root).

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
alembic upgrade head      # apply everything (single initial migration: 0001_initial)
alembic downgrade -1      # roll back (drops all tables) — verified clean both directions
alembic upgrade head      # ...and back up
```

Deployment always goes through Alembic; only the test suite uses
`metadata.create_all` against its throwaway `nexus_test` database.

## Tests

```bash
pytest -q                          # full suite, ~3s (load tests use fast defaults)
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
│   ├── models/        # SQLAlchemy ORM: cameras, vehicles, observations, plate_reads
│   ├── schemas/       # Pydantic contracts + all validation rules
│   ├── services/      # business logic: ingest, batch, queries, camera update
│   └── repositories/  # data access
├── alembic/           # migrations (0001_initial)
├── tests/             # schema / DB / service / API / fixture / load
└── fixtures/          # dummy_observations.json (Plan §12 edge cases)
```

Architecture rule: **route handlers stay thin — every business rule and
edge case lives in the service layer** (idempotency, camera auto-create,
provisional vehicles, monotonic last_seen_at, pagination clamps).

Spec: `NEXUS_R3_Backend_Database_Claude_Code_Plan_v2.md` (repo root).
Progress: `TODO.md` (repo root, untracked).
