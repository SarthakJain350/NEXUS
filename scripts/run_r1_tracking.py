"""
Demo script for R1 Vehicle Detection and ByteTrack Tracking.

Runs:
  - Loads trained YOLO11n weights (runs/detect/r1_vehicle_model/weights/best.pt)
  - Reads a local test video (default: data/test_video.mp4)
  - Tracks vehicles using ByteTrack
  - Renders bounding boxes, persistent track IDs, and trajectory trails
  - Saves annotated video under runs/tracking/tracked_output.mp4
"""

import argparse
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import sys
import time
from pathlib import Path
from typing import Optional
import cv2
import numpy as np

# Ensure NEXUS project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.tracking.r1_tracker import R1VehicleTracker, TrackedVehicle, R1_VEHICLE_CLASSES


def get_track_color(track_id: int) -> tuple:
    """Generate a distinct, consistent BGR color for a given track ID."""
    np.random.seed(track_id * 17)
    color = np.random.randint(50, 255, size=3).tolist()
    return (int(color[0]), int(color[1]), int(color[2]))


def generate_demo_video(output_video_path: Path, num_frames: int = 60, fps: int = 20) -> bool:
    """
    Generate a demo test video using available road images when no video is provided.
    Simulates smooth panning/motion across road scene frames.
    """
    img_dir = PROJECT_ROOT / "data" / "indian_road_yolo" / "images" / "val"
    if not img_dir.exists():
        img_dir = PROJECT_ROOT / "data" / "indian_road_subset" / "images"
    if not img_dir.exists():
        img_dir = PROJECT_ROOT / "runs" / "detect" / "NEXUS_Local" / "RTX4060_Uniform_v1"

    images = sorted(list(img_dir.glob("*.jpg")))
    if not images:
        return False

    print(f"Generating synthetic test video at: {output_video_path}")
    output_video_path.parent.mkdir(parents=True, exist_ok=True)

    # Use first few images
    sample_images = [cv2.imread(str(p)) for p in images[:4] if cv2.imread(str(p)) is not None]
    if not sample_images:
        return False

    base_h, base_w = sample_images[0].shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_video_path), fourcc, fps, (base_w, base_h))

    frames_per_img = num_frames // len(sample_images)
    for img in sample_images:
        resized = cv2.resize(img, (base_w, base_h))
        for _ in range(frames_per_img):
            writer.write(resized)

    writer.release()
    print(f"Sample test video generated successfully ({num_frames} frames).\n")
    return True


