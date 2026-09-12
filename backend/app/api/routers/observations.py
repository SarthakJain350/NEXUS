"""Observation endpoints — ingest (single + batch) and reads (Plan §7, §8, TODO 4.2–4.4, 4.7).

Route handlers stay thin: every §6 edge case lives in the service layer.
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.common import DEFAULT_PAGE_SIZE, Page
from app.schemas.observation import (
    IST,
    BatchIngestResult,
    ObservationCreate,
    ObservationRead,
)
from app.schemas.vehicle import VehicleUpdate
from app.services import batch_service, observation_service, query_service

router = APIRouter(prefix="/api/v1/observations", tags=["observations"])


def _as_utc(value: datetime | None) -> datetime | None:
    """Query filters follow the same D10 policy as ingest: naive = IST."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=IST)
    return value.astimezone(timezone.utc)


@router.post("", response_model=ObservationRead)
def create_observation(
    payload: ObservationCreate, db: Session = Depends(get_db)
) -> JSONResponse:
    """Ingest one observation.

    201 when a new record was stored; **200 when an `ingest_id` replay
    returned the existing record** — retries are always a success, never
    a 409 (§6.2). Unknown cameras are auto-created as `unregistered`
    (§6.3); a plate creates/links a provisional vehicle (§6.4).
    """
    result = observation_service.ingest(db, payload)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED if result.created else status.HTTP_200_OK,
        content=jsonable_encoder(ObservationRead.model_validate(result.observation)),
    )


@router.post("/batch", response_model=BatchIngestResult)
def create_observations_batch(
    items: list[dict[str, Any]] = Body(..., description="Observations; each item is validated independently (§6.7)."),
    db: Session = Depends(get_db),
) -> BatchIngestResult:
    """Ingest a batch with per-item results — one bad row never sinks the
    batch (§6.7). Each valid item follows the exact same path as the
    single POST, including idempotency."""
    return batch_service.ingest_batch(db, items)


@router.get("", response_model=Page[ObservationRead])
def list_observations(
    db: Session = Depends(get_db),
    camera_id: str | None = Query(None, max_length=64),
    plate_number: str | None = Query(None, max_length=32, description="Normalized on input, e.g. 'mh 12 ab 1234' matches MH12AB1234."),
    vehicle_type: str | None = Query(None, max_length=16),
    start: datetime | None = Query(None, description="Inclusive lower bound; naive values assumed IST (D10)."),
    end: datetime | None = Query(None, description="Inclusive upper bound; naive values assumed IST (D10)."),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, description="Clamped to 200 (§6.8)."),
):
    """List observations, newest first. Empty result is a valid `200` with
    an empty `items` list (§6.8)."""
    return query_service.list_observations(
        db,
        camera_id=camera_id,
        plate_number=plate_number,
        vehicle_type=vehicle_type,
        start=_as_utc(start),
        end=_as_utc(end),
        page=page,
        page_size=page_size,
    )


@router.get("/{observation_id}", response_model=ObservationRead)
def get_observation(observation_id: int, db: Session = Depends(get_db)):
    return query_service.get_observation(db, observation_id)


@router.patch("/{observation_id}/vehicle", response_model=ObservationRead)
def assign_vehicle(
    observation_id: int,
    payload: VehicleUpdate,
    db: Session = Depends(get_db),
):
    """R6 fusion integration point — **provisional body `{global_vehicle_id}`
    per D6** until R6 confirms the real fusion-output shape (Phase 8.3).

    Links the observation to the vehicle carrying this global identity,
    creating that vehicle if needed. A plain FK write, not a restructure
    (§6.4).
    """
    return ObservationRead.model_validate(
        observation_service.assign_vehicle(db, observation_id, payload)
    )
