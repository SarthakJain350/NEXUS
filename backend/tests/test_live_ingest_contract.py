"""Live-ingest contract test — the exact payload `run_video_live_ingest.py`
posts, driven through the full HTTP → DB path.

The script itself needs the root CV env (torch/ultralytics/fast-plate-ocr)
which the backend venv deliberately excludes (Plan §0), so it cannot be
imported here. Instead this file mirrors the payload dict the script builds
(scripts/run_video_live_ingest.py, ingest_payload construction — keep the
two in sync) and asserts what TODO §10 asks for: CAM_01 ingest → vehicle /
journey / plate_reads land correctly, and a re-run replays idempotently
(the script's re-upload path depends on that).

Runs like every other suite file: nexus_test Postgres via conftest.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.database.session import get_db
from app.main import app

UTC = timezone.utc


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def script_payload(frame_idx: int, track_id: int = 3, ocr_conf: float | None = 0.97,
                   minutes_ago: float = 1.0, **overrides) -> dict:
    """Mirror of the ingest_payload dict in run_video_live_ingest.py.

    Backend-native names, per-frame ingest_id, frame_id "frame_N", the
    None-stripping filter — exactly as the script builds it. Any change to
    the script's payload shape must be reflected here (and vice versa).
    """
    payload = {
        "camera_id": "CAM_01",
        "track_id": track_id,
        "plate_number": "MH12AB1234",
        "raw_plate_text": "MH12AB1234",
        "timestamp": (datetime.now(UTC) - timedelta(minutes=minutes_ago)).isoformat(),
        "vehicle_type": "car",
        "confidence": 0.69,
        "plate_confidence": ocr_conf if ocr_conf is not None else 0.69,
        "detection_confidence": 0.69,
        "ocr_confidence": round(ocr_conf, 3) if ocr_conf is not None else None,
        "trajectory": [[120.4, 240.1], [122.8, 241.9], [125.0, 243.2]],
        "ingest_id": f"vid-CAM_01-t{track_id}-f{frame_idx}",
        "frame_id": f"frame_{frame_idx}",
        "vehicle_bbox": [120, 240, 480, 610],
        "plate_bbox": [150, 250, 290, 270],
        "ocr_engine": "fast-plate-ocr",
    }
    payload.update(overrides)
    # The script strips None values before posting (line: {k: v for ... if v is not None})
    return {k: v for k, v in payload.items() if v is not None}


class TestLiveIngestContract:
    def test_first_frame_ingests_vehicle_journey_plate_reads(self, client):
        """The script's payload → 201, plate-linked vehicle, journey point,
        and a plate_reads trail carrying the separate confidences (C3)."""
        res = client.post("/api/v1/observations", json=script_payload(frame_idx=42))
        assert res.status_code == 201, res.text
        obs = res.json()

        assert obs["camera_id"] == "CAM_01"
        assert obs["frame_id"] == "frame_42"
        assert obs["plate_number"] == "MH12AB1234"
        assert obs["trajectory"] == [[120.4, 240.1], [122.8, 241.9], [125.0, 243.2]]
        assert obs["vehicle_bbox"] == [120, 240, 480, 610]
        assert obs["confidence"] == 0.69

        # Camera auto-created as unregistered (§6.3)
        cam = client.get("/api/v1/cameras/CAM_01")
        assert cam.status_code == 200
        assert cam.json()["status"] == "unregistered"

        # Plate-linked provisional vehicle exists and the journey has the point
        vehicle_id = obs["vehicle_id"]
        assert vehicle_id is not None
        veh = client.get(f"/api/v1/vehicles/{vehicle_id}")
        assert veh.status_code == 200
        assert veh.json()["plate_number_best_guess"] == "MH12AB1234"

        journey = client.get(f"/api/v1/vehicles/{vehicle_id}/journey").json()
        assert journey["total"] == 1
        assert journey["items"][0]["observation_id"] == obs["id"]

        # plate_reads trail: raw text + the three separate confidences (C3/C9)
        reads = client.get(f"/api/v1/observations/{obs['id']}/plate-reads").json()
        assert len(reads) == 1
        read = reads[0]
        assert read["plate_number_normalized"] == "MH12AB1234"
        assert read["confidence"] == pytest.approx(0.97)
        assert read["ocr_confidence"] == pytest.approx(0.97)
        assert read["detection_confidence"] == pytest.approx(0.69)
        assert read["plate_bbox"] == [150.0, 250.0, 290.0, 270.0]
        assert read["source"] == "fast-plate-ocr"

    def test_replay_same_frame_is_idempotent(self, client):
        """The script re-run on the same video re-posts the same ingest_ids;
        the backend must return the existing record (200), never a duplicate."""
        first = client.post("/api/v1/observations", json=script_payload(frame_idx=42))
        assert first.status_code == 201

        replay = client.post("/api/v1/observations", json=script_payload(frame_idx=42))
        assert replay.status_code == 200
        assert replay.json()["id"] == first.json()["id"]

        journey = client.get(
            f"/api/v1/vehicles/{first.json()['vehicle_id']}/journey"
        ).json()
        assert journey["total"] == 1  # no duplicate row

        reads = client.get(
            f"/api/v1/observations/{first.json()['id']}/plate-reads"
        ).json()
        assert len(reads) == 1  # no duplicate trail row

    def test_next_frame_grows_journey_in_timestamp_order(self, client):
        """A later frame of the same track lands on the same vehicle and the
        journey stays timestamp-ascending (§6.5) even though it was ingested
        after — the script posts wall-clock stamps, ordering must hold."""
        f1_res = client.post("/api/v1/observations",
                             json=script_payload(frame_idx=42, minutes_ago=2.0))
        f2_res = client.post("/api/v1/observations",
                             json=script_payload(frame_idx=48, minutes_ago=1.0))
        assert f1_res.status_code == 201, f1_res.text
        assert f2_res.status_code == 201, f2_res.text
        f1, f2 = f1_res.json(), f2_res.json()

        assert f2["vehicle_id"] == f1["vehicle_id"]

        journey = client.get(f"/api/v1/vehicles/{f1['vehicle_id']}/journey").json()
        assert journey["total"] == 2
        stamps = [p["timestamp"] for p in journey["items"]]
        assert stamps == sorted(stamps)

    def test_payload_without_ocr_confidence_still_valid(self, client):
        """When char_probs are unavailable the script sends no ocr_confidence
        (stripped by the None filter) — ingest must still succeed and the
        trail's ocr_confidence stays null."""
        res = client.post("/api/v1/observations",
                          json=script_payload(frame_idx=7, ocr_conf=None))
        assert res.status_code == 201, res.text

        reads = client.get(f"/api/v1/observations/{res.json()['id']}/plate-reads").json()
        assert len(reads) == 1
        assert reads[0]["ocr_confidence"] is None
        # plate_confidence fell back to the detection confidence
        assert reads[0]["confidence"] == pytest.approx(0.69)