def draw_tracking_overlays(frame: np.ndarray, tracks: list, frame_id: int) -> np.ndarray:
    """Render bounding boxes, persistent IDs, and trajectory trails onto frame."""
    annotated = frame.copy()

    for trk in tracks:
        color = get_track_color(trk.track_id)
        x1, y1, x2, y2 = [int(round(c)) for c in trk.bbox]

        # Draw bounding box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

        # Draw trajectory lines (smooth trail of past centers)
        if len(trk.trajectory) > 1:
            pts = np.array([[int(pt[0]), int(pt[1])] for pt in trk.trajectory], np.int32)
            pts = pts.reshape((-1, 1, 2))
            cv2.polylines(annotated, [pts], isClosed=False, color=color, thickness=2)

        # Draw track ID and class label
        label = f"ID #{trk.track_id} {trk.class_name} {trk.confidence:.2f}"
        (label_w, label_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)

        # Label background badge
        badge_y1 = max(0, y1 - label_h - 8)
        badge_y2 = y1
        badge_x2 = min(annotated.shape[1], x1 + label_w + 8)
        cv2.rectangle(annotated, (x1, badge_y1), (badge_x2, badge_y2), color, -1)

        # Label text (white or dark depending on brightness)
        cv2.putText(
            annotated,
            label,
            (x1 + 4, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

    # Top HUD banner
    banner_text = f"NEXUS R1 ByteTrack | Frame: {frame_id:04d} | Active Tracks: {len(tracks)}"
    cv2.rectangle(annotated, (10, 10), (520, 45), (20, 20, 20), -1)
    cv2.rectangle(annotated, (10, 10), (520, 45), (0, 200, 255), 1)
    cv2.putText(
        annotated,
        banner_text,
        (20, 34),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 255, 200),
        2,
        cv2.LINE_AA,
    )

    return annotated


def run_r1_tracking(
    model_path: str = "runs/detect/r1_vehicle_model/weights/best.pt",
    video_path: str = "data/test_video.mp4",
    output_path: str = "runs/tracking/tracked_output.mp4",
    conf_thresh: float = 0.25,
    max_frames: Optional[int] = None,
):
    project_root = Path(__file__).resolve().parent.parent
    model_file = Path(model_path)
    if not model_file.is_absolute():
        model_file = project_root / model_file

    video_file = Path(video_path)
    if not video_file.is_absolute():
        video_file = project_root / video_file

    output_file = Path(output_path)
    if not output_file.is_absolute():
        output_file = project_root / output_file

    output_file.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("NEXUS R1 VEHICLE TRACKING (ByteTrack)")
    print("=" * 65)
    print(f"Model weights:  {model_file}")
    print(f"Input video:    {video_file}")
    print(f"Output video:   {output_file}")
    print(f"Conf threshold: {conf_thresh}\n")

    # 1. Verify model exists
    if not model_file.exists():
        fallback_model = project_root / "models" / "yolo11n.pt"
        if fallback_model.exists():
            print(f"[NEXUS] Notice: Model {model_file} not found, falling back to: {fallback_model}\n")
            model_file = fallback_model
        else:
            print(f"Error: Model weights not found at: {model_file}", file=sys.stderr)
            sys.exit(1)

    # 14. Check if test video exists, otherwise provide clear instructions
    if not video_file.exists():
        print("!" * 65)
        print("[NOTICE: TEST VIDEO NOT FOUND]")
        print(f"  Expected video location: {video_file}")
        print("  To test your own footage, place any standard road video file at:")
        print(f"    {video_file}")
        print("  or specify your path via:")
        print(f"    python scripts/run_r1_tracking.py --video <path_to_video>")
        print("!" * 65)
        print("  Creating a sample demonstration video to test the pipeline now...\n")

        success = generate_demo_video(video_file, num_frames=60, fps=15)
        if not success:
            print("Error: Could not automatically generate sample video.", file=sys.stderr)
            sys.exit(1)

    # Initialize tracker
    tracker = R1VehicleTracker(
        model_path=str(model_file),
        camera_id="traffic_cam_01",
        conf_thresh=conf_thresh,
        max_lost_frames=30,
        max_trajectory_length=60,
    )

    cap = cv2.VideoCapture(str(video_file))
    if not cap.isOpened():
        print(f"Error: Unable to open video: {video_file}", file=sys.stderr)
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0 or np.isnan(fps):
        fps = 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_file), fourcc, fps, (width, height))

    print(f"Processing video ({width}x{height} @ {fps:.1f} FPS, {total_frames} total frames)...")

    frame_idx = 0
    all_seen_track_ids = set()
    start_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = float(frame_idx) / fps

        # 4. Frame-by-frame tracking
        active_tracks = tracker.update(frame, frame_id=frame_idx, timestamp=timestamp)

        for trk in active_tracks:
            all_seen_track_ids.add(trk.track_id)

        # 13. Draw boxes, IDs, and trajectory lines
        annotated_frame = draw_tracking_overlays(frame, active_tracks, frame_idx)
        writer.write(annotated_frame)

        frame_idx += 1
        if frame_idx % 15 == 0 or frame_idx == total_frames:
            print(f"  Frame [{frame_idx:04d}/{total_frames}] -> Active tracks: {len(active_tracks)}")

        if max_frames is not None and frame_idx >= max_frames:
            print(f"Reached max frame limit of {max_frames}.")
            break

    cap.release()
    writer.release()

    elapsed = time.time() - start_time
    avg_fps = frame_idx / elapsed if elapsed > 0 else 0

    print("\n" + "=" * 65)
    print("TRACKING COMPLETED SUCCESSFULLY!")
    print("=" * 65)
    print(f"- Processed frames:        {frame_idx}")
    print(f"- Unique vehicles tracked: {len(all_seen_track_ids)}")
    print(f"- Processing speed:        {avg_fps:.1f} FPS ({elapsed:.2f}s total)")
    print(f"- Output video saved to:   {output_file}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NEXUS R1 Vehicle Tracking Demo")
    parser.add_argument("--model", type=str, default="runs/detect/r1_vehicle_model/weights/best.pt")
    parser.add_argument("--video", type=str, default="data/test_video.mp4")
    parser.add_argument("--output", type=str, default="runs/tracking/tracked_output.mp4")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--max-frames", type=int, default=None)
    args = parser.parse_args()

    run_r1_tracking(
        model_path=args.model,
        video_path=args.video,
        output_path=args.output,
        conf_thresh=args.conf,
        max_frames=args.max_frames,
    )
