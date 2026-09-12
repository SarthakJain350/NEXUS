"""Observation ingest — all Plan §6 ingest edge cases live here (TODO 3.1).

Idempotency (§6.2), camera auto-create (§6.3), provisional vehicles
(§6.4), and last_seen_at upkeep are deliberately *not* in route handlers:
every entry point (single POST, batch, future loaders) gets identical
behavior.
"""

import logging
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Observation, Vehicle
from app.repositories import camera_repo, observation_repo, vehicle_repo
from app.schemas.observation import ObservationCreate
from app.schemas.vehicle import VehicleUpdate
from app.services.exceptions import ConflictError, NotFoundError

logger = logging.getLogger("nexus.services.observation")


@dataclass(frozen=True)
class IngestResult:
    """`created` distinguishes a fresh insert (201) from an idempotent
    replay of an existing record (200) — the route layer decides."""

    observation: Observation
    created: bool


def ingest(db: Session, payload: ObservationCreate) -> IngestResult:
    """Store one observation, idempotently (§6.2).

    A duplicate ingest_id returns the existing record as a success, never
    a 409/500 — the caller retried precisely because it wasn't sure the
    first attempt landed.
    """
    for _attempt in range(2):
        if payload.ingest_id is not None:
            existing = observation_repo.get_by_ingest_id(db, payload.ingest_id)
            if existing is not None:
                return IngestResult(existing, created=False)
        else:
            # Optional-but-recommended (§6.2): accept, but make the
            # missing-duplicate-protection rate visible in logs.
            logger.warning(
                "Observation from camera %s (track %s, ts %s) has no "
                "ingest_id — replays of this event cannot be de-duplicated",
                payload.camera_id,
                payload.track_id,
                payload.timestamp.isoformat(),
            )
        try:
            observation = _insert(db, payload)
        except IntegrityError:
            # Lost a race: a concurrent request inserted the same ingest_id
            # (or the same auto-created camera) between our lookup and flush.
            # Roll back and retry — the lookup above then finds the winner.
            db.rollback()
            continue
        db.commit()
        return IngestResult(observation, created=True)

    # Two integrity failures in a row is not a race — surface it cleanly.
    raise ConflictError(
        "observation could not be stored due to a write conflict; "
        "retrying with the same ingest_id is safe"
    )


def _insert(db: Session, payload: ObservationCreate) -> Observation:
    # SAVEPOINT so an integrity failure inside doesn't poison the session
    # before the rollback handling in ingest() runs.
    with db.begin_nested():
        # §6.3: unknown camera → auto-create as 'unregistered'; a known
        # camera keeps its status and registered details untouched.
        camera = camera_repo.get_by_camera_id(db, payload.camera_id)
        if camera is None:
            camera = camera_repo.create_unregistered(db, payload.camera_id)
        camera_repo.touch_last_seen(db, camera, payload.timestamp)

        # C7 (D13 resolution): the frozen ML contract carries no GPS fields.
        # Payload coordinates win; otherwise fall back to the camera row's
        # registered position; cameras without GPS leave the observation
        # coordinate-less (null) rather than blocking ingest.
        if payload.latitude is None or payload.longitude is None:
            payload = payload.model_copy(
                update={
                    "latitude": (
                        payload.latitude if payload.latitude is not None else camera.latitude
                    ),
                    "longitude": (
                        payload.longitude
                        if payload.longitude is not None
                        else camera.longitude
                    ),
                }
            )

        # §6.4: link to the vehicle already known for this plate, else
        # create a provisional one; no plate → no fabricated vehicle.
        vehicle_id: int | None = None
        if payload.plate_number is not None:
            vehicle = vehicle_repo.get_by_plate(db, payload.plate_number)
            if vehicle is None:
                vehicle = vehicle_repo.create_provisional(
                    db, payload.plate_number, payload.vehicle_type
                )
            vehicle_id = vehicle.id

        return observation_repo.create(db, payload, vehicle_id)


def assign_vehicle(db: Session, observation_id: int, payload: VehicleUpdate) -> Observation:
    """R6 fusion write target: link an observation to a global vehicle identity.

    Body is the provisional `{global_vehicle_id}` shape per D6 — extended
    once R6's real fusion output is confirmed (Plan §15, Phase 8.3).
    """
    observation = observation_repo.get_by_id(db, observation_id)
    if observation is None:
        raise NotFoundError(f"observation {observation_id} not found")

    with db.begin_nested():
        vehicle = db.scalar(
            select(Vehicle).where(
                Vehicle.global_vehicle_id == payload.global_vehicle_id
            )
        )
        if vehicle is None:
            vehicle = Vehicle(
                global_vehicle_id=payload.global_vehicle_id,
                vehicle_type=observation.vehicle_type,
                # Best guess seeded from this observation's plate so the
                # vehicle is searchable even if R6 never sends more.
                plate_number_best_guess=observation.plate_number,
            )
            db.add(vehicle)
            db.flush()
        elif vehicle.plate_number_best_guess is None and observation.plate_number:
            vehicle.plate_number_best_guess = observation.plate_number

        observation.vehicle_id = vehicle.id
    db.commit()
    return observation
