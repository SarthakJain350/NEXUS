"""Traffic analytics over NEXUS observation records."""
from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Iterable, Any


class TrafficAnalyzer:
    """Aggregate observations into traffic and vehicle-flow metrics."""

    def summarize(self, observations: Iterable[dict[str, Any]]) -> dict[str, Any]:
        rows = list(observations)
        if not rows:
            return {
                "observation_count": 0,
                "unique_global_vehicles": 0,
                "vehicles_by_type": {},
                "vehicles_by_camera": {},
                "traffic_level": "LOW",
                "avg_confidence": 0.0,
            }

        global_ids = {
            r.get("global_vehicle_id") for r in rows
            if r.get("global_vehicle_id")
        }
        types = Counter(r.get("vehicle_type", "unknown") for r in rows)
        cameras = Counter(r.get("camera_id", "unknown") for r in rows)

        confidences = []
        for r in rows:
            try:
                confidences.append(float(r.get("confidence", 0.0)))
            except (TypeError, ValueError):
                pass

        count = len(global_ids) or len(rows)
        if count >= 30:
            level = "HIGH"
        elif count >= 10:
            level = "MEDIUM"
        else:
            level = "LOW"

        return {
            "observation_count": len(rows),
            "unique_global_vehicles": len(global_ids),
            "vehicles_by_type": dict(types),
            "vehicles_by_camera": dict(cameras),
            "traffic_level": level,
            "avg_confidence": round(
                sum(confidences) / len(confidences), 4
            ) if confidences else 0.0,
        }

    def camera_flow(self, observations: Iterable[dict[str, Any]]) -> dict[str, int]:
        """Count observations per camera, useful for dashboard charts."""
        return dict(Counter(
            r.get("camera_id", "unknown") for r in observations
        ))
