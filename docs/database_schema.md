# NEXUS R3 — Database Schema

PostgreSQL 16, SQLAlchemy 2.x ORM, Alembic migrations. The running schema is
defined by `backend/alembic/versions/0001_initial.py` +
`0002_r1r2_contract_fields.py`; this document explains the *why*.
Connection: `psycopg` v3 (decision D4), URL from `DATABASE_URL`,
pool `pool_size=10, max_overflow=20, pool_timeout=30s, pool_pre_ping=True`.

## Entity relationship

```
cameras 1 ──── N observations N ──── 1 vehicles (nullable)
                    │
                    └──── 1 ──── N plate_reads
```

The core chain the whole system must preserve:
**camera → observation → track → vehicle → plate**.

- An **observation** = "a vehicle was detected/tracked/read at a particular
  camera and time" — the main event table.
- `observations.vehicle_id` is **nullable at insert**: R6 fuses global
  identities later (Plan §6.4). No plate → stays null; plate present →
  linked to a *provisional* vehicle keyed by the normalized plate.
- `observations.camera_id` references `cameras.camera_id` (the external
  stable identifier, not the surrogate PK) so R1/R2 never need DB-internal ids.

## Tables

### `cameras`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | surrogate |
| `camera_id` | varchar(64) **unique, indexed** | stable external ID used by R1/R2 ("CAM_01") |
| `name`, `location` | nullable | filled via `PATCH /cameras/{id}` |
| `latitude`, `longitude` | float, nullable | camera GPS — optional, set at registration |
| `status` | varchar(16) | `active` \| `inactive` \| `maintenance` \| `unregistered` |
| `last_seen_at` | timestamptz, nullable | **monotonic** — updated on every observation, never moved backwards by out-of-order/replayed data |
| `created_at` | timestamptz | server default `now()` |

Unknown cameras in incoming observations are **auto-created with
`status='unregistered'`** (Plan §6.3) — ingest never fails on an unregistered
camera; admin/R4 later fills in details and flips to `active`.

### `vehicles`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `global_vehicle_id` | varchar(64) **unique**, nullable | R6's fused global identity — null until fusion (§6.4) |
| `plate_number_best_guess` | varchar(16), nullable, indexed (non-unique) | normalized plate; provisional vehicles are created per unique normalized plate |
| `vehicle_type` | varchar(16) | |
| `created_at`, `updated_at` | timestamptz | server default `now()` |

### `observations` — main event table

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `vehicle_id` | int FK → vehicles, **nullable**, indexed | null until plate match or R6 fusion |
| `camera_id` | varchar(64) FK → cameras, indexed | |
| `track_id` | int | **local** tracker ID — resets per camera session, never a global key (see "track_id reuse" below) |
| `plate_number` | varchar(16), nullable, indexed | normalized (uppercase, separators stripped) |
| `timestamp` | timestamptz, indexed | capture time, stored UTC (naive input assumed IST, D10) |
| `vehicle_type` | varchar(16) | allow-list + `other` fallback (D7); frozen-contract `vehicle_class` maps here |
| `confidence` | float | [0,1], finite; falls back to `plate_confidence` when the producer sends no detection confidence (C3) |
| `latitude`, `longitude` | float, **nullable** (migration 0002, C7) | payload → camera row → null; range-checked when present |
| `ingest_id` | varchar(64), **nullable-unique**, indexed | idempotency key (§6.2) |
| `frame_id` | varchar(64), nullable (0002) | opaque per-frame ML identifier; int input stored as string (C5) |
| `vehicle_bbox` | JSONB, nullable (0002) | `[x1, y1, x2, y2]` — native JSON, not a serialized string (C6) |
| `trajectory` | JSONB, nullable (0002) | opaque R1 trajectory array; the derivable journey (`GET /vehicles/{id}/journey`) stays authoritative |
| `vehicle_crop_reference` | varchar(512), nullable (0002) | path/URL to the crop artifact — binary crops never stored (C4) |
| `created_at` | timestamptz | server receipt time, kept separate from `timestamp` so clock skew stays diagnosable (§6.6) |

**Indexes:**

