import numpy as np
import pytest

from reid.similarity import cosine_similarity
from reid.vehicle_reid import VehicleReIdentifier
from analytics.traffic_analyzer import TrafficAnalyzer
from analytics.anomaly_detector import AnomalyDetector
from analytics.alerts import AlertEngine


def test_cosine_similarity_identical_vectors():
    vector = np.array([1.0, 2.0, 3.0], dtype=np.float32)
    assert cosine_similarity(vector, vector) == pytest.approx(1.0)


def test_reid_matches_similar_vehicle():
    reid = VehicleReIdentifier(threshold=0.70)
    crop1 = np.full((120, 240, 3), 100, dtype=np.uint8)
    crop2 = np.full((120, 240, 3), 101, dtype=np.uint8)

    first = reid.match(crop1, "CAM_01", "2026-09-11T10:00:00")
    second = reid.match(crop2, "CAM_02", "2026-09-11T10:00:10")

    assert first.matched is False
    assert second.matched is True
    assert second.global_id == first.global_id


def test_traffic_summary():
    rows = [
        {"camera_id": "CAM_01", "vehicle_type": "car",
         "global_vehicle_id": "NEXUS_V00001", "confidence": 0.9},
        {"camera_id": "CAM_02", "vehicle_type": "bus",
         "global_vehicle_id": "NEXUS_V00002", "confidence": 0.8},
    ]
    summary = TrafficAnalyzer().summarize(rows)
    assert summary["observation_count"] == 2
    assert summary["unique_global_vehicles"] == 2
    assert summary["avg_confidence"] == pytest.approx(0.85)


def test_low_confidence_alert():
    rows = [{"camera_id": "CAM_01", "global_vehicle_id": "NEXUS_V00001",
             "confidence": 0.2}]
    anomalies = AnomalyDetector(low_confidence_threshold=0.45).detect(rows)
    alerts = AlertEngine().from_anomalies(anomalies)
    assert len(alerts) == 1
    assert alerts[0].type == "LOW_CONFIDENCE"


def test_congestion_alert():
    alert = AlertEngine().congestion_alert("CAM_01", 35, threshold=30)
    assert alert is not None
    assert alert.type == "CONGESTION"
    assert alert.severity == "HIGH"
