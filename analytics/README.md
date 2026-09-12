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

## Integration with R3 (2026-09-12)

- Feed these modules with rows from `GET /api/v1/observations` — the field
  names match exactly and consumption is defensive (`.get()`), so rows work
  as-is.
- `latitude`/`longitude` are **nullable** since the R1/R2 contract
  integration (observations from GPS-less cameras carry null coordinates) —
  treat missing coordinates as "unknown position".
- `GET /api/v1/observations/{id}/plate-reads` exposes the raw OCR trail
  (pre-normalization text, separate OCR/detection confidences, engine tag)
  for OCR-quality analysis.
- Offline demo: `python scripts/run_r5_demo.py`.
