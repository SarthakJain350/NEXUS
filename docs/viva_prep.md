# NEXUS — SIH Viva Prep Sheet

Everything below is the **true, defensible story** (as of 2026-09-12).
Nothing here is a fabricated claim; the "Limitations" section is meant to be
said out loud — owning them scores better than being caught in them.

---

## 1. Problem statement + why NEXUS (30-second opener)

**PS SIH26127:** City-wide AI engine for multi-camera ANPR, trajectory
tracking and urban traffic analytics.

**Pitch:** Cities already have thousands of plain CCTV cameras that record
traffic and throw it away. NEXUS turns any such feed into a *queryable
traffic record*: detect every vehicle, track it per camera, read its plate,
store every observation idempotently in PostgreSQL, and let operators search
by plate, camera, or vehicle and see cross-camera journeys on a GIS map —
with analytics and alerts on top. No new hardware; the intelligence is
software.

---

## 2. Architecture walkthrough (the script)

Use the README ASCII diagram. The chain:

```
Video → YOLO vehicle detect (R1) → ByteTrack per-camera track (R1)
      → crop → custom plate detect (R2) → Fast-Plate-OCR (R2)
      → POST observation (idempotent) → PostgreSQL (R3)
      → vehicles + cross-camera journeys (R3, plate-linked)
      → GIS dashboard / search / analytics / alerts (R4, client-computed R5)
      → R6 fusion hook: PATCH /observations/{id}/vehicle
```

---

## 3. Tech choices — with the honest "why"

| Choice | Why (say this) |
|---|---|
| **Two-stage detection** (vehicle detect → plate detect inside crop) | Fewer false positives (shop signs, road boards are never plate candidates), focused ROIs improve plate accuracy, ~60–80% less effective detection area. Plate model: custom YOLOv11n, **99.49% mAP@50**, only 2.6M params — smaller than academic baselines with higher accuracy. |
| **ByteTrack** for tracking | The low-score second association keeps detections during occlusion/motion blur that plain trackers discard — that's what gives stable persistent track IDs. |
| **Fast-Plate-OCR** (+ optional GPT-4o-mini fallback) | ~5 ms per plate on GPU, purpose-built for plates; the LLM is a fallback for hard crops only, never the primary. |
| **PostgreSQL + JSONB** | Contract fields (bboxes, trajectory) are schema-flexible JSONB; identity, journeys and the plate_reads trail are relational. Unique indexes make idempotent ingest possible. |
| **Idempotent ingest** | Cameras reconnect and retry; `ingest_id` dedup means replays return 200 and store nothing twice. Race-tested with 50 concurrent duplicates. |
| **FastAPI + Pydantic** | Request validation, uniform error envelope, auto-generated OpenAPI docs (`/docs`). |
| **React + Leaflet** | Lightweight GIS dashboard, polls the API every 12 s. |
| **Handcrafted Re-ID baseline** (HSV/Sobel features + cosine) | No large-scale Indian-vehicle re-id dataset was in scope; we ship a swappable reference baseline rather than pretend trained embeddings. |

---

## 4. Challenges & solutions (pick 2–3)

1. **Cross-module contract freezing** — six modules built in parallel; the
   frozen observation contract (`camera_id, frame_id, timestamp, track_id,
   vehicle_class, vehicle_bbox, trajectory, plate_bbox, plate_text,
   plate_confidence`) let everyone work independently; the backend accepts
   both native and alias names via one adapter.
2. **Idempotent ingest under concurrent retries** — `ingest_id` + unique
   index + IntegrityError retry; verified with 200 concurrent POSTs and a
   ×50 duplicate race.
3. **Confidence normalization** — R2's heuristic emits 0–100, the API
   contract is strictly [0,1]; rescaling happens in exactly one place (the
   adapter), never in routes/schemas.
4. **Timestamps** — naive input = IST, stored UTC; journeys sort across
   cameras correctly.
5. **Occlusion handling** — ByteTrack low-score association + lost-state
   buffer with recovery.

---

## 5. Limitations — own them out loud

- **Cross-camera fusion (R6) is plate-based for the MVP** — the backend
  links observations by plate; global IDs (`NEXUS_V#####`) in the demo are
  seeded. The Re-ID studio shows **real plate-linked sightings** (no
  invented similarity scores). The visual matcher is a reference baseline,
  NOT a trained Re-ID model. **Never claim seeded IDs as Re-ID output.**
