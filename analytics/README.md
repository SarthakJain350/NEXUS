# NEXUS R5 — Analytics & Alerts

Analytics consumes the team's observation JSON records.

## Current capabilities

1. Vehicle/camera flow counts.
2. Unique global vehicle counts.
3. Traffic level classification.
4. Average confidence.
5. Low-confidence detection alerts.
6. Excessive repeated-observation alerts.
7. Congestion alerts.

The modules are dependency-light and can be called from the backend later.

## Common observation fields

The implementation accepts the frozen NEXUS fields:

`camera_id`, `track_id`, `plate_number`, `timestamp`, `vehicle_type`,
`confidence`, `latitude`, `longitude`.

It additionally recognizes `global_vehicle_id` when R6 fusion is available.
