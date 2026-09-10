"""Database tests (Plan §13 — database tests).

Run from backend/:
    pytest tests/test_db.py -v

Written with Phase 2; execution pending (Claude's shell tool down —
Sarthak runs them manually).
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Camera, Observation, PlateRead, Vehicle

UTC = timezone.utc


def make_camera(**overrides) -> Camera:
    defaults = dict(
        camera_id="CAM_01",
        name="North Gate",
        latitude=28.60,
        longitude=77.20,
        location="Entrance A",
        status="active",
    )
    defaults.update(overrides)
    return Camera(**defaults)


def make_observation(camera_id="CAM_01", **overrides) -> Observation:
    defaults = dict(
        camera_id=camera_id,
        track_id=17,
        plate_number="UP32AB1234",
        timestamp=datetime(2026, 9, 10, 5, 2, 12, tzinfo=UTC),
        vehicle_type="car",
        confidence=0.94,
        latitude=28.60,
        longitude=77.20,
    )
    defaults.update(overrides)
    return Observation(**defaults)


class TestCameras:
    def test_create_and_query(self, db_session):
        db_session.add(make_camera())
        db_session.commit()
        cam = db_session.query(Camera).filter_by(camera_id="CAM_01").one()
        assert cam.name == "North Gate"
        assert cam.created_at is not None

    def test_duplicate_camera_id_rejected(self, db_session):
        db_session.add(make_camera())
        db_session.commit()
        db_session.add(make_camera(name="second"))
        with pytest.raises(IntegrityError):
            db_session.commit()


class TestVehicles:
    def test_unfused_vehicle(self, db_session):
        # §6.4: exists purely as unfused observations.
        v = Vehicle(global_vehicle_id=None, plate_number_best_guess=None)
        db_session.add(v)
        db_session.commit()
        assert v.id is not None and v.global_vehicle_id is None

    def test_multiple_nulls_allowed(self, db_session):
        # Nullable-unique: several unfused vehicles coexist.
        db_session.add_all([Vehicle(), Vehicle(), Vehicle()])
        db_session.commit()
        assert db_session.query(Vehicle).count() == 3

    def test_duplicate_global_vehicle_id_rejected(self, db_session):
        db_session.add(Vehicle(global_vehicle_id="VEH_001"))
        db_session.commit()
        db_session.add(Vehicle(global_vehicle_id="VEH_001"))
        with pytest.raises(IntegrityError):
            db_session.commit()


class TestObservations:
    def test_create_with_vehicle(self, db_session):
        cam = make_camera()
        veh = Vehicle(plate_number_best_guess="UP32AB1234")
        db_session.add_all([cam, veh])
        db_session.commit()
        obs = make_observation(vehicle_id=veh.id)
        db_session.add(obs)
        db_session.commit()

        loaded = db_session.get(Observation, obs.id)
        assert loaded.vehicle is veh
        assert loaded.camera is cam
        assert veh.observations == [loaded]

    def test_create_without_vehicle(self, db_session):
        # No plate, no fusion result → vehicle_id stays null (§6.4).
        db_session.add(make_camera())
        db_session.commit()
        obs = make_observation(plate_number=None, vehicle_id=None)
        db_session.add(obs)
        db_session.commit()
        assert obs.vehicle_id is None

    def test_multiple_observations_one_vehicle(self, db_session):
        db_session.add_all(
            [make_camera(camera_id="CAM_01"), make_camera(camera_id="CAM_02")]
        )
        veh = Vehicle()
        db_session.add(veh)
        db_session.commit()
        db_session.add_all(
            [
                make_observation(camera_id="CAM_01", track_id=17, vehicle_id=veh.id),
                make_observation(camera_id="CAM_02", track_id=43, vehicle_id=veh.id),
            ]
        )
        db_session.commit()
        assert len(veh.observations) == 2

    def test_track_id_not_unique(self, db_session):
        # §6.1: same (camera, track_id) can appear many times — one row
        # per detection event, no merging at the DB layer (Option A).
        db_session.add(make_camera())
        db_session.commit()
        db_session.add_all(
            [
                make_observation(track_id=17, timestamp=datetime(2026, 9, 10, 5, tzinfo=UTC)),
                make_observation(track_id=17, timestamp=datetime(2026, 9, 10, 6, tzinfo=UTC)),
            ]
        )
        db_session.commit()
        assert db_session.query(Observation).filter_by(track_id=17).count() == 2


class TestIngestIdIdempotency:
    def test_duplicate_ingest_id_rejected_at_db_level(self, db_session):
        # The DB constraint is the race-condition backstop (§6.2); the
        # service layer (Phase 3) turns this into an idempotent 200.
        db_session.add(make_camera())
        db_session.commit()
        db_session.add(make_observation(ingest_id="ing-001"))
        db_session.commit()
        db_session.add(make_observation(ingest_id="ing-001", track_id=99))
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_multiple_null_ingest_ids_allowed(self, db_session):
        # Optional in the contract — absent ingest_id must never collide.
        db_session.add(make_camera())
        db_session.commit()
        db_session.add_all(
            [
                make_observation(),
                make_observation(track_id=18),
                make_observation(track_id=19),
            ]
        )
        db_session.commit()
        assert db_session.query(Observation).count() == 3


class TestPlateReads:
    def test_raw_ocr_trail(self, db_session):
        db_session.add(make_camera())
        db_session.commit()
        obs = make_observation()
        db_session.add(obs)
        db_session.flush()
        db_session.add(
            PlateRead(
                observation_id=obs.id,
                plate_number_raw="up32 ab1234",
                plate_number_normalized="UP32AB1234",
                confidence=0.91,
                timestamp=obs.timestamp,
            )
        )
        db_session.commit()
        assert obs.plate_reads[0].plate_number_raw == "up32 ab1234"
