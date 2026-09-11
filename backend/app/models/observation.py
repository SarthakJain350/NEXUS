"""Observation ORM model (Plan §4) — the main event table.

An observation = "a vehicle was detected/tracked/read at a particular
camera and time." vehicle_id is nullable at insert (R6 fuses later,
§6.4); ingest_id is the optional idempotency key (§6.2).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Observation(Base):
    __tablename__ = "observations"
    # Composite index for journey queries: out-of-order inserts must still
    # return timestamp-sorted journeys at query time (§6.5).
    __table_args__ = (
        Index("ix_observations_vehicle_timestamp", "vehicle_id", "timestamp"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Nullable until R6 fusion associates a global identity (§6.4).
    vehicle_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("vehicles.id"), index=True
    )
    camera_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("cameras.camera_id"), index=True
    )
    # Local tracker ID — NOT globally unique, resets per camera session
    # (§6.1). Never a lookup key on its own.
    track_id: Mapped[int]
    # Normalized (uppercase, separators stripped) or null.
    plate_number: Mapped[str | None] = mapped_column(String(16), index=True)
    # Camera-reported capture time, stored UTC (§6.6: server receipt time
    # is created_at, kept separate so clock skew stays diagnosable).
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    vehicle_type: Mapped[str] = mapped_column(String(16))
    confidence: Mapped[float] = mapped_column(Float)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    # Optional idempotency key — nullable-unique (§6.2).
    ingest_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    camera: Mapped["Camera"] = relationship(back_populates="observations")  # noqa: F821
    vehicle: Mapped[Optional["Vehicle"]] = relationship(  # noqa: F821
        back_populates="observations"
    )
    plate_reads: Mapped[list["PlateRead"]] = relationship(  # noqa: F821
        back_populates="observation"
    )

    def __repr__(self) -> str:
        return (
            f"<Observation id={self.id} camera={self.camera_id} "
            f"track={self.track_id} at {self.timestamp}>"
        )
