# NEXUS R3 — API Contract

The HTTP contract between R3 and every other NEXUS module: R1/R2 (ingest),
R4 (dashboard), R5 (analytics), R6 (fusion).

- **Base URL:** `http://localhost:8000/api/v1`
- **Interactive docs:** `http://localhost:8000/docs` (OpenAPI/Swagger, kept in sync with the code)
- **Auth:** none for MVP (decision D12) — CORS restricts browser origins via `ALLOWED_ORIGINS`
- **Content type:** `application/json` everywhere

---

## Cross-cutting policies

### Timestamps (decision D10)

- Input: ISO 8601. **Timezone-aware strongly recommended** (`2026-09-10T10:32:12+05:30`).
- **Naive timestamps are assumed to be camera-local IST (+05:30)** and converted to UTC.
- Storage and all responses: **UTC**.
- Range guard: rejected with 422 if before 2020-01-01 or more than 5 minutes in the future (broken camera clock, Plan §3).
- `timestamp` is the *capture* time. Server receipt time is a separate `created_at` field, so clock skew stays diagnosable.

### Plates

- Stored and matched **normalized**: uppercase, whitespace and separators (` -._`) stripped. `up32 ab1234` and `UP32AB1234` are the same plate.
- Plausibility range after normalization: 4–12 alphanumeric characters. No rigid regex — Indian plates have multiple valid formats.
- Whitespace-only / empty / `null` plate → treated as *no plate read*.
- **OCR sentinel strings** (`UNREADABLE`, `UNKNOWN`, `INVALID`, `NOREAD`) → *no plate read* (decision C8) — an unreadable plate is a valid observation, not a bad request. The root pipeline's `"ERR: …"` fallback strings are dropped by the adapter (`app/integration/r1r2.py`).
- **Plate filters accept un-normalized input** (`?plate_number=mh 12 ab 1234`) and normalize it server-side before matching.

### vehicle_type

Allow-list: `car`, `motorcycle`, `bus`, `truck`, `auto`, `other`.
Unknown values are **not rejected** — they are stored as `other` (decision D7), so an evolved R1 detector class never breaks ingest. Empty string is rejected (422).

The frozen ML contract name **`vehicle_class` is accepted as an alias** for
`vehicle_type` on input (likewise `plate_text` → `plate_number`,
`raw_ocr_text` → `raw_plate_text`). Responses always use the backend-native
names — R4/R5 are verified consumers of those. Full mapping table:
`docs/integration.md`.

### Confidences (decision C1/C3)

- Every confidence-flavored field (`confidence`, `plate_confidence`,
  `ocr_confidence`, `detection_confidence`) is **strictly [0.0, 1.0]**.
  A raw `85` is a 422, never silently rescaled — the scale of every stored
  number stays provable.
- **R2's 0–100 heuristic score must be converted by the producer** using
  `app.integration.r1r2.normalize_r2_confidence()` (divides by 100) or by
  posting through `from_r1_r2()`.
- The confidences are kept **separate**, never merged: `confidence` is the
  observation-level detection confidence (falls back to `plate_confidence`
  when the producer sends no detection confidence — the frozen contract
  carries only `plate_confidence`); `plate_confidence`, `ocr_confidence` and
  `detection_confidence` land on the `plate_reads` trail.

### Extra fields (documented decision, Plan §14.1)

Unknown fields in an observation payload are **ignored, not rejected**.
As of the R1/R2 integration (2026-09-12) the frozen NEXUSVehicle contract
fields `frame_id`, `vehicle_bbox`, `trajectory`, `plate_bbox`,
`plate_confidence`, `ocr_confidence`, `detection_confidence`, `ocr_engine`,
`raw_ocr_text` and `vehicle_crop_reference` are **first-class stored
fields** (see the ingest example below). `vehicle_crop` (binary image data)
remains ignored — crops never enter PostgreSQL; send a path/URL in
`vehicle_crop_reference` instead (decision C4).

### Idempotency (`ingest_id`)

Strongly recommended for every producer. A retry or replay with an already-seen
`ingest_id` returns the **existing record with 200 OK** — never 409, never 500,
never a duplicate row (and never a duplicate `plate_reads` trail row).
Suggested: a client UUID, or a hash of `camera_id + track_id + timestamp`.

