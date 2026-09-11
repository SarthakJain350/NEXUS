"""Fixture round-trip tests (TODO 5.2, Plan §12) — the deliberately-imperfect
dummy rows POSTed to the API, persisted to Postgres, and read back.

This is the integration sanity check: every §6 edge case in the fixture
behaves per spec through the full HTTP → service → DB → HTTP path.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import Camera

FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "dummy_observations.json"
UTC = timezone.utc


@pytest.fixture
def fixture_rows() -> list[dict]:
    with FIXTURE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def client(db_session):
    from app.database.session import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def post_all(client, rows: list[dict]) -> list[dict]:
    """POST each fixture row individually; all must be accepted (201)."""
    bodies = []
    for row in rows:
        response = client.post("/api/v1/observations", json=row)
        assert response.status_code == 201, (row["camera_id"], response.text)
        bodies.append(response.json())
    return bodies


def test_fixture_round_trip_preserves_every_row(client, fixture_rows):
    bodies = post_all(client, fixture_rows)

    page = client.get("/api/v1/observations").json()
    assert page["total"] == 4
    by_camera = {obs["camera_id"]: obs for obs in page["items"]}
    assert set(by_camera) == {"CAM_01", "CAM_02", "CAM_03", "CAM_UNKNOWN"}

    # Values survive the trip: aware IST input is stored/returned as UTC.
    first = by_camera["CAM_01"]
    assert first["plate_number"] == "UP32AB1234"
    assert first["track_id"] == 17
    assert first["vehicle_type"] == "car"
    assert first["confidence"] == 0.94
    assert datetime.fromisoformat(first["timestamp"]) == datetime(
        2026, 9, 10, 5, 2, 12, tzinfo=UTC  # 10:32:12+05:30 → 05:02:12Z
    )
    # (0,0) sentinel accepted verbatim (§3: warning, not rejection).
    assert by_camera["CAM_UNKNOWN"]["latitude"] == 0.0
    assert by_camera["CAM_UNKNOWN"]["longitude"] == 0.0
    # Sanity: returned ids match the POST responses.
    assert {b["id"] for b in bodies} == {obs["id"] for obs in page["items"]}


def test_fixture_duplicate_plate_fuses_to_one_vehicle(client, fixture_rows):
    """Rows 1 & 2 (UP32AB1234 / 'up32 ab1234') → same provisional vehicle."""
    # Deliberately out of chronological order (§13 journey test): row 2
    # (10:35) is inserted before row 1 (10:32).
    row1, row2, *_ = fixture_rows
    second = client.post("/api/v1/observations", json=row2).json()
    first = client.post("/api/v1/observations", json=row1).json()

    assert second["plate_number"] == "UP32AB1234"  # lowercase/spaced → normalized
    assert first["vehicle_id"] == second["vehicle_id"] is not None

    # Journey is still timestamp-sorted despite out-of-order arrival (§6.5).
    journey = client.get(f"/api/v1/vehicles/{first['vehicle_id']}/journey").json()
    stops = journey["items"] if isinstance(journey, dict) else journey
    timestamps = [datetime.fromisoformat(s["timestamp"]) for s in stops]
    assert timestamps == sorted(timestamps)
    assert [s["camera_id"] for s in stops] == ["CAM_01", "CAM_02"]


def test_fixture_null_plate_leaves_vehicle_unassigned(client, fixture_rows):
    row3 = fixture_rows[2]
    assert row3["plate_number"] is None
    body = client.post("/api/v1/observations", json=row3).json()
    assert body["vehicle_id"] is None  # §6.4: no plate → no provisional vehicle


def test_fixture_unknown_camera_auto_created_unregistered(client, db_session, fixture_rows):
    row4 = fixture_rows[3]
    client.post("/api/v1/observations", json=row4)

    camera = db_session.scalar(
        select(Camera).where(Camera.camera_id == "CAM_UNKNOWN")
    )
    assert camera is not None  # §6.3: unknown camera auto-created
    assert camera.status == "unregistered"
    assert camera.last_seen_at is not None  # touched by the ingest


def test_fixture_batch_endpoint_accepts_full_file(client, fixture_rows):
    """The whole fixture file also ingests cleanly as one batch (§6.7)."""
    response = client.post("/api/v1/observations/batch", json=fixture_rows)
    assert response.status_code == 200
    result = response.json()
    assert len(result["accepted"]) == 4
    assert result["rejected"] == []
