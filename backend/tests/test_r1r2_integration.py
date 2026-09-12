"""R1/R2 integration tests — the real ML contract against the full stack.

Covers the 21 required cases from the R1/R2 integration task (2026-09-12):
frozen-contract payloads (vehicle_class/plate_text/plate_confidence, bbox,
trajectory, frame_id), the adapter layer (app/integration/r1r2.py), the
plate_reads trail, camera-coordinate fallback (C7), and backward
compatibility with the original backend-native payload shape.

Runs like every other suite file: nexus_test Postgres via conftest.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from app.database.session import get_db
from app.integration import (
    from_r1_r2,
    from_r2_result,
    normalize_r2_confidence,
    plate_text_or_none,
)
from app.main import app
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


def r1_payload(**overrides) -> dict:
    """R1-side object per the frozen contract (vehicle_class naming)."""
    base = dict(
        camera_id="CAM_R1R2",
        frame_id=12345,
        timestamp=past(10).isoformat(),
        track_id=17,
        vehicle_class="Car",
        vehicle_bbox=[120.0, 240.0, 480.0, 610.0],
        trajectory=[[28.60, 77.20], [28.61, 77.21], [28.62, 77.22]],
        confidence=0.91,
        latitude=28.60,
        longitude=77.20,
    )
    base.update(overrides)
    return base


def r2_payload(**overrides) -> dict:
    """R2-side object per the frozen contract (plate_text naming)."""
    base = dict(
        camera_id="CAM_R1R2",
        track_id=17,
        plate_bbox=[150.0, 250.0, 290.0, 270.0],
        plate_text="UP14AB1234",
        plate_confidence=0.94,
        raw_ocr_text="up 14 ab 1234",
        ocr_confidence=0.88,
        detection_confidence=0.97,
        ocr_engine="fast-plate-ocr",
    )
    base.update(overrides)
    return base


def combined(**overrides) -> dict:
    """The combined NEXUS observation (adapter output shape)."""
    payload = from_r1_r2(r1_payload(), r2_payload())
    payload.update(overrides)
    return payload


# --- adapter unit tests ---------------------------------------------------------


class TestAdapter:
    def test_combine_r1_r2(self):
        payload = combined()
        assert payload["vehicle_type"] == "Car"  # schema allow-list maps to "car"
        assert payload["plate_number"] == "UP14AB1234"
        assert payload["raw_plate_text"] == "up 14 ab 1234"
        assert payload["plate_confidence"] == 0.94
        assert payload["frame_id"] == 12345
        assert payload["vehicle_bbox"] == [120.0, 240.0, 480.0, 610.0]
        assert payload["plate_bbox"] == [150.0, 250.0, 290.0, 270.0]
        assert payload["trajectory"] == [[28.60, 77.20], [28.61, 77.21], [28.62, 77.22]]

    def test_association_key_is_camera_plus_track(self):
        # track_id alone is never sufficient (§6.1) — a mismatched R2 object
        # must raise instead of silently mis-linking the plate.
        with pytest.raises(ValueError, match="track_id"):
            from_r1_r2(r1_payload(), r2_payload(track_id=99))
        with pytest.raises(ValueError, match="camera_id"):
            from_r1_r2(r1_payload(), r2_payload(camera_id="CAM_OTHER"))

    def test_r2_anpr_result_shape(self):
        # The ACTUAL r2_anpr.process_plate output: 0-100 heuristic
        # confidence, "status" key, no bboxes.
        r2_result = {"plate_text": "MH12AB1234", "confidence": 90, "status": "readable"}
        fields = from_r2_result(r2_result)
        assert fields["plate_number"] == "MH12AB1234"
        assert fields["plate_confidence"] == pytest.approx(0.9)
        assert fields["ocr_engine"] == "r2_anpr"

    def test_normalize_r2_confidence_scales(self):
        assert normalize_r2_confidence(0) == 0.0
        assert normalize_r2_confidence(0.5) == 0.5  # already [0,1] → untouched
        assert normalize_r2_confidence(50) == pytest.approx(0.5)
        assert normalize_r2_confidence(100) == 1.0
        assert normalize_r2_confidence(250) == 1.0  # clamped, warned
        assert normalize_r2_confidence("junk") == 0.0

    def test_plate_text_sentinels(self):
        assert plate_text_or_none(None) is None
        assert plate_text_or_none("") is None
        assert plate_text_or_none("UNREADABLE") is None
        assert plate_text_or_none("ERR: HTTP 429") is None
        assert plate_text_or_none("up14 ab 1234") == "UP14AB1234"


# --- 1-3: R1-only / R2-only / combined over HTTP ---------------------------------


def test_r1_only_observation(client):
    """Case 1: R1 fields with no plate at all."""
    response = client.post("/api/v1/observations", json=from_r1_r2(r1_payload()))
    assert response.status_code == 201
    body = response.json()
    assert body["vehicle_type"] == "car"
    assert body["plate_number"] is None
    assert body["vehicle_id"] is None  # no plate → no fabricated vehicle
    assert body["vehicle_bbox"] == [120.0, 240.0, 480.0, 610.0]
    assert body["trajectory"] == [[28.60, 77.20], [28.61, 77.21], [28.62, 77.22]]
    assert body["frame_id"] == "12345"  # int → opaque string (C5)
    # No plate information → empty trail.
    assert client.get(f"/api/v1/observations/{body['id']}/plate-reads").json() == []


def test_r2_only_plate_fields_where_valid(client):
    """Case 2: plate fields with the minimum required vehicle context —
    a bare R2 read is not an observation on its own (needs camera, track,
    timestamp, vehicle_class), but plate-only extras ride along fine."""
    response = client.post(
        "/api/v1/observations",
        json={
            "camera_id": "CAM_R1R2",
            "track_id": 17,
            "timestamp": past(5).isoformat(),
            "vehicle_class": "car",
            "plate_text": "DL8CAF1234",
            "plate_confidence": 0.8,
            "plate_bbox": [10, 20, 30, 40],
            "ocr_engine": "pytesseract",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["plate_number"] == "DL8CAF1234"
    assert body["confidence"] == 0.8  # plate_confidence stands in (C3)
    reads = client.get(f"/api/v1/observations/{body['id']}/plate-reads").json()
    assert len(reads) == 1
    assert reads[0]["plate_bbox"] == [10.0, 20.0, 30.0, 40.0]
    assert reads[0]["source"] == "pytesseract"


def test_combined_r1_r2_observation(client):
    """Case 3 + 19: the full flow — adapter → POST → PostgreSQL → GET."""
    response = client.post(
        "/api/v1/observations", json=combined(ingest_id="r1r2-combined-1")
    )
    assert response.status_code == 201
    created = response.json()
    fetched = client.get(f"/api/v1/observations/{created['id']}").json()
    for field in (
        "camera_id", "track_id", "plate_number", "vehicle_type", "confidence",
        "latitude", "longitude", "frame_id", "vehicle_bbox", "trajectory",
    ):
        assert fetched[field] == created[field]
    assert fetched["plate_number"] == "UP14AB1234"
    assert fetched["vehicle_bbox"] == [120.0, 240.0, 480.0, 610.0]
    # The vehicle exists provisionally and the journey round-trips.
    journey = client.get(f"/api/v1/vehicles/{fetched['vehicle_id']}/journey")
    assert journey.status_code == 200
    # Separate confidences preserved, never merged (C3).
    reads = client.get(f"/api/v1/observations/{fetched['id']}/plate-reads").json()
    assert len(reads) == 1
    read = reads[0]
    assert read["plate_number_raw"] == "up 14 ab 1234"
    assert read["plate_number_normalized"] == "UP14AB1234"
    assert read["confidence"] == 0.94
    assert read["ocr_confidence"] == 0.88
    assert read["detection_confidence"] == 0.97
    assert read["plate_bbox"] == [150.0, 250.0, 290.0, 270.0]
    assert read["source"] == "fast-plate-ocr"


# --- 4-7: plate edge cases -------------------------------------------------------


def test_missing_plate(client):
    """Case 4: no plate fields at all."""
    response = client.post("/api/v1/observations", json=from_r1_r2(r1_payload()))
    assert response.status_code == 201
    assert response.json()["plate_number"] is None


def test_unreadable_plate(client):
    """Case 5: OCR sentinels mean *no plate*, not a plate spelling UNREADABLE."""
    for sentinel in ("UNREADABLE", "UNKNOWN"):
        response = client.post(
            "/api/v1/observations", json=combined(plate_number=sentinel)
        )
        assert response.status_code == 201, sentinel
        body = response.json()
        assert body["plate_number"] is None
        assert body["vehicle_id"] is None
        # The attempted read is still preserved in the trail (raw text).
        reads = client.get(f"/api/v1/observations/{body['id']}/plate-reads").json()
        assert len(reads) == 1
        assert reads[0]["plate_number_normalized"] is None

    # app.py's LLM fallback emits "ERR: …" error strings — the adapter
    # drops them (schema-level normalization would 422 on the colon).
    err_payload = from_r1_r2(
        r1_payload(), r2_payload(plate_text="ERR: HTTP 429", raw_ocr_text=None)
    )
    response = client.post("/api/v1/observations", json=err_payload)
    assert response.status_code == 201
    assert response.json()["plate_number"] is None


def test_low_ocr_confidence(client):
    """Case 6: a weak read is stored, not rejected — R5's alert material."""
    response = client.post(
        "/api/v1/observations", json=combined(plate_confidence=0.21, confidence=None)
    )
    assert response.status_code == 201
    assert response.json()["confidence"] == 0.21


