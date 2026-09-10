"""NEXUS R3 backend entry point.

Minimal Phase 0 app: boots FastAPI with a liveness endpoint so the
scaffold is verifiable before the database layer lands (Phase 2).
Full route mounting, CORS, and DB readiness wiring arrive in Phase 4.
"""

from fastapi import FastAPI

app = FastAPI(
    title="NEXUS R3 Backend",
    version="0.1.0",
    description=(
        "Observation ingestion, vehicle, camera, and journey APIs for the "
        "NEXUS multi-camera ANPR system. Serves R1/R2 (ingest), R4 "
        "(dashboard), R5 (analytics), and R6 (fusion)."
    ),
)


@app.get("/api/v1/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness probe — the process is up. DB readiness check lands in Phase 4 (`/api/v1/health/ready`)."""
    return {"status": "ok"}
