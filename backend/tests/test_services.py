"""Service-layer tests against the nexus_test DB (TODO Phase 3).

Covers every §6 ingest edge case: idempotency (6.2), camera auto-create
(6.3), provisional vehicles (6.4), last_seen_at upkeep, batch partial
failure (6.7), and query-side behavior (6.5 out-of-order journeys,
6.8 pagination clamping + empty-vs-404).
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models import Camera, Observation, Vehicle
from app.schemas.observation import ObservationCreate
from app.services import (
    batch_service,
    camera_service,
    observation_service,
    query_service,
)
from app.services.exceptions import NotFoundError
from app.schemas.camera import CameraUpdate

UTC = timezone.utc


def past(minutes_ago: float) -> datetime:
    """A capture time safely in the past — hardcoded dates would trip the
    schema's far-future clock-skew guard depending on when tests run."""
    return datetime.now(UTC) - timedelta(minutes=minutes_ago)


def make_payload(**overrides) -> ObservationCreate:
    base = dict(
        camera_id="CAM_01",
        track_id=1,
        plate_number="MH12AB1234",
        timestamp=past(10),
        vehicle_type="car",
        confidence=0.9,
        latitude=19.07,
        longitude=72.87,
        ingest_id=None,
    )
    base.update(overrides)
    return ObservationCreate.model_validate(base)


# --- 3.1.1 idempotency (§6.2) -------------------------------------------------


def count_observations(db_session) -> int:
    return db_session.scalar(select(func.count(Observation.id)))


def test_ingest_without_ingest_id_creates_row_each_time(db_session):
    first = observation_service.ingest(db_session, make_payload())
    second = observation_service.ingest(db_session, make_payload())
    assert first.created and second.created
    assert first.observation.id != second.observation.id
    assert count_observations(db_session) == 2


def test_ingest_same_ingest_id_returns_existing(db_session):
    first = observation_service.ingest(db_session, make_payload(ingest_id="evt-1"))
    replay = observation_service.ingest(db_session, make_payload(ingest_id="evt-1"))
    assert first.created
    assert not replay.created
    assert replay.observation.id == first.observation.id
    assert count_observations(db_session) == 1


def test_ingest_integrity_race_returns_existing(db_session, monkeypatch):
    """The pre-insert lookup misses (lost race), the unique index catches
    it — the retry loop must recover the winner, never raise (TODO 3.4)."""
    first = observation_service.ingest(db_session, make_payload(ingest_id="evt-2"))
    assert first.created

    original = observation_service.observation_repo.get_by_ingest_id

    def miss_once(db, ingest_id):
        if miss_once.calls == 0:
            miss_once.calls += 1
            return None
        return original(db, ingest_id)

    miss_once.calls = 0
    monkeypatch.setattr(
        observation_service.observation_repo, "get_by_ingest_id", miss_once
    )

    replay = observation_service.ingest(db_session, make_payload(ingest_id="evt-2"))
    assert not replay.created
    assert replay.observation.id == first.observation.id
    assert count_observations(db_session) == 1


# --- 3.1.2 camera auto-create (§6.3) ------------------------------------------


def test_ingest_auto_creates_unregistered_camera(db_session):
    observation_service.ingest(db_session, make_payload(camera_id="CAM_NEW"))
    camera = db_session.scalar(select(Camera).where(Camera.camera_id == "CAM_NEW"))
    assert camera is not None
    assert camera.status == "unregistered"
    assert camera.latitude is None and camera.longitude is None


def test_ingest_keeps_registered_camera_status(db_session):
    db_session.add(Camera(camera_id="CAM_01", status="active"))
    db_session.commit()
    observation_service.ingest(db_session, make_payload())
    camera = db_session.scalar(select(Camera).where(Camera.camera_id == "CAM_01"))
    assert camera.status == "active"


# --- 3.1.3 provisional vehicles (§6.4) ----------------------------------------


def test_ingest_creates_provisional_vehicle_for_plate(db_session):
    result = observation_service.ingest(db_session, make_payload())
    vehicles = list(db_session.scalars(select(Vehicle)))
    assert len(vehicles) == 1
    assert vehicles[0].plate_number_best_guess == "MH12AB1234"
    assert vehicles[0].global_vehicle_id is None  # unfused until R6
    assert result.observation.vehicle_id == vehicles[0].id


