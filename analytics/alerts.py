"""Alert objects and traffic alert generation for NEXUS."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass
class Alert:
    alert_id: str
    type: str
    severity: str
    message: str
    camera_id: str | None = None
    global_vehicle_id: str | None = None
    timestamp: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AlertEngine:
    """Convert analytics/anomaly results into dashboard-ready alert records."""

    def __init__(self) -> None:
        self._counter = 1

    def _id(self) -> str:
        value = f"ALERT_{self._counter:05d}"
        self._counter += 1
        return value

    def from_anomalies(self, anomalies: list[dict[str, Any]]) -> list[Alert]:
        result = []
        for item in anomalies:
            result.append(Alert(
                alert_id=self._id(),
                type=str(item.get("type", "ANOMALY")),
                severity=str(item.get("severity", "LOW")),
                message=str(item.get("message", "NEXUS anomaly detected.")),
                camera_id=item.get("camera_id"),
                global_vehicle_id=item.get("global_vehicle_id"),
            ))
        return result

    def congestion_alert(self, camera_id: str, vehicle_count: int,
                         threshold: int = 30,
                         timestamp: str | None = None) -> Alert | None:
        if vehicle_count < threshold:
            return None
        return Alert(
            alert_id=self._id(),
            type="CONGESTION",
            severity="HIGH",
            message=(
                f"High traffic detected at {camera_id}: "
                f"{vehicle_count} vehicles in the analysis window."
            ),
            camera_id=camera_id,
            timestamp=timestamp,
        )