def test_normalized_plate(client):
    """Case 7: normalization on the frozen-contract name + raw trail."""
    response = client.post(
        "/api/v1/observations",
        json=combined(plate_number="up 14-ab.1234", raw_plate_text="up 14-ab.1234"),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["plate_number"] == "UP14AB1234"
    read = client.get(f"/api/v1/observations/{body['id']}/plate-reads").json()[0]
    assert read["plate_number_raw"] == "up 14-ab.1234"


# --- 8-9: idempotency + track scoping --------------------------------------------


def test_duplicate_ingest_id_no_duplicate_plate_read(client):
    """Case 8: replay returns the existing record, 200 not 409, and does
    not double-write the plate_reads trail."""
    first = client.post("/api/v1/observations", json=combined(ingest_id="dup-1"))
    assert first.status_code == 201
    replay = client.post("/api/v1/observations", json=combined(ingest_id="dup-1"))
    assert replay.status_code == 200
    assert replay.json()["id"] == first.json()["id"]
    reads = client.get(f"/api/v1/observations/{first.json()['id']}/plate-reads").json()
    assert len(reads) == 1


def test_same_track_id_different_cameras(client):
    """Case 9: track_id is per-camera — the same ID on two cameras is two
    distinct observations, never a collision. (Same plate → same provisional
    vehicle is CORRECT: it's the same physical vehicle.)"""
    a = client.post("/api/v1/observations", json=combined(camera_id="CAM_A"))
    b = client.post("/api/v1/observations", json=combined(camera_id="CAM_B"))
    assert a.status_code == b.status_code == 201
    assert a.json()["id"] != b.json()["id"]
    assert a.json()["vehicle_id"] == b.json()["vehicle_id"]  # same plate fused
    # Camera-scoped reads stay separate — track 17 on CAM_A is not track 17
    # on CAM_B.
    for camera_id, expected in (("CAM_A", 1), ("CAM_B", 1)):
        listed = client.get(
            "/api/v1/observations", params={"camera_id": camera_id}
        ).json()
        assert listed["total"] == expected


# --- 10-14: ML field round-trips ---------------------------------------------------


def test_trajectory_storage_retrieval(client):
    """Case 10."""
    trajectory = [[100.0, 200.0], [110.0, 205.0], [120.0, 210.0]]
    response = client.post("/api/v1/observations", json=combined(trajectory=trajectory))
    assert response.json()["trajectory"] == trajectory


def test_vehicle_bbox_round_trip(client):
    """Case 11."""
    response = client.post(
        "/api/v1/observations", json=combined(vehicle_bbox=[1, 2, 3, 4])
    )
    assert response.json()["vehicle_bbox"] == [1.0, 2.0, 3.0, 4.0]


def test_plate_bbox_round_trip(client):
    """Case 12: stored on the plate_reads trail and served by the trail endpoint."""
    response = client.post(
        "/api/v1/observations", json=combined(plate_bbox=[5, 6, 7, 8])
    )
    read = client.get(
        f"/api/v1/observations/{response.json()['id']}/plate-reads"
    ).json()[0]
    assert read["plate_bbox"] == [5.0, 6.0, 7.0, 8.0]


def test_frame_id_round_trip(client):
    """Case 13: int in, opaque string out (C5)."""
    response = client.post("/api/v1/observations", json=combined(frame_id=987654))
    assert response.json()["frame_id"] == "987654"
    response = client.post(
        "/api/v1/observations",
        json=combined(frame_id="frame_000123.jpg", timestamp=past(3).isoformat()),
    )
    assert response.json()["frame_id"] == "frame_000123.jpg"


def test_naive_timestamp_ist_to_utc(client):
    """Case 14: naive input is IST capture time, stored and returned UTC."""
    utc_capture = past(30)
    naive_ist = utc_capture.astimezone(IST).replace(tzinfo=None)
    response = client.post(
        "/api/v1/observations", json=combined(timestamp=naive_ist.isoformat())
    )
    stored = datetime.fromisoformat(response.json()["timestamp"])
    assert stored.tzinfo == UTC
    assert abs((stored - utc_capture).total_seconds()) < 1


# --- 15-17: validation guards ------------------------------------------------------


def test_invalid_confidence_still_422(client):
    """Case 15: the API stays strictly [0,1] — R2's 0-100 heuristic must go
    through the adapter (C1); a raw 85 is rejected, never rescaled."""
    response = client.post(
        "/api/v1/observations", json=combined(plate_confidence=85, confidence=None)
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_coordinates_422(client):
    """Case 16."""
    response = client.post("/api/v1/observations", json=combined(latitude=91.0))
    assert response.status_code == 422


def test_unknown_camera_created_with_coordinate_fallback(client):
    """Case 17 + C7: unknown camera auto-created; observation without GPS
    falls back to the camera row (here: none yet → null coordinates)."""
    response = client.post(
        "/api/v1/observations",
        json={
            k: v
            for k, v in combined().items()
            if k not in ("latitude", "longitude")
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["latitude"] is None and body["longitude"] is None
    camera = client.get(f"/api/v1/cameras/{body['camera_id']}").json()
    assert camera["status"] == "unregistered"

    # Once the camera is registered with coordinates, later GPS-less
    # observations inherit them (C7 fallback).
    patch = client.patch(
        f"/api/v1/cameras/{body['camera_id']}",
        json={"latitude": 19.07, "longitude": 72.87},
    )
    assert patch.status_code == 200
    later = client.post(
        "/api/v1/observations",
        json=combined(
            timestamp=past(2).isoformat(),
            latitude=None,
            longitude=None,
        ),
    )
    assert later.status_code == 201
    assert later.json()["latitude"] == 19.07
    assert later.json()["longitude"] == 72.87


# --- 18: batch ---------------------------------------------------------------------


def test_batch_ingest_frozen_contract(client):
    """Case 18: mixed frozen-contract batch, per-item results."""
    items = [
        combined(ingest_id="batch-1"),
        combined(timestamp=past(4).isoformat(), ingest_id="batch-2"),
        combined() | {"vehicle_type": "   "},  # empty vehicle_type → rejected
    ]
    response = client.post("/api/v1/observations/batch", json=items)
    assert response.status_code == 200
    body = response.json()
    assert len(body["accepted"]) == 2
    assert len(body["rejected"]) == 1
    assert body["rejected"][0]["index"] == 2
    assert "vehicle_type" in body["rejected"][0]["reason"]


# --- 20-21: schema parity + backward compatibility ----------------------------------


def test_migration_0002_columns_exist(db_engine):
    """Case 20 (schema parity): the ORM (which the migration must match)
    carries every new column. The alembic upgrade/downgrade/upgrade cycle
    itself is verified against the real database and recorded in TODO.md."""
    inspector = inspect(db_engine)
    observation_cols = {c["name"] for c in inspector.get_columns("observations")}
    assert {"frame_id", "vehicle_bbox", "trajectory", "vehicle_crop_reference"} <= observation_cols
    lat = next(c for c in inspector.get_columns("observations") if c["name"] == "latitude")
    lon = next(c for c in inspector.get_columns("observations") if c["name"] == "longitude")
    assert lat["nullable"] and lon["nullable"]
    plate_cols = {c["name"] for c in inspector.get_columns("plate_reads")}
    assert {"plate_bbox", "ocr_confidence", "detection_confidence", "source"} <= plate_cols


def test_backward_compatible_native_payload(client):
    """Case 21: the original backend-native payload (vehicle_type,
    plate_number, required coords) behaves exactly as before."""
    response = client.post(
        "/api/v1/observations",
        json={
            "camera_id": "CAM_OLD",
            "track_id": 1,
            "plate_number": "MH12AB1234",
            "timestamp": past(10).isoformat(),
            "vehicle_type": "car",
            "confidence": 0.9,
            "latitude": 19.07,
            "longitude": 72.87,
            "ingest_id": "old-style-1",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["vehicle_type"] == "car"
    assert body["plate_number"] == "MH12AB1234"
    assert body["frame_id"] is None
    assert body["vehicle_bbox"] is None
    assert body["trajectory"] is None
