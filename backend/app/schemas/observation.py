"""Observation schemas — the frozen R1/R2 → R3 contract (Plan §3, §8).

Field names/meanings are the multi-team contract; do not rename casually.
All §3 validation rules live here so every entry point (single POST,
batch POST, future loaders) gets identical behavior.

R1/R2 integration (2026-09-12): the frozen NEXUSVehicle ML contract names
are accepted as aliases — `vehicle_class` → `vehicle_type`, `plate_text` →
`plate_number`, `raw_ocr_text` → `raw_plate_text` — so a producer can POST
either naming. Responses always use the backend-native names (R4/R5 are
verified consumers of those). Full mapping table in docs/integration.md.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

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

# OCR engines emit sentinel strings instead of a plate when they cannot
# read one (app.py's LLM fallback returns "UNREADABLE"; adapters add
# "UNKNOWN"/"INVALID"/"NOREAD"). These mean *no plate read*, not a plate
# literally spelling UNREADABLE (decision C8, docs/integration.md).
UNREADABLE_PLATE_TEXTS = frozenset({"UNREADABLE", "UNKNOWN", "INVALID", "NOREAD"})

# Allow-list with fallback (D7): R1's detector classes may evolve
# independently of the backend, so unknown types map to "other" instead of
# being rejected.
VEHICLE_TYPES = frozenset({"car", "motorcycle", "bus", "truck", "auto", "other"})


def normalize_plate(value: str | None) -> str | None:
    """Normalize a plate read: uppercase, strip whitespace/separators.

    Whitespace-only / empty input is treated as *no plate* (None), not a
    valid-but-empty plate — a common silent bug from upstream CSV/JSON
    exports (Plan §3). OCR sentinel strings (C8) also map to None.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if stripped.upper() in UNREADABLE_PLATE_TEXTS:
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


def _confidence_in_unit_range(value: float, field_name: str) -> float:
    """Strict [0,1] + finite check for every confidence-flavored field.

    Values above 1 are NOT silently rescaled here (decision C1): the API
    contract is unambiguous [0,1], and R2's 0–100 heuristic scores are
    converted only in the integration adapter so the scale of every stored
    number is provable.
    """
    if not math.isfinite(value):
        raise ValueError(f"{field_name} must be a finite number")
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{field_name} must be in [0.0, 1.0] (got {value})")
    return value


def _bbox_shape(value: Any, field_name: str) -> list[float] | None:
    """Bounding boxes are [x1, y1, x2, y2] with finite coordinates."""
    if value is None:
        return None
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise ValueError(f"{field_name} must be a list of 4 numbers [x1, y1, x2, y2]")
    coords = []
    for coord in value:
        if isinstance(coord, bool) or not isinstance(coord, (int, float)) or not math.isfinite(coord):
            raise ValueError(f"{field_name} must contain only finite numbers")
        coords.append(float(coord))
    return coords