| Index | Purpose |
|---|---|
| `ix_observations_ingest_id` (unique) | idempotent replay detection — Postgres nullable-unique allows multiple NULLs for clients that don't send one |
| `ix_observations_vehicle_timestamp` (composite) | journey queries: filter by vehicle, sort by timestamp (§6.5) |
| `ix_observations_camera_id` | per-camera history lists |
| `ix_observations_timestamp` | time-window filters (R5 analytics) |
| `ix_observations_plate_number` | plate search |
| `ix_observations_vehicle_id` | vehicle → observations join |

### `plate_reads` — raw OCR trail (decision D5, populated since the R1/R2 integration)

Keeps the unnormalized OCR output next to the normalized plate for later
OCR-quality analysis. **Written on every ingest that carries plate
information** (plate, raw text, plate confidence or plate bbox — decision C9):
one row per fresh observation insert; `ingest_id` replays return before the
trail is touched, so replays never double-write. Unreadable attempts are
preserved too (`plate_number_normalized` null, `plate_number_raw` holding what
the OCR emitted). Served by `GET /observations/{id}/plate-reads`.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `observation_id` | int FK → observations, indexed | |
| `plate_number_raw` | varchar(64) | exactly what the OCR emitted (pre-normalization) |
| `plate_number_normalized` | varchar(16), nullable | post-normalization; null = unreadable attempt |
| `confidence` | float, nullable | the producer's read-level `plate_confidence` |
| `ocr_confidence` | float, nullable (0002) | OCR-engine confidence, kept separate (C3) |
| `detection_confidence` | float, nullable (0002) | plate-detection confidence, kept separate (C3) |
| `plate_bbox` | JSONB, nullable (0002) | `[x1, y1, x2, y2]` |
| `source` | varchar(64), nullable (0002) | OCR engine tag, e.g. `fast-plate-ocr`, `pytesseract` |
| `timestamp` | timestamptz | read time |

## Design decisions worth remembering

### track_id reuse — Option A (Plan §6.1)

`track_id` is a **local** ByteTrack ID that resets per camera session. It is
*stored* (useful context for one camera's session) but **never used alone as a
lookup key** — observations are addressed by `id`, vehicles by
`vehicle_id`/plate. When the same `track_id` reappears hours later on the same
camera it simply creates new observations; no global uniqueness is assumed or
enforced. Cross-camera identity is R6's job, written via
`PATCH /observations/{id}/vehicle`.

### Idempotency via nullable-unique `ingest_id` (§6.2)

The unique index on `ingest_id` is the race-catcher: two concurrent requests
with the same key both pass the "does it exist?" lookup, both try to insert,
the loser hits the constraint, and the service's retry loop returns the
existing record → the client sees **200, never 409 or 500**.

### Plate normalization at the boundary

Plates are normalized (uppercase, strip ` -._`) once, at ingest, in the
Pydantic layer — everything downstream (storage, matching, filtering) works
with the normalized form only. `up32 ab1234` and `UP32AB1234` are one vehicle.

## Migrations

- `0001_initial` (Plan §11) — all tables + all indexes from day one.
- `0002_r1r2_contract_fields` (2026-09-12) — **additive only**: the frozen
  NEXUSVehicle contract columns (observations: `frame_id`, `vehicle_bbox`,
  `trajectory`, `vehicle_crop_reference`; plate_reads: `plate_bbox`,
  `ocr_confidence`, `detection_confidence`, `source`) plus
  `observations.latitude/longitude` → nullable (C7). No existing column is
  dropped or retyped; existing migrations are never modified.

Workflow:

```bash
cd backend
alembic upgrade head        # apply everything
alembic downgrade -1        # roll back 0002 (drops the new columns)
alembic upgrade head        # and back up — verified clean both directions
```

Note: `alembic downgrade -1` from a database containing null-coordinate rows
will fail the `NOT NULL` restore — expected, since pre-0002 rows cannot
represent missing GPS; clear or backfill those rows first.

Test databases (`nexus_test`) are created via `metadata.create_all` for
isolation; **the deployment path is always `alembic upgrade head`**.
