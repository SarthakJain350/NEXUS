# NEXUS — System Architecture

Mermaid source of the architecture (GitHub renders it natively). The ASCII
version lives in the root README; this is the viva-friendly rendering.

```mermaid
flowchart TB
    subgraph INGEST["Ingestion (CV env)"]
        V["CCTV / video file<br/>(Indian traffic footage)"]
        R1["R1 — Vehicle Detection + Tracking<br/>YOLOv11n (COCO, D1) + ByteTrack<br/>per-camera track_id, lifecycle,<br/>trajectory, crops"]
        R2["R2 — ANPR (official, D2)<br/>custom plate YOLOv11n (99.49% mAP@50)<br/>+ Fast-Plate-OCR (+ GPT-4o-mini fallback)"]
        V --> R1 --> R2
    end

    subgraph BACKEND["R3 — Backend (backend/, its own venv)"]
        API["FastAPI<br/>POST /observations (idempotent via ingest_id)<br/>cameras · vehicles · journeys · plate_reads"]
        DB[("PostgreSQL 16<br/>JSONB contract fields<br/>unique ingest_id index<br/>naive IST → stored UTC")]
        PATCH["PATCH /observations/id/vehicle<br/>(R6 fusion hook, provisional)"]
        API <--> DB
    end

    subgraph CONSUMERS["Consumers"]
        R4["R4 — React + Leaflet GIS dashboard<br/>(primary demo UI, D10)<br/>polls every 12 s · page_size 200"]
        R5["R5 — reid/ + analytics/<br/>(Python reference layer, D4)<br/>dashboard computes its own client-side"]
        R6["R6 — Cross-camera fusion<br/>(plate-link MVP, D3 · seeded NEXUS_V##### IDs)<br/>PATCH hook is the integration point"]
    end

    R2 -- "observation JSON<br/>(frozen contract + aliases)" --> API
    API -- "REST /api/v1" --> R4
    API -- "observations + global_vehicle_id" --> R5
    PATCH --> R6
    R6 -- "global_vehicle_id" --> DB
```

## Data contract (frozen, all modules)

```
camera_id · frame_id · timestamp · track_id · vehicle_class
vehicle_bbox [x1,y1,x2,y2] · vehicle_crop · trajectory
plate_bbox · plate_text · plate_confidence
```

Confidence policy: API contract strictly [0,1]; rescaling from R2's 0–100
heuristic happens in exactly one place — the adapter
(`backend/app/integration/r1r2.py`), never in routes/schemas (decision C1).
Per-source confidences (plate detection vs OCR) are stored separately in the
`plate_reads` trail, never blended (C3).

## Identity model

| ID | Scope | Owner |
|---|---|---|
| `track_id` | per camera, always paired with `camera_id` | R1 |
| vehicle row | linked by plate at ingest (provisional vehicle per plate) | R3 |
| `global_vehicle_id` (`NEXUS_V#####`, canonical D6) | cross-camera global identity | R6 (plate-link MVP + seeded IDs for the demo) |

## Decision index

D1 COCO detector · D2 app.py engine = official R2 · D3 plate association +
seeded IDs (no fake Re-ID claims) · D4 client-side analytics · D6
`NEXUS_V#####` canonical · D8 CityFlowV2 = R6 validation dataset · D10
React dashboard = primary demo UI. Full texts: TODO.md.