### Coordinates (decision C7 / D13 resolution)

`latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180], **both optional**. The
frozen ML contract carries no GPS fields, so resolution order is:

1. payload coordinates (range-checked when present),
2. else the **camera row's** registered coordinates,
3. else **null** (camera has no GPS either).

The `(0.0, 0.0)` GPS sentinel is **accepted** (logged as a data-quality
warning server-side) — it is valid ocean coordinates and rejecting real
input is worse. Consumers drawing maps (R4) must skip null-coordinate
journey points.

### Pagination (`Page[T]` envelope)

All list endpoints return:

```json
{
  "items": [...],
  "total": 137,
  "page": 1,
  "page_size": 50
}
```

- `page` starts at 1; `page_size` defaults to 50 and is **clamped to 200** (no error).
- `total` is the unfiltered-by-pagination match count.
- **An empty result is a valid 200 with `"items": []`** — 404 is reserved for a referenced entity that doesn't exist (e.g. an unknown vehicle id).

### Error envelope (every error, every endpoint)

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": [...]   // optional, e.g. per-field 422 info
  }
}
```

Codes: `validation_error` (422), `invalid_value` (422), `not_found` (404),
`conflict` (409), `bad_request` (400), `internal_error` (500), `error` (other
HTTP errors). **Stack traces, SQL, and DB details never appear in responses**;
a 500 is always the generic message and the traceback goes to server logs only.

---

## Endpoints

### Health

#### `GET /health` → 200
```json
{"status": "ok"}
```

#### `GET /health/ready` → 200 (real `SELECT 1` against PostgreSQL)
```json
{"status": "ok", "database": "connected"}
```

---

### Observations

#### `POST /observations` — ingest one

**201** when stored, **200** when an `ingest_id` replay returned the existing record.

The full frozen NEXUSVehicle contract posts as-is (ML field names accepted):

```json
POST /api/v1/observations
{
  "camera_id": "CAM_01",
  "frame_id": 12345,
  "timestamp": "2026-09-10T10:32:12+05:30",
  "track_id": 17,
  "vehicle_class": "car",
  "vehicle_bbox": [120, 240, 480, 610],
  "trajectory": [[28.60, 77.20], [28.61, 77.21]],
  "confidence": 0.91,
  "latitude": 28.60,
  "longitude": 77.20,
  "plate_bbox": [150, 250, 290, 270],
  "plate_text": "up32 ab1234",
  "raw_ocr_text": "up32 ab1234",
  "plate_confidence": 0.94,
  "ocr_confidence": 0.88,
  "detection_confidence": 0.97,
  "ocr_engine": "fast-plate-ocr",
  "vehicle_crop_reference": "crops/cam01/t17/f12345.jpg",
  "ingest_id": "cam01-t17-f12345"
}
```

(`vehicle_class`/`plate_text`/`raw_ocr_text` are aliases of
`vehicle_type`/`plate_number`/`raw_plate_text`; when both names are sent, the
backend-native one wins. `vehicle_crop` binary data is ignored — C4. All
plate-related extras go to the `plate_reads` trail, retrievable via
`GET /observations/{id}/plate-reads`.)

Response body (both 200 and 201):
```json
{
  "id": 42,
  "vehicle_id": 7,
  "camera_id": "CAM_01",
  "track_id": 17,
  "plate_number": "UP32AB1234",
  "timestamp": "2026-09-10T05:02:12Z",
  "vehicle_type": "car",
  "confidence": 0.91,
  "latitude": 28.6,
  "longitude": 77.2,
  "ingest_id": "cam01-t17-f12345",
  "frame_id": "12345",
  "vehicle_bbox": [120.0, 240.0, 480.0, 610.0],
  "trajectory": [[28.6, 77.2], [28.61, 77.21]],
  "vehicle_crop_reference": "crops/cam01/t17/f12345.jpg",
  "created_at": "2026-09-12T04:15:33.221403Z"
}
```

Ingest behavior (all in the service layer, identical for single and batch):

