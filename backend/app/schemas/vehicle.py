"""Vehicle schemas (Plan §8).

`global_vehicle_id` stays null until R6's fusion assigns one — a vehicle
can exist purely as "one or more observations not yet fused" (Plan §6.4).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    global_vehicle_id: str | None
    plate_number_best_guess: str | None
    vehicle_type: str
    created_at: datetime
    updated_at: datetime
    observation_count: int = 0  # populated by the service layer (Phase 3)


class VehicleUpdate(BaseModel):
    """R6 fusion write target — provisional body per D6.

    Only `global_vehicle_id` for now; extended once R6's real fusion
    output shape is confirmed (Plan §15).
    """

    model_config = ConfigDict(extra="forbid")

    global_vehicle_id: str = Field(..., min_length=1, max_length=64)
