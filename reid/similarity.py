"""Similarity functions used by the NEXUS R5 Re-ID module."""
from __future__ import annotations
import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return cosine similarity in the range [-1, 1]."""
    a = np.asarray(a, dtype=np.float32).reshape(-1)
    b = np.asarray(b, dtype=np.float32).reshape(-1)

    if a.size == 0 or b.size == 0 or a.size != b.size:
        raise ValueError("Feature vectors must be non-empty and have equal size.")

    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 1e-8:
        return 0.0
    return float(np.dot(a, b) / denom)


def appearance_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine distance: 0 means identical direction, 1 means orthogonal."""
    return 1.0 - cosine_similarity(a, b)
