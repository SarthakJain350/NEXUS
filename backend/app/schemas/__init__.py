"""Pydantic request/response schemas (Plan §3, §8).

Contract summary:
- ObservationCreate/ObservationBatchItem — ingest payload (frozen field names)
- ObservationRead, JourneyPoint — observation responses
- VehicleRead, VehicleUpdate — vehicle responses / R6 fusion write
- CameraRead, CameraUpdate — camera responses / admin PATCH
- BatchIngestResult — per-item batch result (§6.7)
"""

from app.schemas.camera import CameraRead, CameraStatus, CameraUpdate
from app.schemas.common import (
    CAMERA_STATUSES,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
)
from app.schemas.observation import (
    BatchIngestResult,
    IST,
    JourneyPoint,
    ObservationBatchItem,
    ObservationCreate,
    ObservationRead,
    RejectedItem,
    VEHICLE_TYPES,
    normalize_plate,
)
from app.schemas.plate_read import PlateReadRead
from app.schemas.vehicle import VehicleRead, VehicleUpdate

__all__ = [
    "CAMERA_STATUSES",
    "CameraRead",
    "CameraStatus",
    "CameraUpdate",
    "DEFAULT_PAGE_SIZE",
    "IST",
    "MAX_PAGE_SIZE",
    "BatchIngestResult",
    "JourneyPoint",
    "ObservationBatchItem",
    "ObservationCreate",
    "ObservationRead",
    "PlateReadRead",
    "RejectedItem",
    "VEHICLE_TYPES",
    "VehicleRead",
    "VehicleUpdate",
    "normalize_plate",
]
