"""Vehicle data access (Plan §4, §6.4)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Observation, Vehicle


def get_by_id(db: Session, vehicle_id: int) -> Vehicle | None:
    return db.get(Vehicle, vehicle_id)


def get_by_plate(db: Session, plate_number: str) -> Vehicle | None:
    return db.scalar(
        select(Vehicle).where(Vehicle.plate_number_best_guess == plate_number)
    )


def create_provisional(
    db: Session, plate_number: str, vehicle_type: str
) -> Vehicle:
    """Best-effort vehicle per unique normalized plate (§6.4) so
    GET /vehicles isn't empty before R6 fusion runs. global_vehicle_id
    stays null until R6 assigns one."""
    vehicle = Vehicle(
        plate_number_best_guess=plate_number, vehicle_type=vehicle_type
    )
    db.add(vehicle)
    db.flush()
    return vehicle


def list_vehicles(
    db: Session,
    *,
    plate_number: str | None = None,
    global_vehicle_id: str | None = None,
    vehicle_type: str | None = None,
    limit: int,
    offset: int,
) -> tuple[list[Vehicle], int]:
    query = select(Vehicle)
    if plate_number is not None:
        query = query.where(Vehicle.plate_number_best_guess == plate_number)
    if global_vehicle_id is not None:
        query = query.where(Vehicle.global_vehicle_id == global_vehicle_id)
    if vehicle_type is not None:
        query = query.where(Vehicle.vehicle_type == vehicle_type)
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    )
    items = list(
        db.scalars(
            query.order_by(Vehicle.id).limit(limit).offset(offset)
        )
    )
    return items, total


def observation_counts(
    db: Session, vehicle_ids: list[int] | None = None
) -> dict[int, int]:
    """Observation count per vehicle_id — feeds VehicleRead.observation_count.

    Only counts the given ids when provided (a page of vehicles), so a
    listing never aggregates the whole table.
    """
    query = (
        select(Vehicle.id, func.count(Observation.id))
        .join(Observation, Observation.vehicle_id == Vehicle.id, isouter=True)
        .group_by(Vehicle.id)
    )
    if vehicle_ids:
        query = query.where(Vehicle.id.in_(vehicle_ids))
    return {vehicle_id: count for vehicle_id, count in db.execute(query)}
