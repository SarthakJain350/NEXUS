"""Schema validation tests (Plan §13 — schema tests).

Run from backend/ with the backend venv:
    pytest tests/test_schemas.py

Cannot run yet (venv pending, Phase 0.3a) — written now, executed next
session.
"""

from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas import (
    IST,
    ObservationCreate,
    normalize_plate,
)


def valid_payload(**overrides) -> dict:
    """A clean observation per the frozen contract (Plan §3)."""
    payload = {
        "camera_id": "CAM_01",
        "track_id": 17,
        "plate_number": "UP32AB1234",
        "timestamp": "2026-09-10T10:32:12+05:30",
        "vehicle_type": "car",
        "confidence": 0.94,
        "latitude": 28.60,
        "longitude": 77.20,
    }
    payload.update(overrides)
    return payload


class TestValidObservation:
    def test_valid_contract_example(self):
        obs = ObservationCreate(**valid_payload())
        assert obs.camera_id == "CAM_01"
        assert obs.track_id == 17
        assert obs.plate_number == "UP32AB1234"
        assert obs.vehicle_type == "car"

    def test_null_plate_is_valid(self):
        obs = ObservationCreate(**valid_payload(plate_number=None))
        assert obs.plate_number is None

    def test_naive_timestamp_assumed_ist_stored_utc(self):
        # 10:32:12 IST == 05:02:12 UTC (D10)
        obs = ObservationCreate(**valid_payload(timestamp="2026-09-10T10:32:12"))
        assert obs.timestamp.tzinfo is not None
        assert obs.timestamp == datetime(2026, 9, 10, 5, 2, 12, tzinfo=timezone.utc)

    def test_aware_timestamp_converted_to_utc(self):
        obs = ObservationCreate(**valid_payload(timestamp="2026-09-10T10:32:12+00:00"))
        assert obs.timestamp == datetime(2026, 9, 10, 10, 32, 12, tzinfo=timezone.utc)

    def test_ingest_id_optional(self):
        assert ObservationCreate(**valid_payload()).ingest_id is None
        obs = ObservationCreate(**valid_payload(ingest_id="abc-123"))
        assert obs.ingest_id == "abc-123"

    def test_extra_fields_ignored(self):
        obs = ObservationCreate(**valid_payload(unexpected_field="x"))
        assert not hasattr(obs, "unexpected_field")


class TestCameraId:
    def test_empty_string_rejected_distinctly(self):
        with pytest.raises(ValidationError, match="camera_id"):
            ObservationCreate(**valid_payload(camera_id=""))

    def test_whitespace_only_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(camera_id="   "))

    def test_stripped(self):
        assert ObservationCreate(**valid_payload(camera_id=" CAM_01 ")).camera_id == "CAM_01"

    def test_over_64_chars_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(camera_id="C" * 65))


class TestTrackId:
    def test_negative_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(track_id=-1))

    def test_zero_valid(self):
        assert ObservationCreate(**valid_payload(track_id=0)).track_id == 0


class TestPlateNumber:
    def test_lowercase_and_spaces_normalized(self):
        obs = ObservationCreate(**valid_payload(plate_number="up32 ab1234"))
        assert obs.plate_number == "UP32AB1234"

    def test_separators_stripped(self):
        obs = ObservationCreate(**valid_payload(plate_number="UP-32.AB_1234"))
        assert obs.plate_number == "UP32AB1234"

    def test_whitespace_only_becomes_none(self):
        obs = ObservationCreate(**valid_payload(plate_number="   "))
        assert obs.plate_number is None

    def test_too_short_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(plate_number="AB"))

    def test_too_long_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(plate_number="A" * 13))

    def test_junk_characters_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(plate_number="UP32#AB"))

    def test_normalize_plate_helper(self):
        assert normalize_plate(" up32 ab1234 ") == "UP32AB1234"
        assert normalize_plate(None) is None
        assert normalize_plate("  ") is None


class TestTimestamp:
    def test_malformed_string_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(timestamp="not-a-timestamp"))

    def test_far_future_rejected(self):
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        with pytest.raises(ValidationError, match="future"):
            ObservationCreate(**valid_payload(timestamp=future.isoformat()))

    def test_small_skew_allowed(self):
        skew = datetime.now(timezone.utc) + timedelta(minutes=2)
        obs = ObservationCreate(**valid_payload(timestamp=skew.isoformat()))
        assert obs.timestamp == skew.astimezone(timezone.utc)

    def test_pre_epoch_rejected(self):
        with pytest.raises(ValidationError, match="2020"):
            ObservationCreate(**valid_payload(timestamp="2019-06-01T10:00:00+05:30"))


class TestVehicleType:
    def test_case_and_whitespace_normalized(self):
        assert ObservationCreate(**valid_payload(vehicle_type=" Car ")).vehicle_type == "car"

    def test_unknown_falls_back_to_other(self):
        assert ObservationCreate(**valid_payload(vehicle_type="hovercraft")).vehicle_type == "other"

    def test_empty_rejected(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(vehicle_type="  "))

    @pytest.mark.parametrize("vtype", ["car", "motorcycle", "bus", "truck", "auto", "other"])
    def test_allowlist_accepted(self, vtype):
        assert ObservationCreate(**valid_payload(vehicle_type=vtype)).vehicle_type == vtype


class TestConfidence:
    @pytest.mark.parametrize("bad", [-0.1, 1.1, float("nan"), float("inf"), float("-inf")])
    def test_out_of_range_and_non_finite_rejected(self, bad):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(confidence=bad))

    def test_bounds_inclusive(self):
        assert ObservationCreate(**valid_payload(confidence=0.0)).confidence == 0.0
        assert ObservationCreate(**valid_payload(confidence=1.0)).confidence == 1.0


class TestCoordinates:
    def test_latitude_out_of_range(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(latitude=91.0))

    def test_longitude_out_of_range(self):
        with pytest.raises(ValidationError):
            ObservationCreate(**valid_payload(longitude=-200.0))

    def test_gps_sentinel_accepted(self):
        # (0.0, 0.0) is suspicious but technically valid — warn, don't reject.
        obs = ObservationCreate(**valid_payload(latitude=0.0, longitude=0.0))
        assert obs.latitude == 0.0 and obs.longitude == 0.0


class TestMissingFields:
    @pytest.mark.parametrize(
        "field",
        [
            "camera_id",
            "track_id",
            "timestamp",
            "vehicle_type",
            "confidence",
            "latitude",
            "longitude",
        ],
    )
    def test_required_fields(self, field):
        payload = valid_payload()
        del payload[field]
        with pytest.raises(ValidationError):
            ObservationCreate(**payload)
