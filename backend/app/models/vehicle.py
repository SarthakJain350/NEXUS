"""Vehicle ORM model (Plan §4).

A vehicle can exist purely as "one or more observations not yet fused":
global_vehicle_id stays null until R6's fusion assigns one (§6.4), and
plate_number_best_guess is null when no plate has ever been read.
"""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Null until R6 fusion assigns one. Nullable-unique: Postgres allows
    # multiple NULLs under a unique index.
    global_vehicle_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True
    )
    # Most-recent/most-confident known plate; nullable, never assumed present.
    plate_number_best_guess: Mapped[str | None] = mapped_column(String(16), index=True)
    vehicle_type: Mapped[str] = mapped_column(String(16), default="other")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    observations: Mapped[list["Observation"]] = relationship(  # noqa: F821
        back_populates="vehicle"
    )

    def __repr__(self) -> str:
        return f"<Vehicle {self.global_vehicle_id or f'id={self.id} (unfused)'}>"
