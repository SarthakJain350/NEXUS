# NEXUS R5 — Re-ID + Analytics + Alerts

## Responsibility

R5 owns visual vehicle Re-ID, similarity scoring, traffic analytics and anomaly
alerts.

## Integration contract

R5 does not rename or alter the frozen observation fields. R6 may add a
`global_vehicle_id` during cross-camera fusion.

## Integration flow

```text
R1 tracking
    |
    v
vehicle crop + track_id + camera_id
    |
    v
R5 Re-ID
    |
    v
global vehicle candidate + similarity
    |
    +----> R5 analytics ----> traffic metrics
    |                         anomaly detection
    |                         alerts
    |
    v
R6 cross-camera fusion
    |
    v
backend / dashboard
```

## Why the design is modular

The current feature extractor is intentionally lightweight so the repository
works without downloading a large additional model. A learned Re-ID model can
later replace `VehicleFeatureExtractor` while keeping `VehicleReIdentifier`,
analytics and alert APIs stable.

## Testing

From the repository root:

```bash
pip install -r requirements.txt
pip install pytest
pytest -q tests/test_r5.py
python scripts/run_r5_demo.py
```
