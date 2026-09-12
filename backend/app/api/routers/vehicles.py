"""Vehicle endpoints (Plan §7, §6.5, TODO 4.6)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.common import DEFAULT_PAGE_SIZE, Page
from app.schemas.observation import JourneyPoint
from app.schemas.vehicle import VehicleRead
from app.services import query_service

router = APIRouter(prefix="/api/v1/vehicles", tags=["vehicles"])


@router.get("", response_model=Page[VehicleRead])
def list_vehicles(
    db: Session = Depends(get_db),
    plate_number: str | None = Query(None, max_length=32, description="Normalized on input, e.g. 'mh 12 ab 1234' matches MH12AB1234."),
    global_vehicle_id: str | None = Query(None, max_length=64, description="R6-assigned global identity."),
    vehicle_type: str | None = Query(None, max_length=16),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, description="Clamped to 200 (§6.8)."),
):
    return query_service.list_vehicles(
        db,
        plate_number=plate_number,
        global_vehicle_id=global_vehicle_id,
        vehicle_type=vehicle_type,
        page=page,
        page_size=page_size,
    )


@router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    return query_service.get_vehicle(db, vehicle_id)


@router.get("/{vehicle_id}/journey", response_model=Page[JourneyPoint])
def vehicle_journey(
    vehicle_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, description="Clamped to 200 (§6.8)."),
):
    """The vehicle's observations as a journey, **sorted by capture
    timestamp ascending at query time** — never insertion order (§6.5).
    A known vehicle with no observations returns a valid empty page; 404
    is reserved for a vehicle that doesn't exist (§6.8)."""
    return query_service.vehicle_journey(
        db, vehicle_id, page=page, page_size=page_size
    )
