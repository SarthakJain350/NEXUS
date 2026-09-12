"""Seed script for NEXUS R3 database.
Populates realistic cameras, vehicles, and observations along the Mumbai-Pune corridor.
"""

from datetime import datetime, timedelta, timezone
from app.database.session import SessionLocal
from app.models import Camera, Vehicle, Observation
from app.schemas.observation import ObservationCreate
from app.services import observation_service

CAMERAS_DATA = [
    {
        "camera_id": "CAM_01",
        "name": "Bandra-Worli Sea Link North Plaza",
        "latitude": 19.0368,
        "longitude": 72.8172,
        "location": "Bandra West, Mumbai",
        "status": "active",
    },
    {
        "camera_id": "CAM_02",
        "name": "Worli Seaface South Junction",
        "latitude": 19.0125,
        "longitude": 72.8152,
        "location": "Worli, Mumbai",
        "status": "active",
    },
    {
        "camera_id": "CAM_03",
        "name": "Haji Ali Express Bay",
        "latitude": 18.9782,
        "longitude": 72.8118,
        "location": "Mahalaxmi, Mumbai",
        "status": "active",
    },
    {
        "camera_id": "CAM_04",
        "name": "Eastern Freeway Chembur Exit",
        "latitude": 19.0522,
        "longitude": 72.8987,
        "location": "Chembur, Mumbai",
        "status": "active",
    },
    {
        "camera_id": "CAM_05",
        "name": "Vashi Bridge Toll Gate 04",
        "latitude": 19.0645,
        "longitude": 72.9855,
        "location": "Navi Mumbai Outer",
        "status": "active",
    },
    {
        "camera_id": "CAM_06",
        "name": "Expressway Khalapur Plaza",
        "latitude": 18.8258,
        "longitude": 73.2846,
        "location": "Mumbai-Pune Expressway KM 38",
        "status": "active",
    },
    {
        "camera_id": "CAM_07",
        "name": "Urse Toll Plaza Pune Entry",
        "latitude": 18.7214,
        "longitude": 73.6621,
        "location": "Talegaon Dabhade, Pune",
        "status": "unregistered",
    },
    {
        "camera_id": "CAM_08",
        "name": "Wakad Hinjewadi Flyover North",
        "latitude": 18.5996,
        "longitude": 73.7634,
        "location": "Hinjewadi Phase 1, Pune",
        "status": "maintenance",
    },
]