def test_ingest_same_plate_links_to_same_vehicle(db_session):
    observation_service.ingest(db_session, make_payload(track_id=1))
    observation_service.ingest(
        db_session, make_payload(track_id=2, ingest_id="e2")
    )
    vehicles = list(db_session.scalars(select(Vehicle)))
    assert len(vehicles) == 1
    assert count_observations(db_session) == 2


def test_ingest_no_plate_leaves_vehicle_null(db_session):
    result = observation_service.ingest(db_session, make_payload(plate_number=None))
    assert result.observation.vehicle_id is None
    assert list(db_session.scalars(select(Vehicle))) == []


def test_ingest_normalizes_plate_before_matching(db_session):
    """'mh 12 ab 1234' and 'MH12AB1234' are the same vehicle."""
    observation_service.ingest(db_session, make_payload(plate_number="mh 12 ab 1234"))
    observation_service.ingest(
        db_session, make_payload(plate_number="MH12-AB-1234", ingest_id="e2")
    )
    assert len(list(db_session.scalars(select(Vehicle)))) == 1


# --- 3.1.4 last_seen_at (§6.3/§6.5) --------------------------------------------


def test_ingest_updates_last_seen_at(db_session):
    captured_at = past(10)
    observation_service.ingest(db_session, make_payload(timestamp=captured_at))
    camera = db_session.scalar(select(Camera).where(Camera.camera_id == "CAM_01"))
    assert camera.last_seen_at == captured_at


def test_ingest_out_of_order_does_not_move_last_seen_backwards(db_session):
    newest = past(10)
    observation_service.ingest(db_session, make_payload(timestamp=newest))
    observation_service.ingest(
        db_session,
        make_payload(
            track_id=2,
            timestamp=past(70),  # older, arrives later (§6.5)
            ingest_id="older",
        ),
    )
    camera = db_session.scalar(select(Camera).where(Camera.camera_id == "CAM_01"))
    assert camera.last_seen_at == newest


# --- 3.2 batch (§6.7) ----------------------------------------------------------


def test_batch_mixed_valid_invalid_is_partial(db_session):
    result = batch_service.ingest_batch(
        db_session,
        [
            make_payload(ingest_id="b1"),
            {"camera_id": "", "track_id": 1, "timestamp": past(5).isoformat(),
             "vehicle_type": "car", "confidence": 0.5, "latitude": 0, "longitude": 0},
            # invalid confidence — raw dict so the failure happens inside
            # the batch, not at payload-construction time
            {"camera_id": "CAM_01", "track_id": 2, "timestamp": past(5).isoformat(),
             "vehicle_type": "car", "confidence": 5.0, "latitude": 0, "longitude": 0,
             "ingest_id": "b3"},
            make_payload(track_id=3, ingest_id="b4"),
        ],
    )
    assert len(result.accepted) == 2
    assert [r.index for r in result.rejected] == [1, 2]
    assert "camera_id" in result.rejected[0].reason
    assert "confidence" in result.rejected[1].reason
    assert count_observations(db_session) == 2


def test_batch_all_valid(db_session):
    result = batch_service.ingest_batch(
        db_session,
        [make_payload(track_id=i, ingest_id=f"ok-{i}") for i in range(3)],
    )
    assert result.rejected == []
    assert len(result.accepted) == 3


def test_batch_all_invalid_still_reports_each_item(db_session):
    result = batch_service.ingest_batch(
        db_session,
        [
            {"track_id": -1},  # missing everything else too
            {"camera_id": "CAM_01"},  # missing required fields
        ],
    )
    assert result.accepted == []
    assert [r.index for r in result.rejected] == [0, 1]


def test_batch_duplicate_ingest_id_within_batch_is_idempotent(db_session):
    result = batch_service.ingest_batch(
        db_session,
        [make_payload(ingest_id="dup"), make_payload(ingest_id="dup")],
    )
    assert len(result.accepted) == 2
    assert result.accepted[0].id == result.accepted[1].id
    assert count_observations(db_session) == 1


# --- 3.3 queries (§6.5, §6.8) ---------------------------------------------------


@pytest.fixture
def three_observations(db_session):
    """Three observations from one plate/vehicle, arriving out of order:
    CAM_03 captured most recently but inserted first."""
    observation_service.ingest(
        db_session,
        make_payload(
            camera_id="CAM_03", track_id=8,
            timestamp=past(10),  # newest capture
            ingest_id="o3",
        ),
    )
    observation_service.ingest(
        db_session,
        make_payload(
            camera_id="CAM_01", track_id=17,
            timestamp=past(30),  # oldest capture
            ingest_id="o1",
        ),
    )
    observation_service.ingest(
        db_session,
        make_payload(
            camera_id="CAM_02", track_id=43,
            timestamp=past(20),  # middle
            ingest_id="o2",
        ),
    )


