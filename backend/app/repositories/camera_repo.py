"""Camera data access (Plan §4, §6.3)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Camera


def get_by_camera_id(db: Session, camera_id: str) -> Camera | None:
    return db.scalar(select(Camera).where(Camera.camera_id == camera_id))


def create_unregistered(db: Session, camera_id: str) -> Camera:
    """Auto-create a minimal camera row (§6.3) — deliberate leniency so a
    new field camera doesn't lose data while awaiting registration."""
    camera = Camera(camera_id=camera_id, status="unregistered")
    db.add(camera)
    db.flush()
    return camera


def touch_last_seen(db: Session, camera: Camera, timestamp) -> None:
    """Every observation updates last_seen_at (§6.4 TODO 3.1.4) — but
    monotonically: a replayed or out-of-order older observation (§6.2/§6.5)
    must not move it backwards."""
    if camera.last_seen_at is None or timestamp > camera.last_seen_at:
        camera.last_seen_at = timestamp


def list_cameras(
    db: Session,
    *,
    status: str | None = None,
    limit: int,
    offset: int,
) -> tuple[list[Camera], int]:
    query = select(Camera)
    if status is not None:
        query = query.where(Camera.status == status)
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    )
    items = list(
        db.scalars(
            query.order_by(Camera.camera_id).limit(limit).offset(offset)
        )
    )
    return items, total


def update(db: Session, camera: Camera, **fields: object) -> Camera:
    for key, value in fields.items():
        setattr(camera, key, value)
    db.flush()
    return camera
