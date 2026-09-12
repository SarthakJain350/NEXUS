"""Online vehicle Re-ID gallery and matching logic."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import numpy as np

from .feature_extractor import VehicleFeatureExtractor
from .similarity import cosine_similarity


@dataclass
class ReIDMatch:
    global_id: str
    similarity: float
    matched: bool
    previous_camera_id: Optional[str] = None
    previous_timestamp: Optional[str] = None


@dataclass
class GalleryEntry:
    global_id: str
    feature: np.ndarray
    camera_id: str
    timestamp: str


class VehicleReIdentifier:
    """Match vehicle appearances across cameras using an in-memory gallery.

    This is a lightweight baseline intended for R5 integration. It does not
    claim biometric-grade identity. In a production system, this class can be
    swapped for a learned Re-ID embedding model without changing the public API.
    """

    def __init__(self, threshold: float = 0.78,
                 extractor: VehicleFeatureExtractor | None = None) -> None:
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("threshold must be between 0 and 1")
        self.threshold = threshold
        self.extractor = extractor or VehicleFeatureExtractor()
        self.gallery: dict[str, GalleryEntry] = {}
        self._next_id = 1

    def _new_id(self) -> str:
        value = f"NEXUS_V{self._next_id:05d}"
        self._next_id += 1
        return value

    def _best_match(self, feature: np.ndarray) -> tuple[GalleryEntry | None, float]:
        best_entry = None
        best_score = -1.0
        for entry in self.gallery.values():
            score = cosine_similarity(feature, entry.feature)
            if score > best_score:
                best_entry, best_score = entry, score
        return best_entry, best_score

    def match(self, vehicle_crop_bgr: np.ndarray, camera_id: str,
              timestamp: str) -> ReIDMatch:
        """Assign a global vehicle ID to a crop."""
        feature = self.extractor.extract(vehicle_crop_bgr)
        entry, score = self._best_match(feature)

        if entry is not None and score >= self.threshold:
            # Exponential-style feature update via a simple moving average.
            updated = 0.7 * entry.feature + 0.3 * feature
            updated /= max(np.linalg.norm(updated), 1e-8)
            self.gallery[entry.global_id] = GalleryEntry(
                entry.global_id, updated.astype(np.float32),
                camera_id, timestamp
            )
            return ReIDMatch(
                entry.global_id, float(score), True,
                entry.camera_id, entry.timestamp
            )

        global_id = self._new_id()
        self.gallery[global_id] = GalleryEntry(
            global_id, feature, camera_id, timestamp
        )
        return ReIDMatch(global_id, float(max(score, 0.0)), False)

    def reset(self) -> None:
        self.gallery.clear()
        self._next_id = 1

    def size(self) -> int:
        return len(self.gallery)
