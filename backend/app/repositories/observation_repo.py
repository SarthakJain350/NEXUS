"""Observation data access (Plan §4, §6.5, §6.8)."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Observation
from app.schemas.observation import ObservationCreate


def create(
    db: Session, payload: ObservationCreate, vehicle_id: int | None
) -> Observation:
    observation = Observation(
        vehicle_id=vehicle_id,
        camera_id=payload.camera_id,
        track_id=payload.track_id,
        plate_number=payload.plate_number,
        timestamp=payload.timestamp,
        vehicle_type=payload.vehicle_type,
        confidence=payload.confidence,
        latitude=payload.latitude,
        longitude=payload.longitude,
        ingest_id=payload.ingest_id,
    )
    db.add(observation)
    db.flush()
    return observation


def get_by_id(db: Session, observation_id: int) -> Observation | None:
    return db.get(Observation, observation_id)


def get_by_ingest_id(db: Session, ingest_id: str) -> Observation | None:
    return db.scalar(
        select(Observation).where(Observation.ingest_id == ingest_id)
    )


def list_observations(
    db: Session,
    *,
    camera_id: str | None = None,
    plate_number: str | None = None,
    vehicle_type: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int,
    offset: int,
) -> tuple[list[Observation], int]:
    query = select(Observation)
    if camera_id is not None:
        query = query.where(Observation.camera_id == camera_id)
    if plate_number is not None:
        query = query.where(Observation.plate_number == plate_number)
    if vehicle_type is not None:
        query = query.where(Observation.vehicle_type == vehicle_type)
    if start is not None:
        query = query.where(Observation.timestamp >= start)
    if end is not None:
        query = query.where(Observation.timestamp <= end)
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    )
    items = list(
        db.scalars(
            query.order_by(Observation.timestamp.desc(), Observation.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def journey_for_vehicle(
    db: Session,
    vehicle_id: int,
    *,
    limit: int,
    offset: int,
) -> tuple[list[Observation], int]:
    """Journey points sorted by timestamp at query time (§6.5) — never
    insertion order. The (vehicle_id, timestamp) composite index serves this."""
    query = select(Observation).where(Observation.vehicle_id == vehicle_id)
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    )
    items = list(
        db.scalars(
            query.order_by(Observation.timestamp.asc())
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def for_camera(
    db: Session, camera_id: str, *, limit: int, offset: int
) -> tuple[list[Observation], int]:
    query = select(Observation).where(Observation.camera_id == camera_id)
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    )
    items = list(
        db.scalars(
            query.order_by(Observation.timestamp.desc(), Observation.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total
