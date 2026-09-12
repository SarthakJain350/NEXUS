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
database schema**. Status as of the **R1/R2 integration, 2026-09-12**
(migration `0002_r1r2_contract_fields`): every contract field is either stored
or deliberately delegated, and the ML field names are accepted as **input
aliases** (`vehicle_class` → `vehicle_type`, `plate_text` → `plate_number`,
`raw_ocr_text` → `raw_plate_text`) — so a producer can POST either naming.
Responses always use backend-native names (R4/R5 are verified consumers of
those).

| Contract field | Status | How R3 handles it |
|---|---|---|
| `camera_id` | ✅ direct match | `observations.camera_id` |
| `timestamp` | ✅ direct match | ISO 8601; naive = IST → stored UTC (D10) |
| `track_id` | ✅ direct match | stored, never a global key (Option A, §6.1); the adapter associates R1↔R2 on **camera_id + track_id** |
| `vehicle_class` | ✅ alias | input alias of `vehicle_type`; allow-list with `other` fallback (D7) |
| `plate_text` | ✅ alias | input alias of `plate_number` (normalized); the pre-normalization value is preserved as `plate_reads.plate_number_raw` |
| `plate_confidence` | ✅ stored | `plate_reads.confidence`; observation `confidence` falls back to it when no detection confidence is sent (C3). Strictly [0,1] — see the R2 confidence note below |
| `frame_id` | ✅ stored (0002) | opaque `String(64)`; int input stored as string (C5) |
| `vehicle_bbox` | ✅ stored (0002) | `observations.vehicle_bbox` JSONB (C6) |
| `vehicle_crop` | ⛔ never stored | binary crops stay in the pipeline; `vehicle_crop_reference` (path/URL, ≤512) accepted instead (C4) |
| `trajectory` | ✅ stored (0002) | opaque `observations.trajectory` JSONB; the derivable journey (`GET /vehicles/{id}/journey`) remains authoritative |
| `plate_bbox` | ✅ stored (0002) | `plate_reads.plate_bbox` JSONB |
| (no GPS fields) | ✅ optional (0002) | payload → camera row → null (C7 — D13 resolved) |

### The actual R1/R2 reality (2026-09-12 inspection) and the adapter

What the repo's ML code **actually** produces today:

- **R1 (vehicle detection + per-camera tracking) is not delivered yet** — no
  ByteTrack/`track_id` producer exists anywhere in the repository. The only
  real detection code is the root `app.py` pipeline (YOLO vehicle detect →
  vehicle crop → YOLO plate detect → OCR), which emits in-memory dicts with no
  camera/track/timestamp linkage. Until R1 lands, producers should emit the
  frozen contract shape and use `app/integration/r1r2.py`.
- **R2 (`r2_anpr.process_plate`)** returns
  `{"plate_text": str, "confidence": 0–100 heuristic, "status": ...}` — a
  **percentage-scale heuristic score** (isalnum/length/letter-digit bonuses),
  not an OCR probability. ⚠️ The backend API is strictly [0,1] (C1): convert
  with `normalize_r2_confidence()` or post through `from_r1_r2()`. A raw `85`
  POST is a 422 by design, so the scale of every stored number is provable.
  (Also known: `r2_anpr`'s `anpr_pipeline.py` has a broken import —
  `clean_plate` vs `clean_plate_text` — flagged to R2, not fixed by R3.)
- The root pipeline's OCR fallbacks emit the sentinel `"UNREADABLE"` and
  `"ERR: …"` error strings; both mean *no plate* (C8). Sentinels are handled
  in the schema, `ERR:` junk in the adapter.

`backend/app/integration/r1r2.py` is the one place these quirks live:

```python
from app.integration import from_r1_r2, normalize_r2_confidence

combined = from_r1_r2(r1_dict, r2_dict)          # camera_id+track_id association
combined["ingest_id"] = "cam01-t17-f12345"        # recommended
requests.post(f"{BASE}/observations", json=combined)
```

