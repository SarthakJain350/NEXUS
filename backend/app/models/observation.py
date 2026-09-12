"""Observation ORM model (Plan §4) — the main event table.

An observation = "a vehicle was detected/tracked/read at a particular
camera and time." vehicle_id is nullable at insert (R6 fuses later,
§6.4); ingest_id is the optional idempotency key (§6.2).

R1/R2 integration (2026-09-12, migration 0002): frame_id, vehicle_bbox,
trajectory and vehicle_crop_reference store the frozen NEXUSVehicle
contract's per-observation ML fields; latitude/longitude became nullable
(camera-row fallback, decision C7). vehicle_crop itself never enters the
DB — only a path/URL reference (C4).
"""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
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
    # Nullable since migration 0002 (C7): payload → camera row → null.
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    # Optional idempotency key — nullable-unique (§6.2).
    ingest_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    # --- Frozen NEXUSVehicle contract fields (migration 0002) ---------------
    # Opaque per-frame identifier from the ML pipeline (C5).
    frame_id: Mapped[str | None] = mapped_column(String(64))
    # [x1, y1, x2, y2] in frame pixels; JSONB so no awkward serialization.
    vehicle_bbox: Mapped[Optional[list[Any]]] = mapped_column(JSONB)
    # Opaque R1 trajectory array; the derivable journey stays authoritative.
    trajectory: Mapped[Optional[list[Any]]] = mapped_column(JSONB)
    # Path/URL to the crop artifact — binary crops never stored (C4).
    vehicle_crop_reference: Mapped[str | None] = mapped_column(String(512))
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

    @property
    def global_vehicle_id(self) -> str | None:
        """The linked vehicle's global identity (R6), or None when unfused.

        Exposed on ObservationRead so R4/R5 consumers can group observations
        by global vehicle without an extra join on their side.
        """
        return self.vehicle.global_vehicle_id if self.vehicle else None
