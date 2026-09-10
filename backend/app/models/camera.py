"""Camera ORM model (Plan §4).

status/last_seen_at let R4/R5 detect a dead or unregistered camera
instead of silently getting no data.
"""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Stable external identifier used by R1/R2 (e.g. "CAM_01"). Unique and
    # indexed; observations reference this, not the surrogate PK.
    camera_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(128))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    location: Mapped[str | None] = mapped_column(String(256))
    # active | inactive | maintenance | unregistered (§4, §6.3 auto-create)
    status: Mapped[str] = mapped_column(String(16), default="unregistered")
    # Updated on every observation from this camera (Phase 3 service).
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    observations: Mapped[list["Observation"]] = relationship(  # noqa: F821
        back_populates="camera"
    )

    def __repr__(self) -> str:
        return f"<Camera {self.camera_id} status={self.status}>"
