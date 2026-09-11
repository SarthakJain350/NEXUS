"""SQLAlchemy ORM models (Plan §4, §5).

Importing all model modules here ensures Base.metadata is complete for
Alembic autogenerate and Base.metadata.create_all.
"""

from app.models.base import Base
from app.models.camera import Camera
from app.models.observation import Observation
from app.models.plate_read import PlateRead
from app.models.vehicle import Vehicle

__all__ = ["Base", "Camera", "Observation", "PlateRead", "Vehicle"]