def test_journey_sorted_by_timestamp_not_insertion_order(
    db_session, three_observations
):
    vehicle = db_session.scalar(select(Vehicle))
    journey = query_service.vehicle_journey(db_session, vehicle.id)
    timestamps = [p.timestamp for p in journey.items]
    assert timestamps == sorted(timestamps)
    assert [p.camera_id for p in journey.items] == ["CAM_01", "CAM_02", "CAM_03"]
    assert journey.total == 3


def test_journey_unknown_vehicle_is_not_found(db_session):
    with pytest.raises(NotFoundError):
        query_service.vehicle_journey(db_session, 9999)


def test_list_observations_filters(db_session, three_observations):
    by_camera = query_service.list_observations(db_session, camera_id="CAM_02")
    assert by_camera.total == 1
    assert by_camera.items[0].camera_id == "CAM_02"

    by_plate = query_service.list_observations(
        db_session, plate_number="mh 12 ab 1234"  # filter input is normalized too
    )
    assert by_plate.total == 3

    by_type = query_service.list_observations(db_session, vehicle_type="CAR")
    assert by_type.total == 3

    window = query_service.list_observations(
        db_session,
        start=past(25),  # between CAM_02 (20m ago) and CAM_01 (30m ago)
        end=past(15),
    )
    assert [o.camera_id for o in window.items] == ["CAM_02"]


def test_list_observations_empty_result_is_normal(db_session):
    page = query_service.list_observations(db_session, camera_id="NOPE")
    assert page.items == []
    assert page.total == 0


def test_page_size_clamped_not_errored(db_session, three_observations):
    page = query_service.list_observations(db_session, page_size=500, page=0)
    assert page.page_size == 200  # MAX_PAGE_SIZE clamp (§6.8)
    assert page.page == 1


def test_pagination_walks_all_pages(db_session, three_observations):
    first = query_service.list_observations(db_session, page=1, page_size=2)
    second = query_service.list_observations(db_session, page=2, page_size=2)
    assert len(first.items) == 2 and first.total == 3
    assert len(second.items) == 1
    assert {o.id for o in first.items}.isdisjoint({o.id for o in second.items})


def test_get_observation(db_session, three_observations):
    obs = query_service.list_observations(db_session).items[0]
    fetched = query_service.get_observation(db_session, obs.id)
    assert fetched.id == obs.id
    with pytest.raises(NotFoundError):
        query_service.get_observation(db_session, 999999)


def test_list_vehicles_with_observation_counts(db_session, three_observations):
    page = query_service.list_vehicles(db_session)
    assert page.total == 1
    assert page.items[0].observation_count == 3
    assert page.items[0].plate_number_best_guess == "MH12AB1234"

    single = query_service.get_vehicle(db_session, page.items[0].id)
    assert single.observation_count == 3
    with pytest.raises(NotFoundError):
        query_service.get_vehicle(db_session, 999999)


def test_list_cameras_status_filter(db_session, three_observations):
    db_session.add(Camera(camera_id="CAM_KNOWN", status="active"))
    db_session.commit()

    unregistered = query_service.list_cameras(db_session, status="unregistered")
    assert {c.camera_id for c in unregistered.items} == {"CAM_01", "CAM_02", "CAM_03"}

    all_cameras = query_service.list_cameras(db_session)
    assert all_cameras.total == 4


def test_camera_observations(db_session, three_observations):
    page = query_service.camera_observations(db_session, "CAM_01")
    assert page.total == 1
    assert page.items[0].camera_id == "CAM_01"
    with pytest.raises(NotFoundError):
        query_service.camera_observations(db_session, "NOPE")


def test_update_camera_fills_unregistered_details(db_session):
    observation_service.ingest(db_session, make_payload(camera_id="CAM_NEW"))
    updated = camera_service.update_camera(
        db_session,
        "CAM_NEW",
        CameraUpdate(
            name="Gate 2 North", latitude=19.08, longitude=72.88,
            location="Main gate", status="active",
        ),
    )
    assert updated.status == "active"
    assert updated.name == "Gate 2 North"

    with pytest.raises(NotFoundError):
        camera_service.update_camera(
            db_session, "NOPE", CameraUpdate(name="x")
        )
