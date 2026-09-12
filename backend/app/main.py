"""NEXUS R3 backend entry point (Plan §7, §8, §20, TODO 4.9).

Liveness + DB readiness probes, all /api/v1 routers, CORS from
ALLOWED_ORIGINS, and the uniform JSON error envelope. No auth for the
MVP demo (D12) — CORS restrictions only.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_error_handlers
from app.api.routers import cameras, health, observations, vehicles, videos
from app.config import get_settings

app = FastAPI(
    title="NEXUS R3 Backend",
    version="0.2.0",
    description=(
        "Observation ingestion, vehicle, camera, and journey APIs for the "
        "NEXUS multi-camera ANPR system. Serves R1/R2 (ingest), R4 "
        "(dashboard), R5 (analytics), and R6 (fusion).\n\n"
        "**Timestamps:** ISO 8601. Naive values are assumed camera-local "
        "IST and stored as UTC.\n"
        "**Idempotency:** send an `ingest_id` on every observation — "
        "replays return the existing record (200), never an error."
    ),
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(health.router)
app.include_router(observations.router)
app.include_router(cameras.router)
app.include_router(vehicles.router)
app.include_router(videos.router)
