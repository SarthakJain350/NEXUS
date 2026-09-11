"""
R1 Vehicle Tracker with ByteTrack for NEXUS Vehicle Tracking Pipeline.

Implements:
  - ByteTrack multi-object tracking
  - Persistent track IDs across frames
  - Track lifecycle states: 'active', 'lost', 'removed'
  - Trajectory history recording
  - Occlusion handling via ByteTrack low-score association & lost-state buffer
  - Standardized TrackedVehicle data representation
  - Filtering for R1 vehicle classes
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import cv2


class TrackState(str, Enum):
    ACTIVE = "active"
    LOST = "lost"
    REMOVED = "removed"


# 6. Track only the vehicle classes used by R1
R1_VEHICLE_CLASSES = {
    "car",
    "motorcycle",
    "autorickshaw",
    "truck",
    "bus",
    "vehicle fallback",
    "bicycle",
}


@dataclass
class TrackedVehicle:
    """Standardized representation of a tracked vehicle in the R1 pipeline."""
    camera_id: str
    frame_id: int
    timestamp: float
    track_id: int
    bbox: List[float]  # [x1, y1, x2, y2]
    class_name: str
    confidence: float
    vehicle_crop: Optional[np.ndarray] = None
    trajectory: List[Tuple[float, float]] = field(default_factory=list)
    state: str = TrackState.ACTIVE.value
    lost_count: int = 0

    @property
    def center(self) -> Tuple[float, float]:
        """Return center point (cx, cy) of the bounding box."""
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    @property
    def is_active(self) -> bool:
        return self.state == TrackState.ACTIVE.value

    @property
    def is_lost(self) -> bool:
        return self.state == TrackState.LOST.value

    @property
    def is_removed(self) -> bool:
        return self.state == TrackState.REMOVED.value

    def to_dict(self) -> dict:
        return {
            "camera_id": self.camera_id,
            "frame_id": self.frame_id,
            "timestamp": self.timestamp,
            "track_id": self.track_id,
            "bbox": [round(float(c), 2) for c in self.bbox],
            "class_name": self.class_name,
            "confidence": round(float(self.confidence), 4),
            "state": self.state,
            "trajectory_length": len(self.trajectory),
        }

    def __repr__(self) -> str:
        return (
            f"TrackedVehicle(id={self.track_id}, class='{self.class_name}', "
            f"conf={self.confidence:.2f}, state='{self.state}', "
            f"bbox={[round(c, 1) for c in self.bbox]}, traj_pts={len(self.trajectory)})"
        )


def compute_iou_matrix(boxes_a: np.ndarray, boxes_b: np.ndarray) -> np.ndarray:
    """Compute IoU matrix between two sets of bounding boxes [x1, y1, x2, y2]."""
    if len(boxes_a) == 0 or len(boxes_b) == 0:
        return np.zeros((len(boxes_a), len(boxes_b)), dtype=np.float32)

    boxes_a = np.asarray(boxes_a, dtype=np.float32)
    boxes_b = np.asarray(boxes_b, dtype=np.float32)

    area_a = (boxes_a[:, 2] - boxes_a[:, 0]) * (boxes_a[:, 3] - boxes_a[:, 1])
    area_b = (boxes_b[:, 2] - boxes_b[:, 0]) * (boxes_b[:, 3] - boxes_b[:, 1])

    xx1 = np.maximum(boxes_a[:, None, 0], boxes_b[None, :, 0])
    yy1 = np.maximum(boxes_a[:, None, 1], boxes_b[None, :, 1])
    xx2 = np.minimum(boxes_a[:, None, 2], boxes_b[None, :, 2])
    yy2 = np.minimum(boxes_a[:, None, 3], boxes_b[None, :, 3])

    w = np.maximum(0.0, xx2 - xx1)
    h = np.maximum(0.0, yy2 - yy1)
    inter = w * h

    union = area_a[:, None] + area_b[None, :] - inter
    union = np.maximum(union, 1e-6)

    return inter / union


def linear_assignment(cost_matrix: np.ndarray, cost_limit: float = 0.5):
    """Solve linear sum assignment using lapjv or greedy fallback."""
    if cost_matrix.size == 0:
        return np.empty((0, 2), dtype=int), tuple(range(cost_matrix.shape[0])), tuple(range(cost_matrix.shape[1]))

    try:
        import lap
        _, x, y = lap.lapjv(cost_matrix, extend_cost=True, cost_limit=cost_limit)
        matches = []
        for ix, mx in enumerate(x):
            if mx >= 0:
                matches.append([ix, mx])
        unmatched_a = np.where(x < 0)[0]
        unmatched_b = np.where(y < 0)[0]
        return np.asarray(matches, dtype=int).reshape(-1, 2), unmatched_a, unmatched_b
    except Exception:
        # Robust greedy matching fallback
        matched_a, matched_b = set(), set()
        matches = []
        cost_copy = cost_matrix.copy()

        for _ in range(min(cost_matrix.shape)):
            min_val = np.min(cost_copy)
            if min_val > cost_limit:
                break
            i, j = np.unravel_index(np.argmin(cost_copy), cost_copy.shape)
            matches.append([i, j])
            matched_a.add(i)
            matched_b.add(j)
            cost_copy[i, :] = 1e9
            cost_copy[:, j] = 1e9

        unmatched_a = [i for i in range(cost_matrix.shape[0]) if i not in matched_a]
        unmatched_b = [j for j in range(cost_matrix.shape[1]) if j not in matched_b]
        return np.asarray(matches, dtype=int).reshape(-1, 2), unmatched_a, unmatched_b


class R1VehicleTracker:
    """
    R1 Vehicle Tracker using ByteTrack multi-object tracking.
    
    Supports:
      - YOLO11n detection integration
      - Video frame-by-frame processing
      - Persistent track ID assignment
      - Track lifecycle management: active, lost, removed
      - Occlusion recovery via ByteTrack 2-stage association
      - Trajectory history maintenance
      - Vehicle image patch cropping
    """

    def __init__(
        self,
        model_path: Optional[str] = "runs/detect/r1_vehicle_model/weights/best.pt",
        camera_id: str = "cam_01",
        conf_thresh: float = 0.25,
        track_high_thresh: float = 0.5,
        track_low_thresh: float = 0.1,
        max_lost_frames: int = 30,
        max_trajectory_length: int = 60,
        match_thresh: float = 0.8,
        device: Optional[str] = None,
    ):
        self.model_path = model_path
        self.camera_id = camera_id
        self.conf_thresh = conf_thresh
        self.track_high_thresh = track_high_thresh
        self.track_low_thresh = track_low_thresh
        self.max_lost_frames = max_lost_frames
        self.max_trajectory_length = max_trajectory_length
        self.match_thresh = match_thresh
        self.device = device

        # Model instance
        self.model = None
        if model_path is not None:
            self._load_model()

        # Track registry: track_id -> TrackedVehicle
        self.tracks: Dict[int, TrackedVehicle] = {}
        self._next_id: int = 1

    def _load_model(self):
        """Load YOLO model if path provided."""
        from ultralytics import YOLO
        import torch

        if self.device is None:
            self.device = 0 if torch.cuda.is_available() else "cpu"

        print(f"R1VehicleTracker: Loading detector from {self.model_path} (device: {self.device})...")
        self.model = YOLO(self.model_path)

    def _crop_vehicle(self, frame: Optional[np.ndarray], bbox: List[float]) -> Optional[np.ndarray]:
        """Safely crop vehicle region from frame."""
        if frame is None or frame.size == 0:
            return None
        h, w = frame.shape[:2]
        x1 = max(0, min(w - 1, int(round(bbox[0]))))
        y1 = max(0, min(h - 1, int(round(bbox[1]))))
        x2 = max(0, min(w, int(round(bbox[2]))))
        y2 = max(0, min(h, int(round(bbox[3]))))
        if x2 > x1 and y2 > y1:
            return frame[y1:y2, x1:x2].copy()
        return None

    def update_with_detections(
        self,
        detections: List[dict],
        frame: Optional[np.ndarray] = None,
        frame_id: int = 0,
        timestamp: Optional[float] = None,
    ) -> List[TrackedVehicle]:
        """
        Update tracker using raw detection dictionaries.
        
        Each detection dict should contain:
          - 'bbox': [x1, y1, x2, y2]
          - 'confidence': float
          - 'class_name': str
          
        Implements ByteTrack 2-stage association with track lifecycle & occlusion handling.
        """
        if timestamp is None:
            timestamp = float(frame_id) / 30.0

        # Filter for R1 vehicle classes
        valid_dets = [
            d for d in detections
            if d.get("class_name") in R1_VEHICLE_CLASSES
        ]

        # 1. Partition detections into high score and low score
        det_high = [d for d in valid_dets if d.get("confidence", 0.0) >= self.track_high_thresh]
        det_low = [
            d for d in valid_dets
            if self.track_low_thresh <= d.get("confidence", 0.0) < self.track_high_thresh
        ]

        # Get existing track candidates (active and lost)
        candidate_ids = [
            tid for tid, trk in self.tracks.items()
            if trk.state in (TrackState.ACTIVE.value, TrackState.LOST.value)
        ]
        candidate_tracks = [self.tracks[tid] for tid in candidate_ids]

        # First association: candidate tracks vs high-score detections
        matched_tracks_1 = []
        unmatched_track_indices_1 = list(range(len(candidate_tracks)))
        unmatched_det_high_indices = list(range(len(det_high)))

        if len(candidate_tracks) > 0 and len(det_high) > 0:
            track_boxes = np.array([trk.bbox for trk in candidate_tracks], dtype=np.float32)
            det_boxes_high = np.array([d["bbox"] for d in det_high], dtype=np.float32)
            iou_matrix = compute_iou_matrix(track_boxes, det_boxes_high)
            cost_matrix = 1.0 - iou_matrix

            matches, u_tracks, u_dets = linear_assignment(cost_matrix, cost_limit=1.0 - self.match_thresh)
            matched_tracks_1 = matches
            unmatched_track_indices_1 = list(u_tracks)
            unmatched_det_high_indices = list(u_dets)

        # Second association: remaining unmatched tracks vs low-score detections (Occlusion recovery!)
        remaining_track_indices = unmatched_track_indices_1
        matched_tracks_2 = []
        unmatched_track_indices_final = remaining_track_indices

        if len(remaining_track_indices) > 0 and len(det_low) > 0:
            rem_tracks = [candidate_tracks[i] for i in remaining_track_indices]
            track_boxes_rem = np.array([trk.bbox for trk in rem_tracks], dtype=np.float32)
            det_boxes_low = np.array([d["bbox"] for d in det_low], dtype=np.float32)
            iou_matrix_low = compute_iou_matrix(track_boxes_rem, det_boxes_low)
            cost_matrix_low = 1.0 - iou_matrix_low

            matches_low, u_tracks_low, _ = linear_assignment(cost_matrix_low, cost_limit=0.5)
            # Map back to candidate_tracks indices
            for m in matches_low:
                trk_idx = remaining_track_indices[m[0]]
                det_idx = m[1]
                matched_tracks_2.append((trk_idx, det_idx))
            unmatched_track_indices_final = [remaining_track_indices[i] for i in u_tracks_low]

        updated_track_ids = set()

        # Update stage 1 matches
        for trk_idx, det_idx in matched_tracks_1:
            track = candidate_tracks[trk_idx]
            det = det_high[det_idx]
            self._update_track_matched(track, det, frame, frame_id, timestamp)
            updated_track_ids.add(track.track_id)

        # Update stage 2 matches (recovered through low confidence / occlusion)
        for trk_idx, det_idx in matched_tracks_2:
            track = candidate_tracks[trk_idx]
            det = det_low[det_idx]
            self._update_track_matched(track, det, frame, frame_id, timestamp)
            updated_track_ids.add(track.track_id)

        # Initialize new tracks for unmatched high-confidence detections
        for det_idx in unmatched_det_high_indices:
            det = det_high[det_idx]
            new_track = self._create_new_track(det, frame, frame_id, timestamp)
            self.tracks[new_track.track_id] = new_track
            updated_track_ids.add(new_track.track_id)

        # 7 & 8. Lifecycle updates for unmatched tracks (active -> lost -> removed)
        for trk_idx in unmatched_track_indices_final:
            track = candidate_tracks[trk_idx]
            track.lost_count += 1
            track.frame_id = frame_id
            track.timestamp = timestamp

            if track.lost_count <= self.max_lost_frames:
                # 8. Mark as LOST rather than immediately removing (handles occlusion!)
                track.state = TrackState.LOST.value
            else:
                # Exceeded max occlusion frames -> REMOVED
                track.state = TrackState.REMOVED.value

        return self.get_active_tracks()

    def _update_track_matched(
        self,
        track: TrackedVehicle,
        det: dict,
        frame: Optional[np.ndarray],
        frame_id: int,
        timestamp: float,
    ):
        """Update an existing track upon successful detection match."""
        track.bbox = [float(c) for c in det["bbox"]]
        track.class_name = det.get("class_name", track.class_name)
        track.confidence = float(det.get("confidence", track.confidence))
        track.frame_id = frame_id
        track.timestamp = timestamp
        track.state = TrackState.ACTIVE.value
        track.lost_count = 0

        # Update trajectory history
        cx = (track.bbox[0] + track.bbox[2]) / 2.0
        cy = (track.bbox[1] + track.bbox[3]) / 2.0
        track.trajectory.append((cx, cy))
        if len(track.trajectory) > self.max_trajectory_length:
            track.trajectory.pop(0)

        # Update vehicle crop
        if frame is not None:
            track.vehicle_crop = self._crop_vehicle(frame, track.bbox)

    def _create_new_track(
        self,
        det: dict,
        frame: Optional[np.ndarray],
        frame_id: int,
        timestamp: float,
    ) -> TrackedVehicle:
        """Create a new active TrackedVehicle."""
        tid = self._next_id
        self._next_id += 1

        bbox = [float(c) for c in det["bbox"]]
        cx = (bbox[0] + bbox[2]) / 2.0
        cy = (bbox[1] + bbox[3]) / 2.0

        vehicle_crop = self._crop_vehicle(frame, bbox) if frame is not None else None

        return TrackedVehicle(
            camera_id=self.camera_id,
            frame_id=frame_id,
            timestamp=timestamp,
            track_id=tid,
            bbox=bbox,
            class_name=det.get("class_name", "car"),
            confidence=float(det.get("confidence", 1.0)),
            vehicle_crop=vehicle_crop,
            trajectory=[(cx, cy)],
            state=TrackState.ACTIVE.value,
            lost_count=0,
        )

    def update(
        self,
        frame: np.ndarray,
        frame_id: int = 0,
        timestamp: Optional[float] = None,
    ) -> List[TrackedVehicle]:
        """
        Process a single video frame with YOLO detector and ByteTrack.
        
        Args:
          frame: numpy BGR image array
          frame_id: sequential frame index
          timestamp: optional timestamp in seconds
        """
        if self.model is None:
            raise RuntimeError("YOLO model not loaded in R1VehicleTracker.")

        if timestamp is None:
            timestamp = float(frame_id) / 30.0

        # Run YOLO with ByteTrack tracker
        results = self.model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
            conf=self.conf_thresh,
            device=self.device,
            verbose=False,
        )

        detections = []
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                class_name = self.model.names.get(cls_id, f"class_{cls_id}")
                conf = float(boxes.conf[i].item())
                xyxy = boxes.xyxy[i].cpu().numpy().tolist()

                # If ByteTrack already assigned an ID via YOLO tracker
                track_id = int(boxes.id[i].item()) if boxes.id is not None and len(boxes.id) > i and boxes.id[i] is not None else None

                detections.append({
                    "bbox": xyxy,
                    "confidence": conf,
                    "class_name": class_name,
                    "external_track_id": track_id,
                })

        # Process detections with lifecycle and trajectory management
        return self._sync_yolo_tracks(detections, frame, frame_id, timestamp)

    def _sync_yolo_tracks(
        self,
        detections: List[dict],
        frame: np.ndarray,
        frame_id: int,
        timestamp: float,
    ) -> List[TrackedVehicle]:
        """Synchronize YOLO ByteTrack detections with lifecycle state & trajectory."""
        current_seen_ids = set()

        for det in detections:
            cname = det["class_name"]
            if cname not in R1_VEHICLE_CLASSES:
                continue

            tid = det.get("external_track_id")
            if tid is None:
                # Fallback to internal ID assignment if external ID is missing
                tid = self._next_id
                self._next_id += 1

            bbox = [float(c) for c in det["bbox"]]
            conf = float(det["confidence"])
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = (bbox[1] + bbox[3]) / 2.0

            if tid in self.tracks:
                trk = self.tracks[tid]
                trk.bbox = bbox
                trk.class_name = cname
                trk.confidence = conf
                trk.frame_id = frame_id
                trk.timestamp = timestamp
                trk.state = TrackState.ACTIVE.value
                trk.lost_count = 0
                trk.trajectory.append((cx, cy))
                if len(trk.trajectory) > self.max_trajectory_length:
                    trk.trajectory.pop(0)
                trk.vehicle_crop = self._crop_vehicle(frame, bbox)
            else:
                new_trk = TrackedVehicle(
                    camera_id=self.camera_id,
                    frame_id=frame_id,
                    timestamp=timestamp,
                    track_id=tid,
                    bbox=bbox,
                    class_name=cname,
                    confidence=conf,
                    vehicle_crop=self._crop_vehicle(frame, bbox),
                    trajectory=[(cx, cy)],
                    state=TrackState.ACTIVE.value,
                    lost_count=0,
                )
                self.tracks[tid] = new_trk

            current_seen_ids.add(tid)

        # Update lifecycle states for missing tracks
        for tid, trk in list(self.tracks.items()):
            if tid not in current_seen_ids:
                trk.lost_count += 1
                trk.frame_id = frame_id
                trk.timestamp = timestamp
                if trk.lost_count <= self.max_lost_frames:
                    trk.state = TrackState.LOST.value
                else:
                    trk.state = TrackState.REMOVED.value

        return self.get_active_tracks()

    def get_active_tracks(self) -> List[TrackedVehicle]:
        """Return all currently active tracks."""
        return [t for t in self.tracks.values() if t.state == TrackState.ACTIVE.value]

    def get_lost_tracks(self) -> List[TrackedVehicle]:
        """Return all currently lost (occluded) tracks."""
        return [t for t in self.tracks.values() if t.state == TrackState.LOST.value]

    def get_all_tracks(self) -> List[TrackedVehicle]:
        """Return all registered tracks across all lifecycle states."""
        return list(self.tracks.values())

    def get_track(self, track_id: int) -> Optional[TrackedVehicle]:
        """Retrieve a specific track by its ID."""
        return self.tracks.get(track_id)

    def reset(self):
        """Reset internal tracker state."""
        self.tracks.clear()
        self._next_id = 1
