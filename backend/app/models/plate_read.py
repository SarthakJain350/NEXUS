"""PlateRead ORM model (Plan §4, adopted per D5).

Raw OCR trail: keeps the unnormalized OCR output next to the normalized
plate for later OCR-quality analysis.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
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
    confidence: Mapped[float | None] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    observation: Mapped["Observation"] = relationship(  # noqa: F821
        back_populates="plate_reads"
    )

    def __repr__(self) -> str:
        return f"<PlateRead {self.plate_number_raw!r} conf={self.confidence}>"
