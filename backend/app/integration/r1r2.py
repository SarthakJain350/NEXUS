"""R1/R2 → R3 adapter — the frozen NEXUSVehicle contract, made real (2026-09-12).

Why this module exists
----------------------
Inspection of the *actual* ML code in this repository found:

- **R1 (vehicle detection + per-camera tracking) has not been delivered
  yet** — no ByteTrack/track_id producer exists anywhere. Until it lands,
  this adapter speaks the frozen contract so R1 can drop in without R3
  changes.
- **R2 (`r2_anpr.process_plate`)** emits
  ``{"plate_text": str, "confidence": 0-100 heuristic, "status":
  "readable"|"low_confidence"|"unreadable"}`` — a *percentage-scale
  heuristic*, not an OCR probability, with no bbox/track/camera linkage.
- The root `app.py` pipeline OCR fallback returns the literal sentinel
  ``"UNREADABLE"`` and error strings starting with ``"ERR:"``.

Every quirk is normalized here — never in routes, services or the schema
(the API contract stays strictly [0,1], decision C1).

Field mapping (frozen contract → backend)
-----------------------------------------
===========================  ==========================  ==============================
ML contract field            Backend field               Notes
===========================  ==========================  ==============================
camera_id                    camera_id                   identical
frame_id                     frame_id                    int → str, opaque (C5)
timestamp                    timestamp                   ISO 8601; naive = IST (D10)
track_id                     track_id                    per-camera only; paired with
                                                         camera_id, never used alone
vehicle_class                vehicle_type                lowercase; unknown → other (D7)
vehicle_bbox                 vehicle_bbox                [x1,y1,x2,y2], JSONB (C6)
vehicle_crop                 — (ignored)                 binary never stored (C4);
                                                         vehicle_crop_reference instead
trajectory                   trajectory                  opaque JSONB array (C6)
plate_bbox                   plate_bbox                  stored on the plate_reads trail
plate_text                   plate_number                normalized (uppercase,
                                                         separators stripped, C8)
raw_ocr_text                 raw_plate_text              pre-normalization trail (C9)
plate_confidence             plate_confidence →           [0,1] required; R2's 0–100
                             plate_reads.confidence      heuristic converted here (C1)
— (R1 detection conf)        confidence                  falls back to plate_confidence
                                                         when absent (C3)
ocr_confidence               ocr_confidence              plate_reads trail, kept
                                                         separate (C3)
detection_confidence         detection_confidence        plate_reads trail, kept
                                                         separate (C3)
latitude / longitude         latitude / longitude        optional; camera-row fallback
                                                         in the service (C7)
ingest_id                    ingest_id                   recommended idempotency key
===========================  ==========================  ==============================

R2's separate confidences are never merged silently (C3): the heuristic
score becomes ``plate_confidence``; genuine OCR and plate-detection
probabilities, when a producer reports them, keep their own fields.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("nexus.integration.r1r2")

# r2_anpr's calculate_confidence() tops out at 100 (percentage scale).
R2_HEURISTIC_MAX = 100.0

# OCR sentinel/junk strings that mean "no plate read" (C8). The schema
# handles the plain sentinels too; this layer additionally strips the
# root app.py LLM fallback's "ERR: …" error strings.
_PLATE_SENTINELS = {"UNREADABLE", "UNKNOWN", "INVALID", "NOREAD"}
_ERR_PREFIX = "ERR:"


def normalize_r2_confidence(value: Any) -> float:
    """Convert r2_anpr's 0–100 heuristic score to the backend's [0,1].

    The only scale conversion in the system (C1): the API boundary stays
    strictly [0,1], so a direct POST of ``confidence: 85`` still 422s and
    every stored number's scale is provable.
    """
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if score <= 1.0:
        return max(score, 0.0)
    if score > R2_HEURISTIC_MAX:
        logger.warning("R2 confidence %s exceeds 100 — clamping to 1.0", score)
        return 1.0
    return score / R2_HEURISTIC_MAX


def plate_text_or_none(text: Any) -> str | None:
    """Map an OCR text to a plate string, or None when unreadable.

    None/empty, the sentinel strings, and app.py's ``"ERR: …"`` fallback
    errors all mean *no plate* (C8). Non-alphanumeric junk that cannot be
    a plate is dropped rather than 422-ing the whole observation — an
    unreadable plate is a valid observation, not a bad request.
    """
    if text is None:
        return None
    text = str(text).strip()
    if not text or text.upper() in _PLATE_SENTINELS or text.upper().startswith(_ERR_PREFIX):
        return None
    cleaned = "".join(ch for ch in text.upper() if ch.isalnum())
    return cleaned or None


def from_r2_result(result: dict[str, Any], *, ocr_engine: str = "r2_anpr") -> dict[str, Any]:
    """Map one ``r2_anpr.process_plate()`` output to plate payload fields.

    Returns backend-named plate fields ready to merge into a combined
    observation payload (see ``from_r1_r2``).
    """
    text = plate_text_or_none(result.get("plate_text"))
    confidence = normalize_r2_confidence(result.get("confidence", 0))
    return {
        "plate_number": text,
        "raw_plate_text": str(result.get("plate_text") or "") or None,
        "plate_confidence": confidence,
        "ocr_engine": ocr_engine,
    }


def from_r1_r2(
    r1: dict[str, Any],
    r2: dict[str, Any] | None = None,
    *,
    ingest_id: str | None = None,
) -> dict[str, Any]:
    """Combine separate R1 and R2 objects into one observation payload.

    Association key is **camera_id + track_id** — never track_id alone
    (§6.1: track IDs reset per camera and collide across cameras). An R2
    object naming a different camera/track is an integration bug and
    raises ``ValueError`` rather than silently mis-linking plates.

    ``r2`` may be a frozen-contract R2 dict (plate_bbox, plate_text,
    plate_confidence, ...) *or* a raw ``r2_anpr.process_plate()`` result
    (detected by its ``status`` key). The returned dict uses backend field
    names and validates cleanly against ``ObservationCreate``.
    """
    if not isinstance(r1, dict) or "camera_id" not in r1 or "track_id" not in r1:
        raise ValueError("R1 payload must carry camera_id and track_id")

    combined: dict[str, Any] = {
        "camera_id": r1["camera_id"],
        "track_id": r1["track_id"],
        "timestamp": r1.get("timestamp"),
        # vehicle_class is the frozen-contract name; ObservationCreate also
        # accepts it directly, but the adapter emits the canonical name.
        "vehicle_type": r1.get("vehicle_type") or r1.get("vehicle_class"),
        "confidence": r1.get("confidence"),
        "frame_id": r1.get("frame_id"),
        "vehicle_bbox": r1.get("vehicle_bbox"),
        "trajectory": r1.get("trajectory"),
        "vehicle_crop_reference": r1.get("vehicle_crop_reference"),
        "latitude": r1.get("latitude"),
        "longitude": r1.get("longitude"),
        "ingest_id": ingest_id or r1.get("ingest_id"),
    }
    combined = {k: v for k, v in combined.items() if v is not None}

    if r2 is None:
        return combined

    # --- association check (camera_id + track_id, §6.1) ---------------------
    for key in ("camera_id", "track_id"):
        if key in r2 and r2[key] != r1[key]:
            raise ValueError(
                f"R2 object {key}={r2[key]!r} does not match R1 {key}={r1[key]!r} "
                "— plate reads must be associated via camera_id + track_id"
            )

    # --- R2 shape: raw r2_anpr result vs frozen-contract dict ---------------
    if "status" in r2 and "plate_confidence" not in r2:
        plate_fields = from_r2_result(r2)
    else:
        plate_fields = {
            "plate_number": plate_text_or_none(
                r2.get("plate_text") or r2.get("plate_number")
            ),
            "raw_plate_text": (
                r2.get("raw_ocr_text") or r2.get("raw_plate_text")
            ),
            "plate_confidence": r2.get("plate_confidence"),
            "plate_bbox": r2.get("plate_bbox"),
            "ocr_confidence": r2.get("ocr_confidence"),
            "detection_confidence": r2.get("detection_confidence"),
            "ocr_engine": r2.get("ocr_engine"),
        }
        plate_fields = {k: v for k, v in plate_fields.items() if v is not None}

    combined.update(plate_fields)
    return combined
