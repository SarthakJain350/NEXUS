"""Local video upload → ANPR pipeline service (demo feature, 2026-09-12).

Runs the EXISTING ``scripts/run_video_live_ingest.py`` (root CV env: YOLO
vehicle detection + ByteTrack, ONNX plate detection, Fast-Plate-OCR) on an
uploaded file and reports the observations it ingested. Deliberately
narrow: no fusion, no Re-ID, no camera assignment — uploads run against
the reserved LOCAL_UPLOAD source node, which §6.3 auto-creates as
'unregistered' with no GPS (C7: coordinate-less, so it never plots on the
GIS map). Every detection carries the real-world UTC timestamp the script
stamps at processing time.

The CV models live only in the root requirements.txt env (Plan §0 pin
conflicts), so the pipeline runs as a subprocess of the configured CV
interpreter (settings.cv_python, env CV_PYTHON).
"""

import logging
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.schemas.camera import CameraUpdate
from app.schemas.video import VideoProcessResult
from app.services import camera_service, query_service

logger = logging.getLogger("nexus.services.video")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOADS_DIR = PROJECT_ROOT / "runs" / "tracking" / "uploads"

# Reserved source node for local uploads — intentionally NOT a CAM_XX id;
# §6.3 auto-creates it 'unregistered' on the first ingested observation.
UPLOAD_CAMERA_ID = "LOCAL_UPLOAD"
ALLOWED_SUFFIXES = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB
MAX_FRAMES = 200  # ~100 processed frames at stride 2 — demo-scale runtime
SUBPROCESS_TIMEOUT_SECONDS = 600


def process_uploaded_video(db: Session, filename: str, content: bytes) -> VideoProcessResult:
    started_at = datetime.now(timezone.utc)

    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            400,
            f"unsupported file type {suffix!r}; allowed: "
            + ", ".join(sorted(ALLOWED_SUFFIXES)),
        )
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "video exceeds the upload size limit")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    stem = started_at.strftime("%Y%m%d_%H%M%S_%f")
    video_path = UPLOADS_DIR / f"upload_{stem}{suffix}"
    annotated_path = UPLOADS_DIR / f"annotated_{stem}.mp4"
    log_path = UPLOADS_DIR / f"upload_{stem}.log"
    video_path.write_bytes(content)

    cmd = [
        get_settings().cv_python,
        str(PROJECT_ROOT / "scripts" / "run_video_live_ingest.py"),
        "--video", str(video_path),
        "--camera", UPLOAD_CAMERA_ID,
        "--max-frames", str(MAX_FRAMES),
        "--stride", "2",
        "--output", str(annotated_path),
    ]
    logger.info("video upload: running %s", " ".join(cmd))
    wall_start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
    except FileNotFoundError:
        raise HTTPException(
            500,
            "CV interpreter not found — the video pipeline needs the root "
            "requirements.txt environment; set CV_PYTHON to its python.exe",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(500, "video processing timed out")
    finally:
        # Keep the script output for debugging regardless of outcome.
        try:
            log_path.write_text(
                (proc.stdout or "") + "\n--- stderr ---\n" + (proc.stderr or ""),
                encoding="utf-8",
            )
        except UnboundLocalError:  # interpreter itself missing — proc unset
            pass
        except OSError:
            pass
    elapsed = time.monotonic() - wall_start

    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or proc.stdout or "").strip().splitlines()[-10:])
        raise HTTPException(500, f"video pipeline failed (exit {proc.returncode}):\n{tail}")

    # Label the auto-created source node (best-effort; status stays
    # 'unregistered' — an uploaded file is not a physical camera, and no
    # GPS is ever fabricated).
    try:
        camera_service.update_camera(
            db,
            UPLOAD_CAMERA_ID,
            CameraUpdate(name="Uploaded Video Source", location="Local file upload (no GPS)"),
        )
    except Exception:  # noqa: BLE001 — cosmetic only
        logger.warning("could not label %s camera row", UPLOAD_CAMERA_ID, exc_info=True)

    # The script POSTs each observation itself; collect what THIS run
    # ingested (script timestamps are wall-clock UTC at detection time, so
    # timestamp >= started_at selects exactly this run's events — replays
    # of the same footage stay on their original idempotent records).
    page = query_service.camera_observations(db, UPLOAD_CAMERA_ID, page=1, page_size=200)
    detections = [o for o in page.items if o.timestamp >= started_at]

    # Machine-readable summary line printed by the script (absent for
    # older script versions — tolerate that).
    summary: dict = {}
    match = re.search(r"NEXUS_SUMMARY_JSON: (\{.*\})", proc.stdout or "")
    if match:
        try:
            summary = json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.warning("could not parse pipeline NEXUS_SUMMARY_JSON line")

    return VideoProcessResult(
        status="complete",
        filename=filename,
        source=UPLOAD_CAMERA_ID,
        elapsed_seconds=round(elapsed, 1),
        detection_count=len(detections),
        detections=detections,
        plates_read=summary.get("plates_read"),
        pipeline_ingested=summary.get("ingested"),
        pipeline_replays=summary.get("replays"),
        pipeline_failures=summary.get("failures"),
    )
