"""Camera schemas (Plan §4, §6.3, §8).

`status`/`last_seen_at` let R4/R5 detect a dead or unregistered camera
instead of silently getting no data (Plan §4).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import CAMERA_STATUSES

CameraStatus = Literal[
    "active", "inactive", "maintenance", "unregistered"
]


class CameraRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    camera_id: str
    name: str | None
    latitude: float | None
    longitude: float | None
    location: str | None
    status: CameraStatus
    last_seen_at: datetime | None
    created_at: datetime


class CameraUpdate(BaseModel):
    """PATCH /cameras/{camera_id} — fill in or correct camera details.

    Used by admins/R4 to flesh out cameras that were auto-created as
    'unregistered' by incoming observations (Plan §6.3). camera_id itself
    is not updatable.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(None, min_length=1, max_length=128)
    latitude: float | None = Field(None, ge=-90.0, le=90.0)
    longitude: float | None = Field(None, ge=-180.0, le=180.0)
    location: str | None = Field(None, min_length=1, max_length=256)
    status: CameraStatus | None = None
