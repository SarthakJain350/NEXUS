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
- **Plate filters accept un-normalized input** (`?plate_number=mh 12 ab 1234`) and normalize it server-side before matching.

### vehicle_type

Allow-list: `car`, `motorcycle`, `bus`, `truck`, `auto`, `other`.
Unknown values are **not rejected** — they are stored as `other` (decision D7), so an evolved R1 detector class never breaks ingest. Empty string is rejected (422).

### Extra fields (documented decision, Plan §14.1)

Unknown fields in an observation payload are **ignored, not rejected**. The frozen
NEXUSVehicle ML contract carries `frame_id`, `vehicle_bbox`, `vehicle_crop`,
`trajectory`, `plate_bbox`, ... — R1/R2 may POST the full ML output as-is today.
See `docs/integration.md` for the field-by-field mapping.

### Idempotency (`ingest_id`)

Strongly recommended for every producer. A retry or replay with an already-seen
`ingest_id` returns the **existing record with 200 OK** — never 409, never 500,
never a duplicate row. Suggested: a client UUID, or a hash of
`camera_id + track_id + timestamp`.

### Coordinates

`latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180]. The `(0.0, 0.0)` GPS sentinel
is **accepted** (logged as a data-quality warning server-side) — it is valid
ocean coordinates and rejecting real input is worse.

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

```json
POST /api/v1/observations
{
  "camera_id": "CAM_01",
  "track_id": 17,
  "plate_number": "up32 ab1234",
  "timestamp": "2026-09-10T10:32:12+05:30",
  "vehicle_type": "car",
  "confidence": 0.94,
  "latitude": 28.60,
  "longitude": 77.20,
  "ingest_id": "cam01-t17-103212"
}
```

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
  "confidence": 0.94,
  "latitude": 28.6,
  "longitude": 77.2,
  "ingest_id": "cam01-t17-103212",
  "created_at": "2026-09-12T04:15:33.221403Z"
}
```

Ingest behavior (all in the service layer, identical for single and batch):

- Unknown `camera_id` → camera auto-created with `status="unregistered"`; existing cameras are untouched (§6.3).
- Plate present and unmatched → a **provisional vehicle** is created and linked; plate matches an existing vehicle → linked to it; **no plate → `vehicle_id` stays `null`** until R6 fusion (§6.4).
- `cameras.last_seen_at` is updated **monotonically** — out-of-order or replayed observations never move it backwards.
- `track_id` is a local tracker ID, not a global key — it resets per camera session and is never used alone as a lookup key (§6.1).

Validation (422 with the error envelope):

| Field | Rule |
|---|---|
| `camera_id` | required, non-empty after strip, ≤ 64 chars |
| `track_id` | required, integer ≥ 0 |
| `plate_number` | optional; normalizes to 4–12 alphanumeric (see Plates) |
| `timestamp` | required; ISO 8601; range guard (see Timestamps) |
| `vehicle_type` | required; allow-list, unknown → `other`, empty → 422 |
| `confidence` | required; finite number in [0.0, 1.0] (NaN/Inf rejected) |
| `latitude` / `longitude` | required; range-checked |
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
| **R1/R2** | `POST /observations` (or `/batch`); send `ingest_id`; extra ML fields are ignored |
| **R4** | `GET /cameras` (+ PATCH to register them), `GET /observations?camera_id=`, `GET /vehicles?plate_number=`, `GET /vehicles/{id}/journey` for map + history |
| **R5** | `GET /observations` with `start`/`end`/`vehicle_type` filters; `GET /cameras` for liveness via `last_seen_at` |
| **R6** | `PATCH /observations/{id}/vehicle` to write fusion results; `GET /vehicles?global_vehicle_id=` to check existing identities |
