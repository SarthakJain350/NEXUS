# NEXUS R3 Backend

FastAPI + PostgreSQL backend for the NEXUS multi-camera ANPR system.
Receives vehicle observations from the R1/R2 pipelines, persists them,
and serves vehicles/cameras/journeys to the R4 dashboard, R5 analytics,
and R6 fusion.

**Status: Phase 0 (scaffold).** Full setup docs land in Phase 7.

## Quick start (once Docker Desktop is installed)

```bash
# 1. Backend virtual environment (never mix with the CV app's env)
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 2. PostgreSQL
copy .env.example .env
docker compose up -d            # wait for "healthy"

# 3. Migrations (Phase 2)
alembic upgrade head

# 4. API
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

## Layout

```
backend/
├── app/
│   ├── main.py        # FastAPI app
│   ├── config.py      # settings (Phase 2)
│   ├── api/           # route handlers (Phase 4)
│   ├── database/      # engine/session (Phase 2)
│   ├── models/        # SQLAlchemy ORM (Phase 2)
│   ├── schemas/       # Pydantic contracts (Phase 1)
│   ├── services/      # business logic + §6 edge cases (Phase 3)
│   └── repositories/  # data access (Phase 3)
├── alembic/           # migrations (Phase 2)
├── tests/             # schema/DB/API/load tests (Phases 1, 2, 4, 6)
└── fixtures/          # dummy observations (Phase 5)
```

Spec: `NEXUS_R3_Backend_Database_Claude_Code_Plan_v2.md` (repo root).
