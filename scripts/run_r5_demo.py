"""Small offline demo for the NEXUS R5 module.

Usage:
    python scripts/run_r5_demo.py

It generates synthetic vehicle crops, assigns global IDs, and runs analytics.
No external dataset is required.
"""
from __future__ import annotations

import numpy as np

from reid import VehicleReIdentifier
from analytics import TrafficAnalyzer, AnomalyDetector, AlertEngine


def main() -> None:
    reid = VehicleReIdentifier(threshold=0.78)
    observations = []

    crops = [
        np.full((160, 300, 3), 80, dtype=np.uint8),
        np.full((160, 300, 3), 82, dtype=np.uint8),
        np.full((160, 300, 3), 180, dtype=np.uint8),
    ]

    for i, crop in enumerate(crops):
        camera = ["CAM_01", "CAM_02", "CAM_01"][i]
        result = reid.match(
            crop, camera, f"2026-09-11T10:00:0{i}"
        )
        observations.append({
            "camera_id": camera,
            "track_id": i + 1,
            "global_vehicle_id": result.global_id,
            "timestamp": f"2026-09-11T10:00:0{i}",
            "vehicle_type": "car",
            "confidence": 0.92,
            "latitude": 28.60,
            "longitude": 77.20,
        })

    summary = TrafficAnalyzer().summarize(observations)
    anomalies = AnomalyDetector().detect(observations)
    alerts = AlertEngine().from_anomalies(anomalies)

    print("=== NEXUS R5 DEMO ===")
    print("Gallery size:", reid.size())
    print("Traffic summary:", summary)
    print("Anomalies:", anomalies)
    print("Alerts:", [a.to_dict() for a in alerts])


if __name__ == "__main__":
    main()
