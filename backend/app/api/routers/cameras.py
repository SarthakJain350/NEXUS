"""Camera endpoints (Plan §7, §6.3, TODO 4.5)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.camera import CameraRead, CameraUpdate
from app.schemas.common import DEFAULT_PAGE_SIZE, Page
from app.schemas.observation import ObservationRead
from app.services import camera_service, query_service

router = APIRouter(prefix="/api/v1/cameras", tags=["cameras"])


@router.get("", response_model=Page[CameraRead])
def list_cameras(
    db: Session = Depends(get_db),
    status: str | None = Query(
        None,
        description="Filter by status: active, inactive, maintenance, unregistered. `unregistered` surfaces auto-created cameras awaiting admin setup (§6.3).",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, description="Clamped to 200 (§6.8)."),
):
    return query_service.list_cameras(db, status=status, page=page, page_size=page_size)


@router.get("/{camera_id}", response_model=CameraRead)
def get_camera(camera_id: str, db: Session = Depends(get_db)):
    return query_service.get_camera(db, camera_id)


@router.get("/{camera_id}/observations", response_model=Page[ObservationRead])
def camera_observations(
    camera_id: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, description="Clamped to 200 (§6.8)."),
):
    """Observations from one camera, newest first. 404 only when the
    camera itself doesn't exist — a silent camera returns an empty page
    (§6.8)."""
    return query_service.camera_observations(
        db, camera_id, page=page, page_size=page_size
    )


@router.patch("/{camera_id}", response_model=CameraRead)
def update_camera(
    camera_id: str,
    payload: CameraUpdate,
    db: Session = Depends(get_db),
):
    """Fill in or correct camera details — the intended path for
    fleshing out cameras auto-created as `unregistered` by incoming
    observations (§6.3). `camera_id` itself is not updatable."""
    return camera_service.update_camera(db, camera_id, payload)