`from_r1_r2` accepts an R2 object in either shape — frozen-contract
(`plate_bbox`/`plate_text`/`plate_confidence`/`raw_ocr_text`/`ocr_confidence`/
`detection_confidence`/`ocr_engine`) or a raw `r2_anpr.process_plate()` result
(detected by its `status` key, confidence rescaled 0–100 → [0,1]). A mismatched
camera/track raises instead of silently mis-linking the plate.

**Recommendation to R1/R2:** emit an `ingest_id` (client UUID or hash of
`camera_id+track_id+timestamp`+frame) so retries/replays are idempotent
instead of duplicating rows.

## Consumer readiness (Plan §15 / TODO Phase 8)

*Verified 2026-09-12 by direct inspection of the consumers' committed code.*

| Module | Status | Verification |
|---|---|---|
| R1/R2 | 🔶 **contract ready, real output partial** | R2's `r2_anpr` output shape is known and adapted (0–100 heuristic confidence rescaled in the adapter only); R1's tracking output **not delivered yet** (no ByteTrack/track_id producer in-repo). The frozen contract + aliases + `app/integration/r1r2.py` adapter are the integration surface; `tests/test_r1r2_integration.py` proves the full contract posts and round-trips. R2 bug flagged: `anpr_pipeline.py` imports `clean_plate` but the module defines `clean_plate_text`. |
| R4 | ✅ **verified compatible** | Inspected `frontend/src/services/api.js` + components on `origin/main`. Every call maps 1:1 onto the API: `GET /cameras?status=&page_size=100`, `PATCH /cameras/{id}`, `GET /vehicles?plate_number=&vehicle_type=`, `GET /vehicles/{id}/journey?page_size=200`, `GET /observations?camera_id=&plate_number=&vehicle_type=`, `POST /observations`, `GET /health/ready` (reads `data.database`). Page envelope unwrapped via `data.items` correctly; journey/observation field names match exactly. Their ingest simulator sends a textbook payload — including `ingest_id` (`ui-sim-{timestamp}`) and camera-row lat/lon fallback, which is precisely the C7 pattern. Vite dev proxy `/api → localhost:8000` and our CORS default (`localhost:3000`) line up out of the box. One cosmetic delta: mock cameras carry `observation_count`, but no component consumes it — no backend change needed. **Post-0002 note:** observations/journey points can now carry `latitude: null` — map components must skip null-coordinate points (verified their map renders from camera lat/lon which was already nullable). |
| R5 | ✅ **verified compatible** (code-level) | Inspected `feature/reid-analytics` (`analytics/traffic_analyzer.py`, `alerts.py`). Analytics consume plain observation dicts with defensive `.get()` — no coupling to API internals; our `GET /observations` rows work as-is (null coordinates degrade to "unknown position", no crash). New for them: `GET /observations/{id}/plate-reads` exposes the raw OCR trail (raw text, separate confidences) for OCR-quality analysis. Note for later: their `unique_global_vehicles` metric reads `global_vehicle_id` off observation rows, which our API doesn't expose yet (it's on the vehicle, not the observation). It degrades gracefully to row counts today; revisit when R6 fusion lands. |
| R6 | ⏳ waiting | Real fusion output not delivered; `PATCH /observations/{id}/vehicle` runs the provisional `{global_vehicle_id}` body (D6). R6 implementation is out of scope for R3. |

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
- **`GET /observations/{id}/plate-reads`** was added with the R1/R2
  integration (2026-09-12) — serves the raw OCR trail that ingest now writes.
- **`plate_reads`** exists (D5) and **is written by ingest** since the R1/R2
  integration (C9): one trail row per fresh insert carrying plate information.
- **`camera.status`** uses the Plan §4 values with `unregistered` added for
  the §6.3 auto-create path.
- **R1/R2 integration (2026-09-12):** migration `0002` adds the frozen-contract
  columns and makes coordinates optional (C7). The earlier "not in DB" verdicts
  for `frame_id`/`vehicle_bbox`/`trajectory`/`plate_bbox` were revisited per
  the integration task: they are stored (JSONB/opaque) because the combined
  NEXUS observation round-trip requires them, while `vehicle_crop` stays out
  of the database permanently (C4).