class ObservationCreate(BaseModel):
    """A single vehicle observation from a camera pipeline (R1/R2).

    Unexpected extra fields are ignored (documented decision, Plan §14.1):
    upstream pipelines may add fields before the contract catches up.
    In particular the frozen contract's `vehicle_crop` (binary image data)
    is ignored — crops never enter PostgreSQL; use `vehicle_crop_reference`
    for a path/URL if a producer keeps crops on disk/object storage (C4).

    Frozen-contract aliases accepted on input (C2): `vehicle_class` →
    vehicle_type, `plate_text` → plate_number, `raw_ocr_text` →
    raw_plate_text. Responses use the backend-native names.
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
        validation_alias=AliasChoices("plate_number", "plate_text"),
        description=(
            "Normalized plate text, or null when ANPR failed / plate "
            "obstructed / non-plated vehicle. Normalized on ingest: "
            "uppercase, whitespace and separators stripped. OCR sentinel "
            "strings (UNREADABLE/UNKNOWN/INVALID/NOREAD) are treated as no "
            "plate. Alias: plate_text (frozen contract)."
        ),
    )
    raw_plate_text: str | None = Field(
        None,
        max_length=64,
        validation_alias=AliasChoices("raw_plate_text", "raw_ocr_text"),
        description=(
            "Raw OCR output before normalization, preserved in the "
            "plate_reads trail for OCR-quality analysis. When omitted, the "
            "pre-normalization plate_number/plate_text value is used. "
            "Alias: raw_ocr_text."
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
        validation_alias=AliasChoices("vehicle_type", "vehicle_class"),
        description=(
            "One of: car, motorcycle, bus, truck, auto, other. Unknown values "
            "are stored as 'other'. Alias: vehicle_class (frozen contract)."
        ),
    )
    confidence: float | None = Field(
        None,
        description=(
            "Detection confidence in [0.0, 1.0]. Falls back to "
            "plate_confidence when absent (the frozen contract carries no "
            "other confidence); at least one of the two is required."
        ),
    )
    latitude: float | None = Field(
        None,
        description=(
            "Latitude in decimal degrees. Optional (D13/C7): when absent, "
            "the camera row's latitude is used; if the camera has none "
            "either, null is stored. Range-checked when present."
        ),
    )
    longitude: float | None = Field(
        None,
        description=(
            "Longitude in decimal degrees. Optional (D13/C7): camera-row "
            "fallback, else null. Range-checked when present."
        ),
    )
    ingest_id: str | None = Field(
        None,
        max_length=64,
        description=(
            "Optional idempotency key (client UUID or hash of "
            "camera_id+track_id+timestamp). Strongly recommended — retries "
            "and replays with the same ingest_id return the existing record."
        ),
    )
    # --- Frozen NEXUSVehicle contract fields (R1/R2 integration, 2026-09-12)
    frame_id: int | str | None = Field(
        None,
        description=(
            "Per-frame identifier from the ML pipeline (int or short string). "
            "Informational only — timestamp+camera_id+track_id already "
            "identify the observation. Stored opaque, max 64 chars."
        ),
    )
    vehicle_bbox: list[float] | None = Field(
        None,
        description="Vehicle bounding box [x1, y1, x2, y2] in frame pixels.",
    )
    trajectory: list[Any] | None = Field(
        None,
        description=(
            "Opaque trajectory array from R1 tracking (e.g. list of [x, y] "
            "points). Stored as-is; the authoritative journey remains "
            "GET /vehicles/{id}/journey."
        ),
    )
    vehicle_crop_reference: str | None = Field(
        None,
        max_length=512,
        description=(
            "Optional path/URL to the vehicle crop artifact (never binary "
            "image data — crops stay outside PostgreSQL, decision C4)."
        ),
    )
    plate_bbox: list[float] | None = Field(
        None,
        description="Plate bounding box [x1, y1, x2, y2]; stored on the plate_reads trail.",
    )
    plate_confidence: float | None = Field(
        None,
        description=(
            "Confidence of the plate read itself, [0.0, 1.0]. Stored on the "
            "plate_reads trail; used as observation confidence when "
            "`confidence` is absent. Not merged with ocr_confidence or "
            "detection_confidence (C3)."
        ),
    )
    ocr_confidence: float | None = Field(
        None,
        description="OCR-engine-specific confidence [0.0, 1.0], when reported separately.",
    )
    detection_confidence: float | None = Field(
        None,
        description="Plate-detection confidence [0.0, 1.0], when reported separately.",
    )
    ocr_engine: str | None = Field(
        None,
        max_length=64,
        description="OCR engine/model that produced the read, e.g. 'fast-plate-ocr', 'pytesseract'.",
    )

    @model_validator(mode="before")
    @classmethod
    def _capture_raw_plate_text(cls, data: Any) -> Any:
        """Preserve the pre-normalization plate text for the plate_reads
        trail (C9) before field validators normalize plate_number."""
        if not isinstance(data, dict):
            return data
        raw = data.get("raw_plate_text", data.get("raw_ocr_text"))
        if raw is None:
            plate = data.get("plate_number", data.get("plate_text"))
            if plate is not None:
                data["raw_plate_text"] = str(plate)
        return data

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

    @field_validator("raw_plate_text")
    @classmethod
    def _raw_plate_text_stripped(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

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
    def _confidence_unit_range(cls, v: float | None) -> float | None:
        # Strict [0,1] — no silent 0–100 rescaling at the API boundary (C1);
        # NaN/Inf can leak through from numpy-sourced floats (Plan §3).
        return None if v is None else _confidence_in_unit_range(v, "confidence")

    @field_validator("plate_confidence")
    @classmethod
    def _plate_confidence_unit_range(cls, v: float | None) -> float | None:
        return None if v is None else _confidence_in_unit_range(v, "plate_confidence")

    @field_validator("ocr_confidence")
    @classmethod
    def _ocr_confidence_unit_range(cls, v: float | None) -> float | None:
        return None if v is None else _confidence_in_unit_range(v, "ocr_confidence")

    @field_validator("detection_confidence")
    @classmethod
    def _detection_confidence_unit_range(cls, v: float | None) -> float | None:
        return None if v is None else _confidence_in_unit_range(v, "detection_confidence")

    @field_validator("latitude")
    @classmethod
    def _latitude_range(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if not math.isfinite(v) or not -90.0 <= v <= 90.0:
            raise ValueError("latitude must be in [-90.0, 90.0]")
        return v

    @field_validator("longitude")
    @classmethod
    def _longitude_range(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if not math.isfinite(v) or not -180.0 <= v <= 180.0:
            raise ValueError("longitude must be in [-180.0, 180.0]")
        return v

    @field_validator("frame_id")
    @classmethod
    def _frame_id_to_str(cls, v: int | str | None) -> str | None:
        # Opaque identifier: normalize int → str so round-trips are stable
        # in the String(64) column (C5).
        if v is None:
            return None
        if isinstance(v, bool):
            raise ValueError("frame_id must be an integer or string, not a boolean")
        if isinstance(v, int):
            v = str(v)
        v = v.strip()
        if not v:
            return None
        if len(v) > 64:
            raise ValueError("frame_id must be at most 64 characters")
        return v

    @field_validator("vehicle_bbox")
    @classmethod
    def _vehicle_bbox_shape(cls, v: Any) -> list[float] | None:
        return _bbox_shape(v, "vehicle_bbox")

    @field_validator("plate_bbox")
    @classmethod
    def _plate_bbox_shape(cls, v: Any) -> list[float] | None:
        return _bbox_shape(v, "plate_bbox")

    @field_validator("trajectory")
    @classmethod
    def _trajectory_is_list(cls, v: Any) -> list[Any] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("trajectory must be a list of points")
        return v

    @field_validator("ingest_id")
    @classmethod
    def _ingest_id_blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def _resolve_confidence_and_gps(self) -> "ObservationCreate":
        # The frozen contract carries only plate_confidence; when the
        # producer sends no detection-level `confidence`, the plate read's
        # confidence stands in for it (C3) — one of the two is required.
        if self.confidence is None:
            if self.plate_confidence is None:
                raise ValueError(
                    "confidence is required (or plate_confidence, which is "
                    "used as a fallback)"
                )
            self.confidence = self.plate_confidence
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
    """Observation as returned by the API — never expose raw ORM objects.

    Field names are backend-native (R4/R5 verified consumers); the frozen
    ML-contract aliases (vehicle_class, plate_text, ...) are input-only.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int | None
    camera_id: str
    track_id: int
    plate_number: str | None
    timestamp: datetime
    vehicle_type: str
    confidence: float
    latitude: float | None
    longitude: float | None
    ingest_id: str | None
    frame_id: str | None
    vehicle_bbox: list[float] | None
    trajectory: list[Any] | None
    vehicle_crop_reference: str | None
    created_at: datetime


class JourneyPoint(BaseModel):
    """One stop in a vehicle's journey, ordered by timestamp ascending (§6.5).

    latitude/longitude are nullable (C7): observations from cameras without
    GPS data carry no coordinates; map consumers must skip those points.
    """

    model_config = ConfigDict(from_attributes=True)

    observation_id: int
    camera_id: str
    track_id: int
    plate_number: str | None
    timestamp: datetime
    vehicle_type: str
    confidence: float
    latitude: float | None
    longitude: float | None


class RejectedItem(BaseModel):
    """Why one item of a batch was rejected — batches never fail atomically (§6.7)."""

    index: int
    reason: str


class BatchIngestResult(BaseModel):
    """Per-item result for POST /observations/batch (Plan §6.7)."""

    accepted: list[ObservationRead]
    rejected: list[RejectedItem]
