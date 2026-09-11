"""Rule-based anomaly detection for NEXUS traffic observations."""
from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Any


class AnomalyDetector:
    """Detect operationally useful anomalies without requiring a new ML model."""

    def __init__(self, low_confidence_threshold: float = 0.45,
                 repeated_observation_limit: int = 20) -> None:
        self.low_confidence_threshold = low_confidence_threshold
        self.repeated_observation_limit = repeated_observation_limit

    def detect(self, observations: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
        rows = list(observations)
        alerts: list[dict[str, Any]] = []

        by_vehicle = defaultdict(list)
        for row in rows:
            gid = row.get("global_vehicle_id")
            if gid:
                by_vehicle[gid].append(row)

            try:
                confidence = float(row.get("confidence", 1.0))
            except (TypeError, ValueError):
                confidence = 0.0

            if confidence < self.low_confidence_threshold:
                alerts.append({
                    "type": "LOW_CONFIDENCE",
                    "severity": "MEDIUM",
                    "message": (
                        f"Low-confidence observation ({confidence:.2f}) "
                        f"at {row.get('camera_id', 'unknown')}."
                    ),
                    "camera_id": row.get("camera_id"),
                    "global_vehicle_id": gid,
                })

        for gid, vehicle_rows in by_vehicle.items():
            if len(vehicle_rows) > self.repeated_observation_limit:
                alerts.append({
                    "type": "EXCESSIVE_REPETITION",
                    "severity": "LOW",
                    "message": (
                        f"Vehicle {gid} generated {len(vehicle_rows)} "
                        "observations in the supplied window."
                    ),
                    "global_vehicle_id": gid,
                })

        return alerts
