"""Tests for POST /api/v1/videos/upload (local upload → ANPR feature).

The CV subprocess is faked — these tests cover validation and the
detection-collection/labelling logic, not the actual YOLO/OCR pipeline
(which needs the root CV env and real footage; rehearsed live via
docs/demo_runbook.md).
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.database.session import get_db
from app.main import app
from app.schemas.observation import ObservationCreate
from app.services import observation_service, video_service

UTC = timezone.utc


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _fake_pipeline_run(db):
    """Stand-in for subprocess.run: 'is' the CV pipeline by ingesting one
    fresh and one stale LOCAL_UPLOAD observation, exactly as the real
    script would (it POSTs observations itself while processing)."""

    def _run(cmd, **kwargs):
        now = datetime.now(UTC)
        for ts, track in ((now, 101), (now - timedelta(hours=1), 100)):
            observation_service.ingest(
                db,
                ObservationCreate(
                    camera_id="LOCAL_UPLOAD",
                    track_id=track,
                    plate_number=f"MH12T{track:04d}",
                    timestamp=ts,
                    vehicle_type="car",
                    confidence=0.9,
                    ingest_id=f"vid-LOCAL_UPLOAD-t{track}-f1",
                ),
            )
        return SimpleNamespace(
            returncode=0,
            stdout=(
                "  [Frame 016] Track #101 (car) -> Plate: MH12T0101 -> Ingested to R3 [201]\n"
                'NEXUS_SUMMARY_JSON: {"plates_read": 2, "ingested": 1, "replays": 1,'
                ' "unreadable": 0, "failures": 0, "backend_online": true}\n'
            ),
            stderr="",
        )

    return _run


def test_upload_rejects_wrong_extension(client):
    res = client.post(
        "/api/v1/videos/upload",
        files={"file": ("notes.txt", b"not a video", "text/plain")},
    )
    assert res.status_code == 400
    assert "unsupported" in res.json()["error"]["message"]


def test_upload_rejects_oversize(client, monkeypatch):
    monkeypatch.setattr(video_service, "MAX_UPLOAD_BYTES", 8)
    res = client.post(
        "/api/v1/videos/upload",
        files={"file": ("clip.mp4", b"0123456789", "video/mp4")},
    )
    assert res.status_code == 400
    assert "size limit" in res.json()["error"]["message"]


def test_upload_returns_only_this_runs_detections(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(video_service.subprocess, "run", _fake_pipeline_run(db_session))
    monkeypatch.setattr(video_service, "UPLOADS_DIR", tmp_path)

    res = client.post(
        "/api/v1/videos/upload",
        files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "complete"
    assert body["source"] == "LOCAL_UPLOAD"
    # Pipeline summary line parsed through to the response.
    assert body["plates_read"] == 2
    assert body["pipeline_ingested"] == 1
    assert body["pipeline_replays"] == 1
    # Only the detection stamped during this run — the hour-old one keeps
    # its original record but is not reported as a new detection.
    assert body["detection_count"] == 1
    det = body["detections"][0]
    assert det["camera_id"] == "LOCAL_UPLOAD"
    assert det["plate_number"] == "MH12T0101"


def test_upload_labels_the_upload_source_camera(client, db_session, monkeypatch, tmp_path):
    from sqlalchemy import select

    from app.models import Camera

    monkeypatch.setattr(video_service.subprocess, "run", _fake_pipeline_run(db_session))
    monkeypatch.setattr(video_service, "UPLOADS_DIR", tmp_path)

    res = client.post(
        "/api/v1/videos/upload",
        files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
    )
    assert res.status_code == 200
    camera = db_session.scalar(select(Camera).where(Camera.camera_id == "LOCAL_UPLOAD"))
    assert camera is not None
    assert camera.name == "Uploaded Video Source"
    # Honest virtual source: unregistered, never any fabricated GPS.
    assert camera.status == "unregistered"
    assert camera.latitude is None and camera.longitude is None
