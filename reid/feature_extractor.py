"""Lightweight visual feature extraction for vehicle re-identification.

The extractor deliberately avoids adding a large pretrained dependency. It combines
HSV color histograms, RGB statistics, grayscale texture statistics and a compact
edge-orientation descriptor. The resulting vector is normalized and can be compared
between cameras.
"""
from __future__ import annotations

import cv2
import numpy as np


class VehicleFeatureExtractor:
    """Extract a deterministic appearance embedding from a vehicle crop."""

    def __init__(self, image_size: tuple[int, int] = (128, 256),
                 hist_bins: int = 16) -> None:
        self.image_size = image_size
        self.hist_bins = hist_bins

    @staticmethod
    def _safe_normalize(vector: np.ndarray) -> np.ndarray:
        vector = vector.astype(np.float32)
        norm = np.linalg.norm(vector)
        return vector / norm if norm > 1e-8 else vector

    def _color_features(self, image: np.ndarray) -> list[float]:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        features: list[float] = []

        # HSV histograms capture dominant vehicle colors while being fairly
        # robust to small lighting changes.
        for channel, bins, rng in (
            (0, self.hist_bins, (0, 180)),
            (1, self.hist_bins, (0, 256)),
            (2, self.hist_bins, (0, 256)),
        ):
            hist = cv2.calcHist([hsv], [channel], None, [bins], list(rng))
            hist = cv2.normalize(hist, hist).flatten()
            features.extend(hist.tolist())

        # Mean/std of RGB channels provide low-dimensional appearance cues.
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        features.extend(np.mean(rgb, axis=(0, 1)).astype(np.float32).tolist())
        features.extend(np.std(rgb, axis=(0, 1)).astype(np.float32).tolist())
        return features

    def _texture_features(self, image: np.ndarray) -> list[float]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Small normalized grayscale histogram.
        hist = cv2.calcHist([gray], [0], None, [16], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()

        # Sobel edge statistics capture coarse shape/texture.
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        magnitude = cv2.magnitude(gx, gy)
        orientation = cv2.phase(gx, gy, angleInDegrees=True)

        edge_hist, _ = np.histogram(
            orientation, bins=18, range=(0, 360),
            weights=magnitude
        )
        edge_hist = edge_hist.astype(np.float32)
        if edge_hist.sum() > 0:
            edge_hist /= edge_hist.sum()

        return hist.astype(np.float32).tolist() + edge_hist.tolist()

    def extract(self, crop_bgr: np.ndarray) -> np.ndarray:
        """Return a unit-normalized appearance feature vector."""
        if crop_bgr is None or crop_bgr.size == 0:
            raise ValueError("Vehicle crop is empty.")

        width, height = self.image_size
        image = cv2.resize(crop_bgr, (width, height), interpolation=cv2.INTER_AREA)

        # Mild illumination normalization.
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
        image = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)

        features = np.asarray(
            self._color_features(image) + self._texture_features(image),
            dtype=np.float32,
        )
        return self._safe_normalize(features)