def seed():
    db = SessionLocal()
    try:
        # Check if cameras already exist
        for cam_info in CAMERAS_DATA:
            cam = db.query(Camera).filter(Camera.camera_id == cam_info["camera_id"]).first()
            if not cam:
                cam = Camera(
                    camera_id=cam_info["camera_id"],
                    name=cam_info["name"],
                    latitude=cam_info["latitude"],
                    longitude=cam_info["longitude"],
                    location=cam_info["location"],
                    status=cam_info["status"],
                )
                db.add(cam)
            else:
                cam.name = cam_info["name"]
                cam.latitude = cam_info["latitude"]
                cam.longitude = cam_info["longitude"]
                cam.location = cam_info["location"]
                cam.status = cam_info["status"]
        db.commit()
        print("Cameras seeded/updated successfully.")

        now = datetime.now(timezone.utc)
        obs_definitions = [
            # Journey 1: MH12AB1234
            {"camera_id": "CAM_01", "track_id": 12, "plate": "MH12AB1234", "mins_ago": 65, "type": "car", "conf": 0.96, "lat": 19.0368, "lon": 72.8172},
            {"camera_id": "CAM_02", "track_id": 45, "plate": "MH12AB1234", "mins_ago": 51, "type": "car", "conf": 0.94, "lat": 19.0125, "lon": 72.8152},
            {"camera_id": "CAM_03", "track_id": 92, "plate": "MH12AB1234", "mins_ago": 38, "type": "car", "conf": 0.95, "lat": 18.9782, "lon": 72.8118},
            {"camera_id": "CAM_05", "track_id": 114, "plate": "MH12AB1234", "mins_ago": 22, "type": "car", "conf": 0.95, "lat": 19.0645, "lon": 72.9855},
            {"camera_id": "CAM_06", "track_id": 219, "plate": "MH12AB1234", "mins_ago": 5, "type": "car", "conf": 0.97, "lat": 18.8258, "lon": 73.2846},

            # Journey 2: MH02CD5678
            {"camera_id": "CAM_03", "track_id": 19, "plate": "MH02CD5678", "mins_ago": 70, "type": "car", "conf": 0.93, "lat": 18.9782, "lon": 72.8118},
            {"camera_id": "CAM_02", "track_id": 54, "plate": "MH02CD5678", "mins_ago": 48, "type": "car", "conf": 0.95, "lat": 19.0125, "lon": 72.8152},
            {"camera_id": "CAM_01", "track_id": 88, "plate": "MH02CD5678", "mins_ago": 25, "type": "car", "conf": 0.96, "lat": 19.0368, "lon": 72.8172},
            {"camera_id": "CAM_04", "track_id": 130, "plate": "MH02CD5678", "mins_ago": 8, "type": "car", "conf": 0.91, "lat": 19.0522, "lon": 72.8987},

            # Journey 3: MH14EF9900 (Truck)
            {"camera_id": "CAM_04", "track_id": 201, "plate": "MH14EF9900", "mins_ago": 90, "type": "truck", "conf": 0.98, "lat": 19.0522, "lon": 72.8987},
            {"camera_id": "CAM_05", "track_id": 312, "plate": "MH14EF9900", "mins_ago": 40, "type": "truck", "conf": 0.99, "lat": 19.0645, "lon": 72.9855},
            {"camera_id": "CAM_06", "track_id": 405, "plate": "MH14EF9900", "mins_ago": 12, "type": "truck", "conf": 0.94, "lat": 18.8258, "lon": 73.2846},

            # Journey 4: DL01XY9999 (Interstate Bus)
            {"camera_id": "CAM_06", "track_id": 511, "plate": "DL01XY9999", "mins_ago": 35, "type": "bus", "conf": 0.92, "lat": 18.8258, "lon": 73.2846},
            {"camera_id": "CAM_07", "track_id": 108, "plate": "DL01XY9999", "mins_ago": 10, "type": "bus", "conf": 0.89, "lat": 18.7214, "lon": 73.6621},

            # Motorcycle
            {"camera_id": "CAM_01", "track_id": 77, "plate": "MH01ZZ3322", "mins_ago": 15, "type": "motorcycle", "conf": 0.88, "lat": 19.0368, "lon": 72.8172},

            # Unregistered / No-plate auto
            {"camera_id": "CAM_07", "track_id": 12, "plate": None, "mins_ago": 3, "type": "auto", "conf": 0.82, "lat": 18.7214, "lon": 73.6621},
        ]

        for i, o in enumerate(obs_definitions):
            ts = now - timedelta(minutes=o["mins_ago"])
            ingest_payload = ObservationCreate(
                camera_id=o["camera_id"],
                track_id=o["track_id"],
                plate_number=o["plate"],
                timestamp=ts,
                vehicle_type=o["type"],
                confidence=o["conf"],
                latitude=o["lat"],
                longitude=o["lon"],
                ingest_id=f"seed-demo-{i+1}-{o['camera_id']}-{o['track_id']}",
                frame_id=f"frame_{1000 + i}",
                vehicle_bbox=[100, 200, 400, 500],
                plate_bbox=[150, 420, 250, 460] if o["plate"] else None,
                plate_confidence=o["conf"] if o["plate"] else None,
                ocr_confidence=o["conf"] if o["plate"] else None,
                ocr_engine="fast_plate_anpr",
                raw_ocr_text=o["plate"]
            )
            observation_service.ingest(db, ingest_payload)

        print(f"Ingested {len(obs_definitions)} observations with full plate reads and vehicle tracking.")
        
        # Assign global_vehicle_id for demo fused vehicles
        # (canonical format: NEXUS_V##### — decision D6, 2026-09-12)
        v1 = db.query(Vehicle).filter(Vehicle.plate_number_best_guess == "MH12AB1234").first()
        if v1:
            v1.global_vehicle_id = "NEXUS_V00001"
        v2 = db.query(Vehicle).filter(Vehicle.plate_number_best_guess == "MH02CD5678").first()
        if v2:
            v2.global_vehicle_id = "NEXUS_V00002"
        v3 = db.query(Vehicle).filter(Vehicle.plate_number_best_guess == "MH14EF9900").first()
        if v3:
            v3.global_vehicle_id = "NEXUS_V00003"
        v4 = db.query(Vehicle).filter(Vehicle.plate_number_best_guess == "DL01XY9999").first()
        if v4:
            v4.global_vehicle_id = "NEXUS_V00004"
        db.commit()
        print("Assigned global vehicle IDs for fused vehicles.")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
