"""PlateRead ORM model (Plan §4, adopted per D5).

Raw OCR trail: keeps the unnormalized OCR output next to the normalized
plate for later OCR-quality analysis.

R1/R2 integration (2026-09-12, migration 0002): plate_bbox plus separate
ocr_confidence/detection_confidence columns (never merged — C3) and a
source tag for the OCR engine that produced the read. Rows are written on
every ingest that carries plate information (C9).
"""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PlateRead(Base):
    __tablename__ = "plate_reads"

    id: Mapped[int] = mapped_column(primary_key=True)
    observation_id: Mapped[int] = mapped_column(
        ForeignKey("observations.id"), index=True
    )
    plate_number_raw: Mapped[str] = mapped_column(String(64))
    plate_number_normalized: Mapped[str | None] = mapped_column(String(16))
    # Combined/read-level confidence from the producer, [0,1].
    confidence: Mapped[float | None] = mapped_column(Float)
    # Separate OCR vs plate-detection confidences, when reported (C3).
    ocr_confidence: Mapped[Optional[float]] = mapped_column(Float)
    detection_confidence: Mapped[Optional[float]] = mapped_column(Float)
    # Plate bounding box [x1, y1, x2, y2].
    plate_bbox: Mapped[Optional[list[Any]]] = mapped_column(JSONB)
    # OCR engine/model tag, e.g. 'fast-plate-ocr', 'pytesseract'.
    source: Mapped[str | None] = mapped_column(String(64))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    observation: Mapped["Observation"] = relationship(  # noqa: F821
        back_populates="plate_reads"
    )

    def __repr__(self) -> str:
        return f"<PlateRead {self.plate_number_raw!r} conf={self.confidence}>"