- **Vehicle detector is COCO YOLOv11n** (decision D1) — no autorickshaw
  class; fine-tuning on the Indian Road subset is future work. The plate
  detector IS custom-trained.
- **Analytics/alerts are client-side** (decision D4) — computed in the
  browser from live API data; the Python `analytics/` modules are the
  reference layer. Alert ack/resolve persists in the browser only.
- **Dev-scale data** — 8-camera corridor demo, ~86 observations; no
  production-scale or multi-city claims.
- **No auth** — documented MVP decision (D12).
- **AI copilot is rule-based**, not an LLM.
- **OCR domain limit** — out-of-domain clips (e.g. YouTube ANPR footage)
  yield 0 plates; the model reports zero rather than hallucinating. Good
  line: "our 99.49% mAP corridor-trained detector refuses to guess."

---

## 6. Expected questions + answers

**Q: What happens when OCR misreads a plate?**
Every observation keeps a `plate_reads` trail: raw OCR text plus per-source
confidences (plate detection vs OCR, kept separate, never blended). The
vehicle's `plate_number_best_guess` is the best read; the trail is the
audit record.

**Q: What if the plate is unreadable?**
Null-plate observations are valid (schema-level). The vehicle is still
detected, tracked, and counted; identity association is where Re-ID would
plug in — that's the documented R6 path.

**Q: Is `track_id` globally unique?**
No — it's per-camera by design and always paired with `camera_id`.
Global identity is `global_vehicle_id` (R6's contract).

**Q: How does the global vehicle ID work today?**
Plate-link at ingest (same plate → same vehicle row, journey across
cameras), plus the `PATCH /observations/{id}/vehicle` hook for a fusion
service. Seeded IDs power the demo; the mechanism is honest.

**Q: Scale?**
Stateless API + pooled DB (10+20) held 200 concurrent POSTs; plate path
~8 ms detect + ~5 ms OCR on RTX 4060; ONNX/TensorRT path exists for edge.
No production-scale claims.

**Q: Privacy?**
Retention policy is future work; no biometric data; plates on public roads
in public CCTV context. Acknowledged as a real concern, not dismissed.

**Q: Why not one big end-to-end model?**
Modularity: the contract lets each module improve independently (e.g. swap
the OCR engine without touching the DB); two-stage detection beats
single-stage full-frame for plate precision; explainability — every
observation carries its per-stage confidences.

**Q: Datasets?**
Indian Road Driving Dataset (R1 context/detection; Delhi NCR, day/night/
rain, GPS-tagged) + Indian Vehicle License Plate Dataset (plate detection/
OCR) — small subsets only, full sets are ~210 GB and gitignored.
**CityFlowV2** (AI City Challenge: 46 cameras, 16 intersections, 880
annotuated cross-camera identities) is the designated R6 validation
dataset — US city, redacted plates, so it validates fusion, not ANPR.

**Q: Detection confidence varies 0.46–0.79 on demo footage while OCR shows
100% — why?**
They're different quantities: detection confidence is the plate-detector's
box score (varies with crop quality), OCR char-probabilities saturate at
1.0 on clean crops. We keep them separate and never blend them into one
number — that's deliberate (decision C3).

---

## 7. Demo fallbacks (if asked to run something live)

| Scenario | Fallback |
|---|---|
| Backend won't start | Restart takes ~2 min (docker → alembic → uvicorn → npm); dashboard degrades gracefully to clearly-labeled simulation meanwhile |
| Live video ingest fails | Seeded data alone carries the whole dashboard story; annotated `runs/tracking/live_ingest_output.mp4` shows the pipeline |
| Upload clip finds 0 plates | Out-of-domain footage reported honestly; switch to `data/test_video.mp4` / `data/clip_b..e.mp4` |
| Full demo fails | Backup walkthrough recording (recorded from `docs/demo_walkthrough_script.md`) |

---

## 8. Numbers you should know cold

- Plate detector: **99.49% mAP@50**, 72.91% mAP@50-95, 2.6M params, ~8 ms
  (PT) / ~6 ms (ONNX) on RTX 4060
- Backend tests: **165 passing** (161 + 4 video-upload) as of 2026-09-12
- Load: 200 concurrent POSTs OK; duplicate-ingest race ×50 OK
- Stack: 8 demo cameras, Mumbai–Pune corridor; dashboard polls every 12 s;
  observations page_size 200 (backend clamp)
- Footage: CPU ~2 FPS on demo footage; models load in ~15 s
