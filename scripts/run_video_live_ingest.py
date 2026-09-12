"""
NEXUS End-to-End Video Ingestion & Tracking Demo.

Connects R1 (Vehicle Tracking / ByteTrack) + R2 (ANPR & Fast-Plate-OCR) + R3 (FastAPI / PostgreSQL Backend).

Usage:
    python scripts/run_video_live_ingest.py --video data/test_video.mp4 --camera CAM_01 --max-frames 60
    python scripts/run_video_live_ingest.py --video path/to/your_road_video.mp4 --camera CAM_02
"""

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import sys
import time
import argparse
import json
import re
from pathlib import Path
from datetime import datetime, timezone
import cv2
import numpy as np
import requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.tracking.r1_tracker import R1VehicleTracker
from fast_plate_ocr import LicensePlateRecognizer
from ultralytics import YOLO

# R1 detector class name -> backend vehicle_type allow-list value
# (backend/app/schemas/observation.py: car/motorcycle/bus/truck/auto/other).
VEHICLE_TYPE_MAP = {
    "car": "car",
    "motorcycle": "motorcycle",
    "bus": "bus",
    "truck": "truck",
    "autorickshaw": "auto",
    "bicycle": "other",
    "vehicle fallback": "other",
}

def main():
    parser = argparse.ArgumentParser(description="NEXUS End-to-End Video Live Ingestion")
    parser.add_argument("--video", type=str, default="data/test_video.mp4", help="Path to input video")
    parser.add_argument("--camera", type=str, default="CAM_01", help="Camera ID (e.g. CAM_01..CAM_08)")
    parser.add_argument("--api-url", type=str, default="http://localhost:8000/api/v1", help="NEXUS Backend API base URL")
    parser.add_argument("--output", type=str, default="runs/tracking/live_ingest_output.mp4", help="Annotated video output path")
    parser.add_argument("--max-frames", type=int, default=500, help="Max frames to process (default: 500, set 0 for full video)")
    parser.add_argument("--stride", type=int, default=2, help="Frame stride (process every Nth frame to accelerate CPU inference, default: 2)")
    parser.add_argument("--show", action="store_true", help="Display live OpenCV window during processing")
    args = parser.parse_args()

    video_path = Path(args.video)
    if not video_path.is_absolute():
        video_path = PROJECT_ROOT / video_path

    if not video_path.exists():
        print(f"[NEXUS] Video file not found at: {video_path}")
        print("[NEXUS] Generating sample test video from available road frames...")
        from scripts.run_r1_tracking import generate_demo_video
        generate_demo_video(video_path, num_frames=60, fps=15)

    print("=" * 70)
    print("🚗 NEXUS END-TO-END VIDEO INFERENCE & LIVE BACKEND INGESTION")
    print("=" * 70)
    print(f"Camera Node   : {args.camera}")
    print(f"Input Video   : {video_path}")
    print(f"Backend API   : {args.api_url}")
    print(f"Max Frames    : {args.max_frames}")
    print("-" * 70)

    # 1. Verify Backend Health
    backend_online = False
    try:
        health_res = requests.get(f"{args.api_url}/health/ready", timeout=3)
        if health_res.status_code == 200:
            backend_online = True
            print("✅ NEXUS R3 Backend is ONLINE and Database is CONNECTED.")
        else:
            print(f"⚠️  Backend responded with status {health_res.status_code}. Telemetry may fail.")
    except Exception as e:
        print(f"⚠️  Could not connect to backend at {args.api_url}: {e}")
        print("   Proceeding in local video-inference mode without backend ingestion.")

    # 2. Load Models
    print("\n[1/3] Loading YOLO11 Vehicle Tracker...")
    yolo_model_path = PROJECT_ROOT / "models" / "yolo11n.pt"
    tracker = R1VehicleTracker(
        model_path=str(yolo_model_path),
        camera_id=args.camera,
        conf_thresh=0.25,
        max_lost_frames=30,
    )

    print("[2/3] Loading ONNX License Plate Detector...")
    plate_model_path = PROJECT_ROOT / "models" / "best.onnx"
    if not plate_model_path.exists():
        plate_model_path = PROJECT_ROOT / "models" / "best.pt"
    plate_detector = YOLO(str(plate_model_path), task="detect")

    print("[3/3] Loading Fast-Plate-OCR Engine...")
    ocr_engine = LicensePlateRecognizer("cct-s-v2-global-model")
    print("✅ All AI models loaded successfully.\n")

    # 3. Open Video
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error: Cannot open video {video_path}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 20.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    output_path = PROJECT_ROOT / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    print(f"Processing video stream: {width}x{height} @ {fps:.1f} FPS (total frames: {total_frames})...")
    print("-" * 70)

    frame_idx = 0
    total_ingested = 0
    total_plates = 0
    ingest_failures = 0
    unreadable_plates = 0
    plate_seen_per_track = {}
    start_time = time.time()

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Fast stride skipping on CPU
        if args.stride > 1 and (frame_idx % args.stride != 0):
            frame_idx += 1
            continue

        timestamp_sec = float(frame_idx) / fps
        active_tracks = tracker.update(frame, frame_id=frame_idx, timestamp=timestamp_sec)
        annotated = frame.copy()

        # Detect plates across full frame with high sensitivity
        full_frame_plates = []
        try:
            p_res_full = plate_detector.predict(source=frame, conf=0.15, verbose=False)[0]
            for pb in p_res_full.boxes:
                fpx1, fpy1, fpx2, fpy2 = map(int, pb.xyxy[0])
                full_frame_plates.append((fpx1, fpy1, fpx2, fpy2, float(pb.conf[0])))
        except Exception:
            pass

        # HUD Overlay
        cv2.putText(annotated, f"NEXUS Node: {args.camera} | Frame: {frame_idx}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.putText(annotated, f"Active Tracks: {len(active_tracks)} | Ingested: {total_ingested}", (20, 75),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 100), 2)

        for trk in active_tracks:
            x1, y1, x2, y2 = map(int, trk.bbox)
            track_id = trk.track_id
            # Map R1 detector classes onto the backend vehicle_type allow-list
            # (car/motorcycle/bus/truck/auto/other — backend maps unknowns to
            # 'other' too, but we never mislabel an unknown vehicle as 'car').
            vtype = VEHICLE_TYPE_MAP.get(trk.class_name, "other")

            # Draw vehicle box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 140, 0), 2)
            cv2.putText(annotated, f"ID:{track_id} {vtype.upper()}", (x1, max(20, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 140, 0), 2)

            # Match with full-frame plate detections or crop detection
            best_plate_crop = None
            best_pconf = 0.0
            best_pbox = None

            # First check full-frame detections overlapping vehicle bbox
            for fpx1, fpy1, fpx2, fpy2, fpconf in full_frame_plates:
                cx, cy = (fpx1 + fpx2) / 2, (fpy1 + fpy2) / 2
                if x1 <= cx <= x2 and y1 <= cy <= y2:
                    pc = frame[max(0, fpy1):min(height, fpy2), max(0, fpx1):min(width, fpx2)]
                    if pc.size > 0 and fpconf > best_pconf:
                        best_plate_crop = pc
                        best_pconf = fpconf
                        best_pbox = [fpx1, fpy1, fpx2, fpy2]

            # Fallback to vehicle crop detection if needed
            if best_plate_crop is None:
                vcrop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
                if vcrop.size > 0:
                    plate_res = plate_detector.predict(source=vcrop, conf=0.15, verbose=False)
                    p_boxes = plate_res[0].boxes
                    if len(p_boxes) > 0:
                        first_box = p_boxes[0]
                        px1, py1, px2, py2 = map(int, first_box.xyxy[0])
                        best_pconf = float(first_box.conf[0])
                        best_plate_crop = vcrop[max(0, py1):min(vcrop.shape[0], py2), max(0, px1):min(vcrop.shape[1], px2)]
                        best_pbox = [x1 + px1, y1 + py1, x1 + px2, y1 + py2]

            # Perform OCR if plate detected
            if best_plate_crop is not None and best_plate_crop.size > 0:
                cv2.rectangle(annotated, (best_pbox[0], best_pbox[1]), (best_pbox[2], best_pbox[3]), (0, 255, 0), 2)
                should_ocr = (track_id not in plate_seen_per_track) or (frame_idx % 6 == 0)
                if should_ocr:
                    try:
                        # return_confidence=True -> PlatePrediction.char_probs
                        # (per-character softmax scores, [0,1]).
                        ocr_preds = ocr_engine.run(best_plate_crop, return_confidence=True)
                        raw_text = ""
                        ocr_conf = None
                        if isinstance(ocr_preds, list) and len(ocr_preds) > 0:
                            first_pred = ocr_preds[0]
                            raw_text = str(getattr(first_pred, "plate", "") or "")
                            char_probs = getattr(first_pred, "char_probs", None)
                            if char_probs is not None:
                                ocr_conf = float(np.mean(char_probs))

                        clean_plate = re.sub(r"[^A-Z0-9]", "", raw_text.upper())
                        if len(clean_plate) >= 4:
                            total_plates += 1
                            plate_seen_per_track[track_id] = clean_plate

                            # Full NEXUS observation contract payload
                            # (backend/app/schemas/observation.py). raw_ocr_text
                            # keeps the PRE-normalization OCR output for the
                            # plate_reads trail; plate_confidence prefers the
                            # OCR text confidence, falling back to detection.
                            plate_conf = ocr_conf if ocr_conf is not None else best_pconf
                            ingest_payload = {
                                "camera_id": args.camera,
                                "track_id": track_id,
                                "plate_number": clean_plate,
                                "raw_plate_text": raw_text or clean_plate,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "vehicle_type": vtype,
                                "confidence": round(best_pconf, 3),
                                "plate_confidence": round(plate_conf, 3),
                                "detection_confidence": round(best_pconf, 3),
                                "ocr_confidence": round(ocr_conf, 3) if ocr_conf is not None else None,
                                "trajectory": [[round(px, 1), round(py, 1)] for px, py in trk.trajectory],
                                "ingest_id": f"vid-{args.camera}-t{track_id}-f{frame_idx}",
                                "frame_id": f"frame_{frame_idx}",
                                "vehicle_bbox": [x1, y1, x2, y2],
                                "plate_bbox": best_pbox,
                                "ocr_engine": "fast-plate-ocr",
                            }
                            ingest_payload = {k: v for k, v in ingest_payload.items() if v is not None}

                            if backend_online:
                                try:
                                    res = requests.post(
                                        f"{args.api_url}/observations",
                                        json=ingest_payload,
                                        timeout=3,
                                    )
                                    if res.status_code in (200, 201):
                                        total_ingested += 1
                                        ocr_txt = f", ocr {ocr_conf:.0%}" if ocr_conf is not None else ""
                                        print(f"  [Frame {frame_idx:03d}] Track #{track_id} ({vtype}) -> "
                                              f"Plate: {clean_plate} (det {best_pconf:.0%}{ocr_txt}) "
                                              f"-> Ingested to R3 [{res.status_code}]")
                                    else:
                                        ingest_failures += 1
                                        print(f"  [WARN] Ingest rejected [{res.status_code}] track #{track_id}: "
                                              f"{res.text[:120]}")
                                except requests.RequestException as exc:
                                    ingest_failures += 1
                                    print(f"  [WARN] Ingest failed for track #{track_id}: {exc}")
                        else:
                            unreadable_plates += 1
                    except Exception as exc:
                        ingest_failures += 1
                        print(f"  [WARN] OCR/ingest error on track #{track_id}: {exc}")

            # Render plate tag on overlay if known
            if track_id in plate_seen_per_track:
                plate_text = plate_seen_per_track[track_id]
                cv2.rectangle(annotated, (x1, y2 - 25), (x1 + 160, y2), (0, 255, 80), -1)
                cv2.putText(annotated, plate_text, (x1 + 5, y2 - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

        writer.write(annotated)

        if args.show:
            cv2.imshow("NEXUS Video Live Ingest", annotated)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        frame_idx += 1
        if args.max_frames and args.max_frames > 0 and frame_idx >= args.max_frames:
            break

    cap.release()
    writer.release()
    if args.show:
        cv2.destroyAllWindows()

    elapsed = time.time() - start_time
    avg_fps = frame_idx / elapsed if elapsed > 0 else 0

    print("\n" + "=" * 70)
    print("🎉 VIDEO INGESTION SESSION COMPLETE")
    print("=" * 70)
    print(f"Processed Frames        : {frame_idx}")
    print(f"Elapsed Time            : {elapsed:.2f} seconds ({avg_fps:.1f} FPS)")
    print(f"Plates Read             : {total_plates}")
    print(f"  Unreadable (<4 chars) : {unreadable_plates}")
    print(f"Ingested to R3          : {total_ingested}")
    print(f"Ingest Failures         : {ingest_failures}")
    print(f"Annotated Video Saved   : {output_path}")
    if not backend_online:
        print("NOTE: backend was offline - nothing was ingested.")
    if ingest_failures > 0:
        print(f"WARNING: {ingest_failures} failures occurred - check the warnings above / backend logs.")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