- Unknown `camera_id` → camera auto-created with `status="unregistered"`; existing cameras are untouched (§6.3).
- Plate present and unmatched → a **provisional vehicle** is created and linked; plate matches an existing vehicle → linked to it; **no plate → `vehicle_id` stays `null`** until R6 fusion (§6.4).
- Any plate information (plate, raw text, plate confidence, plate bbox) → a **`plate_reads` trail row** preserving the raw OCR text, separate confidences, plate bbox and OCR engine (C9).
- Missing coordinates → the camera row's position; camera without GPS → null (C7).
- `cameras.last_seen_at` is updated **monotonically** — out-of-order or replayed observations never move it backwards.
- `track_id` is a local tracker ID, not a global key — it resets per camera session and is never used alone as a lookup key (§6.1).

Validation (422 with the error envelope):

| Field | Rule |
|---|---|
| `camera_id` | required, non-empty after strip, ≤ 64 chars |
| `track_id` | required, integer ≥ 0 |
| `plate_number` (`plate_text`) | optional; normalizes to 4–12 alphanumeric; sentinels → no plate (see Plates) |
| `timestamp` | required; ISO 8601; range guard (see Timestamps) |
| `vehicle_type` (`vehicle_class`) | required; allow-list, unknown → `other`, empty → 422 |
| `confidence` | required *or* `plate_confidence` as fallback; finite number in [0.0, 1.0] (NaN/Inf rejected) |
| `plate_confidence`, `ocr_confidence`, `detection_confidence` | optional; finite, [0.0, 1.0] — never rescaled (C1) |
| `latitude` / `longitude` | optional; range-checked when present (C7) |
| `frame_id` | optional; int or string, stored opaque ≤ 64 chars |
| `vehicle_bbox`, `plate_bbox` | optional; exactly 4 finite numbers `[x1, y1, x2, y2]` |
| `trajectory` | optional; any JSON array (opaque R1 structure) |
| `vehicle_crop_reference`, `ocr_engine` | optional; ≤ 512 / ≤ 64 chars |
| `ingest_id` | optional; ≤ 64 chars; empty string treated as absent |

#### `POST /observations/batch` — ingest many, per-item results

Body: a JSON **array of raw objects**. Each item is validated independently;
one bad row never sinks the batch (§6.7). Valid items follow the exact same
path as the single POST, including idempotency — an intra-batch duplicate
`ingest_id` is idempotent.

```json
POST /api/v1/observations/batch
[ { ...observation... }, { ...observation... } ]
```

Response — **always 200** with the per-item split:
```json
{
  "accepted": [ ...ObservationRead... ],
  "rejected": [
    {"index": 3, "reason": "confidence must be a finite number in [0, 1]"}
  ]
}
```

#### `GET /observations` — list/filter

Newest first. Filters:

| Param | Notes |
|---|---|
| `camera_id` | exact match |
| `plate_number` | normalized on input (accepts `mh 12 ab 1234`) |
| `vehicle_type` | exact match |
| `start`, `end` | inclusive bounds; naive values assumed IST (same D10 policy as ingest) |
| `page`, `page_size` | pagination; `page_size` clamped to 200 |

#### `GET /observations/{id}` → `ObservationRead` · 404 if unknown

#### `GET /observations/{id}/plate-reads` — the raw OCR trail (R1/R2 integration)

Every plate attempt for one observation, newest last: pre-normalization text,
separate confidences (never merged — C3), plate bbox and the OCR engine tag.
**Empty list** when the observation carried no plate information; **404** when
the observation doesn't exist.

```json
GET /api/v1/observations/42/plate-reads
[
  {
    "id": 11,
    "observation_id": 42,
    "plate_number_raw": "up32 ab1234",
    "plate_number_normalized": "UP32AB1234",
    "confidence": 0.94,
    "ocr_confidence": 0.88,
    "detection_confidence": 0.97,
    "plate_bbox": [150.0, 250.0, 290.0, 270.0],
    "source": "fast-plate-ocr",
    "timestamp": "2026-09-10T05:02:12Z",
    "created_at": "2026-09-12T04:15:33.221403Z"
  }
]
```

#### `PATCH /observations/{id}/vehicle` — R6 fusion write point ⚠️ provisional

