"""
Automated unit tests for R1 Vehicle Tracking with ByteTrack.

Covers:
  - TrackedVehicle output fields
  - Track creation
  - Track ID persistence across frames
  - Track loss and occlusion recovery
  - Track removal after max_lost_frames
  - Trajectory history recording and truncation
  - Vehicle class filtering
"""

import sys
import unittest
import numpy as np
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.tracking.r1_tracker import (
    R1VehicleTracker,
    TrackedVehicle,
    TrackState,
    R1_VEHICLE_CLASSES,
)


class TestR1VehicleTracking(unittest.TestCase):

    def setUp(self):
        # Initialize tracker without loading YOLO weights for fast unit testing
        self.tracker = R1VehicleTracker(
            model_path=None,
            camera_id="cam_test",
            max_lost_frames=5,
            max_trajectory_length=4,
            match_thresh=0.5,
        )

    def test_tracked_vehicle_fields(self):
        """1. Verify TrackedVehicle contains all 9 required fields + state."""
        dummy_crop = np.zeros((50, 50, 3), dtype=np.uint8)
        vehicle = TrackedVehicle(
            camera_id="cam_01",
            frame_id=1,
            timestamp=0.033,
            track_id=42,
            bbox=[100.0, 150.0, 300.0, 400.0],
            class_name="car",
            confidence=0.92,
            vehicle_crop=dummy_crop,
            trajectory=[(200.0, 275.0)],
            state="active",
        )

        self.assertEqual(vehicle.camera_id, "cam_01")
        self.assertEqual(vehicle.frame_id, 1)
        self.assertAlmostEqual(vehicle.timestamp, 0.033)
        self.assertEqual(vehicle.track_id, 42)
        self.assertEqual(vehicle.bbox, [100.0, 150.0, 300.0, 400.0])
        self.assertEqual(vehicle.class_name, "car")
        self.assertEqual(vehicle.confidence, 0.92)
        self.assertIsNotNone(vehicle.vehicle_crop)
        self.assertEqual(vehicle.trajectory, [(200.0, 275.0)])
        self.assertEqual(vehicle.state, "active")
        self.assertTrue(vehicle.is_active)
        self.assertEqual(vehicle.center, (200.0, 275.0))

        # Test dictionary serialization
        v_dict = vehicle.to_dict()
        self.assertIn("camera_id", v_dict)
        self.assertIn("track_id", v_dict)
        self.assertIn("bbox", v_dict)
        self.assertIn("class_name", v_dict)

    def test_track_creation(self):
        """2. Verify track creation on first detection."""
        dets = [
            {"bbox": [100.0, 100.0, 200.0, 200.0], "confidence": 0.9, "class_name": "car"}
        ]
        active_tracks = self.tracker.update_with_detections(dets, frame_id=0)

        self.assertEqual(len(active_tracks), 1)
        trk = active_tracks[0]
        self.assertEqual(trk.track_id, 1)
        self.assertEqual(trk.class_name, "car")
        self.assertEqual(trk.state, TrackState.ACTIVE.value)
        self.assertEqual(trk.trajectory, [(150.0, 150.0)])
        self.assertEqual(trk.lost_count, 0)

    def test_track_id_persistence(self):
        """3. Verify track ID remains persistent across consecutive frames."""
        # Frame 0
        dets_f0 = [{"bbox": [100.0, 100.0, 200.0, 200.0], "confidence": 0.9, "class_name": "car"}]
        self.tracker.update_with_detections(dets_f0, frame_id=0)

        # Frame 1 (vehicle moves slightly right)
        dets_f1 = [{"bbox": [105.0, 100.0, 205.0, 200.0], "confidence": 0.88, "class_name": "car"}]
        active_f1 = self.tracker.update_with_detections(dets_f1, frame_id=1)

        self.assertEqual(len(active_f1), 1)
        self.assertEqual(active_f1[0].track_id, 1, "Track ID must remain persistent across frames")
        self.assertEqual(active_f1[0].bbox, [105.0, 100.0, 205.0, 200.0])

        # Frame 2 (vehicle moves slightly more)
        dets_f2 = [{"bbox": [110.0, 100.0, 210.0, 200.0], "confidence": 0.85, "class_name": "car"}]
        active_f2 = self.tracker.update_with_detections(dets_f2, frame_id=2)

        self.assertEqual(len(active_f2), 1)
        self.assertEqual(active_f2[0].track_id, 1)
        self.assertEqual(len(active_f2[0].trajectory), 3)

    def test_track_loss_and_occlusion_recovery(self):
        """4. Verify track transitions to lost during occlusion and recovers same ID upon reappearance."""
        # Frame 0: Vehicle detected
        self.tracker.update_with_detections(
            [{"bbox": [200.0, 200.0, 300.0, 300.0], "confidence": 0.95, "class_name": "motorcycle"}],
            frame_id=0
        )
        self.assertEqual(len(self.tracker.get_active_tracks()), 1)

        # Frame 1: Temporary occlusion (0 detections)
        self.tracker.update_with_detections([], frame_id=1)
        self.assertEqual(len(self.tracker.get_active_tracks()), 0)
        self.assertEqual(len(self.tracker.get_lost_tracks()), 1)
        lost_trk = self.tracker.get_track(1)
        self.assertIsNotNone(lost_trk)
        self.assertEqual(lost_trk.state, TrackState.LOST.value)
        self.assertEqual(lost_trk.lost_count, 1)

        # Frame 2: Still occluded
        self.tracker.update_with_detections([], frame_id=2)
        self.assertEqual(self.tracker.get_track(1).state, TrackState.LOST.value)
        self.assertEqual(self.tracker.get_track(1).lost_count, 2)

        # Frame 3: Vehicle emerges from occlusion at nearby position
        active_recovered = self.tracker.update_with_detections(
            [{"bbox": [205.0, 200.0, 305.0, 300.0], "confidence": 0.85, "class_name": "motorcycle"}],
            frame_id=3
        )
        self.assertEqual(len(active_recovered), 1)
        self.assertEqual(active_recovered[0].track_id, 1, "Occluded vehicle must recover its previous track ID")
        self.assertEqual(active_recovered[0].state, TrackState.ACTIVE.value)
        self.assertEqual(active_recovered[0].lost_count, 0)

    def test_track_removal(self):
        """5. Verify track transitions to removed after exceeding max_lost_frames."""
        # Max lost frames is 5 in setUp
        self.tracker.update_with_detections(
            [{"bbox": [50.0, 50.0, 150.0, 150.0], "confidence": 0.9, "class_name": "truck"}],
            frame_id=0
        )
        trk = self.tracker.get_track(1)
        self.assertEqual(trk.state, TrackState.ACTIVE.value)

        # Miss 5 frames -> state is lost
        for f in range(1, 6):
            self.tracker.update_with_detections([], frame_id=f)
            self.assertEqual(trk.state, TrackState.LOST.value)

        # Miss 6th frame -> exceeds max_lost_frames (5) -> removed
        self.tracker.update_with_detections([], frame_id=6)
        self.assertEqual(trk.state, TrackState.REMOVED.value)
        self.assertTrue(trk.is_removed)

    def test_trajectory_history_truncation(self):
        """6. Verify trajectory history accumulates centers and truncates at max_trajectory_length."""
        # max_trajectory_length is 4 in setUp
        for f in range(8):
            cx = 100.0 + f * 10.0
            self.tracker.update_with_detections(
                [{"bbox": [cx - 20, 100.0, cx + 20, 150.0], "confidence": 0.9, "class_name": "bus"}],
                frame_id=f
            )

        trk = self.tracker.get_track(1)
        self.assertEqual(len(trk.trajectory), 4, "Trajectory should be capped at max_trajectory_length=4")
        # Last center should be 100.0 + 7 * 10 = 170.0
        self.assertEqual(trk.trajectory[-1][0], 170.0)

    def test_vehicle_class_filtering(self):
        """7. Verify non-R1 classes are ignored and not tracked."""
        dets = [
            {"bbox": [10.0, 10.0, 50.0, 50.0], "confidence": 0.9, "class_name": "person"},
            {"bbox": [60.0, 60.0, 120.0, 120.0], "confidence": 0.9, "class_name": "traffic sign"},
            {"bbox": [200.0, 200.0, 300.0, 300.0], "confidence": 0.9, "class_name": "autorickshaw"},
        ]
        active_tracks = self.tracker.update_with_detections(dets, frame_id=0)

        self.assertEqual(len(active_tracks), 1)
        self.assertEqual(active_tracks[0].class_name, "autorickshaw")


if __name__ == "__main__":
    unittest.main()
