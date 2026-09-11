"""Read-side queries — pagination, filters, §6.5/§6.8 behavior (TODO 3.3).

Empty results are normal (empty page, not 404); 404 is reserved for a
referenced entity that doesn't exist.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.repositories import camera_repo, observation_repo, vehicle_repo
from app.schemas.camera import CameraRead
from app.schemas.common import (
    CAMERA_STATUSES,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    Page,
)
from app.schemas.observation import (
    JourneyPoint,
    ObservationRead,
    normalize_plate,
)
from app.schemas.vehicle import VehicleRead
from app.services.exceptions import NotFoundError


def _page_bounds(
    page: int, page_size: int
) -> tuple[int, int, int]:
    """Clamp, don't error (§6.8): page_size hard-capped at MAX_PAGE_SIZE."""
    page = max(1, page)
    page_size = min(max(1, page_size), MAX_PAGE_SIZE)
    offset = (page - 1) * page_size
    return page, page_size, offset


# --- observations -----------------------------------------------------------


def list_observations(
    db: Session,
    *,
    camera_id: str | None = None,
    plate_number: str | None = None,
    vehicle_type: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Page[ObservationRead]:
    normalized_plate = (
        normalize_plate(plate_number) if plate_number else None  # may raise ValueError → 422 upstream
    )
    normalized_type = vehicle_type.strip().lower() if vehicle_type else None
    page, page_size, offset = _page_bounds(page, page_size)
    items, total = observation_repo.list_observations(
        db,
        camera_id=camera_id,
        plate_number=normalized_plate,
        vehicle_type=normalized_type,
        start=start,
        end=end,
        limit=page_size,
        offset=offset,
    )
    return Page[ObservationRead](
        items=[ObservationRead.model_validate(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_observation(db: Session, observation_id: int) -> ObservationRead:
    observation = observation_repo.get_by_id(db, observation_id)
    if observation is None:
        raise NotFoundError(f"observation {observation_id} not found")
    return ObservationRead.model_validate(observation)


def camera_observations(
    db: Session,
    camera_id: str,
    *,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Page[ObservationRead]:
    if camera_repo.get_by_camera_id(db, camera_id) is None:
        raise NotFoundError(f"camera {camera_id!r} not found")
    page, page_size, offset = _page_bounds(page, page_size)
    items, total = observation_repo.for_camera(
        db, camera_id, limit=page_size, offset=offset
    )
    return Page[ObservationRead](
        items=[ObservationRead.model_validate(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# --- vehicles ---------------------------------------------------------------


def list_vehicles(
    db: Session,
    *,
    plate_number: str | None = None,
    global_vehicle_id: str | None = None,
    vehicle_type: str | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Page[VehicleRead]:
    normalized_plate = (
        normalize_plate(plate_number) if plate_number else None
    )
    normalized_type = vehicle_type.strip().lower() if vehicle_type else None
    page, page_size, offset = _page_bounds(page, page_size)
    items, total = vehicle_repo.list_vehicles(
        db,
        plate_number=normalized_plate,
        global_vehicle_id=global_vehicle_id,
        vehicle_type=normalized_type,
        limit=page_size,
        offset=offset,
    )
    counts = vehicle_repo.observation_counts(db, [v.id for v in items])
    reads = []
    for v in items:
        read = VehicleRead.model_validate(v)
        read.observation_count = counts.get(v.id, 0)
        reads.append(read)
    return Page[VehicleRead](
        items=reads,
        total=total,
        page=page,
        page_size=page_size,
    )


def get_vehicle(db: Session, vehicle_id: int) -> VehicleRead:
    vehicle = vehicle_repo.get_by_id(db, vehicle_id)
    if vehicle is None:
        raise NotFoundError(f"vehicle {vehicle_id} not found")
    counts = vehicle_repo.observation_counts(db, [vehicle.id])
    read = VehicleRead.model_validate(vehicle)
    read.observation_count = counts.get(vehicle.id, 0)
    return read


def vehicle_journey(
    db: Session,
    vehicle_id: int,
    *,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Page[JourneyPoint]:
    """Sorted by timestamp at query time (§6.5); unknown vehicle is a 404,
    known-but-silent vehicle is a valid empty page (§6.8)."""
    if vehicle_repo.get_by_id(db, vehicle_id) is None:
        raise NotFoundError(f"vehicle {vehicle_id} not found")
    page, page_size, offset = _page_bounds(page, page_size)
    items, total = observation_repo.journey_for_vehicle(
        db, vehicle_id, limit=page_size, offset=offset
    )
    # JourneyPoint's key field is `observation_id`; the ORM attribute is
    # `id` — mapped explicitly (from_attributes can't rename fields).
    return Page[JourneyPoint](
        items=[
            JourneyPoint(
                observation_id=o.id,
                camera_id=o.camera_id,
                track_id=o.track_id,
                plate_number=o.plate_number,
                timestamp=o.timestamp,
                vehicle_type=o.vehicle_type,
                confidence=o.confidence,
                latitude=o.latitude,
                longitude=o.longitude,
            )
            for o in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# --- cameras ----------------------------------------------------------------


def list_cameras(
    db: Session,
    *,
    status: str | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Page[CameraRead]:
    if status is not None and status not in CAMERA_STATUSES:
        # Bad input, not a missing entity (§6.8) — Phase 4 maps to 422.
        raise ValueError(
            f"status must be one of {', '.join(CAMERA_STATUSES)} (got {status!r})"
        )
    page, page_size, offset = _page_bounds(page, page_size)
    items, total = camera_repo.list_cameras(
        db, status=status, limit=page_size, offset=offset
    )
    return Page[CameraRead](
        items=[CameraRead.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_camera(db: Session, camera_id: str) -> CameraRead:
    camera = camera_repo.get_by_camera_id(db, camera_id)
    if camera is None:
        raise NotFoundError(f"camera {camera_id!r} not found")
    return CameraRead.model_validate(camera)