**Provisional body per decision D6** — `{global_vehicle_id}` only — until R6
confirms its real fusion-output shape (Phase 8.3). `extra="forbid"`: unknown
fields are rejected here, unlike observation ingest.

```json
PATCH /api/v1/observations/42/vehicle
{"global_vehicle_id": "GVID-9f3a2c"}
```

Links the observation to the vehicle carrying that global identity, creating
the vehicle if needed (seeding `plate_number_best_guess` from the observation).
A plain FK write, not a restructure (§6.4). Returns the updated `ObservationRead`.

---

### Cameras

#### `GET /cameras` — list, `?status=` filter (`active | inactive | maintenance | unregistered`; anything else → 422)

`unregistered` surfaces auto-created cameras awaiting admin setup.

#### `GET /cameras/{camera_id}` → `CameraRead` · 404 if unknown

```json
{
  "id": 1, "camera_id": "CAM_01", "name": null,
  "latitude": null, "longitude": null, "location": null,
  "status": "unregistered",
  "last_seen_at": "2026-09-12T04:15:33Z",
  "created_at": "2026-09-10T08:00:00Z"
}
```

#### `GET /cameras/{camera_id}/observations` — newest first, paginated

404 only when the **camera** doesn't exist; a known-but-silent camera returns a
valid empty page (§6.8).

#### `PATCH /cameras/{camera_id}` — fill in / correct details

The intended path for fleshing out cameras auto-created by incoming
observations. **Unknown fields are forbidden** (`extra="forbid"`) — a typo
422s instead of silently doing nothing. `camera_id` itself is not updatable.

```json
PATCH /api/v1/cameras/CAM_01
{"name": "Connaught Place Gate 2", "latitude": 28.6315,
 "longitude": 77.2167, "location": "New Delhi", "status": "active"}
```

All fields optional; `null` means "leave unchanged".

---

### Vehicles

#### `GET /vehicles` — list/filter

Filters: `plate_number` (normalized on input), `global_vehicle_id` (R6 identity),
`vehicle_type`. Each row includes `observation_count`.

```json
{
  "items": [
    {"id": 7, "global_vehicle_id": null, "plate_number_best_guess": "UP32AB1234",
     "vehicle_type": "car", "created_at": "...", "updated_at": "...",
     "observation_count": 3}
  ],
  "total": 1, "page": 1, "page_size": 50
}
```

#### `GET /vehicles/{id}` → `VehicleRead` · 404 if unknown

#### `GET /vehicles/{id}/journey` — the vehicle's trajectory

The vehicle's observations **sorted by capture `timestamp` ascending at query
time** — never insertion order (§6.5), so out-of-order arrival and backfills
always produce a correct journey. Paginated with the standard envelope; a
known vehicle with no observations returns a valid empty page.

```json
{
  "items": [
    {"observation_id": 42, "camera_id": "CAM_01", "track_id": 17,
     "plate_number": "UP32AB1234", "timestamp": "2026-09-10T05:02:12Z",
     "vehicle_type": "car", "confidence": 0.94,
     "latitude": 28.6, "longitude": 77.2}
  ],
  "total": 3, "page": 1, "page_size": 50
}
```

---

## Consumer cheat-sheet

| Consumer | What to use |
|---|---|
| **R1/R2** | `POST /observations` (or `/batch`); send `ingest_id`; ML field names (`vehicle_class`, `plate_text`, ...) accepted as aliases; convert 0–100 scores with `app.integration.r1r2`; `vehicle_crop` ignored, `vehicle_crop_reference` accepted |
| **R4** | `GET /cameras` (+ PATCH to register them), `GET /observations?camera_id=`, `GET /vehicles?plate_number=`, `GET /vehicles/{id}/journey` for map + history — skip null-coordinate points (C7) |
| **R5** | `GET /observations` with `start`/`end`/`vehicle_type` filters; `GET /cameras` for liveness via `last_seen_at`; `GET /observations/{id}/plate-reads` for OCR-quality analysis |
| **R6** | `PATCH /observations/{id}/vehicle` to write fusion results; `GET /vehicles?global_vehicle_id=` to check existing identities |
