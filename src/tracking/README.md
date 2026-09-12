# R1 — Vehicle Detection + Per-Camera Tracking

Owner: HARSHIT. Code: `src/tracking/r1_tracker.py`,
runners: `scripts/run_r1_tracking.py` (annotated demo video) and
`scripts/run_video_live_ingest.py` (end-to-end R1→R2→R3 bridge).
Tests: `tests/test_r1_tracking.py` (7 tests, no GPU/dataset needed).

## What it does

ByteTrack multi-object tracking for the NEXUS pipeline:

- **Two-stage association** (high- and low-score detections; IoU cost,
  lapjv with greedy fallback) — the low-score second pass is what makes
  ByteTrack robust to occlusion and motion blur.
- **Persistent per-camera `track_id`** across frames (never global — pair it
  with `camera_id`; global identity is R6's job).
- **Lifecycle states** `active → lost → removed` with a lost-state buffer
  for occlusion recovery.
- **Trajectory history** — center points per frame, capped at
  `max_trajectory_length` (default 60).
- **Vehicle crops** (bounds-safe) handed downstream to R2 plate detection.
- **Vehicle-class filtering** — car, motorcycle, autorickshaw, truck, bus,
  bicycle (`R1_VEHICLE_CLASSES`).

## Vehicle detector (decision D1)

The detector is COCO-pretrained **YOLOv11n** (`models/yolo11n.pt` — classes
car/motorcycle/bus/truck; **no autorickshaw**). No custom Indian-road vehicle
model was trained; fine-tuning on the Indian Road Driving Dataset subset is
future work. The plate detector (custom, 99.49% mAP@50) is separate and is
part of R2.

## Usage

```bash
# Annotated tracking demo video -> runs/tracking/tracked_output.mp4
python scripts/run_r1_tracking.py --video data/test_video.mp4

# End-to-end live ingest into the R3 backend (needs uvicorn on :8000)
python scripts/run_video_live_ingest.py --video data/test_video.mp4 --camera CAM_01 --max-frames 200 --stride 2
```

If `--video` is missing, `run_r1_tracking.py` auto-generates a synthetic
clip from dataset images.

## API sketch

```python
from src.tracking.r1_tracker import R1VehicleTracker

tracker = R1VehicleTracker(camera_id="CAM_01")
tracked: list[TrackedVehicle] = tracker.update(detections, frame_id=42, timestamp=123.4)
# TrackedVehicle: camera_id, frame_id, timestamp, track_id, bbox [x1,y1,x2,y2],
# class_name, confidence, vehicle_crop, trajectory, state, lost_count
```

`TrackedVehicle.to_dict()` uses tracker-native names (`bbox`, `class_name`).
The live-ingest bridge posts the **backend contract** payload instead
(vehicle_bbox, vehicle_class, trajectory, plate fields, plate/ocr
confidences). Producers speaking frozen ML-contract names go through
`backend/app/integration/r1r2.py` (the documented adapter).

## Tests

```bash
python -m pytest tests/test_r1_tracking.py -q     # 7 tests, CPU-only
```

Covers two-stage association, lifecycle transitions, trajectory capping,
crop bounds safety, class filtering, and the YOLO `.track(persist=True)`
external-ID sync path.
