"""Camera management — the PATCH /cameras/{camera_id} target (Plan §6.3).

Admins/R4 flesh out cameras auto-created as 'unregistered' by incoming
observations. Validation (bounds, allow-listed status) lives in
CameraUpdate; this service only resolves the row and writes.
"""

from sqlalchemy.orm import Session

from app.repositories import camera_repo
from app.schemas.camera import CameraRead, CameraUpdate
from app.services.exceptions import NotFoundError


def update_camera(
    db: Session, camera_id: str, payload: CameraUpdate
) -> CameraRead:
    camera = camera_repo.get_by_camera_id(db, camera_id)
    if camera is None:
        raise NotFoundError(f"camera {camera_id!r} not found")
    camera_repo.update(db, camera, **payload.model_dump(exclude_unset=True))
    db.commit()
    return CameraRead.model_validate(camera)
