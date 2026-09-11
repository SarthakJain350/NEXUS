"""Observation schemas — the frozen R1/R2 → R3 contract (Plan §3, §8).

Field names/meanings are the multi-team contract; do not rename casually.
All §3 validation rules live here so every entry point (single POST,
batch POST, future loaders) gets identical behavior.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

logger = logging.getLogger("nexus.schemas.observation")

# Naive timestamps are treated as camera-local IST capture time (D10) and
# stored as UTC. Documented in api_contract.md (Phase 7).
IST = timezone(timedelta(hours=5, minutes=30))

# Reject timestamps outside this window — a broken camera clock, not real
# data (Plan §3). Far-future allows a few minutes of clock skew.
MIN_TIMESTAMP = datetime(2020, 1, 1, tzinfo=timezone.utc)
MAX_FUTURE_SKEW = timedelta(minutes=5)

# Plates are stored normalized: uppercase, separators stripped (Plan §3).
# No rigid regex — Indian plates have multiple valid formats; this is a
# plausibility range only.
PLATE_MIN_LEN = 4
PLATE_MAX_LEN = 12
PLATE_SEPARATORS = " -._"

# Allow-list with fallback (D7): R1's detector classes may evolve
# independently of the backend, so unknown types map to "other" instead of
# being rejected.
VEHICLE_TYPES = frozenset({"car", "motorcycle", "bus", "truck", "auto", "other"})


def normalize_plate(value: str | None) -> str | None:
    """Normalize a plate read: uppercase, strip whitespace/separators.

    Whitespace-only / empty input is treated as *no plate* (None), not a
    valid-but-empty plate — a common silent bug from upstream CSV/JSON
    exports (Plan §3).
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    normalized = stripped.upper()
    for sep in PLATE_SEPARATORS:
        normalized = normalized.replace(sep, "")
    if not normalized.isalnum():
        raise ValueError(
            "plate_number contains non-alphanumeric characters other than "
            f"separators {PLATE_SEPARATORS!r}"
        )
    if not PLATE_MIN_LEN <= len(normalized) <= PLATE_MAX_LEN:
        raise ValueError(
            f"plate_number must normalize to {PLATE_MIN_LEN}-{PLATE_MAX_LEN} "
            f"alphanumeric characters (got {len(normalized)})"
        )
    return normalized


class ObservationCreate(BaseModel):
    """A single vehicle observation from a camera pipeline (R1/R2).

    Unexpected extra fields are ignored (documented decision, Plan §14.1):
    upstream pipelines may add fields before the contract catches up.
    """

    model_config = ConfigDict(extra="ignore")

    camera_id: str = Field(
        ...,
        max_length=64,
        description="Identifier of the originating camera, e.g. 'CAM_01'.",
    )
    track_id: int = Field(
        ...,
        ge=0,
        description=(
            "Local tracker ID. NOT globally unique — resets per camera "
            "session; only meaningful with camera_id within a short window."
        ),
    )
    plate_number: str | None = Field(
        None,
        description=(
            "Normalized plate text, or null when ANPR failed / plate "
            "obstructed / non-plated vehicle. Normalized on ingest: "
            "uppercase, whitespace and separators stripped."
        ),
    )
    timestamp: datetime = Field(
        ...,
        description=(
            "ISO 8601 capture time. Timezone-aware strongly recommended; "
            "naive values are assumed to be camera-local IST and stored as UTC."
        ),
    )
    vehicle_type: str = Field(
        ...,
        description="One of: car, motorcycle, bus, truck, auto, other. Unknown values are stored as 'other'.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Detection/OCR confidence in [0.0, 1.0].",
    )
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees.")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees.")
    ingest_id: str | None = Field(
        None,
        max_length=64,
        description=(
            "Optional idempotency key (client UUID or hash of "
            "camera_id+track_id+timestamp). Strongly recommended — retries "
            "and replays with the same ingest_id return the existing record."
        ),
    )

    @field_validator("camera_id")
    @classmethod
    def _camera_id_not_blank(cls, v: str) -> str:
        v = v.strip()
        # Empty string rejected distinctly from None (which fails the `str`
        # type check) — Plan §3.
        if not v:
            raise ValueError("camera_id must not be empty or whitespace-only")
        return v

    @field_validator("plate_number")
    @classmethod
    def _plate_normalized(cls, v: str | None) -> str | None:
        return normalize_plate(v)

    @field_validator("timestamp")
    @classmethod
    def _timestamp_to_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            v = v.replace(tzinfo=IST)
        v = v.astimezone(timezone.utc)
        now = datetime.now(timezone.utc)
        if v > now + MAX_FUTURE_SKEW:
            raise ValueError(
                "timestamp is further in the future than allowed clock skew "
                "(5 minutes) — camera clock likely misconfigured"
            )
        if v < MIN_TIMESTAMP:
            raise ValueError(
                "timestamp is before 2020-01-01 — camera clock likely misconfigured"
            )
        return v

    @field_validator("vehicle_type")
    @classmethod
    def _vehicle_type_allowlist(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("vehicle_type must not be empty or whitespace-only")
        return v if v in VEHICLE_TYPES else "other"

    @field_validator("confidence")
    @classmethod
    def _confidence_finite(cls, v: float) -> float:
        # NaN/Inf can leak through from numpy-sourced floats serialized
        # upstream (Plan §3) — reject explicitly.
        if not math.isfinite(v):
            raise ValueError("confidence must be a finite number")
        return v

    @field_validator("ingest_id")
    @classmethod
    def _ingest_id_blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def _warn_gps_sentinel(self) -> "ObservationCreate":
        # (0.0, 0.0) is the classic uninitialized-GPS symptom: log it as a
        # data-quality warning but accept — it's technically valid ocean
        # coordinates and hard-rejecting valid input is worse (Plan §3).
        if self.latitude == 0.0 and self.longitude == 0.0:
            logger.warning(
                "Observation from camera %s has (0.0, 0.0) coordinates — "
                "possible uninitialized GPS field",
                self.camera_id,
            )
        return self


# Batch items share the exact same contract as single ingest (Plan §8).
ObservationBatchItem = ObservationCreate


class ObservationRead(BaseModel):
    """Observation as returned by the API — never expose raw ORM objects."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int | None
    camera_id: str
    track_id: int
    plate_number: str | None
    timestamp: datetime
    vehicle_type: str
    confidence: float
    latitude: float
    longitude: float
    ingest_id: str | None
    created_at: datetime


class JourneyPoint(BaseModel):
    """One stop in a vehicle's journey, ordered by timestamp ascending (§6.5)."""

    model_config = ConfigDict(from_attributes=True)

    observation_id: int
    camera_id: str
    track_id: int
    plate_number: str | None
    timestamp: datetime
    vehicle_type: str
    confidence: float
    latitude: float
    longitude: float


class RejectedItem(BaseModel):
    """Why one item of a batch was rejected — batches never fail atomically (§6.7)."""

    index: int
    reason: str


class BatchIngestResult(BaseModel):
    """Per-item result for POST /observations/batch (Plan §6.7)."""

    accepted: list[ObservationRead]
    rejected: list[RejectedItem]
