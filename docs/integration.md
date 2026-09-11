# NEXUS R3 — Integration Notes

Who consumes what, the frozen-contract mapping, and the backend's measured
limits. Read this before wiring a module to the API; the full request/response
detail is in `docs/api_contract.md`.

---

## Integration points (Plan §15)

| Edge | Contract |
|---|---|
| **R1/R2 → R3** | JSON over HTTP only, never direct DB access. `POST /api/v1/observations` (or `/batch`). The backend accepts AI-pipeline output without requiring knowledge of DB internals. |
| **R3 → R4** | API-only; frontend never touches PostgreSQL. Map markers, vehicle search, journey history, camera history/status — all via the endpoints in `api_contract.md`. |
| **R3 → R5** | Clean observation/history APIs; no coupling to R5's analytics internals. Time-window + type filters on `GET /observations`; camera liveness via `last_seen_at`. |
| **R3 ↔ R6** | R6 owns fusion/global identity. R3 exposes `PATCH /observations/{id}/vehicle` so R6 writes fusion results; R3 does not implement fusion logic. |

## Frozen NEXUSVehicle contract vs. R3 schema

The Common Dataset Plan's field list is an **integration agreement, not a 1:1
database schema**. Unknown fields in an observation payload are **ignored**
(`extra="ignore"`), so R1/R2 can POST their full ML output as-is today.

| Contract field | Status | How R3 handles it |
|---|---|---|
| `camera_id` | ✅ direct match | `observations.camera_id` |
| `timestamp` | ✅ direct match | ISO 8601; naive = IST → stored UTC (D10) |
| `track_id` | ✅ direct match | stored, never a global key (Option A, §6.1) |
| `vehicle_class` | 🔶 name mismatch | backend field is `vehicle_type`; allow-list with `other` fallback. **Adapter concern — no DB change.** |
| `plate_text` | 🔶 name mismatch | backend field is `plate_number` (normalized). Raw OCR text belongs in `plate_reads.plate_number_raw` once real payloads land. |
| `plate_confidence` | 🔶 split | observation-level `confidence` + `plate_reads.confidence` (OCR-specific). Which one carries what gets decided at R1/R2 integration (Phase 8.1). |
| `frame_id` | ⛔ not in DB | per-frame ML output; `camera_id + track_id + timestamp` identify the observation |
| `vehicle_bbox` | ⛔ not in DB | raw ML output, changes every frame |
| `vehicle_crop` | ⛔ not in DB | image artifact — never DB state |
| `trajectory` | ⛔ not in DB | **derivable**: it *is* `GET /vehicles/{id}/journey` |
| `plate_bbox` | ⛔ not in DB | raw ML output; could land in `plate_reads` later if OCR-quality analysis needs it |

**Open risk (D13):** the frozen contract has no GPS fields, but R3 *requires*
`latitude`/`longitude` per observation (422 if absent). When the real R1/R2
payload arrives, one of: (a) R1/R2 include camera GPS (preferred — per-camera
static data), (b) backend falls back to the camera row's coordinates,
(c) lat/lon become optional. **No change made yet.**

**Recommendation to R1/R2:** emit an `ingest_id` (client UUID or hash of
`camera_id+track_id+timestamp`) so retries/replays are idempotent instead of
duplicating rows.

## Consumer readiness (Plan §15 / TODO Phase 8)

| Module | Status | Notes |
|---|---|---|
| R1/R2 | ⏳ waiting | Final payload format not delivered yet (D9, expected ~2026-09-11). Until then: fixtures/mock JSON. |
| R4 | 🟡 moving | React GIS dashboard merged (`frontend/`); expected response shapes not yet confirmed against the API (D8 — R4 moves first, then we verify). |
| R5 | 🟡 moving | Re-ID analytics + alerts branch started (`feature/reid-analytics`). Needs `GET /observations` windows + camera liveness — both available. |
| R6 | ⏳ waiting | Real fusion output not delivered; `PATCH /observations/{id}/vehicle` runs the provisional `{global_vehicle_id}` body (D6). |

## Stress-test results (Plan §14.3 / TODO 6.2)

Measured with `backend/tests/test_load.py` against a real uvicorn server +
PostgreSQL 16 (Docker), production pool shape (10 + 20 overflow, 30s timeout).
Numbers are from the dev laptop, not a production benchmark — they establish
*order of magnitude and failure modes*, not SLAs.

> **First full run: 2026-09-12, 135/135 green in 14.3s** (dev laptop, Docker
> Desktop Postgres 16). Numbers are order-of-magnitude + failure-mode
> evidence, not SLAs.

Tunables for reproducing/raising the load:

```bash
NEXUS_LOAD_CONCURRENCY=200 NEXUS_LOAD_JOURNEY_ROWS=3000 \
NEXUS_LOAD_SOAK_SECONDS=180 NEXUS_LOAD_SOAK_CAMERAS=20 \
pytest backend/tests/test_load.py -v -s
```

| Check | Result (2026-09-12, dev laptop) |
|---|---|
| Concurrent POSTs (unique) | **200/200 → 201**, no pool exhaustion, exact row count |
| Same `ingest_id` × 50 concurrent | **exactly 1 row**, one 201 + 49 × 200, all returned the same record, never a 500 — the §6.2 race holds under real concurrency |
| Journey p95 page latency @ 3000 rows (15 pages × 200) | **p50 8.3 ms / p95 11.3 ms** with the composite index |
| Journey p95 without composite index | p50 7.9 ms / p95 8.3 ms — **no measurable index benefit at 3000 rows** (seq scan + sort is trivially cheap at this size; second run also had a warm cache). The index is retained: its cost is negligible and it matters as the table grows and for production-sized journeys. Index benefit should be re-measured at 100k+ rows. |
| Mixed valid/invalid batch (20+5) | 20 accepted, 5 rejected with index+reason, 20 rows persisted |
| Malformed fuzzing (15 shapes) | all clean 422 envelopes, nothing persisted, no internals leaked |
| Full NEXUSVehicle ML payload (extra fields) | 201 accepted, extra fields ignored |
| Sustained rate (20 cams × 1 obs/s × 5 s) | **20 obs/sec sustained**, all 201; pool fully returned afterwards (`Checked out connections: 0`); tracemalloc peak 5.6 MB → current 2.6 MB (no growth) |

## Deviations from the R3 Plan

- **Branch:** work happens on `sarthak`, not `feature/backend` (D1). `main`
  untouched until the Phase 9 PR.
- **`GET /cameras/{camera_id}`** and **`GET /observations/{id}`** were added
  beyond the Plan's endpoint list — thin reads needed by R4/R5.
- **`plate_reads`** exists (D5) but is not written by ingest yet — the API
  contract only carries the normalized plate. Populated once R1/R2's raw OCR
  output shape is known.
- **`camera.status`** uses the Plan §4 values with `unregistered` added for
  the §6.3 auto-create path.
