"""Health endpoints (Plan §7, TODO 4.1).

`/health` is liveness (process up, no DB), `/health/ready` is readiness
(the DB actually answers) — so container orchestration and R4 can tell a
crashed backend from a dead database apart.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get("")
def health() -> dict[str, str]:
    """Liveness probe — the process is up and serving."""
    return {"status": "ok"}


@router.get("/ready")
def health_ready(db: Session = Depends(get_db)) -> dict[str, str]:
    """Readiness probe — liveness plus a real round-trip to Postgres."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
