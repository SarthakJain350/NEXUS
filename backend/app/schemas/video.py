"""Video-upload schemas (local upload → ANPR demo feature, 2026-09-12)."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.observation import ObservationRead


class VideoProcessResult(BaseModel):
    """Result of POST /videos/upload — the observations this run ingested.

    `detections` are real ObservationRead records (they also appear in the
    normal feed/ANPR queries). A re-upload of identical footage is idempotent
    per ingest_id (§6.2), so replays report zero NEW detections — the
    original events keep their original processing timestamps.
    """

    status: str
    filename: str
    source: str
    elapsed_seconds: float
    detection_count: int
    detections: list[ObservationRead]
    # From the pipeline's summary line (None if unavailable): disambiguates
    # "no plates in the clip" from "plates read but all idempotent replays".
    plates_read: int | None = None
    pipeline_ingested: int | None = None
    pipeline_replays: int | None = None
    pipeline_failures: int | None = None
