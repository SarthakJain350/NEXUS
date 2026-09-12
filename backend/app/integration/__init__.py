"""R1/R2 → R3 integration layer.

`r1r2` adapts the real ML-side outputs (root pipeline + r2_anpr) and the
frozen NEXUSVehicle contract into backend-native observation payloads.
Kept out of the FastAPI routes and services on purpose: every
producer-specific quirk (0–100 heuristic confidences, UNREADABLE/ERR
sentinels, per-camera track association) lives here and nowhere else.
"""

from app.integration.r1r2 import (
    from_r1_r2,
    from_r2_result,
    normalize_r2_confidence,
    plate_text_or_none,
)

__all__ = [
    "from_r1_r2",
    "from_r2_result",
    "normalize_r2_confidence",
    "plate_text_or_none",
]
