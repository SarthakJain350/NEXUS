"""Video-upload endpoint (local upload → ANPR demo feature, 2026-09-12).

Thin router: validation + subprocess orchestration live in
app.services.video_service so the endpoint stays consistent with the rest
of the API's service-backed routers.
"""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.video import VideoProcessResult
from app.services import video_service

logger = logging.getLogger("nexus.api.videos")

router = APIRouter(prefix="/api/v1/videos", tags=["videos"])


@router.post("/upload", response_model=VideoProcessResult)
def upload_video(
    file: UploadFile = File(..., description="Local video file (.mp4/.avi/.mov/.mkv/.webm, max 200 MB)"),
    db: Session = Depends(get_db),
) -> VideoProcessResult:
    """Run the existing R1+R2 ANPR pipeline (YOLO + ByteTrack + ONNX plate
    detection + Fast-Plate-OCR) on an uploaded video and ingest every
    detection to R3 against the reserved LOCAL_UPLOAD source node.

    Each detection is stored with the real-world UTC timestamp at which it
    was processed (not the video-relative frame time). Re-uploading the
    same footage is idempotent (§6.2 ingest_id) and reports zero new
    detections. This endpoint blocks until the pipeline finishes
    (typically 30–90 s for a demo clip).
    """
    if not file.filename:
        raise HTTPException(400, "file has no name")
    content = file.file.read(video_service.MAX_UPLOAD_BYTES + 1)
    try:
        return video_service.process_uploaded_video(db, file.filename, content)
    finally:
        file.file.close()
