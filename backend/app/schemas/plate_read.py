"""PlateRead schemas — the raw OCR trail responses (R1/R2 integration).

One observation can carry at most one plate read today (written on ingest
when plate information is present, decision C9); the list shape keeps the
door open for multi-candidate OCR trails without a schema change.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class PlateReadRead(BaseModel):
    """A raw plate read as returned by GET /observations/{id}/plate-reads."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    observation_id: int
    plate_number_raw: str
    plate_number_normalized: str | None
    confidence: float | None
    ocr_confidence: float | None
    detection_confidence: float | None
    plate_bbox: list[Any] | None
    source: str | None
    timestamp: datetime
    created_at: datetime
