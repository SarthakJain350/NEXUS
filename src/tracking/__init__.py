"""
R1 Tracking Package for NEXUS Vehicle Tracking Pipeline.
"""

from .r1_tracker import (
    R1VehicleTracker,
    TrackedVehicle,
    TrackState,
    R1_VEHICLE_CLASSES,
)

__all__ = [
    "R1VehicleTracker",
    "TrackedVehicle",
    "TrackState",
    "R1_VEHICLE_CLASSES",
]
