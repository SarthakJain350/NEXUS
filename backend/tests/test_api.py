"""API tests — every endpoint, every §6 edge case over HTTP (TODO 4.10).

Runs against the app with TestClient; the DB dependency is overridden to
the nexus_test session so no real data is touched.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database.session import get_db
from app.main import app
from app.models import Camera, Vehicle
from app.schemas.observation import IST

UTC = timezone.utc


def past(minutes_ago: float) -> datetime:
    return datetime.now(UTC) - timedelta(minutes=minutes_ago)


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def payload(**overrides) -> dict:
    base = dict(
        camera_id="CAM_01",
        track_id=1,
        plate_number="MH12AB1234",
        timestamp=past(10).isoformat(),
        vehicle_type="car",
        confidence=0.9,
        latitude=19.07,
        longitude=72.87,
    )
    base.update(overrides)
    return base


def assert_error_shape(body: dict, code: str) -> None:
    """Every error response uses the uniform envelope (TODO 4.8)."""
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)


# --- health (4.1) ------------------------------------------------------------


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_ready_round_trips_db(client):
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


# --- POST /observations (4.2) --------------------------------------------------


def test_post_observation_created_201(client):
    response = client.post("/api/v1/observations", json=payload(ingest_id="api-1"))
    assert response.status_code == 201
    body = response.json()
    assert body["camera_id"] == "CAM_01"
    assert body["plate_number"] == "MH12AB1234"  # normalized
    assert body["vehicle_id"] is not None  # provisional vehicle linked (§6.4)


def test_post_duplicate_ingest_id_is_idempotent_200(client):
    first = client.post("/api/v1/observations", json=payload(ingest_id="api-dup"))
    replay = client.post("/api/v1/observations", json=payload(ingest_id="api-dup"))
    assert first.status_code == 201
    assert replay.status_code == 200  # never 409 (§6.2)
    assert replay.json()["id"] == first.json()["id"]


def test_post_without_ingest_id_accepted(client):
    assert client.post("/api/v1/observations", json=payload()).status_code == 201


def test_post_auto_creates_unregistered_camera(client, db_session):
    client.post("/api/v1/observations", json=payload(camera_id="CAM_AUTO"))
    camera = db_session.scalar(
        select(Camera).where(Camera.camera_id == "CAM_AUTO")
    )
    assert camera is not None
    assert camera.status == "unregistered"
    assert camera.last_seen_at is not None  # touched on ingest (§6.3)


def test_post_naive_timestamp_assumed_ist(client):
    # Naive timestamps are camera-local IST → stored 5:30 earlier as UTC (D10)
    naive = past(120).replace(tzinfo=None)
    response = client.post(
        "/api/v1/observations", json=payload(timestamp=naive.isoformat())
    )
    assert response.status_code == 201
    stored = datetime.fromisoformat(response.json()["timestamp"])
    expected = naive.replace(tzinfo=IST).astimezone(UTC)
    assert stored == expected


def test_post_future_timestamp_rejected_422(client):
    future = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    response = client.post("/api/v1/observations", json=payload(timestamp=future))
    assert response.status_code == 422
    assert_error_shape(response.json(), "validation_error")


def test_post_invalid_confidence_422_never_500(client):
    response = client.post("/api/v1/observations", json=payload(confidence=5.0))
    assert response.status_code == 422
    assert_error_shape(response.json(), "validation_error")


def test_post_plate_normalized_and_case_matched(client, db_session):
    client.post("/api/v1/observations", json=payload(plate_number="mh 12 ab 1234", ingest_id="a"))
    client.post("/api/v1/observations", json=payload(track_id=2, plate_number="MH12-AB-1234", ingest_id="b"))
    assert len(list(db_session.scalars(select(Vehicle)))) == 1  # same plate = one vehicle


def test_post_without_plate_has_null_vehicle(client):
    response = client.post("/api/v1/observations", json=payload(plate_number=None))
    assert response.status_code == 201
    assert response.json()["vehicle_id"] is None  # no fabricated vehicle (§6.4)


def test_post_gps_sentinel_accepted_with_warning(client):
    response = client.post(
        "/api/v1/observations", json=payload(latitude=0.0, longitude=0.0)
    )
    assert response.status_code == 201  # (0,0) logged, not rejected (§3)


def test_post_unknown_extra_fields_ignored(client):
    response = client.post(
        "/api/v1/observations", json=payload(source_version="9.9", extra_junk=1)
    )
    assert response.status_code == 201  # extra="ignore" — upstream evolves freely


# --- POST /observations/batch (4.3) ---------------------------------------------


def test_batch_partial_success(client):
    response = client.post(
        "/api/v1/observations/batch",
        json=[
            payload(ingest_id="b1"),
            payload(track_id=2, confidence=9.0, ingest_id="b2"),  # invalid
            payload(track_id=3, ingest_id="b3"),
        ],
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["accepted"]) == 2
    assert [r["index"] for r in body["rejected"]] == [1]
    assert "confidence" in body["rejected"][0]["reason"]


def test_batch_intra_duplicate_ingest_id(client):
    response = client.post(
        "/api/v1/observations/batch",
        json=[payload(ingest_id="dup"), payload(track_id=2, ingest_id="dup")],
    )
    body = response.json()
    assert len(body["accepted"]) == 2
    assert body["accepted"][0]["id"] == body["accepted"][1]["id"]


def test_batch_all_invalid_reports_each(client):
    response = client.post(
        "/api/v1/observations/batch", json=[{"bad": 1}, {"also_bad": 2}]
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == []
    assert [r["index"] for r in body["rejected"]] == [0, 1]


# --- GET /observations (4.4) -----------------------------------------------------


@pytest.fixture
def three_obs(client):
    """Three observations from one plate, out-of-order arrival (§6.5)."""
    for camera, track, minutes, iid in [
        ("CAM_03", 8, 10, "o3"),   # newest, inserted first
        ("CAM_01", 17, 30, "o1"),  # oldest
        ("CAM_02", 43, 20, "o2"),
    ]:
        response = client.post(
            "/api/v1/observations",
            json=payload(camera_id=camera, track_id=track, timestamp=past(minutes).isoformat(), ingest_id=iid),
        )
        assert response.status_code == 201


def test_list_observations_filters(client, three_obs):
    by_camera = client.get("/api/v1/observations", params={"camera_id": "CAM_02"})
    body = by_camera.json()
    assert by_camera.status_code == 200
    assert body["total"] == 1
    assert body["items"][0]["camera_id"] == "CAM_02"

    by_plate = client.get(
        "/api/v1/observations", params={"plate_number": "mh 12 ab 1234"}
    )
    assert by_plate.json()["total"] == 3  # filter input normalized too

    window = client.get(
        "/api/v1/observations",
        params={"start": past(25).isoformat(), "end": past(15).isoformat()},
    )
    assert [o["camera_id"] for o in window.json()["items"]] == ["CAM_02"]


def test_list_observations_empty_is_200(client):
    response = client.get("/api/v1/observations", params={"camera_id": "NOPE"})
    assert response.status_code == 200  # empty is valid, not 404 (§6.8)
    assert response.json()["items"] == []


def test_list_page_size_clamped_to_200(client, three_obs):
    response = client.get("/api/v1/observations", params={"page_size": 500})
    assert response.status_code == 200
    assert response.json()["page_size"] == 200


def test_get_observation_by_id(client, three_obs):
    obs_id = client.get("/api/v1/observations").json()["items"][0]["id"]
    response = client.get(f"/api/v1/observations/{obs_id}")
    assert response.status_code == 200
    assert response.json()["id"] == obs_id


def test_get_observation_unknown_404(client):
    response = client.get("/api/v1/observations/999999")
    assert response.status_code == 404
    assert_error_shape(response.json(), "not_found")


# --- cameras (4.5) ---------------------------------------------------------------


def test_list_cameras_unregistered_filter(client, three_obs):
    response = client.get("/api/v1/cameras", params={"status": "unregistered"})
    assert response.status_code == 200
    assert {c["camera_id"] for c in response.json()["items"]} == {
        "CAM_01", "CAM_02", "CAM_03",
    }


def test_list_cameras_bad_status_422(client):
    response = client.get("/api/v1/cameras", params={"status": "bogus"})
    assert response.status_code == 422
    assert_error_shape(response.json(), "invalid_value")


def test_camera_observations(client, three_obs):
    response = client.get("/api/v1/cameras/CAM_01/observations")
    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_camera_observations_unknown_camera_404(client):
    response = client.get("/api/v1/cameras/NOPE/observations")
    assert response.status_code == 404
    assert_error_shape(response.json(), "not_found")


def test_patch_camera_fills_details(client, three_obs):
    response = client.patch(
        "/api/v1/cameras/CAM_01",
        json={"name": "Gate 1", "latitude": 19.08, "longitude": 72.88, "status": "active"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["name"] == "Gate 1"


def test_patch_camera_unknown_404(client):
    response = client.patch("/api/v1/cameras/NOPE", json={"name": "x"})
    assert response.status_code == 404
    assert_error_shape(response.json(), "not_found")


def test_patch_camera_rejects_unknown_fields(client, three_obs):
    response = client.patch("/api/v1/cameras/CAM_01", json={"camera_id": "NEW"})
    assert response.status_code == 422
    assert_error_shape(response.json(), "validation_error")


# --- vehicles + journey (4.6) ------------------------------------------------------


def test_list_vehicles_with_counts(client, three_obs):
    response = client.get("/api/v1/vehicles")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["observation_count"] == 3


def test_get_vehicle_unknown_404(client):
    assert client.get("/api/v1/vehicles/999").status_code == 404


def test_journey_sorted_by_timestamp(client, three_obs):
    vehicle_id = client.get("/api/v1/vehicles").json()["items"][0]["id"]
    response = client.get(f"/api/v1/vehicles/{vehicle_id}/journey")
    assert response.status_code == 200
    cameras = [p["camera_id"] for p in response.json()["items"]]
    assert cameras == ["CAM_01", "CAM_02", "CAM_03"]  # capture-time order (§6.5)


def test_journey_unknown_vehicle_404(client):
    response = client.get("/api/v1/vehicles/999/journey")
    assert response.status_code == 404
    assert_error_shape(response.json(), "not_found")


def test_journey_known_vehicle_empty_is_200(client, db_session):
    vehicle = Vehicle(vehicle_type="car")
    db_session.add(vehicle)
    db_session.commit()
    response = client.get(f"/api/v1/vehicles/{vehicle.id}/journey")
    assert response.status_code == 200  # §6.8: empty ≠ 404
    assert response.json()["items"] == []


# --- PATCH /observations/{id}/vehicle — R6 fusion point (4.7, provisional D6) -------


def test_patch_observation_vehicle_links_and_creates(client, three_obs):
    obs_id = client.get("/api/v1/observations").json()["items"][0]["id"]
    response = client.patch(
        f"/api/v1/observations/{obs_id}/vehicle",
        json={"global_vehicle_id": "GV-77"},
    )
    assert response.status_code == 200
    assert response.json()["vehicle_id"] is not None

    vehicle = client.get(f"/api/v1/vehicles/{response.json()['vehicle_id']}").json()
    assert vehicle["global_vehicle_id"] == "GV-77"
    assert vehicle["plate_number_best_guess"] == "MH12AB1234"  # seeded from obs


def test_patch_observation_vehicle_links_existing_global(client, three_obs):
    ids = [o["id"] for o in client.get("/api/v1/observations").json()["items"]]
    first = client.patch(
        f"/api/v1/observations/{ids[0]}/vehicle", json={"global_vehicle_id": "GV-9"}
    )
    second = client.patch(
        f"/api/v1/observations/{ids[1]}/vehicle", json={"global_vehicle_id": "GV-9"}
    )
    assert first.json()["vehicle_id"] == second.json()["vehicle_id"]


def test_patch_observation_vehicle_unknown_obs_404(client):
    response = client.patch(
        "/api/v1/observations/999999/vehicle", json={"global_vehicle_id": "GV-1"}
    )
    assert response.status_code == 404
    assert_error_shape(response.json(), "not_found")


# --- error envelope sanity (4.8) ----------------------------------------------------


def test_validation_error_never_leaks_internals(client):
    response = client.post("/api/v1/observations", json={"track_id": "abc"})
    assert response.status_code == 422
    text = response.text
    assert "Traceback" not in text
    assert "sqlalchemy" not in text.lower()
